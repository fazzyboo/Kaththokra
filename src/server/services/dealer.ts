import "server-only";
import type { ClientSession } from "mongodb";
import { UPAZILAS } from "@/lib/data";
import type { DealerSale } from "@/lib/dealer-data";
import type { DealerSession } from "@/lib/session";
import type { CropId } from "@/lib/types";
import { createSession, destroySession, type DealerAuth } from "../auth/session";
import { col, cols } from "../db/collections";
import type { DealerDoc, PaymentDoc } from "../db/types";
import { badRequest, forbidden } from "../http/errors";
import { newDealerId, retryOnDuplicate } from "../lib/ids";
import { log } from "../lib/log";
import { maskMsisdn } from "../lib/msisdn";
import type { Scenario } from "../lib/scenario";
import { DAY_MS, dhakaDayStart, dhakaMonth, dhakaMonthStart } from "../lib/time";
import { requestOtp, verifyOtp } from "./identity";
import { getSettings } from "./settings";

/*
  Dealers (BACKEND_PLAN.md §6, §8): OTP onboarding on the dealer Applink app, kk_d session
  (30 d), attribution of diagnoses/payments, commission ledger, stats and sales.
*/

export const DEFAULT_COMMISSION_RATE = 0.3;
const UPAZILA_CODES = new Set(UPAZILAS.map((u) => u.code));

export function toDealerSession(d: DealerDoc): DealerSession {
  // Full number only to the dealer themself (the profile page masks it).
  return { shopName: d.shopName, upazila: d.upazila, msisdn: d.msisdn, dealerId: d._id };
}

// ---------------------------------------------------------------- onboarding

export async function startOnboarding(
  input: { shopName: string; upazila: string; msisdn: string },
  opts: { ip: string; scenario: Scenario | null },
): Promise<{ requestId: string }> {
  const shopName = input.shopName.trim().replace(/\s+/g, " ");
  if (shopName.length < 2) throw badRequest("Shop name must be at least 2 characters");
  if (!UPAZILA_CODES.has(input.upazila)) throw badRequest("Unknown upazila");
  return requestOtp(input.msisdn, "dealer", { payload: { shopName, upazila: input.upazila }, app: "dealer", ip: opts.ip, scenario: opts.scenario });
}

export async function verifyOnboarding(requestId: string, code: string, scenario: Scenario | null): Promise<DealerSession> {
  const { request } = await verifyOtp(requestId, code, "dealer", scenario);
  const { shopName, upazila } = (request.payload ?? {}) as { shopName: string; upazila: string };
  const dealers = await col("dealers");

  const existing = await dealers.findOne({ msisdn: request.msisdn });
  let dealer: DealerDoc;
  if (existing) {
    if (existing.status === "paused") throw forbidden("Dealer account is paused. Call the helpline.");
    dealer = (await dealers.findOneAndUpdate({ _id: existing._id }, { $set: { shopName, upazila } }, { returnDocument: "after" }))!;
  } else {
    try {
      ({ result: dealer } = await retryOnDuplicate(newDealerId, async (id) => {
        const doc: DealerDoc = {
          _id: id,
          shopName,
          upazila,
          msisdn: request.msisdn,
          status: "active",
          commissionRate: DEFAULT_COMMISSION_RATE,
          fraudFlag: false,
          createdAt: new Date(),
        };
        await dealers.insertOne(doc);
        return doc;
      }, 20));
    } catch (err) {
      // Same number onboarding twice at once: the unique msisdn index wins; use that dealer.
      if ((err as { code?: unknown }).code !== 11000) throw err;
      const again = await dealers.findOne({ msisdn: request.msisdn });
      if (!again) throw err;
      dealer = again;
    }
  }
  await createSession("dealer", dealer._id);
  log.info("dealer.onboarded", { dealerId: dealer._id, msisdn: maskMsisdn(dealer.msisdn), existing: !!existing });
  return toDealerSession(dealer);
}

export async function dealerLogout(): Promise<{ ok: true }> {
  await destroySession("dealer");
  return { ok: true };
}

// ---------------------------------------------------------------- commission (settle hook)

export function commissionFor(price: number, revenueShare: number, commissionRate: number): number {
  return Math.round(price * revenueShare * commissionRate * 100) / 100;
}

/** Called inside the settle transaction, once per paid dealer payment. */
export async function recordCommission(p: PaymentDoc, session: ClientSession): Promise<void> {
  if (!p.dealerId) return;
  const { dealers, commissionLedger } = await cols();
  const dealer = await dealers.findOne({ _id: p.dealerId }, { session });
  if (!dealer) {
    log.warn("dealer.commission_no_dealer", { paymentId: p._id, dealerId: p.dealerId });
    return;
  }
  const settings = await getSettings();
  const now = new Date();
  await commissionLedger.insertOne(
    {
      dealerId: dealer._id,
      paymentId: p._id,
      amount: commissionFor(p.amount, settings.revenueShare, dealer.commissionRate),
      month: dhakaMonth(now),
      paidOut: false,
      createdAt: now,
    },
    { session },
  );
}

// ---------------------------------------------------------------- stats

