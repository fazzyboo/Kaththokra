import "server-only";
import type { Tx } from "@/lib/i18n";
import { DISEASES } from "@/lib/data";
import type { KbDiseaseDoc, KbFreeFields, KbPaidFields } from "../db/types";

/*
  Paid treatment fields for the server KB. These leave the browser bundle in F3, when
  src/lib/data.ts keeps only the free fields (name, symptoms, cause, care).
  SAMPLE content for build/demo only: not agronomist-approved (BR R-7).
  Generic active ingredients only, never brands (BR R-6).
*/

const SAFE_GEAR: Tx = {
  bn: "মাস্ক, গ্লাভস ও লম্বা হাতার জামা পরে স্প্রে করুন। বাতাসের উল্টো দিকে স্প্রে করবেন না। লেবেল পড়ুন।",
  en: "Spray wearing a mask, gloves and long sleeves. Never spray into the wind. Read the label.",
};

const NO_SPRAY_SAFETY: Tx = { bn: "অপ্রয়োজনে কীটনাশক দেবেন না", en: "Do not spray without need" };
const NO_SPRAY: Tx = { bn: "কোনো ওষুধ লাগবে না", en: "No spray needed" };
const DASH: Tx = { bn: "—", en: "—" };

export const KB_PAID: Record<string, KbPaidFields> = {
  // ---------------- Rice ----------------
  RICE_BLAST: {
    activeIngredient: { bn: "ট্রাইসাইক্লাজল ৭৫% WP", en: "Tricyclazole 75% WP" },
    dose: { bn: "প্রতি শতকে ৩ লিটার পানিতে ২ গ্রাম", en: "2 g in 3 L water per shotok" },
    timing: { bn: "বিকেলে স্প্রে করুন; ৭–১০ দিন পর আরেকবার", en: "Spray in the afternoon; repeat after 7–10 days" },
    phiDays: 14,
    safety: SAFE_GEAR,
  },
  RICE_BROWN_SPOT: {
    activeIngredient: { bn: "প্রোপিকোনাজল ২৫% EC", en: "Propiconazole 25% EC" },
    dose: { bn: "প্রতি শতকে ৩ লিটার পানিতে ২ মিলি", en: "2 ml in 3 L water per shotok" },
    timing: { bn: "দাগ দেখা দিলেই; ১০ দিন পর আরেকবার", en: "As soon as spots appear; repeat after 10 days" },
    phiDays: 21,
    safety: SAFE_GEAR,
  },
  RICE_BLB: {
    activeIngredient: { bn: "কপার হাইড্রক্সাইড ৭৭% WP", en: "Copper hydroxide 77% WP" },
    dose: { bn: "প্রতি শতকে ৩ লিটার পানিতে ৪ গ্রাম", en: "4 g in 3 L water per shotok" },
    timing: { bn: "জমির পানি সরিয়ে ২–৩ দিন শুকনো রাখুন, তারপর স্প্রে", en: "Drain the field for 2–3 days, then spray" },
    phiDays: 10,
    safety: SAFE_GEAR,
  },
  RICE_SHEATH_BLIGHT: {
    activeIngredient: { bn: "হেক্সাকোনাজল ৫% SC", en: "Hexaconazole 5% SC" },
    dose: { bn: "প্রতি শতকে ৩ লিটার পানিতে ৬ মিলি", en: "6 ml in 3 L water per shotok" },
    timing: { bn: "গাছের গোড়ায় স্প্রে; ১০–১৫ দিন পর আরেকবার", en: "Spray at the base; repeat after 10–15 days" },
    phiDays: 21,
    safety: SAFE_GEAR,
  },
  RICE_HEALTHY: {
    activeIngredient: NO_SPRAY,
    dose: DASH,
    timing: { bn: "নিয়মিত জমি দেখুন", en: "Keep checking the field" },
    phiDays: 0,
    safety: NO_SPRAY_SAFETY,
  },
  // ---------------- Potato ----------------
  POTATO_LATE_BLIGHT: {
    activeIngredient: { bn: "মেটালাক্সিল + ম্যানকোজেব", en: "Metalaxyl + Mancozeb" },
    dose: { bn: "প্রতি শতকে ৩ লিটার পানিতে ৬ গ্রাম", en: "6 g in 3 L water per shotok" },
    timing: { bn: "এখনই স্প্রে; কুয়াশা থাকলে ৭ দিন পর আবার", en: "Spray now; repeat after 7 days if foggy" },
    phiDays: 14,
    safety: SAFE_GEAR,
  },
  POTATO_EARLY_BLIGHT: {
    activeIngredient: { bn: "ম্যানকোজেব ৮০% WP", en: "Mancozeb 80% WP" },
    dose: { bn: "প্রতি শতকে ৩ লিটার পানিতে ৬ গ্রাম", en: "6 g in 3 L water per shotok" },
    timing: { bn: "১০ দিন পরপর ২–৩ বার", en: "2–3 sprays, 10 days apart" },
    phiDays: 7,
    safety: SAFE_GEAR,
  },
  POTATO_HEALTHY: {
    activeIngredient: NO_SPRAY,
    dose: DASH,
    timing: { bn: "কুয়াশার সময় নিয়মিত জমি দেখুন", en: "Check often during foggy spells" },
    phiDays: 0,
    safety: NO_SPRAY_SAFETY,
  },
  // ---------------- Tomato ----------------
  TOMATO_EARLY_BLIGHT: {
    activeIngredient: { bn: "ক্লোরোথ্যালোনিল ৭৫% WP", en: "Chlorothalonil 75% WP" },
    dose: { bn: "প্রতি শতকে ৩ লিটার পানিতে ৬ গ্রাম", en: "6 g in 3 L water per shotok" },
    timing: { bn: "৭–১০ দিন পরপর", en: "Every 7–10 days" },
    phiDays: 7,
    safety: SAFE_GEAR,
  },
  TOMATO_LATE_BLIGHT: {
    activeIngredient: { bn: "সাইমক্সানিল + ম্যানকোজেব", en: "Cymoxanil + Mancozeb" },
    dose: { bn: "প্রতি শতকে ৩ লিটার পানিতে ৬ গ্রাম", en: "6 g in 3 L water per shotok" },
    timing: { bn: "এখনই; ৭ দিন পর আবার", en: "Now; repeat after 7 days" },
    phiDays: 10,
    safety: SAFE_GEAR,
  },
  TOMATO_LEAF_MOLD: {
    activeIngredient: { bn: "কপার অক্সিক্লোরাইড ৫০% WP", en: "Copper oxychloride 50% WP" },
    dose: { bn: "প্রতি শতকে ৩ লিটার পানিতে ৬ গ্রাম", en: "6 g in 3 L water per shotok" },
    timing: { bn: "১০ দিন পরপর ২ বার", en: "Twice, 10 days apart" },
    phiDays: 7,
    safety: SAFE_GEAR,
  },
  TOMATO_HEALTHY: {
    activeIngredient: NO_SPRAY,
    dose: DASH,
    timing: { bn: "নিয়মিত জমি দেখুন", en: "Keep checking the field" },
    phiDays: 0,
    safety: NO_SPRAY_SAFETY,
  },
};

