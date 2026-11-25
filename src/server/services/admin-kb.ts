import "server-only";
import type { Tx } from "@/lib/i18n";
import type { Disease, KbStatus } from "@/lib/types";
import type { AdminAuth } from "../auth/session";
import { cols } from "../db/collections";
import type { Document, PushOperator } from "mongodb";
import type { KbDiseaseDoc, KbDraft, KbHistoryEntry } from "../db/types";
import { conflict, forbidden, notFound } from "../http/errors";
import { audit } from "./audit";
import { invalidateKbCache } from "./kb";

/*
  Knowledge-base workflow (BACKEND_PLAN.md §6). Top-level fields of a kbDiseases doc are the
  live PUBLISHED version; edits happen on `draft`:
    published → draft   (creates draft = copy, kbVersion + 1)
    draft → review      (any KB role)
    review → approved   (agronomist / admin)      review → draft (send back)
    approved → published (promote the draft: becomes the live version, history kept)
  Prescriptions snapshot the top-level (latest published) version at sale time.
*/

// The driver's PushOperator typing can't see through KbDiseaseDoc's intersection type.
const pushHistory = (h: KbHistoryEntry) => ({ history: h }) as unknown as PushOperator<KbDiseaseDoc & Document>;

const CONTENT_KEYS = [
  "name",
  "banglish",
  "symptoms",
  "cause",
  "care",
  "activeIngredient",
  "dose",
  "timing",
  "phiDays",
  "safety",
] as const;

export type KbEditable = Partial<{
  name: Tx;
  banglish: string;
  symptoms: Tx[];
  cause: Tx;
  care: Tx[];
  activeIngredient: Tx;
  dose: Tx;
  timing: Tx;
  phiDays: number;
  safety: Tx;
}>;

function publishedView(d: KbDiseaseDoc): Disease {
  return {
    code: d._id,
    crop: d.crop,
    name: d.name,
    banglish: d.banglish,
    ...(d.healthy ? { healthy: true } : {}),
    symptoms: d.symptoms,
    cause: d.cause,
    activeIngredient: d.activeIngredient,
    dose: d.dose,
    timing: d.timing,
    phiDays: d.phiDays,
    safety: d.safety,
    care: d.care,
    kbVersion: d.kbVersion,
    kbStatus: d.kbStatus,
    ...(d.approvedBy ? { approvedBy: d.approvedBy } : {}),
    ...(d.approvedAt ? { approvedAt: d.approvedAt } : {}),
  };
}

function draftView(d: KbDiseaseDoc): Disease | null {
  if (!d.draft) return null;
  const x = d.draft;
  return {
    code: d._id,
    crop: x.crop,
    name: x.name,
    banglish: x.banglish,
    ...(x.healthy ? { healthy: true } : {}),
    symptoms: x.symptoms,
    cause: x.cause,
    activeIngredient: x.activeIngredient,
    dose: x.dose,
    timing: x.timing,
    phiDays: x.phiDays,
    safety: x.safety,
    care: x.care,
    kbVersion: x.kbVersion,
    kbStatus: x.kbStatus,
    ...(x.approvedBy ? { approvedBy: x.approvedBy } : {}),
    ...(x.approvedAt ? { approvedAt: x.approvedAt } : {}),
  };
}

/** List row: the entry as the KB pages show it (draft status wins while one exists). */
export type KbListRow = Disease & { publishedVersion: number; hasDraft: boolean; updatedAt: string };

export async function listKb(): Promise<KbListRow[]> {
  const { kbDiseases } = await cols();
  const docs = await kbDiseases.find().sort({ crop: 1, _id: 1 }).toArray();
  return docs.map((d) => ({
    ...(draftView(d) ?? publishedView(d)),
    publishedVersion: d.kbVersion,
    hasDraft: !!d.draft,
    updatedAt: (d.draft?.updatedAt ?? d.updatedAt).toISOString(),
  }));
}

export type KbDetail = { published: Disease; draft: Disease | null; history: (Omit<KbHistoryEntry, "at"> & { at: string })[] };

async function load(code: string): Promise<KbDiseaseDoc> {
  const { kbDiseases } = await cols();
  const d = await kbDiseases.findOne({ _id: code });
  if (!d) throw notFound("Unknown disease code");
  return d;
}

function toDetail(d: KbDiseaseDoc): KbDetail {
  return {
    published: publishedView(d),
    draft: draftView(d),
    history: [...d.history].reverse().map((h) => ({ ...h, at: h.at.toISOString() })),
  };
}

export async function getKb(code: string): Promise<KbDetail> {
  return toDetail(await load(code));
}

