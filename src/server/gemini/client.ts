import "server-only";
import { ApiError, GoogleGenAI } from "@google/genai";
import type { CropId } from "@/lib/types";
import type { KbDiseaseDoc } from "../db/types";
import { getEnv } from "../env";
import { AppError } from "../http/errors";
import { log } from "../lib/log";
import { DEFAULT_SCENARIO, type Scenario } from "../lib/scenario";
import { MOCK_MODEL, mockClassify } from "./mock";
import { buildSystemPrompt, buildUserPrompt } from "./prompt";
import { buildOutputSchema, buildResponseSchema, type GeminiOutput } from "./schema";

/*
  Leaf classification with Gemini (BACKEND_PLAN.md §5 steps 3–4). Gemini only classifies;
  treatment always comes from the KB.
  - GEMINI_MODEL, image inline, JSON mode + responseSchema, temperature 0, 20 s timeout.
  - 429 / 5xx / timeout → one retry on GEMINI_FALLBACK_MODEL; still failing → AppError GEMINI_BUSY (503).
  - Unparseable output → one retry; still bad → null (caller returns RETAKE).
*/

const TIMEOUT_MS = 20_000;

export type ClassifyInput = {
  crop: CropId;
  image: Buffer;
  mime: string;
  kb: KbDiseaseDoc[];
  scenario: Scenario | null;
};

export type ClassifyResult = { output: GeminiOutput | null; model: string; ms: number };

export const geminiBusy = () => new AppError("GEMINI_BUSY", "Diagnosis service is busy, try again in a minute", 503);

type Cache = { key?: string; ai?: GoogleGenAI };
const g = globalThis as typeof globalThis & { __kkGemini?: Cache };
const cache: Cache = (g.__kkGemini ??= {});

function client(apiKey: string): GoogleGenAI {
  if (cache.key !== apiKey || !cache.ai) {
    // Our own retry policy only: the SDK would otherwise retry up to 5 times.
    cache.ai = new GoogleGenAI({ apiKey, httpOptions: { retryOptions: { attempts: 1 } } });
    cache.key = apiKey;
  }
  return cache.ai;
}

function isTransient(err: unknown): boolean {
  if (err instanceof ApiError) return err.status === 429 || err.status >= 500;
  const name = (err as Error)?.name;
  return name === "TimeoutError" || name === "AbortError" || name === "TypeError"; // TypeError = fetch/network failure
}

async function callModel(ai: GoogleGenAI, model: string, input: ClassifyInput, codes: string[]): Promise<string> {
  const res = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [{ inlineData: { mimeType: input.mime, data: input.image.toString("base64") } }, { text: buildUserPrompt(input.crop, input.kb) }],
      },
    ],
    config: {
      systemInstruction: buildSystemPrompt(),
      responseMimeType: "application/json",
      responseSchema: buildResponseSchema(codes),
      temperature: 0,
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    },
  });
  return res.text ?? "";
}

export async function classifyLeaf(input: ClassifyInput): Promise<ClassifyResult> {
  const env = getEnv();
  const codes = input.kb.map((d) => d._id);
  const started = Date.now();

  if (env.GEMINI_MODE === "mock") {
    const output = await mockClassify(input.crop, (input.scenario ?? DEFAULT_SCENARIO).diagnosis, codes);
    return { output, model: MOCK_MODEL, ms: Date.now() - started };
  }

  const ai = client(env.GEMINI_API_KEY!);
  const outputSchema = buildOutputSchema(codes);
  const models = [env.GEMINI_MODEL!, env.GEMINI_FALLBACK_MODEL].filter((m): m is string => !!m);
  let modelIdx = 0;
  let parseFailures = 0;

  for (;;) {
    const model = models[modelIdx];
    let text: string;
    try {
      text = await callModel(ai, model, input, codes);
    } catch (err) {
      const transient = isTransient(err);
      log.warn("gemini.call_failed", {
        model,
        transient,
        status: err instanceof ApiError ? err.status : undefined,
        err: (err as Error)?.name,
      });
      if (transient && modelIdx + 1 < models.length) {
        modelIdx++;
        continue;
      }
      throw geminiBusy();
    }

    let parsed: GeminiOutput | null = null;
    try {
      parsed = outputSchema.parse(JSON.parse(text));
    } catch {
      parsed = null;
    }
    if (parsed) return { output: parsed, model, ms: Date.now() - started };

    parseFailures++;
    log.warn("gemini.parse_failed", { model, attempt: parseFailures, chars: text.length });
    if (parseFailures >= 2) return { output: null, model, ms: Date.now() - started };
  }
}
