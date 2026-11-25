import "server-only";
import type { ReviewItem } from "@/lib/admin-data";
import { CLARIFY } from "@/lib/data";
import type { AdminAuth } from "../auth/session";
import { cols } from "../db/collections";
import type { DiagnosisDoc, ReviewDoc } from "../db/types";
import { conflict, notFound } from "../http/errors";
import { maskMsisdn } from "../lib/msisdn";
import { audit } from "./audit";
import { toDiagnosis, type DiagnosisView } from "./diagnosis";
import { sendSms } from "./messaging";

/*
  Agronomist review queue (ADM-4). Open = open | in_progress; done = closed.
*/

/** Clarify answers as their English option labels (what the queue shows). */
function answerLabels(d: DiagnosisDoc | undefined): string[] | undefined {
  if (!d?.answers) return undefined;
  const out: string[] = [];
  for (const [qid, idx] of Object.entries(d.answers)) {
    const q = CLARIFY.find((x) => x.id === qid);
    const label = q?.options[idx]?.label.en;
    if (label) out.push(label);
  }
  return out.length ? out : undefined;
}

function toReviewItem(r: ReviewDoc, d: DiagnosisDoc | undefined): ReviewItem {
  return {
    id: r._id,
    kind: r.kind,
    crop: d?.crop ?? "rice",
    upazila: d?.upazila ?? "",
    at: r.createdAt.toISOString(),
    top3: d?.initialTop3 ?? d?.top3 ?? [],
    ...(r.note ? { note: r.note } : {}),
    ...(answerLabels(d) ? { answers: answerLabels(d) } : {}),
    status: r.status === "closed" ? "done" : "open",
    ...(r.verdict ? { verdict: r.verdict } : {}),
  };
}

export async function listReviews(status: "open" | "done"): Promise<ReviewItem[]> {
  const { reviews, diagnoses } = await cols();
  const rows = await reviews
    .find({ status: status === "done" ? "closed" : { $in: ["open", "in_progress"] } })
    .sort({ createdAt: status === "done" ? -1 : 1 }) // open: oldest first (FIFO)
    .limit(200)
    .toArray();
  const ds = await diagnoses.find({ _id: { $in: rows.map((r) => r.diagnosisId) } }).toArray();
  const by = new Map(ds.map((d) => [d._id, d]));
  return rows.map((r) => toReviewItem(r, by.get(r.diagnosisId)));
}

export type ReviewDetail = {
  item: ReviewItem;
  diagnosis: DiagnosisView | null;
  image: string | null; // data URL, when the photo is still kept
  farmer: string; // masked
  reply?: string;
  useForTraining: boolean;
  reviewedBy?: string;
};

export async function getReview(id: string): Promise<ReviewDetail> {
  const { reviews, diagnoses, images } = await cols();
  const r = await reviews.findOne({ _id: id });
  if (!r) throw notFound("Review not found");
  const d = await diagnoses.findOne({ _id: r.diagnosisId });
  const img = d?.imageId ? await images.findOne({ _id: d.imageId }) : null;
  return {
    item: toReviewItem(r, d ?? undefined),
    diagnosis: d ? toDiagnosis(d) : null,
    image: img ? `data:${img.mime};base64,${Buffer.from(img.data.buffer).toString("base64")}` : null,
    farmer: maskMsisdn(r.msisdn),
    ...(r.reply ? { reply: r.reply } : {}),
    useForTraining: r.useForTraining,
    ...(r.reviewedBy ? { reviewedBy: r.reviewedBy } : {}),
  };
}

export async function decideReview(
  id: string,
  input: { verdict: string; reply?: string; useForTraining: boolean; sendSms?: boolean },
  auth: AdminAuth,
): Promise<ReviewDetail> {
  const { reviews, diagnoses } = await cols();
  const r = await reviews.findOne({ _id: id });
  if (!r) throw notFound("Review not found");
  if (r.status === "closed") throw conflict("This review is already done");

  const now = new Date();
  await reviews.updateOne(
    { _id: id, status: { $ne: "closed" } },
    {
      $set: {
        status: "closed",
        verdict: input.verdict,
        ...(input.reply ? { reply: input.reply } : {}),
        useForTraining: input.useForTraining,
        reviewedBy: auth.admin._id,
        updatedAt: now,
      },
    },
  );
  await diagnoses.updateOne({ _id: r.diagnosisId, status: "QUEUED_REVIEW" }, { $set: { status: "REVIEWED", updatedAt: now } });

  let smsSent = false;
  if (input.reply && input.sendSms !== false) {
    const res = await sendSms(r.msisdn, `Kaththokra krishibid (${id}): ${input.reply}`, "review-reply");
    smsSent = res.ok;
  }
  await audit(auth.admin._id, "review.decide", "review", id, { verdict: input.verdict, useForTraining: input.useForTraining, smsSent });
  return getReview(id);
}
