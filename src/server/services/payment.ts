import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { ClientSession } from "mongodb";
import { applink } from "../applink/client";
import { bodies } from "../applink/bodies";
import { APPLINK, ApplinkError } from "../applink/errors";
import type { ChargingNotification } from "../applink/types";
import { getMongoClient } from "../db/client";
import { col, cols } from "../db/collections";
import type { PaymentDoc, PrescriptionDoc } from "../db/types";
import { AppError, badRequest, conflict, notFound } from "../http/errors";
import { newPaymentId, newPrescriptionRef, retryOnDuplicate } from "../lib/ids";
import { log } from "../lib/log";
import { maskMsisdn, normalizeMsisdn } from "../lib/msisdn";
import { enforceRateLimit } from "../lib/ratelimit";
import type { Scenario } from "../lib/scenario";
import { prescriptionSms, sendSms } from "./messaging";
import { recordCommission } from "./dealer";
import { getSettings } from "./settings";

/*
  CaaS payment (BACKEND_PLAN.md §6, §7). Money rules:
  - Nothing is PAID until the charging notification (S1000) arrives. OTP S1000 only → VERIFYING.
  - A debit is never retried automatically.
  - One charge → one prescription → one SMS, even with duplicate notifications:
    settle() runs in a transaction keyed on the payment, and only the process that
    claims prescription.smsClaimedAt sends the SMS.
*/

export const OTP_WINDOW_MS = 5 * 60 * 1000;
export const MAX_PAY_OTP_ATTEMPTS = 3;

const numberKey = (msisdn: string) => createHash("sha256").update(msisdn).digest("hex").slice(0, 20);
const isHealthyCode = (code: string) => code.endsWith("_HEALTHY");

export type PayActor = { userId?: string; dealerId?: string };

// ---------------------------------------------------------------- initiate

export async function initiatePayment(
  diagnosisId: string,
  rawMsisdn: string,
  opts: PayActor & { scenario: Scenario | null },
): Promise<{ paymentId: string; otpExpiresAt: string }> {
  const msisdn = normalizeMsisdn(rawMsisdn);
  if (!msisdn) throw badRequest("Enter a Banglalink number (019 or 014)");
  await enforceRateLimit(`pay:n:${numberKey(msisdn)}`, 5, 10 * 60);

  const { diagnoses, payments, kbDiseases } = await cols();
  const d = await diagnoses.findOne({ _id: diagnosisId });
  if (!d) throw notFound("Diagnosis not found");
  // Owned diagnoses: only their farmer or their dealer may pay. Dealer attribution only for
  // the dealer's own diagnoses (no commission on someone else's result).
  const isDealersOwn = !!opts.dealerId && d.dealerId === opts.dealerId;
  if (d.dealerId && !isDealersOwn && !(d.userId && d.userId === opts.userId)) throw notFound("Diagnosis not found");
  if (!d.dealerId && d.userId && d.userId !== opts.userId) throw notFound("Diagnosis not found");
  const dealerId = isDealersOwn ? opts.dealerId : undefined;

  const top = d.top3[0];
  const notPayable = (why: string) => new AppError("NOT_PAYABLE", why, 409, { status: d.status });
  if (d.status === "UNLOCKED" || d.prescriptionRef) throw notPayable("Already paid");
  if (d.status !== "CONFIDENT" || !top) throw notPayable("Only confident results can be paid for");
  if (isHealthyCode(top.code)) throw notPayable("Healthy plants need no prescription");
  const kb = await kbDiseases.findOne({ _id: top.code, kbStatus: "published" });
  if (!kb || kb.healthy) throw notPayable("No approved prescription for this disease yet");

  // A payment already being verified or paid may still settle: never start a second debit.
  const inFlight = await payments.findOne({ diagnosisId, status: { $in: ["VERIFYING", "PAID", "FULFILLED", "DELIVERED"] } });
  if (inFlight) throw notPayable("A payment for this result is already in progress");
  // Abandon older OTP_SENT attempts for this diagnosis.
  await payments.updateMany({ diagnosisId, status: { $in: ["CREATED", "OTP_SENT"] } }, { $set: { status: "EXPIRED", updatedAt: new Date() } });

  const settings = await getSettings();
  const now = new Date();
  const channel = dealerId ? "dealer" : d.channel === "ussd" ? "ussd" : "web";
  const { id: paymentId } = await retryOnDuplicate(newPaymentId, async (id) => {
    const p: PaymentDoc = {
      _id: id,
      diagnosisId,
      msisdn,
      amount: settings.priceRx,
      status: "CREATED",
      externalTrxId: randomUUID(),
      otpAttempts: 0,
      ...(dealerId ? { dealerId } : {}),
      channel,
      createdAt: now,
      updatedAt: now,
    };
    await payments.insertOne(p);
    return p;
  });
  const p = (await payments.findOne({ _id: paymentId }))!;

  try {
    const res = await applink(
      "caas/direct/debit",
      bodies.debit({ externalTrxId: p.externalTrxId, amount: p.amount, msisdn }),
      { app: dealerId ? "dealer" : "farmer", scenario: opts.scenario },
    );
    const otpExpiresAt = new Date(Date.now() + OTP_WINDOW_MS);
    await payments.updateOne(
      { _id: paymentId },
      { $set: { status: "OTP_SENT", requestCorrelator: res.requestCorrelator, internalTrxId: res.internalTrxId, otpExpiresAt, updatedAt: new Date() } },
    );
    log.info("pay.otp_sent", { paymentId, diagnosisId, msisdn: maskMsisdn(msisdn) });
    return { paymentId, otpExpiresAt: otpExpiresAt.toISOString() };
  } catch (err) {
    // No automatic retry. Without the OTP step no money can move, so FAILED is safe.
    const failureCode = err instanceof ApplinkError ? err.code : "INTERNAL";
    await payments.updateOne({ _id: paymentId }, { $set: { status: "FAILED", failureCode, updatedAt: new Date() } });
    log.warn("pay.debit_failed", { paymentId, errorCode: failureCode });
    throw err;
  }
}

