import "server-only";
import type { AlertItem } from "@/lib/admin-data";
import { UPAZILAS } from "@/lib/data";
import type { Tx } from "@/lib/i18n";
import type { CropId } from "@/lib/types";
import type { AdminAuth } from "../auth/session";
import { cols } from "../db/collections";
import type { AlertDoc } from "../db/types";
import { AppError, badRequest, conflict, notFound } from "../http/errors";
import { newAlertId, retryOnDuplicate } from "../lib/ids";
import { DAY_MS, nextDhaka0700 } from "../lib/time";
import { audit } from "./audit";
import { smsSegments } from "./messaging";
import { getSettings } from "./settings";

/*
  Outbreak alerts (SUB-7/8). Suggestions are computed on read: a crop/disease/upazila with
  ≥ 5 confident diagnoses in 7 days and no alert for that disease + upazila in 3 days.
  Admin creates (or adopts a suggestion) → approves → scheduled for the next 07:00 Dhaka;
  the send-alerts job (B11) sends it.
*/

export const OUTBREAK_THRESHOLD = 5;
const SUGGEST_WINDOW_MS = 7 * DAY_MS;
const QUIET_MS = 3 * DAY_MS;
export const MAX_ALERT_SEGMENTS = 2;

const UPAZILA_CODES = new Set(UPAZILAS.map((u) => u.code));
const upzName = (code: string) => UPAZILAS.find((u) => u.code === code)?.name ?? { bn: code, en: code };

export async function recipientCount(crop: CropId, upazilas: string[]): Promise<number> {
  const { subscriptions } = await cols();
  return subscriptions.countDocuments({ status: "REGISTERED", crops: crop, upazila: { $in: upazilas } });
}

function toItem(a: AlertDoc): AlertItem {
  return {
    id: a._id,
    crop: a.crop,
    diseaseCode: a.diseaseCode,
    upazilas: a.upazilas,
    message: a.message,
    status: a.status,
    recipients: a.recipients,
    at: (a.sentAt ?? a.sendAt ?? a.createdAt).toISOString(),
    ...(a.trigger ? { trigger: a.trigger } : {}),
    ...(a.delivered !== undefined ? { delivered: a.delivered } : {}),
  };
}

function checkMessage(m: Tx) {
  for (const lang of ["bn", "en"] as const) {
    const s = smsSegments(m[lang]);
    if (s.segments > MAX_ALERT_SEGMENTS) {
      throw badRequest(`message.${lang} is ${s.segments} SMS segments (${s.units} ${s.encoding} units); max ${MAX_ALERT_SEGMENTS}`);
    }
  }
}

// ---------------------------------------------------------------- suggestions

async function defaultMessage(code: string, upazilas: string[]): Promise<Tx> {
  const { kbDiseases } = await cols();
  const { helpline } = await getSettings();
  const kb = await kbDiseases.findOne({ _id: code }, { projection: { name: 1 } });
  const name = kb?.name ?? { bn: code, en: code };
  const places = upazilas.slice(0, 2).map(upzName);
  return {
    bn: `কাঠঠোকরা সতর্কতা: ${places.map((p) => p.bn).join(" ও ")}-এ ${name.bn} বাড়ছে। লক্ষণ দেখলে ছবি দিন বা ${helpline}-এ কল করুন।`,
    en: `Kaththokra alert: ${name.en} is rising in ${places.map((p) => p.en).join(" and ")}. If you see signs, send a photo or call ${helpline}.`,
  };
}

type Suggestion = { crop: CropId; code: string; upazilas: string[]; counts: number[] };

