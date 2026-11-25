import "server-only";
import { randomBytes } from "node:crypto";
import type { Tx } from "@/lib/i18n";
import { CROPS } from "@/lib/data";
import type { CropId } from "@/lib/types";
import { bodies } from "../applink/bodies";
import { applink } from "../applink/client";
import { ApplinkError } from "../applink/errors";
import { col } from "../db/collections";
import type { SmsLogDoc, TreatmentSnapshot } from "../db/types";
import { log } from "../lib/log";
import { maskMsisdn } from "../lib/msisdn";

/*
  Outbound SMS (Applink sms/send). One smsLog row per send. Failed sends get nextRetryAt
  so the sms-retry job can resend; the text is kept on the row for that.
  Backoff: 5 min before the 1st retry, 15 before the 2nd, 60 before the 3rd, then give up.
*/

const MIN = 60 * 1000;
export const SMS_BACKOFF_MS = [5 * MIN, 15 * MIN, 60 * MIN];
export const MAX_SMS_RETRIES = SMS_BACKOFF_MS.length;
const RETRY_DELAY_MS = SMS_BACKOFF_MS[0];

// ---------------------------------------------------------------- segments

// GSM 03.38 basic set; the extension set costs 2 septets each.
const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXT = "^{}\\[~]|€\f";

export function smsSegments(text: string): { encoding: "GSM-7" | "UCS-2"; units: number; segments: number } {
  let septets = 0;
  let gsm = true;
  for (const ch of text) {
    if (GSM_BASIC.includes(ch)) septets += 1;
    else if (GSM_EXT.includes(ch)) septets += 2;
    else {
      gsm = false;
      break;
    }
  }
  if (gsm) return { encoding: "GSM-7", units: septets, segments: septets <= 160 ? 1 : Math.ceil(septets / 153) };
  const units = [...text].reduce((n, ch) => n + (ch.codePointAt(0)! > 0xffff ? 2 : 1), 0);
  return { encoding: "UCS-2", units, segments: units <= 70 ? 1 : Math.ceil(units / 67) };
}

/** Swap the few non-GSM characters our KB text uses, so Banglish stays in cheap GSM-7. */
export function toGsmFriendly(text: string): string {
  return text
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/×/g, "x")
    .replace(/ /g, " ");
}

// ---------------------------------------------------------------- send

export type SendResult = { smsLogId: string; ok: boolean; messageId?: string };

export async function sendSms(
  msisdn: string,
  text: string,
  template: string,
  opts: { ref?: string; app?: "farmer" | "dealer" } = {},
): Promise<SendResult> {
  const smsLog = await col("smsLog");
  const now = new Date();
  const { segments } = smsSegments(text);
  const base = {
    msisdn,
    template,
    text,
    ...(opts.ref ? { ref: opts.ref } : {}),
    ...(opts.app === "dealer" ? { app: "dealer" as const } : {}),
    segments,
    retries: 0,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const res = await applink("sms/send", bodies.smsSend(msisdn, text), { app: opts.app });
    const dest = res.destinationResponses?.[0];
    const destOk = !dest?.statusCode || dest.statusCode === "S1000";
    const row: SmsLogDoc = {
      _id: res.requestId || `sms-${randomBytes(6).toString("hex")}`,
      ...base,
      ...(dest?.messageId ? { messageId: dest.messageId } : {}),
      status: destOk ? "SENT" : "FAILED",
      ...(destOk ? {} : { lastError: dest?.statusCode, nextRetryAt: new Date(now.getTime() + RETRY_DELAY_MS) }),
    };
    await smsLog.insertOne(row);
    if (!destOk) log.warn("sms.dest_failed", { template, msisdn: maskMsisdn(msisdn), errorCode: dest?.statusCode });
    return { smsLogId: row._id, ok: destOk, messageId: dest?.messageId };
  } catch (err) {
    const errorCode = err instanceof ApplinkError ? err.code : "INTERNAL";
    const row: SmsLogDoc = {
      _id: `sms-${randomBytes(6).toString("hex")}`,
      ...base,
      status: "FAILED",
      lastError: errorCode,
      nextRetryAt: new Date(now.getTime() + RETRY_DELAY_MS),
    };
    await smsLog.insertOne(row);
    log.warn("sms.send_failed", { template, msisdn: maskMsisdn(msisdn), errorCode });
    return { smsLogId: row._id, ok: false };
  }
}

// ---------------------------------------------------------------- retry (sms-retry job)

