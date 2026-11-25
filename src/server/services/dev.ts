import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { applink } from "../applink/client";
import { APPLINK_PATHS, type ApplinkPath, type ApplinkRequest } from "../applink/types";
import { callbackToken, getEnv } from "../env";
import { notFound } from "../http/errors";
import { DEFAULT_SCENARIO, type Scenario } from "../lib/scenario";

/*
  Dev-only helpers. Every function 404s unless APPLINK_MODE=mock, so they can't reach
  the real Applink or be used in a live deployment.
*/

export const DevApplinkSchema = z.object({
  path: z.enum(APPLINK_PATHS as [ApplinkPath, ...ApplinkPath[]]),
  body: z.record(z.string(), z.unknown()).default({}),
  app: z.enum(["farmer", "dealer"]).optional(),
  scenario: z
    .object({
      diagnosis: z.enum(["confident", "uncertain", "retake", "healthy"]),
      payment: z.enum(["success", "wrong_once", "low_balance", "expired", "slow"]),
    })
    .partial()
    .optional(),
});

export type DevApplinkInput = z.infer<typeof DevApplinkSchema>;

export function assertMockApplink() {
  if (getEnv().APPLINK_MODE !== "mock") throw notFound();
}

export async function devApplinkCall(input: DevApplinkInput, headerScenario: Scenario | null) {
  assertMockApplink();
  const scenario: Scenario = { ...DEFAULT_SCENARIO, ...headerScenario, ...input.scenario };
  const result = await applink(input.path, input.body as ApplinkRequest<ApplinkPath>, { app: input.app, scenario });
  return { path: input.path, scenario, result };
}

/** Forward a fake Applink callback to our own callback route, adding the token. */
export async function forwardDevCallback(origin: string, input: { type: string; body: Record<string, unknown>; token?: string }) {
  assertMockApplink();
  const token = input.token ?? callbackToken();
  const res = await fetch(`${origin}/api/callbacks/${input.type}/${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input.body),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* keep text */
  }
  // Pass the callback's own status through (e.g. 403 for a wrong token).
  return NextResponse.json(body, { status: res.status });
}
