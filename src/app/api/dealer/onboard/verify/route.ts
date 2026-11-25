import { z } from "zod";
import { readJson, wrap } from "@/server/http/handler";
import { getScenario } from "@/server/lib/scenario";
import { verifyOnboarding } from "@/server/services/dealer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  requestId: z.string().regex(/^o-[0-9a-f]{16}$/, "invalid requestId"),
  code: z.string().regex(/^\d{4,8}$/, "code must be 4-8 digits"),
});

/** POST /api/dealer/onboard/verify { requestId, code } → DealerSession + kk_d cookie (30 d) */
export const POST = wrap(async (req) => {
  const { requestId, code } = await readJson(req, Body);
  return verifyOnboarding(requestId, code, getScenario(req));
});
