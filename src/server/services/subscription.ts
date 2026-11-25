import "server-only";
import { createHash } from "node:crypto";
import { UPAZILAS } from "@/lib/data";
import type { Subscription } from "@/lib/session";
import type { CropId } from "@/lib/types";
import { applink } from "../applink/client";
import { bodies } from "../applink/bodies";
import { APPLINK, ApplinkError } from "../applink/errors";
import { createSession } from "../auth/session";
import { col } from "../db/collections";
import type { SubscriptionDoc } from "../db/types";
import { getEnv } from "../env";
import { badRequest } from "../http/errors";
import { log } from "../lib/log";
import { maskMsisdn } from "../lib/msisdn";
import type { Scenario } from "../lib/scenario";
import { requestOtp, verifyOtp } from "./identity";
import { sendSms } from "./messaging";
import { getSettings } from "./settings";

/*
  Outbreak-alert subscription (Applink Subscription API, BACKEND_PLAN.md §6).
  `subscriptions` is a mirror of Applink's state keyed by msisdn; Applink's notification
  callback is the source of truth for status.
*/

const UPAZILA_CODES = new Set(UPAZILAS.map((u) => u.code));

export function toSubscription(d: SubscriptionDoc): Subscription {
  return { status: d.status, crops: d.crops, upazila: d.upazila, since: d.since.toISOString() };
}

export async function getSubscription(msisdn: string): Promise<Subscription | null> {
  const subscriptions = await col("subscriptions");
  const d = await subscriptions.findOne({ _id: msisdn });
  return d ? toSubscription(d) : null;
}

function checkChoice(crops: CropId[], upazila: string) {
  if (!crops.length) throw badRequest("Pick at least one crop");
  if (!UPAZILA_CODES.has(upazila)) throw badRequest("Unknown upazila");
}

// ---------------------------------------------------------------- web flow

export async function startSubscription(
  input: { crops: CropId[]; upazila: string; msisdn: string },
  opts: { ip: string; scenario: Scenario | null },
): Promise<{ requestId: string }> {
  const crops = [...new Set(input.crops)];
  checkChoice(crops, input.upazila);
  return requestOtp(input.msisdn, "subscribe", { payload: { crops, upazila: input.upazila }, ip: opts.ip, scenario: opts.scenario });
}

/** OTP verified → REGISTERED mirror + farmer session (the number is proven). */
export async function verifySubscription(requestId: string, code: string, scenario: Scenario | null): Promise<Subscription> {
  const { user, request } = await verifyOtp(requestId, code, "subscribe", scenario);
  const payload = (request.payload ?? {}) as { crops?: CropId[]; upazila?: string };
  const crops = payload.crops ?? [];
  const upazila = payload.upazila ?? "";

  const subscriptions = await col("subscriptions");
  const now = new Date();
  const prev = await subscriptions.findOne({ _id: user.msisdn });
  const doc = await subscriptions.findOneAndUpdate(
    { _id: user.msisdn },
    {
      $set: {
        status: "REGISTERED",
        crops,
        upazila,
        source: "web",
        // A re-subscribe after stopping starts a new "since".
        ...(prev?.status === "REGISTERED" ? {} : { since: now }),
        updatedAt: now,
      },
      $setOnInsert: { frequency: "on_outbreak" },
    },
    { upsert: true, returnDocument: "after" },
  );
  await createSession("farmer", user._id);
  await welcomeOnce(user.msisdn);
  log.info("subscription.registered", { msisdn: maskMsisdn(user.msisdn), source: "web" });
  return toSubscription(doc!);
}

/** Unsubscribe at Applink, then mirror UNREGISTERED. */
export async function stopSubscription(msisdn: string): Promise<{ ok: true }> {
  const subscriptions = await col("subscriptions");
  try {
    await applink("subscription/send", bodies.subscriptionSend(msisdn, "0"));
  } catch (err) {
    // Transport problems and IP blocks: the user is still subscribed at Applink, so say so.
    if (!(err instanceof ApplinkError) || err.isTransport || err.code === APPLINK.IP_NOT_ALLOWED) throw err;
    // Other E-codes (e.g. "not subscribed"): nothing to undo at Applink.
    log.info("subscription.stop_applink_code", { msisdn: maskMsisdn(msisdn), errorCode: err.code });
  }
  await subscriptions.updateOne({ _id: msisdn }, { $set: { status: "UNREGISTERED", updatedAt: new Date() } });
  log.info("subscription.unregistered", { msisdn: maskMsisdn(msisdn) });
  return { ok: true };
}

// ---------------------------------------------------------------- SMS keyword (PD ALERT)