// ---------------------------------------------------------------- OTP

const expiredErr = () => new AppError("EXPIRED", "The code has expired. Start the payment again.", 410);
const lockedErr = () => new AppError("LOCKED", "Too many wrong codes. Start the payment again.", 423);

export async function submitPaymentOtp(
  paymentId: string,
  code: string,
  opts: { scenario: Scenario | null },
): Promise<{ result: "accepted" }> {
  const payments = await col("payments");
  const now = new Date();

  // Demo scenario "expired" (mock mode only): the OTP window has already closed.
  if (opts.scenario?.payment === "expired") {
    await payments.updateOne({ _id: paymentId, status: "OTP_SENT" }, { $set: { otpExpiresAt: new Date(now.getTime() - 1000) } });
  }

  // Claim an attempt atomically (parallel guesses can't exceed the limit).
  const p = await payments.findOneAndUpdate(
    { _id: paymentId, status: "OTP_SENT", otpAttempts: { $lt: MAX_PAY_OTP_ATTEMPTS }, otpExpiresAt: { $gt: now } },
    { $inc: { otpAttempts: 1 }, $set: { updatedAt: now } },
    { returnDocument: "after" },
  );
  if (!p) {
    const cur = await payments.findOne({ _id: paymentId });
    if (!cur) throw notFound("Payment not found");
    if (cur.status === "OTP_SENT" && cur.otpExpiresAt && cur.otpExpiresAt <= now) {
      await payments.updateOne({ _id: paymentId, status: "OTP_SENT" }, { $set: { status: "EXPIRED", updatedAt: now } });
      throw expiredErr();
    }
    if (cur.status === "EXPIRED") throw expiredErr();
    if (cur.status === "OTP_SENT") throw lockedErr();
    if (cur.status === "FAILED" && cur.failureCode === APPLINK.LOW_BALANCE) {
      throw new ApplinkError(APPLINK.LOW_BALANCE, "Insufficient balance", "caas/otp/verify");
    }
    throw conflict("This payment is not waiting for a code", { status: cur.status });
  }

  try {
    await applink(
      "caas/otp/verify",
      bodies.caasOtpVerify({ requestCorrelator: p.requestCorrelator!, otp: code, msisdn: p.msisdn }),
      { app: p.channel === "dealer" ? "dealer" : "farmer", scenario: opts.scenario },
    );
  } catch (err) {
    if (!(err instanceof ApplinkError)) throw err;
    if (err.code === APPLINK.LOW_BALANCE) {
      await payments.updateOne({ _id: paymentId, status: "OTP_SENT" }, { $set: { status: "FAILED", failureCode: err.code, updatedAt: new Date() } });
      log.info("pay.low_balance", { paymentId });
      throw err; // → 402
    }
    if (err.code === APPLINK.TRX_EXISTS) {
      // Already charged on Applink's side: the notification will settle it.
      await markVerifying(paymentId);
      return { result: "accepted" };
    }
    if (err.isTransport) {
      // Unknown outcome: the charge may have gone through. Wait for the notification
      // (the expire-payments job flags VERIFYING payments older than 15 min).
      log.warn("pay.verify_unknown", { paymentId, errorCode: err.code });
      await markVerifying(paymentId);
      return { result: "accepted" };
    }
    if (err.code === APPLINK.IP_NOT_ALLOWED) throw err;
    // Other E-codes: wrong code (the real wrong-OTP code is not confirmed yet).
    const attemptsLeft = Math.max(0, MAX_PAY_OTP_ATTEMPTS - p.otpAttempts);
    log.info("pay.wrong_code", { paymentId, applinkCode: err.code, attemptsLeft });
    throw new AppError("WRONG_CODE", "Wrong code", 400, { attemptsLeft });
  }

  await markVerifying(paymentId);
  log.info("pay.verifying", { paymentId });
  return { result: "accepted" };
}

