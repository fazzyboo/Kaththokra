/*
  Mock client for the internal REST API (SRS §5.3). Each function mirrors one endpoint so the
  real fetch calls can replace the bodies later without touching the pages.

    POST /api/diagnose                → diagnose()
    POST /api/diagnose/{id}/answer    → answerClarify()
    POST /api/pay/initiate            → initiatePayment()
    POST /api/pay/{id}/otp            → submitPaymentOtp()
    GET  /api/pay/{id}                → getPayment()
    POST /api/auth/otp/request|verify → requestOtp() / verifyOtp()
    POST /api/subscribe|unsubscribe   → subscribe() / unsubscribe()
*/
import { CLARIFY, CONFIDENCE_GATE, DIAGNOSES, MODEL_VERSION, PRESCRIPTIONS } from "./data";
import type { Scenario } from "./session";
import type { CropId, Diagnosis, Prescription } from "./types";

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const rid = (prefix: string) => `${prefix}-${Math.random().toString(16).slice(2, 6)}`;

const KEY = "kk.diagnoses";

function readStore(): Record<string, Diagnosis> {
  try {
    return JSON.parse(window.sessionStorage.getItem(KEY) ?? "{}") as Record<string, Diagnosis>;
  } catch {
    return {};
  }
}

function writeStore(d: Diagnosis) {
  try {
    const all = readStore();
    all[d.id] = d;
    window.sessionStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export function getDiagnosis(id: string): Diagnosis | undefined {
  return DIAGNOSES.find((d) => d.id === id) ?? readStore()[id];
}

const CONFIDENT_TOP: Record<CropId, [string, number][]> = {
  rice: [["RICE_BLAST", 0.86], ["RICE_BROWN_SPOT", 0.09], ["RICE_BLB", 0.03]],
  potato: [["POTATO_LATE_BLIGHT", 0.88], ["POTATO_EARLY_BLIGHT", 0.08], ["POTATO_HEALTHY", 0.02]],
  tomato: [["TOMATO_EARLY_BLIGHT", 0.81], ["TOMATO_LEAF_MOLD", 0.11], ["TOMATO_LATE_BLIGHT", 0.05]],
};
const UNCERTAIN_TOP: Record<CropId, [string, number][]> = {
  rice: [["RICE_BLAST", 0.48], ["RICE_BROWN_SPOT", 0.41], ["RICE_BLB", 0.07]],
  potato: [["POTATO_EARLY_BLIGHT", 0.52], ["POTATO_LATE_BLIGHT", 0.39], ["POTATO_HEALTHY", 0.06]],
  tomato: [["TOMATO_LATE_BLIGHT", 0.46], ["TOMATO_LEAF_MOLD", 0.38], ["TOMATO_EARLY_BLIGHT", 0.12]],
};

/** POST /api/diagnose — multipart image + crop → free part of the diagnosis. */
export async function diagnose(crop: CropId, scenario: Scenario["diagnosis"], opts?: { dealer?: boolean; upazila?: string }): Promise<Diagnosis> {
  await sleep(1800);
  const base = {
    id: rid("d"),
    crop,
    createdAt: new Date().toISOString(),
    modelVersion: MODEL_VERSION,
    kbVersion: 4,
    channel: opts?.dealer ? ("dealer" as const) : ("web" as const),
    upazila: opts?.upazila ?? "SRJ-ULL",
  };
  let d: Diagnosis;
  if (scenario === "retake") {
    d = { ...base, status: "RETAKE", top3: [], ood: 0.83, retakeReason: "blurry" };
  } else if (scenario === "uncertain") {
    d = { ...base, status: "UNCERTAIN", top3: UNCERTAIN_TOP[crop].map(([code, p]) => ({ code, p })), ood: 0.22 };
  } else if (scenario === "healthy") {
    const code = `${crop.toUpperCase()}_HEALTHY`;
    d = { ...base, status: "CONFIDENT", top3: [{ code, p: 0.93 }], ood: 0.04 };
  } else {
    d = {
      ...base,
      status: "CONFIDENT",
      severity: "moderate",
      top3: CONFIDENT_TOP[crop].map(([code, p]) => ({ code, p })),
      ood: 0.07,
    };
  }
  writeStore(d);
  return d;
}

/** POST /api/diagnose/{id}/answer — answers re-rank the candidates (DX-5). */
export async function answerClarify(id: string, answers: Record<string, number>): Promise<Diagnosis> {
  await sleep(900);
  const d = getDiagnosis(id);
  if (!d) throw new Error("not found");
  const scores: Record<string, number> = {};
  d.top3.forEach((c) => (scores[c.code] = c.p));
  CLARIFY.filter((q) => q.crop === d.crop).forEach((q) => {
    const idx = answers[q.id];
    if (idx === undefined) return;
    const boost = q.options[idx]?.boost ?? {};
    Object.entries(boost).forEach(([code, b]) => (scores[code] = (scores[code] ?? 0) + b));
  });
  const total = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
  const top3 = Object.entries(scores)
    .map(([code, s]) => ({ code, p: Math.round((s / total) * 100) / 100 }))
    .sort((a, b) => b.p - a.p)
    .slice(0, 3);
  const next: Diagnosis = {
    ...d,
    top3,
    status: top3[0] && top3[0].p >= CONFIDENCE_GATE ? "CONFIDENT" : "UNCERTAIN",
    severity: top3[0] && top3[0].p >= CONFIDENCE_GATE ? "mild" : undefined,
  };
  writeStore(next);
  return next;
}

export async function queueForReview(id: string): Promise<{ ticket: string }> {
  await sleep(700);
  const d = getDiagnosis(id);
  if (d) writeStore({ ...d, status: "QUEUED_REVIEW" });
  return { ticket: `RV-${Math.floor(1000 + Math.random() * 8999)}` };
}

/* ---------------- Payment (CaaS) ---------------- */

export type PayInit = { paymentId: string; externalTrxId: string; correlator: string; statusCode: "P1003" };

/** POST /api/pay/initiate → /caas/direct/debit returns P1003 + requestCorrelator. */
export async function initiatePayment(_diagnosisId: string, _msisdn: string): Promise<PayInit> {
  await sleep(1200);
  return {
    paymentId: rid("p"),
    externalTrxId: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : rid("trx"),
    correlator: `RC-${Math.floor(10000 + Math.random() * 89999)}`,
    statusCode: "P1003",
  };
}

export type OtpResult = "accepted" | "wrong" | "E1308";

/** POST /api/pay/{id}/otp → /caas/otp/verify on the same correlator. */
export async function submitPaymentOtp(scenario: Scenario["payment"], attempt: number): Promise<OtpResult> {
  await sleep(1000);
  if (scenario === "wrong_once" && attempt === 1) return "wrong";
  if (scenario === "low_balance") return "E1308";
  return "accepted";
}

/** GET /api/pay/{id} — only the charging notification (S1000) sets PAID. */
export async function getPayment(scenario: Scenario["payment"], pollCount: number): Promise<"VERIFYING" | "PAID"> {
  await sleep(250);
  if (scenario === "slow") return "VERIFYING";
  return pollCount >= 2 ? "PAID" : "VERIFYING";
}

export const newPrescriptionRef = () => `PD-${Math.floor(100000 + Math.random() * 899999)}`;

/* ---------------- Number verification / subscription (OTP API) ---------------- */

export async function requestOtp(_msisdn: string): Promise<{ referenceNo: string }> {
  await sleep(900);
  return { referenceNo: `OTP-${Math.floor(1000 + Math.random() * 8999)}` };
}

export async function verifyOtp(_ref: string, code: string): Promise<"REGISTERED" | "WRONG"> {
  await sleep(900);
  return code === "000000" ? "WRONG" : "REGISTERED";
}

/* ---------------- Prescriptions created in this session ---------------- */

const RX_KEY = "kk.rx";

export function savePrescription(rx: Prescription) {
  try {
    const all = JSON.parse(window.localStorage.getItem(RX_KEY) ?? "[]") as Prescription[];
    window.localStorage.setItem(RX_KEY, JSON.stringify([rx, ...all.filter((r) => r.ref !== rx.ref)]));
  } catch {
    /* ignore */
  }
}

export function sessionPrescriptions(): Prescription[] {
  try {
    return JSON.parse(window.localStorage.getItem(RX_KEY) ?? "[]") as Prescription[];
  } catch {
    return [];
  }
}

export function getPrescription(ref: string): Prescription | undefined {
  return sessionPrescriptions().find((r) => r.ref === ref) ?? PRESCRIPTIONS.find((r) => r.ref === ref);
}