/** "PD ALERT <crop> <upazila>" from the subscriber's own phone: the number is proven by the MO. */
export async function subscribeBySms(
  msisdn: string,
  crop: CropId,
  upazila: string,
  source: "sms" | "ussd" = "sms",
): Promise<SubscriptionDoc["status"]> {
  checkChoice([crop], upazila);
  const subscriptions = await col("subscriptions");
  const now = new Date();

  let applinkStatus: string | undefined;
  try {
    const res = await applink("subscription/send", bodies.subscriptionSend(msisdn, "1"));
    applinkStatus = res.subscriptionStatus;
  } catch (err) {
    log.warn("subscription.sms_subscribe_failed", { msisdn: maskMsisdn(msisdn), errorCode: err instanceof ApplinkError ? err.code : "INTERNAL" });
  }
  const status: SubscriptionDoc["status"] = applinkStatus === "REGISTERED" ? "REGISTERED" : "PENDING_OTP";

  const prev = await subscriptions.findOne({ _id: msisdn });
  const finalStatus = prev?.status === "REGISTERED" ? "REGISTERED" : status;
  await subscriptions.updateOne(
    { _id: msisdn },
    {
      $addToSet: { crops: crop },
      $set: {
        upazila,
        status: finalStatus,
        ...(prev?.status === "REGISTERED" ? {} : { source, since: now }),
        updatedAt: now,
      },
      $setOnInsert: { frequency: "on_outbreak" as const },
    },
    { upsert: true },
  );
  if (finalStatus === "REGISTERED") await welcomeOnce(msisdn);
  log.info("subscription.sms_alert", { msisdn: maskMsisdn(msisdn), status: finalStatus, source });
  return finalStatus;
}

// ---------------------------------------------------------------- Applink notification

export type SubscriptionNotifyPayload = {
  msisdn: string | null;
  status: string;
  frequency?: string;
  timeStamp?: string;
};

/** Constant-time check of the notification's `password` against APPLINK_PASSWORD. */
export function subscriptionPasswordOk(given: unknown): boolean {
  const env = getEnv();
  // Mock mode without credentials: accept the fixed dev password "dev".
  const expected = env.APPLINK_PASSWORD ?? (env.APPLINK_MODE === "mock" ? "dev" : undefined);
  if (!expected || typeof given !== "string") return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return a.equals(b);
}

export function mirrorStatus(s: string): SubscriptionDoc["status"] {
  const up = s.toUpperCase();
  if (up === "REGISTERED") return "REGISTERED";
  if (/UNREG|BLOCK|DELETE|INACTIVE|CANCEL/.test(up)) return "UNREGISTERED";
  return "PENDING_OTP";
}

export async function applySubscriptionNotification(p: SubscriptionNotifyPayload): Promise<void> {
  if (!p.msisdn) {
    log.warn("subscription.notify_no_msisdn", { status: p.status });
    return;
  }
  const subscriptions = await col("subscriptions");
  const prev = await subscriptions.findOne({ _id: p.msisdn });
  if (prev?.lastStatusTs && p.timeStamp && p.timeStamp.length === prev.lastStatusTs.length && p.timeStamp < prev.lastStatusTs) {
    log.info("subscription.notify_stale", { msisdn: maskMsisdn(p.msisdn), status: p.status });
    return;
  }
  const status = mirrorStatus(p.status);
  const now = new Date();
  await subscriptions.updateOne(
    { _id: p.msisdn },
    {
      $set: {
        status,
        ...(p.frequency ? { billingFrequency: p.frequency } : {}),
        ...(p.timeStamp ? { lastStatusTs: p.timeStamp } : {}),
        ...(status === "REGISTERED" && prev?.status !== "REGISTERED" ? { since: now } : {}),
        updatedAt: now,
      },
      // Subscribed outside our app (e.g. Applink's own channel): crops/upazila unknown yet.
      $setOnInsert: { crops: [], upazila: "", frequency: "on_outbreak" as const, source: "sms" as const, ...(status === "REGISTERED" ? {} : { since: now }) },
    },
    { upsert: true },
  );
  if (status === "REGISTERED") await welcomeOnce(p.msisdn);
  log.info("subscription.notify_applied", { msisdn: maskMsisdn(p.msisdn), status });
}

// ---------------------------------------------------------------- welcome SMS

/** Sends the welcome SMS once per number, ever (claimed atomically via welcomedAt). */
export async function welcomeOnce(msisdn: string): Promise<boolean> {
  const subscriptions = await col("subscriptions");
  const claimed = await subscriptions.findOneAndUpdate(
    { _id: msisdn, welcomedAt: { $exists: false } },
    { $set: { welcomedAt: new Date() } },
  );
  if (!claimed) return false;
  const { helpline } = await getSettings();
  await sendSms(
    msisdn,
    `Kaththokra alert chalu holo. Apnar elakay fosoler rog dekha dile SMS pathano hobe. Bondho korte PD STOP likhe pathan. Help ${helpline}.`,
    "sub-welcome",
  );
  return true;
}
