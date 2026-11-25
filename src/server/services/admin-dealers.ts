import "server-only";
import type { DealerRow } from "@/lib/admin-data";
import { destroyAllSessions, type AdminAuth } from "../auth/session";
import { cols } from "../db/collections";
import type { DealerDoc } from "../db/types";
import { notFound } from "../http/errors";
import { maskMsisdn } from "../lib/msisdn";
import { DAY_MS, dhakaMonth, dhakaMonthStart } from "../lib/time";
import { audit } from "./audit";
import { toCsv } from "./admin-payments";

/*
  Admin dealer list (ADM, DLR-5 fraud check) and status changes.
  Fraud flag: over 30% of the dealer's paid sales in the last 30 days went to the same
  5 numbers (only judged from 10 sales up, so a new shop isn't flagged on its first sales).
*/

export const FRAUD_SHARE = 0.3;
export const FRAUD_MIN_SALES = 10;

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function listDealers(): Promise<DealerRow[]> {
  const { dealers, payments, commissionLedger, diagnoses } = await cols();
  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * DAY_MS);
  const monthStart = dhakaMonthStart(now);

  const [ds, perNumber, monthSales, monthCom, monthDiag] = await Promise.all([
    dealers.find().sort({ createdAt: -1 }).limit(500).toArray(),
    payments
      .aggregate<{ _id: { d: string; m: string }; n: number }>([
        { $match: { dealerId: { $exists: true }, paidAt: { $gte: since30 } } },
        { $group: { _id: { d: "$dealerId", m: "$msisdn" }, n: { $sum: 1 } } },
      ])
      .toArray(),
    payments
      .aggregate<{ _id: string; n: number }>([
        { $match: { dealerId: { $exists: true }, paidAt: { $gte: monthStart } } },
        { $group: { _id: "$dealerId", n: { $sum: 1 } } },
      ])
      .toArray(),
    commissionLedger
      .aggregate<{ _id: string; s: number }>([{ $match: { month: dhakaMonth(now) } }, { $group: { _id: "$dealerId", s: { $sum: "$amount" } } }])
      .toArray(),
    diagnoses
      .aggregate<{ _id: string; n: number }>([
        { $match: { dealerId: { $exists: true }, createdAt: { $gte: monthStart } } },
        { $group: { _id: "$dealerId", n: { $sum: 1 } } },
      ])
      .toArray(),
  ]);

  const counts = new Map<string, number[]>();
  for (const r of perNumber) counts.set(r._id.d, [...(counts.get(r._id.d) ?? []), r.n]);
  const sales = new Map(monthSales.map((r) => [r._id, r.n]));
  const com = new Map(monthCom.map((r) => [r._id, r.s]));
  const diag = new Map(monthDiag.map((r) => [r._id, r.n]));

  return ds.map((d) => {
    const c = (counts.get(d._id) ?? []).sort((a, b) => b - a);
    const total = c.reduce((a, b) => a + b, 0);
    const topFiveShare = total ? round2(c.slice(0, 5).reduce((a, b) => a + b, 0) / total) : 0;
    const fraud = total >= FRAUD_MIN_SALES && topFiveShare > FRAUD_SHARE;
    const status: DealerRow["status"] = d.status === "paused" ? "paused" : d.status === "flagged" || fraud ? "flagged" : "active";
    return {
      id: d._id,
      shop: d.shopName,
      upazila: d.upazila,
      msisdn: maskMsisdn(d.msisdn),
      status,
      monthSales: sales.get(d._id) ?? 0,
      monthCommission: round2(com.get(d._id) ?? 0),
      diagnoses: diag.get(d._id) ?? 0,
      topFiveShare,
      joined: d.createdAt.toISOString().slice(0, 10),
    };
  });
}

export async function setDealerStatus(id: string, status: DealerDoc["status"], auth: AdminAuth): Promise<{ id: string; status: DealerDoc["status"] }> {
  const { dealers } = await cols();
  const prev = await dealers.findOneAndUpdate({ _id: id }, { $set: { status, fraudFlag: status === "flagged" } });
  if (!prev) throw notFound("Dealer not found");
  // Pausing signs the dealer out everywhere.
  const ended = status === "paused" ? await destroyAllSessions("dealer", id) : 0;
  await audit(auth.admin._id, "dealer.status", "dealer", id, { from: prev.status, to: status, sessionsEnded: ended });
  return { id, status };
}

export async function dealersCsv(auth: AdminAuth): Promise<string> {
  const rows = await listDealers();
  await audit(auth.admin._id, "dealer.export_csv", "dealer", "*", { rows: rows.length });
  return toCsv(
    ["id", "shop", "upazila", "msisdn", "status", "monthSales", "monthCommission", "diagnoses", "topFiveShare", "joined"],
    rows.map((r) => [r.id, r.shop, r.upazila, r.msisdn, r.status, r.monthSales, r.monthCommission, r.diagnoses, r.topFiveShare, r.joined]),
  );
}
