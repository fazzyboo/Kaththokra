import "server-only";
import type { SubRow } from "@/lib/admin-data";
import { applink } from "../applink/client";
import { bodies } from "../applink/bodies";
import { ApplinkError } from "../applink/errors";
import type { AdminAuth } from "../auth/session";
import { cols } from "../db/collections";
import type { SubscriptionDoc } from "../db/types";
import { log } from "../lib/log";
import { maskMsisdn } from "../lib/msisdn";
import { audit } from "./audit";
import { mirrorStatus } from "./subscription";

/*
  Subscription mirror for admins (SubRow) and reconcile against Applink
  (getSubscriberChargingInfo, batches of 10). Also used by the daily reconcile job (B11).
*/

const RECONCILED_WITHIN_MS = 36 * 60 * 60 * 1000; // a daily job + slack

function toSubRow(s: SubscriptionDoc, now: number): SubRow {
  return {
    msisdn: maskMsisdn(s._id),
    crops: s.crops,
    upazila: s.upazila,
    status: s.status,
    source: s.source === "ussd" ? "ussd" : s.source === "sms" ? "sms" : "web",
    ...(s.lastChargedAt ? { lastCharge: s.lastChargedAt } : {}),
    reconciled: !!s.lastReconciledAt && now - s.lastReconciledAt.getTime() < RECONCILED_WITHIN_MS,
  };
}

export async function listSubscribers(): Promise<SubRow[]> {
  const { subscriptions } = await cols();
  const rows = await subscriptions.find().sort({ updatedAt: -1, since: -1 }).limit(500).toArray();
  const now = Date.now();
  return rows.map((s) => toSubRow(s, now));
}

export type ReconcileResult = { checked: number; changed: number; failed: number };

/** Numbers reconcile looks at; with staleBefore, only those not reconciled since then (the daily job). */
export function reconcileFilter(staleBefore?: Date) {
  return {
    status: { $in: ["REGISTERED", "PENDING_OTP"] as SubscriptionDoc["status"][] },
    ...(staleBefore ? { $or: [{ lastReconciledAt: { $exists: false } }, { lastReconciledAt: { $lt: staleBefore } }] } : {}),
  };
}

/**
 * Ask Applink for each REGISTERED / PENDING_OTP number (oldest reconcile first), 10 at a time.
 * UNREGISTERED numbers are left alone: we never re-subscribe someone from a mirror check.
 */
export async function reconcileSubscribers(limit = 500, actor?: AdminAuth, opts: { staleBefore?: Date } = {}): Promise<ReconcileResult> {
  const { subscriptions } = await cols();
  const subs = await subscriptions
    .find(reconcileFilter(opts.staleBefore))
    .sort({ lastReconciledAt: 1 })
    .limit(limit)
    .toArray();

  const result: ReconcileResult = { checked: 0, changed: 0, failed: 0 };
  for (let i = 0; i < subs.length; i += 10) {
    const batch = subs.slice(i, i + 10);
    await Promise.all(
      batch.map(async (s) => {
        try {
          const res = await applink("subscription/getSubscriberChargingInfo", bodies.chargingInfo(s._id));
          const status = res.subscriptionStatus ? mirrorStatus(res.subscriptionStatus) : s.status;
          const now = new Date();
          await subscriptions.updateOne(
            { _id: s._id },
            {
              $set: {
                status,
                lastReconciledAt: now,
                ...(res.lastChargedDate ? { lastChargedAt: res.lastChargedDate } : {}),
                ...(status !== s.status ? { updatedAt: now } : {}),
              },
            },
          );
          result.checked++;
          if (status !== s.status) result.changed++;
        } catch (err) {
          result.failed++;
          log.warn("subscription.reconcile_failed", { msisdn: maskMsisdn(s._id), errorCode: err instanceof ApplinkError ? err.code : "INTERNAL" });
        }
      }),
    );
  }
  if (actor) await audit(actor.admin._id, "subscribers.reconcile", "subscription", "*", { ...result });
  log.info("subscription.reconciled", { ...result });
  return result;
}

