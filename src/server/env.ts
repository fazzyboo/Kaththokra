import "server-only";
import { z } from "zod";

/*
  Server environment, validated once and cached (BACKEND_PLAN.md §10).
  Read it with getEnv() at call time, never at module load, so `next build`
  works on machines without secrets.
*/

const empty = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const opt = z.preprocess(empty, z.string().optional());
const optUrl = z.preprocess(empty, z.string().url().optional());

const Schema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

    // App
    NEXT_PUBLIC_APP_URL: z.preprocess(empty, z.string().url().default("http://localhost:3000")),
    NEXT_PUBLIC_DEMO_MODE: z.preprocess(empty, z.enum(["true", "false"]).default("false")).transform((v) => v === "true"),

    // MongoDB
    MONGODB_URI: z.preprocess(empty, z.string({ error: "required" }).regex(/^mongodb(\+srv)?:\/\//, "must start with mongodb:// or mongodb+srv://")),
    MONGODB_DB: z.preprocess(empty, z.string().default("kaththokra")),

    // Gemini
    GEMINI_MODE: z.preprocess(empty, z.enum(["live", "mock"]).default("mock")),
    GEMINI_API_KEY: opt,
    GEMINI_MODEL: opt,
    GEMINI_FALLBACK_MODEL: opt,

    // Applink
    APPLINK_MODE: z.preprocess(empty, z.enum(["live", "mock"]).default("mock")),
    APPLINK_BASE_URL: z.preprocess(empty, z.string().url().default("https://api.applink.com.bd")),
    APPLINK_APP_ID: opt,
    APPLINK_PASSWORD: opt,
    APPLINK_DEALER_APP_ID: opt,
    APPLINK_DEALER_PASSWORD: opt,
    FIXIE_URL: optUrl,
    CALLBACK_TOKEN: opt,

    // Secrets
    JOBS_SECRET: opt,
    /** Set by Vercel for its own cron requests (Authorization: Bearer <CRON_SECRET>). */
    CRON_SECRET: opt,
    SESSION_PEPPER: opt,
  })
  .superRefine((e, ctx) => {
    const need = (key: keyof typeof e, why: string) => {
      if (!e[key]) ctx.addIssue({ code: "custom", path: [key], message: `required when ${why}` });
    };
    if (e.GEMINI_MODE === "live") {
      need("GEMINI_API_KEY", "GEMINI_MODE=live");
      need("GEMINI_MODEL", "GEMINI_MODE=live");
    }
    if (e.APPLINK_MODE === "live") {
      need("APPLINK_APP_ID", "APPLINK_MODE=live");
      need("APPLINK_PASSWORD", "APPLINK_MODE=live");
      need("FIXIE_URL", "APPLINK_MODE=live");
      need("CALLBACK_TOKEN", "APPLINK_MODE=live");
    }
    if (e.NODE_ENV === "production") {
      need("JOBS_SECRET", "NODE_ENV=production");
      need("SESSION_PEPPER", "NODE_ENV=production");
      need("CALLBACK_TOKEN", "NODE_ENV=production");
    }
    if (e.NEXT_PUBLIC_DEMO_MODE && (e.GEMINI_MODE === "live" || e.APPLINK_MODE === "live")) {
      ctx.addIssue({
        code: "custom",
        path: ["NEXT_PUBLIC_DEMO_MODE"],
        message: "NEXT_PUBLIC_DEMO_MODE=true requires GEMINI_MODE=mock and APPLINK_MODE=mock",
      });
    }
  });

export type Env = z.infer<typeof Schema>;

export class EnvError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid server environment:\n  - ${problems.join("\n  - ")}\nSee .env.example.`);
    this.name = "EnvError";
  }
}

/**
 * Path segment for /api/callbacks/<type>/<token>. Required in production and live mode;
 * outside those, falls back to "dev" so mock callbacks work without setup.
 */
export function callbackToken(): string {
  return getEnv().CALLBACK_TOKEN ?? "dev";
}

/**
 * Bearer tokens accepted by /api/jobs/*: JOBS_SECRET (GitHub Actions) and CRON_SECRET (Vercel Cron).
 * Outside production with neither set, "dev" works so jobs can be run by hand.
 */
export function jobsSecrets(): string[] {
  const env = getEnv();
  const list = [env.JOBS_SECRET, env.CRON_SECRET].filter((s): s is string => !!s);
  if (!list.length && env.NODE_ENV !== "production") return ["dev"];
  return list;
}

/** Pepper mixed into session-token hashes. Required in production; fixed dev value otherwise. */
export function sessionPepper(): string {
  return getEnv().SESSION_PEPPER ?? "dev-pepper-not-for-production";
}

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = Schema.safeParse(process.env);
  if (!parsed.success) {
    // Only variable names and rule text, never values.
    const problems = parsed.error.issues.map((i) => `${i.path.join(".") || "(env)"}: ${i.message}`);
    throw new EnvError(problems);
  }
  cached = parsed.data;
  return cached;
}