async function markVerifying(paymentId: string) {
  const payments = await col("payments");
  // Only from OTP_SENT: the notification may already have made it PAID.
  await payments.updateOne({ _id: paymentId, status: "OTP_SENT" }, { $set: { status: "VERIFYING", verifiedAt: new Date(), updatedAt: new Date() } });
}

// ---------------------------------------------------------------- status

/**
 * `status` collapses PAID / FULFILLED / DELIVERED to "PAID" (what the payment page polls for);
 * `stage` carries the exact PaymentStatus.
 */
export async function paymentStatus(
  paymentId: string,
): Promise<{ status: PaymentDoc["status"]; stage: PaymentDoc["status"]; prescriptionRef?: string; failureCode?: string }> {
  const payments = await col("payments");
  const p = await payments.findOne({ _id: paymentId });
  if (!p) throw notFound("Payment not found");
  if (p.status === "OTP_SENT" && p.otpExpiresAt && p.otpExpiresAt <= new Date()) {
    await payments.updateOne({ _id: paymentId, status: "OTP_SENT" }, { $set: { status: "EXPIRED", updatedAt: new Date() } });
    return { status: "EXPIRED", stage: "EXPIRED" };
  }
  const paid = p.status === "PAID" || p.status === "FULFILLED" || p.status === "DELIVERED";
  return {
    status: paid ? "PAID" : p.status,
    stage: p.status,
    ...(p.prescriptionRef ? { prescriptionRef: p.prescriptionRef } : {}),
    ...(p.status === "FAILED" && p.failureCode ? { failureCode: p.failureCode } : {}),
  };
}

// ---------------------------------------------------------------- settle

export type SettleResult = { outcome: "settled" | "already" | "failed" | "unknown"; prescriptionRef?: string };

/**
 * Hook for dealer commission (B8). Runs inside the settle transaction, once per payment.
 */
async function onPaymentSettled(p: PaymentDoc, _ref: string, session: ClientSession): Promise<void> {
  await recordCommission(p, session);
}

async function uniquePrescriptionRef(session: ClientSession): Promise<string> {
  const prescriptions = await col("prescriptions");
  for (let i = 0; i < 10; i++) {
    const ref = newPrescriptionRef();
    if (!(await prescriptions.findOne({ _id: ref }, { session, projection: { _id: 1 } }))) return ref;
  }
  throw new Error("Could not allocate a prescription ref");
}

