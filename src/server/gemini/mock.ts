import "server-only";
import type { CropId } from "@/lib/types";
import type { Scenario } from "../lib/scenario";
import type { GeminiOutput } from "./schema";

/*
  GEMINI_MODE=mock. Returns Gemini-shaped output for the demo scenario, so the real
  mapping in services/diagnosis.ts runs. Numbers match CONFIDENT_TOP / UNCERTAIN_TOP
  in src/lib/api.ts.
*/

export const MOCK_MODEL = "mock-gemini";

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

const toCandidates = (rows: [string, number][], allowed: Set<string>) =>
  rows.filter(([code]) => allowed.has(code)).map(([code, p]) => ({ code, p }));

export async function mockClassify(crop: CropId, scenario: Scenario["diagnosis"], allowedCodes: string[]): Promise<GeminiOutput> {
  await new Promise((r) => setTimeout(r, 600));
  const allowed = new Set(allowedCodes);
  const base = { isPlantLeaf: true, imageQuality: "good" as const, detectedCrop: crop, severity: null, visibleSymptoms: [] as string[] };

  switch (scenario) {
    case "retake":
      return { ...base, imageQuality: "blurry", candidates: [] };
    case "healthy":
      return {
        ...base,
        candidates: toCandidates([[`${crop.toUpperCase()}_HEALTHY`, 0.93]], allowed),
        visibleSymptoms: ["uniform green leaf", "no lesions"],
      };
    case "uncertain":
      return { ...base, candidates: toCandidates(UNCERTAIN_TOP[crop], allowed), severity: "mild", visibleSymptoms: ["small brown spots"] };
    case "confident":
    default:
      return { ...base, candidates: toCandidates(CONFIDENT_TOP[crop], allowed), severity: "moderate", visibleSymptoms: ["spots with grey centres"] };
  }
}
