/*
  Admin console mock data. Every KPI is derived from the same daily arrays so the
  dashboard totals match the ledger (SRS AT-14).
*/
import type { Tx } from "./i18n";
import type { CropId, KbStatus, PaymentStatus } from "./types";

export const DAYS = 14;

/** Oldest → newest; the last entry is today (23 Nov 2026). */
export const DAILY = {
  confident: [118, 124, 131, 140, 152, 149, 163, 171, 166, 182, 190, 201, 214, 226],
  uncertain: [31, 29, 35, 33, 38, 36, 40, 39, 41, 44, 42, 45, 47, 49],
  unlockTaps: [52, 55, 58, 61, 66, 64, 71, 75, 72, 80, 84, 88, 95, 99],
  paid: [47, 51, 53, 57, 61, 59, 66, 70, 66, 74, 78, 82, 88, 92],
  delivered: [46, 50, 51, 55, 59, 58, 64, 68, 65, 72, 76, 80, 86, 89],
  web: [70, 72, 78, 80, 88, 86, 93, 96, 95, 104, 108, 113, 120, 126],
  ussd: [52, 53, 56, 59, 64, 62, 68, 71, 69, 75, 78, 83, 88, 92],
  dealer: [27, 28, 32, 34, 38, 37, 42, 43, 43, 47, 46, 50, 53, 57],
};

export const dayLabel = (i: number) => {
  const d = new Date("2026-11-23T12:00:00+06:00");
  d.setDate(d.getDate() - (DAYS - 1 - i));
  return d.toISOString().slice(0, 10);
};

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

export const SUBSCRIBERS = { total: 1284, newThisWeek: 96, churnThisWeek: 11, priceMonthly: 20 };
export const REVENUE_SHARE = 0.5; // modelled; Applink does not publish it

export function kpis() {
  const conf = sum(DAILY.confident);
  const unc = sum(DAILY.uncertain);
  const taps = sum(DAILY.unlockTaps);
  const paid = sum(DAILY.paid);
  const delivered = sum(DAILY.delivered);
  const grossRx = paid * 5;
  const grossSub = Math.round((SUBSCRIBERS.total * SUBSCRIBERS.priceMonthly * DAYS) / 30);
  return {
    diagnoses: conf + unc,
    confident: conf,
    uncertain: unc,
    confidentShare: conf / (conf + unc),
    unlockConversion: paid / conf,
    chargeSuccess: paid / taps,
    dlrRate: delivered / paid,
    paid,
    grossRx,
    grossSub,
    gross: grossRx + grossSub,
    ourShare: (grossRx + grossSub) * REVENUE_SHARE,
    channels: { web: sum(DAILY.web), ussd: sum(DAILY.ussd), dealer: sum(DAILY.dealer) },
  };
}

/* ---------------- Live Applink log (ADM-2) ---------------- */

export type LogEntry = {
  id: string;
  at: string;
  dir: "out" | "in";
  api: string;
  msisdn: string;
  status: string;
  ms?: number;
  note?: string;
};

export const LOG_TEMPLATES: Omit<LogEntry, "id" | "at">[] = [
  { dir: "out", api: "/caas/direct/debit", msisdn: "019••••2210", status: "P1003", ms: 412, note: "Tk5.00, RC-77120" },
  { dir: "out", api: "/caas/otp/verify", msisdn: "019••••2210", status: "S1000", ms: 288, note: "RC-77120" },
  { dir: "in", api: "/callbacks/caas", msisdn: "019••••2210", status: "S1000", note: "paid 5.00" },
  { dir: "out", api: "/sms/send", msisdn: "019••••2210", status: "S1000", ms: 196, note: "rx PD-483120, 2 seg" },
  { dir: "in", api: "/callbacks/sms-dlr", msisdn: "019••••2210", status: "DELIVERED" },
  { dir: "in", api: "/ussd (mo-init)", msisdn: "014••••7781", status: "—", note: "session 1330929317" },
  { dir: "out", api: "/ussd/send (mt-cont)", msisdn: "014••••7781", status: "S1000", ms: 141 },
  { dir: "out", api: "/otp/request", msisdn: "019••••0453", status: "S1000", ms: 233, note: "WEBAPP" },
  { dir: "out", api: "/otp/verify", msisdn: "019••••0453", status: "S1000", ms: 254, note: "REGISTERED" },
  { dir: "in", api: "/callbacks/subscription", msisdn: "019••••0453", status: "REGISTERED", note: "body redacted" },
  { dir: "out", api: "/caas/direct/debit", msisdn: "019••••8812", status: "P1003", ms: 398 },
  { dir: "out", api: "/caas/otp/verify", msisdn: "019••••8812", status: "E1308", ms: 301, note: "low balance" },
  { dir: "in", api: "/callbacks/sms-mo", msisdn: "019••••3349", status: "—", note: "PD STOP" },
  { dir: "out", api: "/subscription/send", msisdn: "019••••3349", status: "S1000", ms: 177, note: "action 0" },
  { dir: "out", api: "/sms/send", msisdn: "019••••6650", status: "E1318", ms: 90, note: "TPS limit, retry in 1s" },
];

