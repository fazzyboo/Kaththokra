import { z } from "zod";
import { clientIp, readJson, wrap } from "@/server/http/handler";
import { getScenario } from "@/server/lib/scenario";
import { startOnboarding } from "@/server/services/dealer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  shopName: z.string().trim().min(2).max(60),
  upazila: z.string().min(1).max(20),
  msisdn: z.string().min(10).max(20),
});

/** POST /api/dealer/onboard { shopName, upazila, msisdn } → { requestId } (OTP on the dealer app) */
export const POST = wrap(async (req) => {
  const body = await readJson(req, Body);
  return startOnboarding(body, { ip: clientIp(req), scenario: getScenario(req) });
});
