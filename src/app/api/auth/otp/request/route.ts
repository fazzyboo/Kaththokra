import { z } from "zod";
import { clientIp, readJson, wrap } from "@/server/http/handler";
import { getScenario } from "@/server/lib/scenario";
import { requestOtp } from "@/server/services/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ msisdn: z.string().min(10).max(20) });

/** POST /api/auth/otp/request { msisdn } → { requestId } */
export const POST = wrap(async (req) => {
  const { msisdn } = await readJson(req, Body);
  return requestOtp(msisdn, "verify", { ip: clientIp(req), scenario: getScenario(req) });
});