export const seedLog = (): LogEntry[] =>
  LOG_TEMPLATES.slice(0, 12)
    .reverse()
    .map((l, i) => ({ ...l, id: `seed-${i}`, at: new Date(Date.parse("2026-11-23T15:20:00Z") - i * 47000).toISOString() }));

/* ---------------- Payment ledger ---------------- */

export type LedgerRow = {
  id: string;
  externalTrxId: string;
  correlator: string;
  msisdn: string;
  amount: number;
  status: PaymentStatus;
  channel: "web" | "ussd" | "dealer";
  dealer?: string;
  createdAt: string;
  code?: string;
  ref?: string;
};

const minsAgo = (m: number) => new Date(Date.parse("2026-11-23T15:25:00Z") - m * 60000).toISOString();

export const LEDGER: LedgerRow[] = [
  { id: "p-9a01", externalTrxId: "3f8c2b1e-0d4a", correlator: "RC-77120", msisdn: "019••••2210", amount: 5, status: "DELIVERED", channel: "dealer", dealer: "Ma Krishi Bitan", createdAt: minsAgo(3), code: "S1000", ref: "PD-483120" },
  { id: "p-9a02", externalTrxId: "8d1e44c0-77b2", correlator: "RC-77118", msisdn: "014••••7781", amount: 5, status: "FULFILLED", channel: "ussd", createdAt: minsAgo(6), code: "S1000", ref: "PD-483118" },
  { id: "p-9a03", externalTrxId: "c2a9f610-1e5d", correlator: "RC-77115", msisdn: "019••••8812", amount: 5, status: "FAILED", channel: "web", createdAt: minsAgo(9), code: "E1308" },
  { id: "p-9a04", externalTrxId: "55be02d7-c4a1", correlator: "RC-77111", msisdn: "019••••0453", amount: 5, status: "VERIFYING", channel: "web", createdAt: minsAgo(14), code: "S1000" },
  { id: "p-9a05", externalTrxId: "a71c9e3b-2f08", correlator: "RC-77104", msisdn: "019••••6650", amount: 5, status: "OTP_SENT", channel: "web", createdAt: minsAgo(2), code: "P1003" },
  { id: "p-9a06", externalTrxId: "0e6f3b91-9d2c", correlator: "RC-77097", msisdn: "019••••4471", amount: 5, status: "DISPUTED", channel: "dealer", dealer: "Sonali Beej Ghar", createdAt: minsAgo(260), code: "S1000", ref: "PD-482301" },
  { id: "p-9a07", externalTrxId: "f4d2a8c5-60e7", correlator: "RC-77090", msisdn: "019••••1209", amount: 5, status: "EXPIRED", channel: "web", createdAt: minsAgo(31), code: "P1003" },
  { id: "p-9a08", externalTrxId: "9b30e7d4-a1f6", correlator: "RC-77082", msisdn: "014••••1029", amount: 5, status: "DELIVERED", channel: "ussd", createdAt: minsAgo(44), code: "S1000", ref: "PD-483071" },
  { id: "p-9a09", externalTrxId: "2c8d61fa-5b39", correlator: "RC-77076", msisdn: "019••••9033", amount: 5, status: "DELIVERED", channel: "web", createdAt: minsAgo(52), code: "S1000", ref: "PD-483064" },
  { id: "p-9a10", externalTrxId: "7ea4c0b2-e813", correlator: "RC-77061", msisdn: "019••••3349", amount: 5, status: "REFUNDED_MANUAL", channel: "web", createdAt: minsAgo(1500), code: "S1000", ref: "PD-481992" },
  { id: "p-9a11", externalTrxId: "d58f1a6e-3c4b", correlator: "RC-77055", msisdn: "019••••5517", amount: 5, status: "DELIVERED", channel: "dealer", dealer: "Krishok Bondhu Store", createdAt: minsAgo(66), code: "S1000", ref: "PD-483050" },
  { id: "p-9a12", externalTrxId: "16b7e9d0-f2a5", correlator: "RC-77049", msisdn: "014••••6624", amount: 5, status: "DELIVERED", channel: "ussd", createdAt: minsAgo(71), code: "S1000", ref: "PD-483044" },
];