async function computeSuggestions(): Promise<Suggestion[]> {
  const { diagnoses, alerts } = await cols();
  const now = Date.now();
  const rows = await diagnoses
    .aggregate<{ _id: { crop: CropId; code: string; upazila: string }; n: number }>([
      { $match: { status: { $in: ["CONFIDENT", "UNLOCKED"] }, createdAt: { $gte: new Date(now - SUGGEST_WINDOW_MS) }, upazila: { $ne: "" } } },
      { $group: { _id: { crop: "$crop", code: { $arrayElemAt: ["$top3.code", 0] }, upazila: "$upazila" }, n: { $sum: 1 } } },
      { $match: { n: { $gte: OUTBREAK_THRESHOLD } } },
    ])
    .toArray();

  const recent = await alerts
    .find({ status: { $in: ["scheduled", "sent"] }, $or: [{ sendAt: { $gte: new Date(now - QUIET_MS) } }, { createdAt: { $gte: new Date(now - QUIET_MS) } }] })
    .toArray();
  const covered = new Set(recent.flatMap((a) => a.upazilas.map((u) => `${a.diseaseCode}|${u}`)));

  const by = new Map<string, Suggestion>();
  for (const r of rows) {
    const { crop, code, upazila } = r._id;
    if (!code || code.endsWith("_HEALTHY") || code === "UNKNOWN") continue;
    if (covered.has(`${code}|${upazila}`)) continue;
    const s = by.get(code) ?? { crop, code, upazilas: [], counts: [] };
    s.upazilas.push(upazila);
    s.counts.push(r.n);
    by.set(code, s);
  }
  // Busiest upazila first.
  return [...by.values()].map((s) => {
    const order = s.counts.map((n, i) => [n, i] as const).sort((a, b) => b[0] - a[0]);
    return { ...s, upazilas: order.map(([, i]) => s.upazilas[i]), counts: order.map(([n]) => n) };
  });
}

const suggestionId = (code: string) => `SUG-${code}`;

export async function listAlerts(): Promise<AlertItem[]> {
  const { alerts } = await cols();
  const [stored, suggestions] = await Promise.all([alerts.find().sort({ createdAt: -1 }).limit(200).toArray(), computeSuggestions()]);
  const now = new Date().toISOString();
  const suggested: AlertItem[] = await Promise.all(
    suggestions.map(async (s) => ({
      id: suggestionId(s.code),
      crop: s.crop,
      diseaseCode: s.code,
      upazilas: s.upazilas,
      message: await defaultMessage(s.code, s.upazilas),
      status: "suggested" as const,
      recipients: await recipientCount(s.crop, s.upazilas),
      at: now,
      trigger: `${s.counts.join(" + ")} confident cases in 7 days`,
    })),
  );
  return [...suggested, ...stored.map(toItem)];
}

// ---------------------------------------------------------------- create / approve / delete

export type CreateAlertInput = { crop: CropId; diseaseCode: string; upazilas: string[]; message: Tx; trigger?: string };

export async function createAlert(input: CreateAlertInput, auth: AdminAuth): Promise<AlertItem> {
  const { alerts, kbDiseases } = await cols();
  const upazilas = [...new Set(input.upazilas)];
  if (!upazilas.length || upazilas.some((u) => !UPAZILA_CODES.has(u))) throw badRequest("Unknown upazila");
  const kb = await kbDiseases.findOne({ _id: input.diseaseCode, crop: input.crop }, { projection: { _id: 1 } });
  if (!kb) throw badRequest("Disease code does not belong to this crop");
  checkMessage(input.message);

  const recipients = await recipientCount(input.crop, upazilas);
  const { result } = await retryOnDuplicate(newAlertId, async (id) => {
    const doc: AlertDoc = {
      _id: id,
      crop: input.crop,
      diseaseCode: input.diseaseCode,
      upazilas,
      message: input.message,
      status: "suggested",
      recipients,
      ...(input.trigger ? { trigger: input.trigger } : {}),
      createdBy: auth.admin._id,
      createdAt: new Date(),
    };
    await alerts.insertOne(doc);
    return doc;
  }, 20);
  await audit(auth.admin._id, "alert.create", "alert", result._id, { crop: input.crop, diseaseCode: input.diseaseCode, upazilas, recipients });
  return toItem(result);
}

