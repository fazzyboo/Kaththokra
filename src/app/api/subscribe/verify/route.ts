import { z } from "zod";
import { readJson, wrap } from "@/server/http/handler";
import { getScenario } from "@/server/lib/scenario";
import { verifySubscription } from "@/server/services/subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  requestId: z.string().regex(/^o-[0-9a-f]{16}$/, "invalid requestId"),
  code: z.string().regex(/^\d{4,8}$/, "code must be 4–8 digits"),
});

/** POST /api/subscribe/verify { requestId, code } → Subscription (+ kk_f session) / 400 WRONG_CODE */
export const POST = wrap(async (req) => {
  const { requestId, code } = await readJson(req, Body);
  return verifySubscription(requestId, code, getScenario(req));
});