/**
 * Full KB docs: free fields from src/lib/data.ts + paid fields above.
 * kbVersion and approvedBy/At come from data.ts; every entry is seeded as "published".
 * Throws if a disease in data.ts has no paid entry (or vice versa).
 */
export function buildKbDocs(now = new Date()): KbDiseaseDoc[] {
  const codes = new Set(DISEASES.map((d) => d.code));
  const extra = Object.keys(KB_PAID).filter((c) => !codes.has(c));
  const missing = [...codes].filter((c) => !KB_PAID[c]);
  if (extra.length || missing.length) {
    throw new Error(`KB seed mismatch. Missing paid fields: [${missing.join(", ")}]; unknown codes: [${extra.join(", ")}]`);
  }

  return DISEASES.map((d) => {
    const free: KbFreeFields = {
      crop: d.crop,
      name: d.name,
      banglish: d.banglish,
      ...(d.healthy ? { healthy: true } : {}),
      symptoms: d.symptoms,
      cause: d.cause,
      care: d.care,
    };
    const doc: KbDiseaseDoc = {
      _id: d.code,
      ...free,
      ...KB_PAID[d.code],
      kbVersion: d.kbVersion,
      kbStatus: "published",
      ...(d.approvedBy ? { approvedBy: d.approvedBy } : {}),
      ...(d.approvedAt ? { approvedAt: d.approvedAt } : {}),
      history: [{ kbVersion: d.kbVersion, kbStatus: "published", by: "seed", at: now, note: "Initial seed from src/lib/data.ts" }],
      updatedAt: now,
    };
    return doc;
  });
}
