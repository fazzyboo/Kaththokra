import "server-only";
import { createHash } from "node:crypto";
import { UPAZILAS } from "@/lib/data";
import type { CropId } from "@/lib/types";
import { col } from "../db/collections";
import { getEnv } from "../env";
import { log } from "../lib/log";
import { maskMsisdn } from "../lib/msisdn";
import { hitRateLimit } from "../lib/ratelimit";
import { prescriptionSms, sendSms } from "./messaging";
import { getSettings } from "./settings";
import { stopSubscription, subscribeBySms } from "./subscription";

/*
  Inbound SMS keywords (BACKEND_PLAN.md §6). Case-insensitive, extra spaces ignored.
    PD ALERT <DHAN|ALU|TOMATO> <upazila num>  → Applink subscribe (action 1) + mirror
    PD STOP                                   → unsubscribe
    PD HELP                                   → help SMS
    PD-123456 / 123456                        → free re-send if the prescription is the sender's
    anything else                             → help SMS
*/

/** msisdn is null when the sender isn't a Banglalink number we can parse. */
export type SmsMoPayload = { msisdn: string | null; message: string; requestId: string };

const CROP_WORD: Record<string, CropId> = { DHAN: "rice", ALU: "potato", TOMATO: "tomato" };

export type SmsMoAction =
  | { kind: "alert"; crop: CropId; upazila: string }
  | { kind: "alert_bad_upazila"; num: string }
  | { kind: "stop" }
  | { kind: "help" }
  | { kind: "resend"; ref: string }
  | { kind: "unknown" };

export function parseKeyword(raw: string): SmsMoAction {
  const msg = raw.trim().replace(/\s+/g, " ").toUpperCase();
  let m = msg.match(/^PD ALERT (DHAN|ALU|TOMATO) (\d{1,4})$/);
  if (m) {
    const u = UPAZILAS.find((x) => x.num === m![2]);
    return u ? { kind: "alert", crop: CROP_WORD[m[1]], upazila: u.code } : { kind: "alert_bad_upazila", num: m[2] };
  }
  if (/^PD STOP$/.test(msg)) return { kind: "stop" };
  if (/^PD HELP$/.test(msg)) return { kind: "help" };
  m = msg.match(/^(?:PD ?-? ?)?(\d{6})$/);
  if (m) return { kind: "resend", ref: `PD-${m[1]}` };
  return { kind: "unknown" };
}

async function helpText(): Promise<string> {
  const { helpline } = await getSettings();
  const url = getEnv().NEXT_PUBLIC_APP_URL;
  return `Kaththokra: patar chobi tule rog chinun ${url} . Alert: PD ALERT DHAN <upazila no>. Bondho: PD STOP. Prescription abar: PD-xxxxxx. Help ${helpline}.`;
}

/** Replies are capped per number so a misbehaving phone or loop can't run up SMS costs. */
async function reply(msisdn: string, text: string, template: string, ref?: string) {
  const key = createHash("sha256").update(msisdn).digest("hex").slice(0, 20);
  const r = await hitRateLimit(`mo-reply:${key}`, 6, 60 * 60);
  if (!r.ok) {
    log.warn("smsmo.reply_capped", { msisdn: maskMsisdn(msisdn), template });
    return;
  }
  await sendSms(msisdn, text, template, ref ? { ref } : {});
}

export async function handleSmsMo(payload: SmsMoPayload): Promise<SmsMoAction["kind"] | "ignored"> {
  if (!payload.msisdn) {
    log.warn("smsmo.no_sender", { requestId: payload.requestId });
    return "ignored";
  }
  const p = { ...payload, msisdn: payload.msisdn };
  const action = parseKeyword(p.message);
  log.info("smsmo.received", { msisdn: maskMsisdn(p.msisdn), action: action.kind });

  switch (action.kind) {
    case "alert": {
      const status = await subscribeBySms(p.msisdn, action.crop, action.upazila);
      await reply(
        p.msisdn,
        status === "REGISTERED"
          ? "Kaththokra: alert chalu ache. Notun fosol/upazila jog kora holo. Bondho korte PD STOP."
          : "Kaththokra: alert onurodh pawa geche. Nishchit hole SMS pathano hobe. Bondho korte PD STOP.",
        "mo-alert-ack",
      );
      return action.kind;
    }
    case "stop": {
      try {
        await stopSubscription(p.msisdn);
        await reply(p.msisdn, "Kaththokra: alert bondho kora holo. Abar chalu korte PD ALERT DHAN <upazila no>.", "mo-stop");
      } catch (err) {
        log.warn("smsmo.stop_failed", { msisdn: maskMsisdn(p.msisdn), err: (err as Error).message });
        await reply(p.msisdn, "Kaththokra: ekhon bondho kora jayni. Kichukkhon por abar PD STOP pathan.", "mo-stop-failed");
      }
      return action.kind;
    }
    case "resend": {
      const prescriptions = await col("prescriptions");
      const rx = await prescriptions.findOne({ _id: action.ref });
      if (!rx || rx.msisdn !== p.msisdn) {
        await reply(p.msisdn, `Kaththokra: ${action.ref} apnar number-e paoa jayni. Help ${(await getSettings()).helpline}.`, "mo-resend-notfound");
        return action.kind;
      }
      const lim = await hitRateLimit(`resend:${rx._id}`, 3, 24 * 60 * 60); // shared with the app's resend button
      if (!lim.ok) {
        log.info("smsmo.resend_capped", { ref: rx._id });
        return action.kind;
      }
      const text = prescriptionSms({ ref: rx._id, crop: rx.crop, amount: rx.amount, banglish: rx.disease.banglish, treatment: rx.treatment });
      await sendSms(rx.msisdn, text, "prescription-resend", { ref: rx._id });
      return action.kind;
    }
    case "alert_bad_upazila":
    case "help":
    case "unknown":
    default:
      await reply(p.msisdn, await helpText(), action.kind === "help" ? "mo-help" : "mo-help-fallback");
      return action.kind;
  }
}

// ---------------------------------------------------------------- delivery reports

export type DlrPayload = { requestId: string; deliveryStatus: string };

export function dlrOutcome(status: string): "DELIVERED" | "UNDELIVERABLE" | null {
  const s = status.toUpperCase();
  if (/^(DELIVRD|DELIVERED|SUCCESS|S1000)$/.test(s)) return "DELIVERED";
  if (/UNDELIV|FAIL|EXPIRED|REJECT|UNKNOWN|DELETED/.test(s)) return "UNDELIVERABLE";
  return null;
}

export async function handleDlr(p: DlrPayload): Promise<void> {
  const smsLog = await col("smsLog");
  const row = await smsLog.findOneAndUpdate(
    { _id: p.requestId },
    { $set: { dlrStatus: p.deliveryStatus, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!row) {
    log.warn("dlr.unknown_request", { requestId: p.requestId });
    return;
  }
  const outcome = dlrOutcome(p.deliveryStatus);
  if (!row.ref || !outcome) return;
  const prescriptions = await col("prescriptions");
  // Never downgrade: a failed re-send must not hide that the first SMS arrived.
  await prescriptions.updateOne({ _id: row.ref, sms: { $ne: "DELIVERED" } }, { $set: { sms: outcome } });
}
