import "server-only";
import type { CropId } from "@/lib/types";
import { col } from "../db/collections";
import type { KbDiseaseDoc } from "../db/types";

/*
  Read side of the knowledge base. Only "published" entries are used for diagnosis
  (Gemini's allowed codes) and prescriptions. Cached per instance for 60 s; admin KB
  edits (B10) call invalidateKbCache().
*/

const TTL_MS = 60_000;
type Entry = { at: number; docs: KbDiseaseDoc[] };
const g = globalThis as typeof globalThis & { __kkKb?: Map<CropId, Entry> };
const cache: Map<CropId, Entry> = (g.__kkKb ??= new Map());

export async function publishedKbForCrop(crop: CropId): Promise<KbDiseaseDoc[]> {
  const hit = cache.get(crop);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.docs;
  const kb = await col("kbDiseases");
  const docs = await kb.find({ crop, kbStatus: "published" }).sort({ _id: 1 }).toArray();
  cache.set(crop, { at: Date.now(), docs });
  return docs;
}

export function invalidateKbCache() {
  cache.clear();
}
