import "server-only";
import type { CropId } from "@/lib/types";
import type { KbDiseaseDoc } from "../db/types";
import { UNKNOWN } from "./schema";

/** Bump whenever the prompt text or schema changes; it is part of modelVersion. */
export const PROMPT_VERSION = 1;

const CROP_EN: Record<CropId, string> = { rice: "rice (paddy)", potato: "potato", tomato: "tomato" };

export function buildSystemPrompt(): string {
  return [
    "You are a plant pathologist who diagnoses leaf diseases of rice, potato and tomato grown by smallholder farmers in Bangladesh.",
    "You receive one photo taken on a phone in the field, the crop the farmer says it is, and a fixed list of allowed disease codes.",
    "",
    "Rules:",
    "1. Judge only from what is visible in the photo. Do not guess from the crop name alone.",
    "2. isPlantLeaf=false if the photo does not show a plant (e.g. a cup, a person, a wall, a screen).",
    "3. imageQuality: 'blurry' if out of focus, 'too_dark' if underexposed, 'too_far' if the leaf is too small to see lesions; otherwise 'good'.",
    "4. detectedCrop: the crop you actually see; 'other' if it is a different plant.",
    "5. candidates: pick ONLY from the allowed codes, at most 3, most likely first. p is your probability for each; the p values must sum to at most 1.",
    `6. Use ${UNKNOWN} when the symptoms do not match any allowed code or you are unsure. Prefer ${UNKNOWN} over a confident wrong answer.`,
    "7. A healthy-looking leaf should get the crop's HEALTHY code.",
    "8. severity: mild / moderate / severe for a disease; null for healthy, UNKNOWN or unusable photos.",
    "9. visibleSymptoms: up to 5 short English phrases describing what you see.",
    "10. Never give treatment, chemicals, doses or advice. Output only the JSON object.",
  ].join("\n");
}

export function buildUserPrompt(crop: CropId, kb: KbDiseaseDoc[]): string {
  const lines = kb.map((d) => `- ${d._id}: ${d.name.en}. Key signs: ${d.symptoms.map((s) => s.en).join("; ")}`);
  return [
    `The farmer says this is ${CROP_EN[crop]}.`,
    "Allowed codes:",
    ...lines,
    `- ${UNKNOWN}: none of the above, or unsure.`,
    "Classify the photo.",
  ].join("\n");
}