export type DealerStats = {
  todayCommission: number;
  todaySales: number;
  monthCommission: number;
  monthSales: number;
  monthDiagnoses: number;
  lastPayout: { month: string; amount: number; paidOn: string } | null;
  daily: number[]; // paid prescriptions per Dhaka day, last 14 days, oldest first
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function dealerStats(auth: DealerAuth): Promise<DealerStats> {
  const dealerId = auth.dealer._id;
  const { prescriptions, commissionLedger, diagnoses } = await cols();
  const now = new Date();
  const today = dhakaDayStart(now);
  const monthStart = dhakaMonthStart(now);
  const from14 = new Date(today.getTime() - 13 * DAY_MS);

  const [todaySales, monthSales, monthDiagnoses, todayLedger, monthLedger, perDay, lastPaid] = await Promise.all([
    prescriptions.countDocuments({ dealerId, paidAt: { $gte: today } }),
    prescriptions.countDocuments({ dealerId, paidAt: { $gte: monthStart } }),
    diagnoses.countDocuments({ dealerId, createdAt: { $gte: monthStart } }),
    commissionLedger.aggregate<{ s: number }>([{ $match: { dealerId, createdAt: { $gte: today } } }, { $group: { _id: null, s: { $sum: "$amount" } } }]).toArray(),
    commissionLedger.aggregate<{ s: number }>([{ $match: { dealerId, month: dhakaMonth(now) } }, { $group: { _id: null, s: { $sum: "$amount" } } }]).toArray(),
    prescriptions
      .aggregate<{ _id: string; n: number }>([
        { $match: { dealerId, paidAt: { $gte: from14 } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$paidAt", timezone: "+06:00" } }, n: { $sum: 1 } } },
      ])
      .toArray(),
    commissionLedger.find({ dealerId, paidOut: true }).sort({ paidOutAt: -1 }).limit(1).next(),
  ]);

  let lastPayout: DealerStats["lastPayout"] = null;
  if (lastPaid) {
    const [{ s } = { s: 0 }] = await commissionLedger
      .aggregate<{ s: number }>([{ $match: { dealerId, month: lastPaid.month, paidOut: true } }, { $group: { _id: null, s: { $sum: "$amount" } } }])
      .toArray();
    lastPayout = { month: lastPaid.month, amount: round2(s), paidOn: (lastPaid.paidOutAt ?? lastPaid.createdAt).toISOString().slice(0, 10) };
  }

  const counts = new Map(perDay.map((r) => [r._id, r.n]));
  const daily = Array.from({ length: 14 }, (_, i) => {
    const day = new Date(from14.getTime() + i * DAY_MS + 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return counts.get(day) ?? 0;
  });

  return {
    todayCommission: round2(todayLedger[0]?.s ?? 0),
    todaySales,
    monthCommission: round2(monthLedger[0]?.s ?? 0),
    monthSales,
    monthDiagnoses,
    lastPayout,
    daily,
  };
}

// ---------------------------------------------------------------- sales

export type SalesFilter = "all" | "paid" | "issues";

function saleStatus(p: PaymentDoc, smsDelivered: boolean): DealerSale["status"] | null {
  switch (p.status) {
    case "PAID":
    case "FULFILLED":
      return smsDelivered ? "DELIVERED" : "PAID";
    case "DELIVERED":
      return "DELIVERED";
    case "FAILED":
      return "FAILED";
    case "DISPUTED":
    case "REFUNDED_MANUAL":
      return "DISPUTED";
    default:
      return null; // CREATED / OTP_SENT / VERIFYING / EXPIRED are not sales
  }
}

export async function dealerSales(auth: DealerAuth, filter: SalesFilter): Promise<DealerSale[]> {
  const dealerId = auth.dealer._id;
  const { payments, prescriptions, diagnoses, commissionLedger } = await cols();
  const statuses: PaymentDoc["status"][] =
    filter === "paid"
      ? ["PAID", "FULFILLED", "DELIVERED"]
      : filter === "issues"
        ? ["FAILED", "DISPUTED", "REFUNDED_MANUAL"]
        : ["PAID", "FULFILLED", "DELIVERED", "FAILED", "DISPUTED", "REFUNDED_MANUAL"];

  const pays = await payments.find({ dealerId, status: { $in: statuses } }).sort({ createdAt: -1 }).limit(100).toArray();
  const refs = pays.map((p) => p.prescriptionRef).filter((r): r is string => !!r);
  const [rxs, dgs, ledger] = await Promise.all([
    prescriptions.find({ _id: { $in: refs } }, { projection: { sms: 1, crop: 1, diseaseCode: 1, paidAt: 1 } }).toArray(),
    diagnoses.find({ _id: { $in: pays.map((p) => p.diagnosisId) } }, { projection: { crop: 1, top3: 1 } }).toArray(),
    commissionLedger.find({ paymentId: { $in: pays.map((p) => p._id) } }).toArray(),
  ]);
  const rxBy = new Map(rxs.map((r) => [r._id, r]));
  const dgBy = new Map(dgs.map((d) => [d._id, d]));
  const comBy = new Map(ledger.map((l) => [l.paymentId, l.amount]));

  const out: DealerSale[] = [];
  for (const p of pays) {
    const rx = p.prescriptionRef ? rxBy.get(p.prescriptionRef) : undefined;
    const status = saleStatus(p, rx?.sms === "DELIVERED");
    if (!status) continue;
    const dg = dgBy.get(p.diagnosisId);
    out.push({
      ref: p.prescriptionRef ?? p._id, // failed sales have no prescription: show the payment id
      at: (rx?.paidAt ?? p.paidAt ?? p.createdAt).toISOString(),
      crop: (rx?.crop ?? dg?.crop ?? "rice") as CropId,
      diseaseCode: rx?.diseaseCode ?? dg?.top3[0]?.code ?? "",
      farmer: maskMsisdn(p.msisdn),
      status,
      commission: status === "PAID" || status === "DELIVERED" ? (comBy.get(p._id) ?? 0) : 0,
    });
  }
  return out;
}