/** Lease while a retry is in flight, so an overlapping job run doesn't send the same row twice. */
const RETRY_LEASE_MS = 2 * MIN;

/**
 * Resend one FAILED row due for retry. The row is claimed first (nextRetryAt pushed out), so
 * concurrent runs can't both send it. Returns null when someone else took it or it isn't due.
 */
export async function retrySms(id: string): Promise<"sent" | "failed" | "gave_up" | null> {
  const smsLog = await col("smsLog");
  const now = new Date();
  const row = await smsLog.findOneAndUpdate(
    { _id: id, status: "FAILED", retries: { $lt: MAX_SMS_RETRIES }, nextRetryAt: { $lte: now } },
    { $set: { nextRetryAt: new Date(now.getTime() + RETRY_LEASE_MS), updatedAt: now } },
    { returnDocument: "after" },
  );
  if (!row) return null;
  const retries = row.retries + 1;
  let errorCode: string | undefined;
  let messageId: string | undefined;
  try {
    const res = await applink("sms/send", bodies.smsSend(row.msisdn, row.text), { app: row.app });
    const dest = res.destinationResponses?.[0];
    if (dest?.statusCode && dest.statusCode !== "S1000") errorCode = dest.statusCode;
    messageId = dest?.messageId;
  } catch (err) {
    errorCode = err instanceof ApplinkError ? err.code : "INTERNAL";
  }

  if (!errorCode) {
    await smsLog.updateOne(
      { _id: id },
      { $set: { status: "SENT", retries, updatedAt: new Date(), ...(messageId ? { messageId } : {}) }, $unset: { nextRetryAt: "", lastError: "" } },
    );
    log.info("sms.retry_sent", { template: row.template, msisdn: maskMsisdn(row.msisdn), retries });
    return "sent";
  }
  const giveUp = retries >= MAX_SMS_RETRIES;
  await smsLog.updateOne(
    { _id: id },
    giveUp
      ? { $set: { retries, lastError: errorCode, updatedAt: new Date() }, $unset: { nextRetryAt: "" } }
      : { $set: { retries, lastError: errorCode, nextRetryAt: new Date(Date.now() + SMS_BACKOFF_MS[retries]), updatedAt: new Date() } },
  );
  log.warn(giveUp ? "sms.retry_gave_up" : "sms.retry_failed", { template: row.template, msisdn: maskMsisdn(row.msisdn), retries, errorCode });
  return giveUp ? "gave_up" : "failed";
}

// ---------------------------------------------------------------- prescription template

export const MAX_PRESCRIPTION_SEGMENTS = 3;

export type PrescriptionSmsInput = {
  ref: string;
  crop: CropId;
  amount: number;
  banglish: string;
  treatment: Pick<TreatmentSnapshot, "activeIngredient" | "dose" | "timing" | "phiDays">;
};

const cropEn = (crop: CropId): string => (CROPS.find((c) => c.id === crop)?.name as Tx | undefined)?.en ?? crop;

/**
 * The Banglish SMS that PrescriptionView shows today (smsBanglish), made GSM-7 safe.
 * Asserts ≤ 3 segments; if a long KB entry overflows, drops the timing line (the app shows it).
 */
export function prescriptionSms(i: PrescriptionSmsInput): string {
  const t = i.treatment;
  const full = toGsmFriendly(
    `${i.banglish} (${cropEn(i.crop)}). Osudh: ${t.activeIngredient.en}. Matra: ${t.dose.en}. ${t.timing.en}. Fosol tolar ${t.phiDays} din age sesh spray. Mask-glove porun. Label porun. Ref ${i.ref}. Tk${i.amount} paid.`,
  );
  if (smsSegments(full).segments <= MAX_PRESCRIPTION_SEGMENTS) return full;

  const short = toGsmFriendly(
    `${i.banglish} (${cropEn(i.crop)}). Osudh: ${t.activeIngredient.en}. Matra: ${t.dose.en}. Fosol tolar ${t.phiDays} din age sesh spray. Mask-glove porun. Ref ${i.ref}. Tk${i.amount} paid.`,
  );
  const seg = smsSegments(short).segments;
  log.warn("sms.prescription_too_long", { ref: i.ref, segments: seg });
  if (seg > MAX_PRESCRIPTION_SEGMENTS) throw new Error(`Prescription SMS for ${i.ref} needs ${seg} segments (max ${MAX_PRESCRIPTION_SEGMENTS})`);
  return short;
}
