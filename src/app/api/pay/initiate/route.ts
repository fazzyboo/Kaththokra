import { z } from "zod";
import { dealerActor, optionalFarmer } from "@/server/auth/session";
import { readJson, wrap } from "@/server/http/handler";
import { getScenario } from "@/server/lib/scenario";
import { initiatePayment } from "@/server/services/payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  diagnosisId: z.string().regex(/^d-[0-9a-z]{1,16}$/, "invalid diagnosisId"),
  msisdn: z.string().min(10).max(20),
});

/** POST /api/pay/initiate { diagnosisId, msisdn } → { paymentId, otpExpiresAt } / 409 NOT_PAYABLE */
export const POST = wrap(async (req) => {
  const { diagnosisId, msisdn } = await readJson(req, Body);
  const [farmer, dealer] = await Promise.all([optionalFarmer(), dealerActor()]);
  return initiatePayment(diagnosisId, msisdn, { userId: farmer?.user._id, dealerId: dealer?.dealer._id, scenario: getScenario(req) });
});
