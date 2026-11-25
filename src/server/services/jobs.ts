import "server-only";
import { cols } from "../db/collections";
import type { AlertDoc, AlertDeliveryDoc } from "../db/types";
import { log } from "../lib/log";
import { maskMsisdn } from "../lib/msisdn";
import { dhakaHour } from "../lib/time";
import { reconcileFilter, reconcileSubscribers } from "./admin-subscribers";
import { processCallback } from "./inbox";
import { MAX_SMS_RETRIES, retrySms, sendSms } from "./messaging";

/*
  Scheduled jobs (BACKEND_PLAN.md §9). Each run handles at most JOB_BATCH items, is safe to
  re-run at any time (every write is conditional on the state it moves from), and reports
  { processed, remaining } so a caller can see whether another run is needed.
*/

export const JOB_BATCH = 50;
const MIN = 60 * 1000;

export type JobResult = { processed: number; remaining: number } & Record<string, unknown>;

// ---------------------------------------------------------------- expire-payments

const VERIFYING_ATTENTION_MS = 15 * MIN;

/** OTP_SENT past otpExpiresAt → EXPIRED. VERIFYING > 15 min without a notification → needsAttentionAt. */
export async function expirePayments(now = new Date()): Promise<JobResult> {
  const { payments } = await cols();
  const expireQ = { status: "OTP_SENT" as const, otpExpiresAt: { $lte: now } };
  const stuckBefore = new Date(now.getTime() - VERIFYING_ATTENTION_MS);
  const flagQ = { status: "VERIFYING" as const, verifiedAt: { $lte: stuckBefore }, needsAttentionAt: { $exists: false } };

  const toExpire = await payments.find(expireQ, { projection: { _id: 1 } }).sort({ otpExpiresAt: 1 }).limit(JOB_BATCH).toArray();
  let expired = 0;
  if (toExpire.length) {
    const r = await payments.updateMany({ _id: { $in: toExpire.map((p) => p._id) }, ...expireQ }, { $set: { status: "EXPIRED", updatedAt: now } });
    expired = r.modifiedCount;
  }

  const room = JOB_BATCH - toExpire.length;
  let flagged = 0;
  if (room > 0) {
    const toFlag = await payments.find(flagQ, { projection: { _id: 1 } }).sort({ verifiedAt: 1 }).limit(room).toArray();
    if (toFlag.length) {
      const r = await payments.updateMany({ _id: { $in: toFlag.map((p) => p._id) }, ...flagQ }, { $set: { needsAttentionAt: now, updatedAt: now } });
      flagged = r.modifiedCount;
      log.warn("payment.needs_attention", { count: flagged, ids: toFlag.map((p) => p._id) });
    }
  }

  const remaining = (await payments.countDocuments(expireQ)) + (await payments.countDocuments(flagQ));
  return { processed: expired + flagged, remaining, expired, flagged };
}

// ---------------------------------------------------------------- sms-retry

export async function retryFailedSms(now = new Date()): Promise<JobResult> {
  const { smsLog } = await cols();
  const dueQ = { status: "FAILED" as const, retries: { $lt: MAX_SMS_RETRIES }, nextRetryAt: { $lte: now } };
  const due = await smsLog.find(dueQ, { projection: { _id: 1 } }).sort({ nextRetryAt: 1 }).limit(JOB_BATCH).toArray();
  const counts = { sent: 0, failed: 0, gaveUp: 0 };
  let processed = 0;
  for (const row of due) {
    const r = await retrySms(row._id);
    if (!r) continue; // claimed by another run, or no longer due
    processed++;
    if (r === "sent") counts.sent++;
    else if (r === "failed") counts.failed++;
    else counts.gaveUp++;
  }
  const remaining = await smsLog.countDocuments({ ...dueQ, nextRetryAt: { $lte: new Date() } });
  return { processed, remaining, ...counts };
}

// ---------------------------------------------------------------- send-alerts

export const ALERT_WINDOW = { fromHour: 7, toHour: 9 }; // Asia/Dhaka, [07:00, 09:00)
export const MAX_ALERTS_PER_CROP_PER_WEEK = 2;
const WEEK_MS = 7 * 24 * 60 * MIN;
const ALERT_LEASE_MS = 3 * MIN;

export function inAlertWindow(now = new Date()): boolean {
  const h = dhakaHour(now);
  return h >= ALERT_WINDOW.fromHour && h < ALERT_WINDOW.toHour;
}

function recipientQuery(a: AlertDoc, done: string[]) {
  return { status: "REGISTERED" as const, crops: a.crop, upazila: { $in: a.upazilas }, ...(done.length ? { _id: { $nin: done } } : {}) };
}

/**
 * Fan out due "scheduled" alerts (sendAt ≤ now) to REGISTERED subscribers of that crop + upazila.
 * Each recipient gets an alertDeliveries row BEFORE its SMS (unique per alert + number), so a
 * crashed or overlapping run never double-sends and the next run resumes where this one stopped.
 * Someone who already had 2 alerts for that crop in the last 7 days is recorded as "capped".
 * Only sends 07:00–09:00 Dhaka; `force` (non-production only) skips that check for testing.
 */
