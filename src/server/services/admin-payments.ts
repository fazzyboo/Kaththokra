import "server-only";
import type { LedgerRow } from "@/lib/admin-data";
import type { PaymentStatus } from "@/lib/types";
import type { AdminAuth } from "../auth/session";
import { cols } from "../db/collections";
import type { PaymentDoc } from "../db/types";
import { conflict, notFound } from "../http/errors";
import { maskMsisdn } from "../lib/msisdn";
import { audit } from "./audit";

/*
  Admin payment ledger (ADM-3): list, manual refund mark, manual fail, CSV export.
  Numbers are always masked here.
*/

export type PaymentFilter = "all" | "attention" | "settled" | "failed";

const FILTER: Record<PaymentFilter, PaymentStatus[] | null> = {
  all: null,
  // Needs a human: verified but no notification yet, or disputed by the farmer.
  attention: ["VERIFYING", "DISPUTED"],
  settled: ["PAID", "FULFILLED", "DELIVERED", "REFUNDED_MANUAL"],
  failed: ["FAILED", "EXPIRED"],
};

function code(p: PaymentDoc): string | undefined {
  if (p.failureCode) return p.failureCode;
  if (p.paidAt || p.status === "VERIFYING") return "S1000";
  if (p.requestCorrelator) return "P1003";
  return undefined;
}

async function toLedgerRows(pays: PaymentDoc[]): Promise<LedgerRow[]> {
  const { dealers } = await cols();
  const ids = [...new Set(pays.map((p) => p.dealerId).filter((x): x is string => !!x))];
  const ds = await dealers.find({ _id: { $in: ids } }, { projection: { shopName: 1 } }).toArray();
  const shop = new Map(ds.map((d) => [d._id, d.shopName]));
  return pays.map((p) => ({
    id: p._id,
    externalTrxId: p.externalTrxId,
    correlator: p.requestCorrelator ?? "",
    msisdn: maskMsisdn(p.msisdn),
    amount: p.amount,
    status: p.status,
    channel: p.channel,
    ...(p.dealerId && shop.get(p.dealerId) ? { dealer: shop.get(p.dealerId) } : {}),
    createdAt: p.createdAt.toISOString(),
    ...(code(p) ? { code: code(p) } : {}),
    ...(p.prescriptionRef ? { ref: p.prescriptionRef } : {}),
  }));
}

export async function listPayments(filter: PaymentFilter, limit = 200): Promise<LedgerRow[]> {
  const { payments } = await cols();
  const statuses = FILTER[filter];
  const rows = await payments
    .find(statuses ? { status: { $in: statuses } } : {})
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return toLedgerRows(rows);
}

/** DISPUTED → REFUNDED_MANUAL (the refund itself is done outside Applink). Reverses dealer commission. */
export async function refundPayment(id: string, note: string | undefined, auth: AdminAuth): Promise<LedgerRow> {
  const { payments, commissionLedger } = await cols();
  const now = new Date();
  const r = await payments.findOneAndUpdate(
    { _id: id, status: "DISPUTED" },
    { $set: { status: "REFUNDED_MANUAL", updatedAt: now } },
    { returnDocument: "after" },
  );
  if (!r) {
    const cur = await payments.findOne({ _id: id }, { projection: { status: 1 } });
    if (!cur) throw notFound("Payment not found");
    throw conflict("Only disputed payments can be marked refunded", { status: cur.status });
  }
  await commissionLedger.updateOne({ paymentId: id, paidOut: false }, { $set: { amount: 0, reversedAt: now } });
  await audit(auth.admin._id, "payment.refund", "payment", id, note ? { note } : undefined);
  return (await toLedgerRows([r]))[0];
}

/** VERIFYING → FAILED (no charging notification came; confirmed with Applink by hand). */
export async function failPayment(id: string, note: string | undefined, auth: AdminAuth): Promise<LedgerRow> {
  const { payments } = await cols();
  const r = await payments.findOneAndUpdate(
    { _id: id, status: "VERIFYING" },
    { $set: { status: "FAILED", failureCode: "MANUAL", updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!r) {
    const cur = await payments.findOne({ _id: id }, { projection: { status: 1 } });
    if (!cur) throw notFound("Payment not found");
    throw conflict("Only payments waiting for a notification (VERIFYING) can be failed", { status: cur.status });
  }
  await audit(auth.admin._id, "payment.fail", "payment", id, note ? { note } : undefined);
  return (await toLedgerRows([r]))[0];
}

// ---------------------------------------------------------------- CSV

export function csvCell(v: unknown): string {
  const s = v === undefined || v === null ? "" : String(v);
  // Quote everything; neutralise spreadsheet formulas (CSV injection).
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export async function paymentsCsv(auth: AdminAuth): Promise<string> {
  const rows = await listPayments("all", 5000);
  await audit(auth.admin._id, "payment.export_csv", "payment", "*", { rows: rows.length });
  return toCsv(
    ["id", "createdAt", "status", "channel", "amount", "msisdn", "dealer", "ref", "code", "externalTrxId", "correlator"],
    rows.map((r) => [r.id, r.createdAt, r.status, r.channel, r.amount, r.msisdn, r.dealer, r.ref, r.code, r.externalTrxId, r.correlator]),
  );
}
