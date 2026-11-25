import { z } from "zod";
import { clientIp, readJson, wrap } from "@/server/http/handler";
import { getScenario } from "@/server/lib/scenario";
import { startSubscription } from "@/server/services/subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  crops: z.array(z.enum(["rice", "potato", "tomato"])).min(1).max(3),
  upazila: z.string().min(1).max(20),
  msisdn: z.string().min(10).max(20),
});

/** POST /api/subscribe { crops, upazila, msisdn } → { requestId } (OTP sent) */
export const POST = wrap(async (req) => {
  const body = await readJson(req, Body);
  return startSubscription(body, { ip: clientIp(req), scenario: getScenario(req) });
});
