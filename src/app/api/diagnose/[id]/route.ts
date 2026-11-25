import { z } from "zod";
import { wrap } from "@/server/http/handler";
import { getDiagnosis } from "@/server/services/diagnosis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Params = z.object({ id: z.string().regex(/^d-[0-9a-z]{1,16}$/, "invalid diagnosis id") });

/** GET /api/diagnose/[id] → Diagnosis & { prescriptionRef?, reviewTicket? } */
export const GET = wrap<{ id: string }>(async (_req, { params }) => {
  const { id } = Params.parse(params);
  return getDiagnosis(id);
});
