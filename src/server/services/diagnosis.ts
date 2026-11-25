import "server-only";
import { createHash } from "node:crypto";
import { Binary } from "mongodb";
import { CLARIFY } from "@/lib/data";
import type { Channel, CropId, Diagnosis, DiagnosisStatus, Severity } from "@/lib/types";
import { col, cols } from "../db/collections";
import type { DiagnosisDoc, ImageDoc, ReviewDoc } from "../db/types";
import { getEnv } from "../env";
import { classifyLeaf } from "../gemini/client";
import { PROMPT_VERSION } from "../gemini/prompt";
import { UNKNOWN, type GeminiOutput } from "../gemini/schema";
import { AppError, badRequest, conflict, notFound } from "../http/errors";
import { newDiagnosisId, newImageId, newReviewTicket, retryOnDuplicate } from "../lib/ids";
import { log } from "../lib/log";
import { maskMsisdn, normalizeMsisdn } from "../lib/msisdn";
import { enforceRateLimit } from "../lib/ratelimit";
import type { Scenario } from "../lib/scenario";
import { publishedKbForCrop } from "./kb";
import { getSettings } from "./settings";

/*
  Diagnosis API service (BACKEND_PLAN.md §5, §6).
*/

export type DiagnosisView = Diagnosis & { prescriptionRef?: string; reviewTicket?: string };

export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export type ImageMime = (typeof ALLOWED_MIME)[number];
export const MAX_IMAGE_BYTES = 1024 * 1024;

const DAY_MS = 24 * 60 * 60 * 1000;
const CONFIDENT_GAP = 0.2;

export type CreateDiagnosisInput = {
  crop: CropId;
  imageBytes: Buffer;
  mime: string;
  consent: boolean;
  upazila?: string;
  userId?: string;
  dealerId?: string;
  channel: Channel;
  scenario: Scenario | null;
  ip: string;
};

// ---------------------------------------------------------------- mapping