/* ---------------- Review queue (ADM-4) ---------------- */

export type ReviewItem = {
  id: string;
  kind: "uncertain" | "dispute";
  crop: CropId;
  upazila: string;
  at: string;
  top3: { code: string; p: number }[];
  note?: string;
  answers?: string[];
  status: "open" | "done";
  verdict?: string;
};

export const REVIEW: ReviewItem[] = [
  {
    id: "RV-4821",
    kind: "uncertain",
    crop: "potato",
    upazila: "MUN-SRN",
    at: minsAgo(38),
    top3: [
      { code: "POTATO_EARLY_BLIGHT", p: 0.52 },
      { code: "POTATO_LATE_BLIGHT", p: 0.39 },
      { code: "POTATO_HEALTHY", p: 0.06 },
    ],
    answers: ["Not sure", "No"],
    note: "৩ দিন ধরে, অর্ধেক জমিতে",
    status: "open",
  },
  {
    id: "RV-4818",
    kind: "uncertain",
    crop: "rice",
    upazila: "SRJ-SHZ",
    at: minsAgo(95),
    top3: [
      { code: "RICE_BLAST", p: 0.48 },
      { code: "RICE_BROWN_SPOT", p: 0.41 },
      { code: "RICE_BLB", p: 0.07 },
    ],
    answers: ["None of these"],
    status: "open",
  },
  {
    id: "RV-4816",
    kind: "dispute",
    crop: "rice",
    upazila: "BOG-SHB",
    at: minsAgo(260),
    top3: [
      { code: "RICE_SHEATH_BLIGHT", p: 0.81 },
      { code: "RICE_BLAST", p: 0.12 },
      { code: "RICE_HEALTHY", p: 0.04 },
    ],
    note: "SMS পাইনি, টাকা কেটেছে (PD-482301)",
    status: "open",
  },
  {
    id: "RV-4809",
    kind: "uncertain",
    crop: "tomato",
    upazila: "JSR-JKG",
    at: minsAgo(820),
    top3: [
      { code: "TOMATO_LATE_BLIGHT", p: 0.46 },
      { code: "TOMATO_LEAF_MOLD", p: 0.38 },
      { code: "TOMATO_EARLY_BLIGHT", p: 0.12 },
    ],
    status: "done",
    verdict: "TOMATO_LEAF_MOLD",
  },
];

/* ---------------- Outbreak heatmap (ADM-5): confident cases, last 7 days ---------------- */

export const HEAT_DISEASES = ["RICE_BLAST", "RICE_BROWN_SPOT", "RICE_BLB", "RICE_SHEATH_BLIGHT", "POTATO_LATE_BLIGHT", "POTATO_EARLY_BLIGHT", "TOMATO_EARLY_BLIGHT", "TOMATO_LATE_BLIGHT"];
export const HEAT_UPAZILAS = ["SRJ-ULL", "SRJ-SHZ", "PBN-CHT", "PBN-ISW", "BOG-SHB", "BOG-SHR", "RNG-PIR", "RNG-MIT", "MUN-SRN", "JSR-JKG"];
export const HEAT: number[][] = [
  // rows = diseases, cols = upazilas
  [41, 23, 12, 6, 18, 9, 3, 2, 0, 4],
  [9, 14, 7, 11, 6, 5, 8, 12, 0, 3],
  [17, 8, 21, 13, 4, 2, 6, 9, 0, 1],
  [6, 3, 2, 7, 11, 5, 1, 2, 0, 0],
  [2, 0, 1, 3, 4, 6, 9, 7, 38, 12],
  [1, 0, 0, 2, 3, 2, 5, 6, 19, 8],
  [0, 1, 0, 4, 2, 1, 3, 2, 6, 22],
  [0, 0, 0, 1, 0, 2, 1, 0, 3, 9],
];
export const OUTBREAK_THRESHOLD = 5;

/* ---------------- Alerts (SUB-7, SUB-8) ---------------- */

export type AlertItem = {
  id: string;
  crop: CropId;
  diseaseCode: string;
  upazilas: string[];
  message: Tx;
  status: "suggested" | "approved" | "sent" | "scheduled";
  recipients: number;
  at: string;
  trigger?: string;
  delivered?: number;
};

