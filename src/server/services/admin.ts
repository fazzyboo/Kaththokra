import "server-only";
import type { Collection, Document } from "mongodb";
import type { LogEntry } from "@/lib/admin-data";
import { cols } from "../db/collections";
import type { ApplinkLogDoc } from "../db/types";
import { DAY_MS, dhakaDate, dhakaDayStart } from "../lib/time";
import { getSettings } from "./settings";

/*
  Admin dashboard reads (BACKEND_PLAN.md §6): KPIs, live Applink log, sidebar counts.
  Shapes match src/lib/admin-data.ts (kpis() + DAILY, LogEntry).
*/

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const ratio = (a: number, b: number) => (b > 0 ? a / b : 0);

/** Count docs per Dhaka day (oldest first) for the last `days` days. */
async function daily<T extends Document>(c: Collection<T>, match: Document, dateField: string, from: Date, days: number): Promise<number[]> {
  const rows = await c
    .aggregate<{ _id: string; n: number }>([
      { $match: { ...match, [dateField]: { $gte: from } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: `$${dateField}`, timezone: "+06:00" } }, n: { $sum: 1 } } },
    ])
    .toArray();
  const by = new Map(rows.map((r) => [r._id, r.n]));
  return Array.from({ length: days }, (_, i) => by.get(dhakaDate(new Date(from.getTime() + i * DAY_MS))) ?? 0);
}

export type AdminDaily = {
  confident: number[];
  uncertain: number[];
  unlockTaps: number[];
  paid: number[];
  delivered: number[];
  web: number[];
  ussd: number[];
  dealer: number[];
};

export async function adminKpis(days: number) {
  const { diagnoses, payments, prescriptions, subscriptions } = await cols();
  const settings = await getSettings();
  const now = new Date();
  const from = new Date(dhakaDayStart(now).getTime() - (days - 1) * DAY_MS);
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);

  const [confident, uncertain, unlockTaps, paid, delivered, web, ussd, dealer, grossRxAgg, subTotal, subNew, subChurn] = await Promise.all([
    // CONFIDENT stays "confident" after it is paid (UNLOCKED); UNCERTAIN after review too.
    daily(diagnoses, { status: { $in: ["CONFIDENT", "UNLOCKED"] } }, "createdAt", from, days),
    daily(diagnoses, { status: { $in: ["UNCERTAIN", "QUEUED_REVIEW", "REVIEWED"] } }, "createdAt", from, days),
    daily(payments, {}, "createdAt", from, days), // every "unlock" tap creates a payment
    daily(payments, { paidAt: { $exists: true } }, "paidAt", from, days),
    daily(prescriptions, { sms: "DELIVERED" }, "paidAt", from, days),
    daily(diagnoses, { channel: "web" }, "createdAt", from, days),
    daily(diagnoses, { channel: "ussd" }, "createdAt", from, days),
    daily(diagnoses, { channel: "dealer" }, "createdAt", from, days),
    payments.aggregate<{ s: number }>([{ $match: { paidAt: { $gte: from } } }, { $group: { _id: null, s: { $sum: "$amount" } } }]).toArray(),
    subscriptions.countDocuments({ status: "REGISTERED" }),
    subscriptions.countDocuments({ status: "REGISTERED", since: { $gte: weekAgo } }),
    subscriptions.countDocuments({ status: "UNREGISTERED", updatedAt: { $gte: weekAgo } }),
  ]);

  const d: AdminDaily = { confident, uncertain, unlockTaps, paid, delivered, web, ussd, dealer };
  const conf = sum(confident);
  const unc = sum(uncertain);
  const paidN = sum(paid);
  const grossRx = grossRxAgg[0]?.s ?? 0;
  // Subscription revenue is modelled the same way as the mock: active base × monthly price, pro rata.
  const grossSub = Math.round((subTotal * settings.priceSubMonthly * days) / 30);

  const labels = Array.from({ length: days }, (_, i) => dhakaDate(new Date(from.getTime() + i * DAY_MS)));
  return {
    days,
    labels,
    daily: d,
    subscribers: { total: subTotal, newThisWeek: subNew, churnThisWeek: subChurn, priceMonthly: settings.priceSubMonthly },
    revenueShare: settings.revenueShare,
    kpis: {
      diagnoses: conf + unc,
      confident: conf,
      uncertain: unc,
      confidentShare: ratio(conf, conf + unc),
      unlockConversion: ratio(paidN, conf),
      chargeSuccess: ratio(paidN, sum(unlockTaps)),
      dlrRate: ratio(sum(delivered), paidN),
      paid: paidN,
      grossRx,
      grossSub,
      gross: grossRx + grossSub,
      ourShare: (grossRx + grossSub) * settings.revenueShare,
      channels: { web: sum(web), ussd: sum(ussd), dealer: sum(dealer) },
    },
  };
}

// ---------------------------------------------------------------- live log

export type LogApi = "all" | "caas" | "sms" | "ussd" | "sub";

export function toLogEntry(r: ApplinkLogDoc & { _id?: unknown }): LogEntry {
  return {
    id: String(r._id),
    at: r.at.toISOString(),
    dir: r.direction,
    api: `/${r.path}`,
    msisdn: r.msisdnMasked ?? "—",
    status: r.statusCode ?? "—",
    ...(r.ms !== undefined ? { ms: r.ms } : {}),
    ...(r.mode === "mock" ? { note: "mock" } : {}),
  };
}

export async function liveLog(after: Date | null, api: LogApi): Promise<LogEntry[]> {
  const { applinkLog } = await cols();
  const filter: Document = {};
  if (after) filter.at = { $gt: after };
  if (api !== "all") filter.api = api;
  const rows = await applinkLog.find(filter).sort({ at: -1 }).limit(100).toArray();
  return rows.map(toLogEntry);
}

// ---------------------------------------------------------------- counts

export async function adminCounts(): Promise<{ openReviews: number }> {
  const { reviews } = await cols();
  return { openReviews: await reviews.countDocuments({ status: { $in: ["open", "in_progress"] } }) };
}
