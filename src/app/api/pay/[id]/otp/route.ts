import { z } from "zod";
import { readJson, wrap } from "@/server/http/handler";
import { getScenario } from "@/server/lib/scenario";
import { submitPaymentOtp } from "@/server/services/payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Params = z.object({ id: z.string().regex(/^p-[0-9a-f]{1,16}$/, "invalid payment id") });
const Body = z.object({ code: z.string().regex(/^\d{4,8}$/, "code must be 4–8 digits") });

/** POST /api/pay/[id]/otp { code } → { result: "accepted" } / 400 WRONG_CODE / 402 E1308 / 410 EXPIRED / 423 LOCKED */
export const POST = wrap<{ id: string }>(async (req, { params }) => {
  const { id } = Params.parse(params);
  const { code } = await readJson(req, Body);
  return submitPaymentOtp(id, code, { scenario: getScenario(req) });
});
