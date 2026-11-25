import { z } from "zod";
import { dealerActor, optionalFarmer } from "@/server/auth/session";
import { readJson, wrap } from "@/server/http/handler";
import { answerDiagnosis } from "@/server/services/diagnosis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Params = z.object({ id: z.string().regex(/^d-[0-9a-z]{1,16}$/, "invalid diagnosis id") });
const Body = z.object({
  answers: z.record(z.string().max(32), z.number().int().min(0).max(9)).refine((a) => Object.keys(a).length <= 4, "too many answers"),
});

/** POST /api/diagnose/[id]/answer { answers: Record<questionId, optionIndex> } → Diagnosis */
export const POST = wrap<{ id: string }>(async (req, { params }) => {
  const { id } = Params.parse(params);
  const { answers } = await readJson(req, Body);
  const [farmer, dealer] = await Promise.all([optionalFarmer(), dealerActor()]);
  return answerDiagnosis(id, answers, { userId: farmer?.user._id, dealerId: dealer?.dealer._id });
});
