import "server-only";
import type { Tx } from "@/lib/i18n";
import type { Prescription } from "@/lib/types";
import type { DealerAuth, FarmerAuth } from "../auth/session";
import { col } from "../db/collections";
import type { PrescriptionDoc, TreatmentSnapshot } from "../db/types";
import { forbidden, notFound, unauthorized } from "../http/errors";
import { enforceRateLimit } from "../lib/ratelimit";
import { prescriptionSms, sendSms } from "./messaging";

/*
  Prescriptions: only the owner farmer (session number = prescription number) or the
  dealer who sold it may read or re-send one (BACKEND_PLAN.md §6, §8).
*/

export type PrescriptionView = Prescription & { treatment: TreatmentSnapshot; diseaseName: Tx };

export function toPrescription(rx: PrescriptionDoc): Prescription {
  return {
    ref: rx._id,
    diagnosisId: rx.diagnosisId,
    diseaseCode: rx.diseaseCode,
    crop: rx.crop,
    paidAt: rx.paidAt.toISOString(),
    amount: rx.amount,
    msisdn: rx.msisdn, // owner/seller only: every caller is access-checked
    kbVersion: rx.kbVersion,
    modelVersion: rx.modelVersion,
    sms: rx.sms,
    channel: rx.channel,
    ...(rx.dealerShop ? { dealerShop: rx.dealerShop } : {}),
    receiptId: rx.receiptId,
  };
}

export type Viewer = { farmer: FarmerAuth | null; dealer: DealerAuth | null };

function canAccess(rx: PrescriptionDoc, v: Viewer): boolean {
  if (v.farmer && v.farmer.user.msisdn === rx.msisdn) return true;
  if (v.dealer && rx.dealerId && v.dealer.dealer._id === rx.dealerId) return true;
  return false;
}

async function loadForViewer(ref: string, v: Viewer): Promise<PrescriptionDoc> {
  const prescriptions = await col("prescriptions");
  const rx = await prescriptions.findOne({ _id: ref });
  if (!rx) throw notFound("Prescription not found");
  if (!canAccess(rx, v)) throw forbidden("Only the farmer who paid, or the dealer who sold it, can open this prescription");
  return rx;
}

export async function listMyPrescriptions(farmer: FarmerAuth | null): Promise<Prescription[]> {
  if (!farmer) throw unauthorized("Verify your number first");
  const prescriptions = await col("prescriptions");
  const rows = await prescriptions.find({ msisdn: farmer.user.msisdn }).sort({ paidAt: -1 }).limit(100).toArray();
  return rows.map(toPrescription);
}

export async function getPrescriptionForViewer(ref: string, v: Viewer): Promise<PrescriptionView> {
  const rx = await loadForViewer(ref, v);
  return { ...toPrescription(rx), treatment: rx.treatment, diseaseName: rx.disease.name };
}

/** Free re-send of the prescription SMS, max 3 per ref per day. */
export async function resendPrescription(ref: string, v: Viewer): Promise<{ ok: true }> {
  const rx = await loadForViewer(ref, v);
  await enforceRateLimit(`resend:${ref}`, 3, 24 * 60 * 60);
  const text = prescriptionSms({ ref, crop: rx.crop, amount: rx.amount, banglish: rx.disease.banglish, treatment: rx.treatment });
  await sendSms(rx.msisdn, text, "prescription-resend", { ref, app: rx.channel === "dealer" ? "dealer" : "farmer" });
  return { ok: true };
}