export const ALERTS: AlertItem[] = [
  {
    id: "AL-112",
    crop: "potato",
    diseaseCode: "POTATO_LATE_BLIGHT",
    upazilas: ["MUN-SRN", "JSR-JKG"],
    message: {
      bn: "কাঠঠোকরা সতর্কতা: আপনার এলাকায় আলুর মড়ক বাড়ছে। পাতায় কালচে ভেজা দাগ দেখলে ছবি দিন বা ১৬১২৩-এ কল করুন।",
      en: "Kaththokra alert: Potato late blight is rising in your area. If you see dark wet patches, send a photo or call 16123.",
    },
    status: "suggested",
    recipients: 214,
    at: minsAgo(120),
    trigger: "38 + 12 confident cases in 7 days",
  },
  {
    id: "AL-111",
    crop: "rice",
    diseaseCode: "RICE_BLAST",
    upazilas: ["SRJ-ULL", "SRJ-SHZ"],
    message: {
      bn: "কাঠঠোকরা সতর্কতা: উল্লাপাড়া ও শাহজাদপুরে ধানের ব্লাস্ট বাড়ছে। চোখের মতো দাগ দেখলে ছবি দিন।",
      en: "Kaththokra alert: Rice blast rising in Ullapara and Shahjadpur. If you see eye-shaped spots, send a photo.",
    },
    status: "sent",
    recipients: 386,
    delivered: 371,
    at: minsAgo(4500),
    trigger: "41 + 23 confident cases in 7 days",
  },
  {
    id: "AL-110",
    crop: "rice",
    diseaseCode: "RICE_BLB",
    upazilas: ["PBN-CHT"],
    message: {
      bn: "কাঠঠোকরা সতর্কতা: চাটমোহরে পাতা পোড়া রোগ দেখা যাচ্ছে। ইউরিয়া কম দিন।",
      en: "Kaththokra alert: Bacterial leaf blight seen in Chatmohar. Go easy on urea.",
    },
    status: "sent",
    recipients: 142,
    delivered: 139,
    at: minsAgo(11000),
  },
];

/* ---------------- Dealers ---------------- */

export type DealerRow = {
  id: string;
  shop: string;
  upazila: string;
  msisdn: string;
  status: "active" | "paused" | "flagged";
  monthSales: number;
  monthCommission: number;
  diagnoses: number;
  topFiveShare: number; // share of charges going to the same 5 numbers (DLR-5)
  joined: string;
};

export const DEALERS: DealerRow[] = [
  { id: "DLR-114", shop: "Ma Krishi Bitan", upazila: "SRJ-ULL", msisdn: "019••••3344", status: "active", monthSales: 64, monthCommission: 48, diagnoses: 91, topFiveShare: 0.12, joined: "2026-11-24" },
  { id: "DLR-108", shop: "Sonali Beej Ghar", upazila: "BOG-SHB", msisdn: "019••••1180", status: "flagged", monthSales: 41, monthCommission: 30.75, diagnoses: 44, topFiveShare: 0.46, joined: "2026-11-24" },
  { id: "DLR-121", shop: "Krishok Bondhu Store", upazila: "MUN-SRN", msisdn: "014••••9902", status: "active", monthSales: 58, monthCommission: 43.5, diagnoses: 77, topFiveShare: 0.09, joined: "2026-11-25" },
  { id: "DLR-127", shop: "Bhai Bhai Agro", upazila: "PBN-CHT", msisdn: "019••••6604", status: "active", monthSales: 33, monthCommission: 24.75, diagnoses: 52, topFiveShare: 0.15, joined: "2026-11-25" },
  { id: "DLR-133", shop: "Rahman Fertiliser", upazila: "RNG-PIR", msisdn: "019••••2271", status: "paused", monthSales: 7, monthCommission: 5.25, diagnoses: 12, topFiveShare: 0.21, joined: "2026-11-26" },
  { id: "DLR-140", shop: "Nodi Krishi Kendro", upazila: "JSR-JKG", msisdn: "014••••5530", status: "active", monthSales: 29, monthCommission: 21.75, diagnoses: 40, topFiveShare: 0.11, joined: "2026-11-26" },
];

/* ---------------- Subscription mirror ---------------- */

export type SubRow = {
  msisdn: string;
  crops: CropId[];
  upazila: string;
  status: "REGISTERED" | "UNREGISTERED" | "PENDING_OTP" | "REQUESTED";
  source: "web" | "ussd" | "sms";
  lastCharge?: string;
  reconciled: boolean;
};