export async function sendDueAlerts(now = new Date(), opts: { force?: boolean } = {}): Promise<JobResult> {
  const { alerts, alertDeliveries, subscriptions, users } = await cols();
  const dueQ = { status: "scheduled" as const, sendAt: { $lte: now } };

  if (!opts.force && !inAlertWindow(now)) {
    const due = await alerts.countDocuments(dueQ);
    return { processed: 0, remaining: due, skipped: "outside 07:00-09:00 Asia/Dhaka" };
  }

  let budget = JOB_BATCH;
  const counts = { sent: 0, failed: 0, capped: 0, alertsCompleted: 0 };
  const due = await alerts.find(dueQ).sort({ sendAt: 1 }).limit(20).toArray();

  for (const a0 of due) {
    if (budget <= 0) break;
    // Lease the alert so a parallel run skips it.
    const a = await alerts.findOneAndUpdate(
      { _id: a0._id, status: "scheduled", $or: [{ lockUntil: { $exists: false } }, { lockUntil: { $lt: now } }] },
      { $set: { lockUntil: new Date(now.getTime() + ALERT_LEASE_MS) } },
      { returnDocument: "after" },
    );
    if (!a) continue;

    const done = await alertDeliveries.distinct("msisdn", { alertId: a._id });
    const batch = await subscriptions.find(recipientQuery(a, done), { projection: { _id: 1 } }).limit(budget).toArray();
    const langs = new Map(
      (await users.find({ msisdn: { $in: batch.map((s) => s._id) } }, { projection: { msisdn: 1, lang: 1 } }).toArray()).map((u) => [u.msisdn, u.lang]),
    );

    for (const s of batch) {
      budget--;
      const msisdn = s._id;
      // "failed" counts too: the sms-retry job will most likely still deliver it.
      const recent = await alertDeliveries.countDocuments({ msisdn, crop: a.crop, outcome: { $in: ["sent", "failed"] }, at: { $gte: new Date(now.getTime() - WEEK_MS) } });
      const capped = recent >= MAX_ALERTS_PER_CROP_PER_WEEK;
      const row: AlertDeliveryDoc = { _id: `${a._id}:${msisdn}`, alertId: a._id, msisdn, crop: a.crop, outcome: capped ? "capped" : "failed", at: new Date() };
      try {
        await alertDeliveries.insertOne(row); // the claim: a second run gets E11000 and skips
      } catch (err) {
        if ((err as { code?: unknown }).code === 11000) continue;
        throw err;
      }
      if (capped) {
        counts.capped++;
        continue;
      }
      const text = langs.get(msisdn) === "en" ? a.message.en : a.message.bn;
      const res = await sendSms(msisdn, text, "alert", { ref: a._id });
      // A failed send stays "failed" here; the sms-retry job resends the smsLog row.
      await alertDeliveries.updateOne({ _id: row._id }, { $set: { outcome: res.ok ? "sent" : "failed", smsLogId: res.smsLogId } });
      if (res.ok) {
        counts.sent++;
        await subscriptions.updateOne({ _id: msisdn }, { $set: { lastNotifyAt: new Date() } });
      } else {
        counts.failed++;
        log.warn("alert.send_failed", { alertId: a._id, msisdn: maskMsisdn(msisdn) });
      }
    }

    const left = await subscriptions.countDocuments(recipientQuery(a, await alertDeliveries.distinct("msisdn", { alertId: a._id })));
    if (left === 0) {
      // "delivered" counts sends Applink accepted plus failures still queued for retry.
      const delivered = await alertDeliveries.countDocuments({ alertId: a._id, outcome: { $in: ["sent", "failed"] } });
      await alerts.updateOne({ _id: a._id, status: "scheduled" }, { $set: { status: "sent", sentAt: new Date(), delivered }, $unset: { lockUntil: "" } });
      counts.alertsCompleted++;
      log.info("alert.sent", { alertId: a._id, delivered });
    } else {
      await alerts.updateOne({ _id: a._id }, { $unset: { lockUntil: "" } });
    }
  }

  // Remaining = recipients not yet handled across the alerts still due. A due alert with
  // nobody left (not reached this run) counts as 1: the next run only has to close it.
  let remaining = 0;
  for (const a of await alerts.find(dueQ).toArray()) {
    const left = await subscriptions.countDocuments(recipientQuery(a, await alertDeliveries.distinct("msisdn", { alertId: a._id })));
    remaining += Math.max(left, 1);
  }
  return { processed: counts.sent + counts.failed + counts.capped, remaining, ...counts };
}

// ---------------------------------------------------------------- process-inbox

const INBOX_MIN_AGE_MS = 1 * MIN;
const INBOX_MAX_ATTEMPTS = 5;

/** Safety net: callbackInbox rows older than 1 min that were never processed (max 5 attempts each). */
export async function processInbox(now = new Date()): Promise<JobResult> {
  const { callbackInbox } = await cols();
  const q = {
    processedAt: { $exists: false },
    receivedAt: { $lte: new Date(now.getTime() - INBOX_MIN_AGE_MS) },
    $or: [{ attempts: { $exists: false } }, { attempts: { $lt: INBOX_MAX_ATTEMPTS } }],
  };
  const rows = await callbackInbox.find(q).sort({ receivedAt: 1 }).limit(JOB_BATCH).toArray();
  let ok = 0;
  let failed = 0;
  for (const row of rows) {
    // Processors are idempotent (settle is transactional, SMS sends are claimed), so a
    // row whose after() is still running can safely be run here too.
    if (await processCallback(row)) ok++;
    else failed++;
  }
  const remaining = await callbackInbox.countDocuments(q);
  return { processed: rows.length, remaining, ok, failed };
}

// ---------------------------------------------------------------- reconcile

const RECONCILE_EVERY_MS = 24 * 60 * MIN;

/** getSubscriberChargingInfo for numbers not reconciled in 24 h, 10 at a time, max 50 per run. */
export async function reconcileJob(now = new Date()): Promise<JobResult> {
  const { subscriptions } = await cols();
  const staleBefore = new Date(now.getTime() - RECONCILE_EVERY_MS);
  const r = await reconcileSubscribers(JOB_BATCH, undefined, { staleBefore });
  const remaining = await subscriptions.countDocuments(reconcileFilter(staleBefore));
  return { processed: r.checked + r.failed, remaining, ...r };
}