/** PUT: only while the draft is in "draft". */
export async function editKbDraft(code: string, patch: KbEditable, auth: AdminAuth): Promise<KbDetail> {
  const { kbDiseases } = await cols();
  const d = await load(code);
  if (!d.draft || d.draft.kbStatus !== "draft") {
    throw conflict("Only a draft can be edited. Move the entry to draft first.", { status: d.draft?.kbStatus ?? d.kbStatus });
  }
  const set: Record<string, unknown> = { "draft.updatedAt": new Date(), "draft.updatedBy": auth.admin._id };
  for (const k of CONTENT_KEYS) if (patch[k] !== undefined) set[`draft.${k}`] = patch[k];
  await kbDiseases.updateOne({ _id: code, "draft.kbStatus": "draft" }, { $set: set });
  await audit(auth.admin._id, "kb.edit", "kb", code, { fields: Object.keys(patch), kbVersion: d.draft.kbVersion });
  return getKb(code);
}

type To = "draft" | "review" | "approved" | "published";

export async function transitionKb(code: string, to: To, auth: AdminAuth, note?: string): Promise<KbDetail> {
  const { kbDiseases } = await cols();
  const d = await load(code);
  const from: KbStatus = d.draft?.kbStatus ?? d.kbStatus;
  const role = auth.admin.role;
  const now = new Date();
  const history = (kbVersion: number, kbStatus: KbStatus): KbHistoryEntry => ({ kbVersion, kbStatus, by: auth.admin._id, at: now, ...(note ? { note } : {}) });
  const bad = () => conflict(`Can't move ${code} from ${from} to ${to}`, { from, to });

  if (to === "draft") {
    if (!d.draft) {
      if (d.kbStatus !== "published") throw bad();
      // published → draft: start v+1 as a copy of the live version.
      const draft: KbDraft = {
        crop: d.crop,
        name: d.name,
        banglish: d.banglish,
        ...(d.healthy ? { healthy: true } : {}),
        symptoms: d.symptoms,
        cause: d.cause,
        care: d.care,
        activeIngredient: d.activeIngredient,
        dose: d.dose,
        timing: d.timing,
        phiDays: d.phiDays,
        safety: d.safety,
        kbVersion: d.kbVersion + 1,
        kbStatus: "draft",
        updatedBy: auth.admin._id,
        updatedAt: now,
      };
      const r = await kbDiseases.updateOne({ _id: code, draft: { $exists: false } }, { $set: { draft }, $push: pushHistory(history(draft.kbVersion, "draft")) });
      if (!r.modifiedCount) throw conflict("Someone else started a draft, reload");
    } else if (d.draft.kbStatus === "review" || d.draft.kbStatus === "approved") {
      // Send back for more edits; approval is dropped.
      await kbDiseases.updateOne(
        { _id: code },
        { $set: { "draft.kbStatus": "draft", "draft.updatedAt": now, "draft.updatedBy": auth.admin._id }, $unset: { "draft.approvedBy": "", "draft.approvedAt": "" }, $push: pushHistory(history(d.draft.kbVersion, "draft")) },
      );
    } else throw bad();
  } else if (to === "review") {
    if (d.draft?.kbStatus !== "draft") throw bad();
    await kbDiseases.updateOne(
      { _id: code, "draft.kbStatus": "draft" },
      { $set: { "draft.kbStatus": "review", "draft.updatedAt": now }, $push: pushHistory(history(d.draft.kbVersion, "review")) },
    );
  } else if (to === "approved") {
    if (d.draft?.kbStatus !== "review") throw bad();
    if (role !== "agronomist" && role !== "admin") throw forbidden("Only an agronomist or admin can approve");
    await kbDiseases.updateOne(
      { _id: code, "draft.kbStatus": "review" },
      {
        $set: { "draft.kbStatus": "approved", "draft.approvedBy": auth.admin.name, "draft.approvedAt": now.toISOString().slice(0, 10), "draft.updatedAt": now },
        $push: pushHistory(history(d.draft.kbVersion, "approved")),
      },
    );
  } else if (to === "published") {
    if (d.draft?.kbStatus !== "approved") throw bad();
    if (role !== "agronomist" && role !== "admin") throw forbidden("Only an agronomist or admin can publish");
    const x = d.draft;
    const live: Partial<KbDiseaseDoc> = {
      crop: x.crop,
      name: x.name,
      banglish: x.banglish,
      symptoms: x.symptoms,
      cause: x.cause,
      care: x.care,
      activeIngredient: x.activeIngredient,
      dose: x.dose,
      timing: x.timing,
      phiDays: x.phiDays,
      safety: x.safety,
      kbVersion: x.kbVersion,
      kbStatus: "published",
      ...(x.approvedBy ? { approvedBy: x.approvedBy } : {}),
      ...(x.approvedAt ? { approvedAt: x.approvedAt } : {}),
      updatedAt: now,
    };
    const r = await kbDiseases.updateOne(
      { _id: code, "draft.kbStatus": "approved", "draft.kbVersion": x.kbVersion },
      { $set: live, $unset: { draft: "" }, $push: pushHistory(history(x.kbVersion, "published")) },
    );
    if (!r.modifiedCount) throw conflict("The draft changed meanwhile, reload");
    invalidateKbCache();
  } else throw bad();

  await audit(auth.admin._id, "kb.transition", "kb", code, { from, to, ...(note ? { note } : {}) });
  return getKb(code);
}