export const SUBS: SubRow[] = [
  { msisdn: "019••••0453", crops: ["rice"], upazila: "SRJ-ULL", status: "REGISTERED", source: "web", lastCharge: minsAgo(30), reconciled: true },
  { msisdn: "014••••7781", crops: ["rice", "potato"], upazila: "PBN-CHT", status: "REGISTERED", source: "ussd", lastCharge: minsAgo(9000), reconciled: true },
  { msisdn: "019••••3349", crops: ["rice"], upazila: "SRJ-SHZ", status: "UNREGISTERED", source: "sms", reconciled: true },
  { msisdn: "019••••6650", crops: ["tomato"], upazila: "JSR-JKG", status: "PENDING_OTP", source: "web", reconciled: false },
  { msisdn: "019••••9033", crops: ["potato"], upazila: "MUN-SRN", status: "REGISTERED", source: "web", lastCharge: minsAgo(20000), reconciled: true },
  { msisdn: "014••••1029", crops: ["rice"], upazila: "BOG-SHB", status: "REQUESTED", source: "ussd", reconciled: false },
  { msisdn: "019••••5517", crops: ["rice", "tomato"], upazila: "RNG-MIT", status: "REGISTERED", source: "sms", lastCharge: minsAgo(14000), reconciled: true },
];

/* ---------------- Model registry ---------------- */

export const MODELS = [
  { version: "effb0-2026-11-27", status: "live" as const, macroF1: 0.87, ece: 0.041, coverage: 0.79, accAtGate: 0.94, trainedOn: 3256 + 612, date: "2026-11-27" },
  { version: "effb0-2026-11-30-shadow", status: "shadow" as const, macroF1: 0.89, ece: 0.037, coverage: 0.81, accAtGate: 0.95, trainedOn: 3256 + 904, date: "2026-11-30" },
  { version: "effb0-2026-11-20", status: "retired" as const, macroF1: 0.82, ece: 0.063, coverage: 0.72, accAtGate: 0.91, trainedOn: 3256, date: "2026-11-20" },
];

export const PER_CLASS = [
  { code: "RICE_BLAST", p: 0.91, r: 0.88 },
  { code: "RICE_BROWN_SPOT", p: 0.86, r: 0.84 },
  { code: "RICE_BLB", p: 0.9, r: 0.92 },
  { code: "RICE_SHEATH_BLIGHT", p: 0.81, r: 0.77 },
  { code: "RICE_HEALTHY", p: 0.95, r: 0.96 },
  { code: "POTATO_LATE_BLIGHT", p: 0.89, r: 0.9 },
  { code: "POTATO_EARLY_BLIGHT", p: 0.83, r: 0.85 },
  { code: "POTATO_HEALTHY", p: 0.93, r: 0.94 },
  { code: "TOMATO_EARLY_BLIGHT", p: 0.84, r: 0.81 },
  { code: "TOMATO_LATE_BLIGHT", p: 0.82, r: 0.8 },
  { code: "TOMATO_LEAF_MOLD", p: 0.79, r: 0.83 },
  { code: "TOMATO_HEALTHY", p: 0.94, r: 0.92 },
];

/* ---------------- Team (ADM-6) ---------------- */

export const TEAM = [
  { name: "Fazle Rabbi", email: "fazle@kaththokra.app", role: "admin" as const, totp: true, last: minsAgo(2) },
  { name: "Dr. Nasrin Akter", email: "nasrin@kaththokra.app", role: "agronomist" as const, totp: true, last: minsAgo(40) },
  { name: "Dr. Kamrul Hasan", email: "kamrul@kaththokra.app", role: "agronomist" as const, totp: true, last: minsAgo(300) },
  { name: "Tania Sultana", email: "tania@kaththokra.app", role: "analyst" as const, totp: true, last: minsAgo(1300) },
  { name: "Rakib Hossain", email: "rakib@kaththokra.app", role: "dealer_manager" as const, totp: false, last: minsAgo(4000) },
];

export const KB_STATUS_ORDER: KbStatus[] = ["draft", "review", "approved", "published", "retired"];

export const KB_LABEL: Record<KbStatus, { bn: string; en: string }> = {
  draft: { bn: "খসড়া", en: "Draft" },
  review: { bn: "রিভিউতে", en: "In review" },
  approved: { bn: "অনুমোদিত", en: "Approved" },
  published: { bn: "প্রকাশিত", en: "Published" },
  retired: { bn: "বাতিল", en: "Retired" },
};