export function toDiagnosis(d: DiagnosisDoc): DiagnosisView {
  return {
    id: d._id,
    crop: d.crop,
    status: d.status,
    createdAt: d.createdAt.toISOString(),
    top3: d.top3,
    ...(d.severity ? { severity: d.severity } : {}),
    ood: d.ood,
    modelVersion: d.modelVersion,
    kbVersion: d.kbVersion,
    channel: d.channel,
    upazila: d.upazila,
    ...(d.retakeReason ? { retakeReason: d.retakeReason } : {}),
    ...(d.prescriptionRef ? { prescriptionRef: d.prescriptionRef } : {}),
    ...(d.reviewTicket ? { reviewTicket: d.reviewTicket } : {}),
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

type Mapped = Pick<DiagnosisDoc, "status" | "top3" | "ood" | "severity" | "retakeReason">;

/** Plan §5 step 5: Gemini output → Diagnosis fields. null output (unparseable twice) → RETAKE. */
export function mapGeminiOutput(out: GeminiOutput | null, crop: CropId, gate: number): Mapped {
  if (!out) return { status: "RETAKE", top3: [], ood: 0.6, retakeReason: "blurry" };
  if (!out.isPlantLeaf) return { status: "RETAKE", top3: [], ood: 0.9, retakeReason: "not_leaf" };
  if (out.imageQuality !== "good") return { status: "RETAKE", top3: [], ood: 0.6, retakeReason: "blurry" };
  if (out.detectedCrop !== crop) return { status: "RETAKE", top3: [], ood: 0.7, retakeReason: "crop_mismatch" };

  // Scale down if Gemini's p values sum past 1.
  const sum = out.candidates.reduce((a, c) => a + c.p, 0);
  const scale = sum > 1 ? 1 / sum : 1;
  const ranked = out.candidates.map((c) => ({ code: c.code, p: round2(c.p * scale) })).sort((a, b) => b.p - a.p);

  const [top1, top2] = ranked;
  const unknownP = ranked.filter((c) => c.code === UNKNOWN).reduce((a, c) => a + c.p, 0);
  const known = ranked.filter((c) => c.code !== UNKNOWN);
  const ood = round2(Math.min(1, Math.max(unknownP, 1 - known.reduce((a, c) => a + c.p, 0))));

  const confident = !!top1 && top1.code !== UNKNOWN && top1.p >= gate && top1.p - (top2?.p ?? 0) >= CONFIDENT_GAP;
  const healthy = !!top1 && top1.code.endsWith("_HEALTHY");
  return {
    status: confident ? "CONFIDENT" : "UNCERTAIN",
    // UNKNOWN is not a disease the UI can show; it only feeds ood.
    top3: known.slice(0, 3),
    ood,
    ...(confident && !healthy && out.severity ? { severity: out.severity as Severity } : {}),
  };
}

// ---------------------------------------------------------------- create

function sniffMime(buf: Buffer): ImageMime | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

export async function createDiagnosis(input: CreateDiagnosisInput): Promise<DiagnosisView> {
  const env = getEnv();
  // 10/min per IP for everyone; 30/day per IP and per farmer. A dealer shop diagnoses for
  // many farmers, so a dealer session gets its own day budget instead of the IP one.
  await enforceRateLimit(`diagnose:ip:${input.ip}`, 10, 60);
  if (input.dealerId) {
    await enforceRateLimit(`diagnose:dealer:${input.dealerId}`, 30, 60);
    await enforceRateLimit(`diagnose:dealer-day:${input.dealerId}`, 300, 24 * 60 * 60);
  } else {
    await enforceRateLimit(`diagnose:ip-day:${input.ip}`, 30, 24 * 60 * 60);
  }
  if (input.userId) {
    await enforceRateLimit(`diagnose:user:${input.userId}`, 10, 60);
    await enforceRateLimit(`diagnose:user-day:${input.userId}`, 30, 24 * 60 * 60);
  }

  if (input.imageBytes.length === 0) throw badRequest("Image is empty");
  if (input.imageBytes.length > MAX_IMAGE_BYTES) throw new AppError("BAD_REQUEST", "Image must be 1 MB or smaller", 413);
  const sniffed = sniffMime(input.imageBytes);
  if (!sniffed || !(ALLOWED_MIME as readonly string[]).includes(input.mime) || sniffed !== input.mime) {
    throw badRequest("Image must be a JPEG, PNG or WebP photo");
  }

  const [settings, kb] = await Promise.all([getSettings(), publishedKbForCrop(input.crop)]);
  if (kb.length === 0) throw new AppError("INTERNAL", "Knowledge base is empty for this crop", 500);

  const imageHash = createHash("sha256").update(input.imageBytes).digest("hex");
  const { diagnoses, images } = await cols();

  // Hash cache (live mode only; mock output depends on the scenario header):
  // reuse the Gemini output of the same photo + crop from the last 24 h. A new diagnosis
  // doc is still created so two people never share one diagnosis' status or payment.
  let gemini: { model: string; output: GeminiOutput | null; ms: number; cached?: boolean } | null = null;
  if (env.GEMINI_MODE === "live") {
    const prev = await diagnoses.findOne(
      { imageHash, crop: input.crop, createdAt: { $gte: new Date(Date.now() - DAY_MS) }, "gemini.output": { $exists: true } },
      { sort: { createdAt: -1 }, projection: { gemini: 1 } },
    );
    const prevGemini = prev?.gemini as { model?: string; output?: GeminiOutput | null } | undefined;
    if (prevGemini?.model && prevGemini.output !== undefined) {
      gemini = { model: prevGemini.model, output: prevGemini.output, ms: 0, cached: true };
    }
  }
  if (!gemini) {
    gemini = await classifyLeaf({ crop: input.crop, image: input.imageBytes, mime: input.mime, kb, scenario: input.scenario });
  }

  const mapped = mapGeminiOutput(gemini.output, input.crop, settings.confidenceGate);
  const top1Kb = kb.find((d) => d._id === mapped.top3[0]?.code);
  const kbVersion = top1Kb?.kbVersion ?? Math.max(...kb.map((d) => d.kbVersion));
  const now = new Date();

  const { id } = await retryOnDuplicate(newDiagnosisId, async (id) => {
    const doc: DiagnosisDoc = {
      _id: id,
      crop: input.crop,
      ...mapped,
      modelVersion: `${gemini.model}+p${PROMPT_VERSION}`,
      kbVersion,
      channel: input.channel,
      upazila: input.upazila ?? "",
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.dealerId ? { dealerId: input.dealerId } : {}),
      imageHash,
      gemini: { model: gemini.model, output: gemini.output, ms: gemini.ms, ...(gemini.cached ? { cached: true } : {}) },
      createdAt: now,
    };
    await diagnoses.insertOne(doc);
    return doc;
  });

  // Keep the photo: 180 days with consent (training/review), else 7 days (disputes).
  try {
    const { id: imageId } = await retryOnDuplicate(newImageId, async (imageId) => {
      const img: ImageDoc = {
        _id: imageId,
        diagnosisId: id,
        mime: input.mime as ImageMime,
        data: new Binary(input.imageBytes),
        bytes: input.imageBytes.length,
        keepUntil: new Date(now.getTime() + (input.consent ? 180 : 7) * DAY_MS),
        createdAt: now,
      };
      await images.insertOne(img);
      return img;
    });
    await diagnoses.updateOne({ _id: id }, { $set: { imageId } });
  } catch (err) {
    log.warn("diagnosis.image_store_failed", { diagnosisId: id, err });
  }

  log.info("diagnosis.created", { diagnosisId: id, crop: input.crop, status: mapped.status, model: gemini.model, ms: gemini.ms, cached: !!gemini.cached });
  return getDiagnosis(id);
}

// ---------------------------------------------------------------- USSD

/**
 * Diagnosis from the USSD symptom tree (no photo, no Gemini). CONFIDENT for the pay path,
 * UNCERTAIN for the free agronomist-call path (so it can be queued for review).
 */
export async function createUssdDiagnosis(input: {
  crop: CropId;
  code: string;
  status: "CONFIDENT" | "UNCERTAIN";
  userId?: string;
}): Promise<DiagnosisView> {
  const kb = await publishedKbForCrop(input.crop);
  const entry = kb.find((d) => d._id === input.code);
  const kbVersion = entry?.kbVersion ?? (kb.length ? Math.max(...kb.map((d) => d.kbVersion)) : 0);
  const diagnoses = await col("diagnoses");
  const now = new Date();
  const { id } = await retryOnDuplicate(newDiagnosisId, async (id) => {
    const doc: DiagnosisDoc = {
      _id: id,
      crop: input.crop,
      status: input.status,
      top3: [{ code: input.code, p: 1 }],
      ood: 0,
      modelVersion: "ussd-tree",
      kbVersion,
      channel: "ussd",
      upazila: "",
      ...(input.userId ? { userId: input.userId } : {}),
      imageHash: "",
      createdAt: now,
    };
    await diagnoses.insertOne(doc);
    return doc;
  });
  return getDiagnosis(id);
}

// ---------------------------------------------------------------- get

async function loadDoc(id: string): Promise<DiagnosisDoc> {
  const diagnoses = await col("diagnoses");
  const doc = await diagnoses.findOne({ _id: id });
  if (!doc) throw notFound("Diagnosis not found");
  return doc;
}

/** Who is acting on a diagnosis. Anonymous diagnoses stay open; owned ones only to the owner. */
export type Actor = { userId?: string; dealerId?: string };

function assertCanModify(doc: DiagnosisDoc, actor: Actor) {
  // 404, not 403, so ids of other people's diagnoses aren't confirmed.
  const byUser = !!doc.userId && doc.userId === actor.userId;
  const byDealer = !!doc.dealerId && doc.dealerId === actor.dealerId;
  if ((doc.userId || doc.dealerId) && !byUser && !byDealer) throw notFound("Diagnosis not found");
}

export async function getDiagnosis(id: string): Promise<DiagnosisView> {
  return toDiagnosis(await loadDoc(id));
}

// ---------------------------------------------------------------- clarify

/**
 * Server copy of answerClarify() from src/lib/api.ts: question boosts re-rank the candidates.
 * Always starts from the pre-answer top3, so answering again doesn't compound.
 */
export function rerank(crop: CropId, baseTop3: { code: string; p: number }[], answers: Record<string, number>, gate: number) {
  const scores: Record<string, number> = {};
  baseTop3.forEach((c) => (scores[c.code] = c.p));
  CLARIFY.filter((q) => q.crop === crop).forEach((q) => {
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
  const confident = !!top3[0] && top3[0].p >= gate;
  return {
    top3,
    status: (confident ? "CONFIDENT" : "UNCERTAIN") as DiagnosisStatus,
    severity: confident ? ("mild" as const) : undefined,
  };
}

export async function answerDiagnosis(id: string, answers: Record<string, number>, actor: Actor = {}): Promise<DiagnosisView> {
  const doc = await loadDoc(id);
  assertCanModify(doc, actor);
  if (doc.status !== "UNCERTAIN") throw conflict("Only uncertain results can be clarified", { status: doc.status });

  const questions = CLARIFY.filter((q) => q.crop === doc.crop);
  for (const [qid, idx] of Object.entries(answers)) {
    const q = questions.find((x) => x.id === qid);
    if (!q) throw badRequest(`Unknown question ${qid} for ${doc.crop}`);
    if (!Number.isInteger(idx) || idx < 0 || idx >= q.options.length) throw badRequest(`Invalid option for ${qid}`);
  }

  const settings = await getSettings();
  const base = doc.initialTop3 ?? doc.top3;
  const next = rerank(doc.crop, base, answers, settings.confidenceGate);

  const diagnoses = await col("diagnoses");
  await diagnoses.updateOne(
    { _id: id, status: "UNCERTAIN" },
    {
      $set: {
        top3: next.top3,
        status: next.status,
        answers,
        initialTop3: base,
        updatedAt: new Date(),
        ...(next.severity ? { severity: next.severity } : {}),
      },
      ...(next.severity ? {} : { $unset: { severity: "" } }),
    },
  );
  return getDiagnosis(id);
}

// ---------------------------------------------------------------- review

export async function requestReview(id: string, input: { msisdn: string; note?: string }, actor: Actor = {}): Promise<{ ticket: string }> {
  const msisdn = normalizeMsisdn(input.msisdn);
  if (!msisdn) throw badRequest("Enter a Banglalink number (019 or 014)");

  const doc = await loadDoc(id);
  assertCanModify(doc, actor);
  if (doc.reviewTicket) return { ticket: doc.reviewTicket }; // idempotent
  if (doc.status !== "UNCERTAIN") throw conflict("Only uncertain results can be sent for review", { status: doc.status });

  const { reviews, diagnoses } = await cols();
  const now = new Date();
  const { id: ticket } = await retryOnDuplicate(newReviewTicket, async (ticket) => {
    const review: ReviewDoc = {
      _id: ticket,
      diagnosisId: id,
      kind: "uncertain",
      msisdn,
      ...(actor.userId ? { userId: actor.userId } : {}),
      ...(input.note ? { note: input.note } : {}),
      status: "open",
      useForTraining: false,
      createdAt: now,
      updatedAt: now,
    };
    await reviews.insertOne(review);
    return review;
  });

  const r = await diagnoses.updateOne(
    { _id: id, reviewTicket: { $exists: false } },
    { $set: { status: "QUEUED_REVIEW", reviewTicket: ticket, updatedAt: now } },
  );
  if (r.matchedCount === 0) {
    // Lost a race with a parallel request: keep theirs, drop ours.
    await reviews.deleteOne({ _id: ticket });
    return { ticket: (await loadDoc(id)).reviewTicket! };
  }
  log.info("diagnosis.review_requested", { diagnosisId: id, ticket, msisdn: maskMsisdn(msisdn) });
  return { ticket };
}
