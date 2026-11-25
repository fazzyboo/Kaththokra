import { z } from "zod";
import { dealerActor, optionalFarmer } from "@/server/auth/session";
import { readJson, wrap } from "@/server/http/handler";
import { requestReview } from "@/server/services/diagnosis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Params = z.object({ id: z.string().regex(/^d-[0-9a-z]{1,16}$/, "invalid diagnosis id") });
const Body = z.object({
  msisdn: z.string().min(10).max(20),
  note: z.string().trim().max(500).optional(),
});

/** POST /api/diagnose/[id]/review { msisdn, note? } → { ticket } */
export const POST = wrap<{ id: string }>(async (req, { params }) => {
  const { id } = Params.parse(params);
  const body = await readJson(req, Body);
  const [farmer, dealer] = await Promise.all([optionalFarmer(), dealerActor()]);
  return requestReview(id, body, { userId: farmer?.user._id, dealerId: dealer?.dealer._id });
});
