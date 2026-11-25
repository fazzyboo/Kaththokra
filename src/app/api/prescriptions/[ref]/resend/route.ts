import { z } from "zod";
import { optionalDealer, optionalFarmer } from "@/server/auth/session";
import { wrap } from "@/server/http/handler";
import { resendPrescription } from "@/server/services/prescriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Params = z.object({ ref: z.string().regex(/^PD-\d{6}$/, "invalid prescription ref") });

/** POST /api/prescriptions/[ref]/resend → { ok: true } (free SMS, max 3/day per ref) */
export const POST = wrap<{ ref: string }>(async (_req, { params }) => {
  const { ref } = Params.parse(params);
  const [farmer, dealer] = await Promise.all([optionalFarmer(), optionalDealer()]);
  return resendPrescription(ref, { farmer, dealer });
});