/** Charging notification → PAID + prescription + UNLOCKED diagnosis (one transaction), then SMS. */
export async function settlePayment(n: ChargingNotification): Promise<SettleResult> {
  const { payments, diagnoses, prescriptions, kbDiseases, dealers } = await cols();
  const client = await getMongoClient();

  const first = await payments.findOne({ externalTrxId: n.externalTrxId });
  if (!first) {
    log.error("pay.settle_unknown_trx", { externalTrxId: n.externalTrxId });
    return { outcome: "unknown" };
  }

  if (n.statusCode !== APPLINK.SUCCESS) {
    const r = await payments.updateOne(
      { _id: first._id, status: { $nin: ["PAID", "FULFILLED", "DELIVERED"] } },
      { $set: { status: "FAILED", failureCode: n.statusCode, updatedAt: new Date() } },
    );
    log.warn("pay.notification_failed", { paymentId: first._id, statusCode: n.statusCode, changed: r.modifiedCount });
    return { outcome: "failed" };
  }

  let result: SettleResult = { outcome: "already" };
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      const p = await payments.findOne({ _id: first._id }, { session });
      if (!p) throw new Error("payment vanished");
      if (p.status === "PAID" || p.status === "FULFILLED" || p.status === "DELIVERED") {
        result = { outcome: "already", prescriptionRef: p.prescriptionRef };
        return;
      }
      const d = await diagnoses.findOne({ _id: p.diagnosisId }, { session });
      if (!d || !d.top3[0]) throw new Error(`diagnosis ${p.diagnosisId} missing for payment ${p._id}`);
      const code = d.top3[0].code;
      const kb = await kbDiseases.findOne({ _id: code, kbStatus: "published" }, { session });
      if (!kb) throw new Error(`no published KB entry ${code}`);
      const dealer = p.dealerId ? await dealers.findOne({ _id: p.dealerId }, { session }) : null;

      const now = new Date();
      const ref = await uniquePrescriptionRef(session);
      const rx: PrescriptionDoc = {
        _id: ref,
        diagnosisId: d._id,
        paymentId: p._id,
        diseaseCode: code,
        crop: d.crop,
        amount: p.amount,
        msisdn: p.msisdn,
        kbVersion: kb.kbVersion,
        modelVersion: d.modelVersion,
        sms: "PENDING",
        channel: p.channel,
        ...(p.dealerId ? { dealerId: p.dealerId } : {}),
        ...(dealer ? { dealerShop: dealer.shopName } : {}),
        receiptId: n.internalTrxId || p.internalTrxId || p.externalTrxId,
        treatment: {
          activeIngredient: kb.activeIngredient,
          dose: kb.dose,
          timing: kb.timing,
          phiDays: kb.phiDays,
          safety: kb.safety,
          care: kb.care,
        },
        disease: { name: kb.name, banglish: kb.banglish },
        paidAt: now,
        createdAt: now,
      };
      await prescriptions.insertOne(rx, { session });
      await payments.updateOne(
        { _id: p._id },
        {
          $set: {
            status: "PAID",
            paidAt: now,
            paidAmount: n.paidAmount,
            prescriptionRef: ref,
            ...(n.internalTrxId ? { internalTrxId: n.internalTrxId } : {}),
            updatedAt: now,
          },
        },
        { session },
      );
      await diagnoses.updateOne({ _id: d._id }, { $set: { status: "UNLOCKED", prescriptionRef: ref, updatedAt: now } }, { session });
      await onPaymentSettled(p, ref, session);
      result = { outcome: "settled", prescriptionRef: ref };
    });
  } finally {
    await session.endSession();
  }

  if (Number(n.paidAmount) && Number(n.paidAmount) !== first.amount) {
    log.warn("pay.amount_mismatch", { paymentId: first._id, expected: first.amount, paidAmount: n.paidAmount });
  }
  if (result.prescriptionRef) {
    log.info("pay.settled", { paymentId: first._id, ref: result.prescriptionRef, outcome: result.outcome });
    // Also covers "already": a crash between commit and SMS is finished by the next run.
    await sendPrescriptionSmsOnce(result.prescriptionRef);
  }
  return result;
}

// ---------------------------------------------------------------- prescription SMS

/** Sends the prescription SMS at most once per prescription, then marks the payment FULFILLED. */
export async function sendPrescriptionSmsOnce(ref: string): Promise<boolean> {
  const { prescriptions, payments } = await cols();
  const rx = await prescriptions.findOneAndUpdate(
    { _id: ref, smsClaimedAt: { $exists: false } },
    { $set: { smsClaimedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!rx) return false; // someone else sent (or is sending) it

  const text = prescriptionSms({ ref, crop: rx.crop, amount: rx.amount, banglish: rx.disease.banglish, treatment: rx.treatment });
  const sent = await sendSms(rx.msisdn, text, "prescription", { ref, app: rx.channel === "dealer" ? "dealer" : "farmer" });
  await prescriptions.updateOne({ _id: ref }, { $set: { sms: sent.ok ? "SENT" : "PENDING", smsLogId: sent.smsLogId } });
  // FULFILLED = prescription created and SMS handed to Applink (or queued for retry).
  await payments.updateOne({ _id: rx.paymentId, status: "PAID" }, { $set: { status: "FULFILLED", updatedAt: new Date() } });
  return true;
}
