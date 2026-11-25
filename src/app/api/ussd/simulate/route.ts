import { z } from "zod";
import { optionalFarmer } from "@/server/auth/session";
import { badRequest } from "@/server/http/errors";
import { readJson, wrap } from "@/server/http/handler";
import { normalizeMsisdn } from "@/server/lib/msisdn";
import { getScenario } from "@/server/lib/scenario";
import { assertMockApplink } from "@/server/services/dev";
import { simulateUssd } from "@/server/services/ussd";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

const DEMO_MSISDN = "8801900000001";

const Body = z.object({
  sessionId: z.string().min(4).max(64),
  input: z.string().max(32).default(""),
  msisdn: z.string().min(10).max(20).optional(),
});

/** POST /api/ussd/simulate { sessionId, input, msisdn? } → { text, end, log } (mock Applink only) */
export const POST = wrap(async (req) => {
  // Mock only: in live mode the mock charging notification would unlock prescriptions for free.
  assertMockApplink();
  const body = await readJson(req, Body);
  const farmer = await optionalFarmer();
  let msisdn = farmer?.user.msisdn ?? DEMO_MSISDN;
  if (!farmer && body.msisdn) {
    const n = normalizeMsisdn(body.msisdn);
    if (!n) throw badRequest("Enter a Banglalink number (019 or 014)");
    msisdn = n;
  }
  return simulateUssd({ sessionId: body.sessionId, input: body.input, msisdn, scenario: getScenario(req) });
});