/** Approve → scheduled for the next 07:00 Dhaka. A computed suggestion (SUG-…) is saved first. */
export async function approveAlert(id: string, auth: AdminAuth): Promise<AlertItem> {
  const { alerts } = await cols();
  let alertId = id;
  if (id.startsWith("SUG-")) {
    const s = (await computeSuggestions()).find((x) => suggestionId(x.code) === id);
    if (!s) throw notFound("Suggestion no longer applies");
    const created = await createAlert(
      { crop: s.crop, diseaseCode: s.code, upazilas: s.upazilas, message: await defaultMessage(s.code, s.upazilas), trigger: `${s.counts.join(" + ")} confident cases in 7 days` },
      auth,
    );
    alertId = created.id;
  }
  const cur = await alerts.findOne({ _id: alertId });
  if (!cur) throw notFound("Alert not found");
  if (cur.status !== "suggested") throw conflict("Only suggested alerts can be approved", { status: cur.status });

  const sendAt = nextDhaka0700();
  const recipients = await recipientCount(cur.crop, cur.upazilas);
  const doc = await alerts.findOneAndUpdate(
    { _id: alertId, status: "suggested" },
    { $set: { status: "scheduled", sendAt, recipients, approvedBy: auth.admin._id } },
    { returnDocument: "after" },
  );
  if (!doc) throw conflict("Alert changed meanwhile, reload");
  await audit(auth.admin._id, "alert.approve", "alert", alertId, { sendAt: sendAt.toISOString(), recipients });
  return toItem(doc);
}

export async function deleteAlert(id: string, auth: AdminAuth): Promise<{ ok: true }> {
  const { alerts } = await cols();
  const cur = await alerts.findOne({ _id: id });
  if (!cur) throw notFound("Alert not found");
  if (cur.status === "sent") throw new AppError("CONFLICT", "A sent alert can't be deleted", 409);
  await alerts.deleteOne({ _id: id, status: { $ne: "sent" } });
  await audit(auth.admin._id, "alert.delete", "alert", id, { status: cur.status });
  return { ok: true };
}

// ---------------------------------------------------------------- heatmap

export type Heatmap = { diseases: string[]; upazilas: string[]; cells: (number | null)[][]; days: number; threshold: number };

/** CONFIDENT diagnoses in 30 days by top disease × upazila. Counts under 5 are null (privacy + noise). */
export async function heatmap(crop?: CropId): Promise<Heatmap> {
  const { diagnoses, kbDiseases } = await cols();
  const kb = await kbDiseases
    .find({ ...(crop ? { crop } : {}), healthy: { $ne: true } }, { projection: { _id: 1, crop: 1 } })
    .sort({ crop: 1, _id: 1 })
    .toArray();
  const diseases = kb.map((d) => d._id);
  const upazilas = UPAZILAS.map((u) => u.code);
  const rows = await diagnoses
    .aggregate<{ _id: { code: string; upazila: string }; n: number }>([
      {
        $match: {
          status: { $in: ["CONFIDENT", "UNLOCKED"] },
          createdAt: { $gte: new Date(Date.now() - 30 * DAY_MS) },
          ...(crop ? { crop } : {}),
        },
      },
      { $group: { _id: { code: { $arrayElemAt: ["$top3.code", 0] }, upazila: "$upazila" }, n: { $sum: 1 } } },
    ])
    .toArray();
  const count = new Map(rows.map((r) => [`${r._id.code}|${r._id.upazila}`, r.n]));
  const cells = diseases.map((code) =>
    upazilas.map((u) => {
      const n = count.get(`${code}|${u}`) ?? 0;
      return n < OUTBREAK_THRESHOLD ? null : n;
    }),
  );
  return { diseases, upazilas, cells, days: 30, threshold: OUTBREAK_THRESHOLD };
}
