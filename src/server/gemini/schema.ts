import "server-only";
import { Type, type Schema } from "@google/genai";
import { z } from "zod";

/*
  Structured output for leaf classification (BACKEND_PLAN.md §5).
  The candidate code enum is built per request from that crop's published KB codes + "UNKNOWN",
  so Gemini can only pick codes we have an approved prescription for.
*/

export const UNKNOWN = "UNKNOWN";

export const IMAGE_QUALITY = ["good", "blurry", "too_dark", "too_far"] as const;
export const DETECTED_CROP = ["rice", "potato", "tomato", "other"] as const;
export const SEVERITY = ["mild", "moderate", "severe"] as const;

export function allowedCodes(kbCodes: string[]): [string, ...string[]] {
  return [UNKNOWN, ...kbCodes.filter((c) => c !== UNKNOWN)];
}

/** Gemini responseSchema (OpenAPI subset). */
export function buildResponseSchema(codes: string[]): Schema {
  return {
    type: Type.OBJECT,
    properties: {
      isPlantLeaf: { type: Type.BOOLEAN, description: "True only if the photo shows a plant leaf, stem or plant part." },
      imageQuality: { type: Type.STRING, enum: [...IMAGE_QUALITY], description: "Is the photo usable for diagnosis?" },
      detectedCrop: { type: Type.STRING, enum: [...DETECTED_CROP], description: "Which crop the plant in the photo is." },
      candidates: {
        type: Type.ARRAY,
        maxItems: "3",
        description: "Up to 3 most likely codes, highest first. Probabilities sum to at most 1.",
        items: {
          type: Type.OBJECT,
          properties: {
            code: { type: Type.STRING, enum: allowedCodes(codes) },
            p: { type: Type.NUMBER, minimum: 0, maximum: 1 },
          },
          required: ["code", "p"],
          propertyOrdering: ["code", "p"],
        },
      },
      severity: { type: Type.STRING, enum: [...SEVERITY], nullable: true },
      visibleSymptoms: { type: Type.ARRAY, maxItems: "5", items: { type: Type.STRING } },
    },
    required: ["isPlantLeaf", "imageQuality", "detectedCrop", "candidates", "severity", "visibleSymptoms"],
    propertyOrdering: ["isPlantLeaf", "imageQuality", "detectedCrop", "candidates", "severity", "visibleSymptoms"],
  };
}

/** Matching zod schema. Lenient on list lengths (trimmed), strict on codes and enums. */
export function buildOutputSchema(codes: string[]) {
  return z.object({
    isPlantLeaf: z.boolean(),
    imageQuality: z.enum(IMAGE_QUALITY),
    detectedCrop: z.enum(DETECTED_CROP),
    candidates: z
      .array(z.object({ code: z.enum(allowedCodes(codes)), p: z.number().min(0).max(1) }))
      .transform((c) => [...c].sort((a, b) => b.p - a.p).slice(0, 3)),
    severity: z.enum(SEVERITY).nullable().optional().transform((v) => v ?? null),
    visibleSymptoms: z
      .array(z.string())
      .optional()
      .transform((v) => (v ?? []).slice(0, 5)),
  });
}

export type GeminiOutput = z.infer<ReturnType<typeof buildOutputSchema>>;
