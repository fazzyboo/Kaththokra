import "server-only";
import { z } from "zod";
import type { Scenario } from "@/lib/session";
import { getEnv } from "../env";
import { log } from "./log";

/*
  Demo scenario from the `x-kk-scenario` header (JSON, same shape as Scenario in
  src/lib/session.tsx). Honoured only while Applink or Gemini runs in mock mode;
  in full live mode the header is ignored, and so it is whenever APPLINK_MODE=live while
  NEXT_PUBLIC_DEMO_MODE=true (logged as a warning).
*/

export type { Scenario };

export const SCENARIO_HEADER = "x-kk-scenario";

export const DEFAULT_SCENARIO: Scenario = { diagnosis: "confident", payment: "success" };

const ScenarioSchema = z
  .object({
    diagnosis: z.enum(["confident", "uncertain", "retake", "healthy"]),
    payment: z.enum(["success", "wrong_once", "low_balance", "expired", "slow"]),
  })
  .partial() satisfies z.ZodType<Partial<Scenario>>;

/** Returns the scenario, or null when no mock mode is active. Bad/missing header → defaults. */
export function getScenario(req: Request): Scenario | null {
  const env = getEnv();
  if (env.APPLINK_MODE !== "mock" && env.GEMINI_MODE !== "mock") return null;
  // Demo controls must never steer real payments (env.ts rejects this combination; belt and braces).
  if (env.NEXT_PUBLIC_DEMO_MODE && env.APPLINK_MODE === "live") {
    if (req.headers.has(SCENARIO_HEADER)) log.warn("scenario.ignored_live", { reason: "NEXT_PUBLIC_DEMO_MODE=true with APPLINK_MODE=live" });
    return null;
  }
  const raw = req.headers.get(SCENARIO_HEADER);
  if (!raw) return { ...DEFAULT_SCENARIO };
  try {
    const parsed = ScenarioSchema.safeParse(JSON.parse(raw));
    return parsed.success ? { ...DEFAULT_SCENARIO, ...parsed.data } : { ...DEFAULT_SCENARIO };
  } catch {
    return { ...DEFAULT_SCENARIO };
  }
}
