import "./_env";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import type { CropId } from "@/lib/types";
import { closeDb } from "@/server/db/client";
import { col } from "@/server/db/collections";
import { getEnv } from "@/server/env";
import { classifyLeaf } from "@/server/gemini/client";
import { PROMPT_VERSION } from "@/server/gemini/prompt";
import { mapGeminiOutput } from "@/server/services/diagnosis";
import { publishedKbForCrop } from "@/server/services/kb";
import { getSettings } from "@/server/services/settings";

/*
  Evaluate the diagnosis path on labelled photos and save an evalRuns doc (admin "AI model" page).
    npm run eval-gemini -- <folder> [--delay 4000] [--dry]
  <folder>/<DISEASE_CODE>/*.jpg|png|webp, e.g. photos/RICE_BLAST/1.jpg. The crop comes from the KB.
  Runs the same code as POST /api/diagnose (classifyLeaf → mapGeminiOutput, current gate),
  without storing diagnoses. --delay (ms between calls, default 4000) keeps the free tier
  under its per-minute limit. --dry prints the result without saving.
  In GEMINI_MODE=mock the numbers are meaningless (the mock ignores the photo).
*/

const MIME: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

function arg(name: string, fallback?: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

async function main() {
  const folder = process.argv.slice(2).find((a, i, all) => !a.startsWith("--") && all[i - 1] !== "--delay");
  if (!folder) throw new Error("Usage: npm run eval-gemini -- <folder> [--delay 4000] [--dry]");
  const delay = Number(arg("delay", "4000"));
  const dry = process.argv.includes("--dry");
  const env = getEnv();
  const settings = await getSettings();
  const kbCol = await col("kbDiseases");

  type Sample = { file: string; code: string; crop: CropId };
  const samples: Sample[] = [];
  for (const code of readdirSync(folder)) {
    const dir = join(folder, code);
    if (!statSync(dir).isDirectory()) continue;
    const kb = await kbCol.findOne({ _id: code }, { projection: { crop: 1 } });
    if (!kb) {
      console.warn(`skip ${code}: not a KB disease code`);
      continue;
    }
    for (const f of readdirSync(dir)) if (MIME[extname(f).toLowerCase()]) samples.push({ file: join(dir, f), code, crop: kb.crop });
  }
  if (!samples.length) throw new Error("No photos found. Expected <folder>/<DISEASE_CODE>/*.jpg");
  console.log(`Evaluating ${samples.length} photos, mode=${env.GEMINI_MODE}, model=${env.GEMINI_MODEL ?? "mock"}, prompt v${PROMPT_VERSION}, gate ${settings.confidenceGate}`);

  type Result = { truth: string; pred: string; confident: boolean };
  const results: Result[] = [];
  let model = "";
  for (const [i, s] of samples.entries()) {
    const kb = await publishedKbForCrop(s.crop);
    const image = readFileSync(s.file);
    let pred = "ERROR";
    let confident = false;
    try {
      const r = await classifyLeaf({ crop: s.crop, image, mime: MIME[extname(s.file).toLowerCase()], kb, scenario: null });
      model = r.model;
      const m = mapGeminiOutput(r.output, s.crop, settings.confidenceGate);
      pred = m.status === "RETAKE" ? "RETAKE" : (m.top3[0]?.code ?? "UNKNOWN");
      confident = m.status === "CONFIDENT";
    } catch (err) {
      console.warn(`  ${s.file}: ${(err as Error).message}`);
    }
    results.push({ truth: s.code, pred, confident });
    console.log(`  [${i + 1}/${samples.length}] ${s.code} → ${pred}${confident ? " ✓gate" : ""}`);
    if (delay && i < samples.length - 1 && env.GEMINI_MODE === "live") await new Promise((r) => setTimeout(r, delay));
  }

  const n = results.length;
  const correct = results.filter((r) => r.truth === r.pred).length;
  const passed = results.filter((r) => r.confident);
  const codes = [...new Set(results.map((r) => r.truth))].sort();
  const perClass = codes.map((code) => {
    const tp = results.filter((r) => r.truth === code && r.pred === code).length;
    const predicted = results.filter((r) => r.pred === code).length;
    const actual = results.filter((r) => r.truth === code).length;
    return { code, n: actual, precision: predicted ? tp / predicted : 0, recall: actual ? tp / actual : 0 };
  });
  const run = {
    model: model ? `${model}+p${PROMPT_VERSION}` : "unknown",
    promptVersion: String(PROMPT_VERSION),
    n,
    accuracy: correct / n,
    perClass,
    coverage: passed.length / n,
    accAtGate: passed.length ? passed.filter((r) => r.truth === r.pred).length / passed.length : 0,
    gate: settings.confidenceGate,
    retake: results.filter((r) => r.pred === "RETAKE").length / n,
    at: new Date(),
  };

  console.log(`\naccuracy ${(run.accuracy * 100).toFixed(1)}%  coverage@gate ${(run.coverage * 100).toFixed(1)}%  acc@gate ${(run.accAtGate * 100).toFixed(1)}%  retake ${(run.retake * 100).toFixed(1)}%`);
  for (const c of perClass) console.log(`  ${c.code.padEnd(22)} n=${c.n}  P=${c.precision.toFixed(2)}  R=${c.recall.toFixed(2)}`);
  if (dry) return console.log("(dry run: not saved)");
  await (await col("evalRuns")).insertOne(run);
  console.log("Saved to evalRuns.");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
