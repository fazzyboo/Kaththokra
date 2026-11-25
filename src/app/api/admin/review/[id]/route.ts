import { NextResponse } from "next/server";
import { z } from "zod";
import { ROLES } from "@/server/auth/roles";
import { requireAdmin } from "@/server/auth/session";
import { readJson, wrap } from "@/server/http/handler";
import { decideReview, getReview } from "@/server/services/admin-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Params = z.object({ id: z.string().regex(/^RV-\d{4}$/, "invalid review id") });
const Body = z.object({
  verdict: z.string().regex(/^[A-Z][A-Z_]{1,39}$/, "verdict must be a disease code or UNKNOWN / RETAKE / OTHER"),
  reply: z.string().trim().min(1).max(300).optional(),
  useForTraining: z.boolean(),
  sendSms: z.boolean().optional(),
});

/** GET /api/admin/review/[id] → { item, diagnosis, image (data URL | null), farmer (masked), … } */
export const GET = wrap<{ id: string }>(async (_req, { params }) => {
  await requireAdmin(ROLES.review);
  const { id } = Params.parse(params);
  return NextResponse.json(await getReview(id), { headers: { "cache-control": "private, no-store" } });
});

/** POST /api/admin/review/[id] { verdict, reply?, useForTraining, sendSms? } → done; SMS reply to the farmer if `reply` */
export const POST = wrap<{ id: string }>(async (req, { params }) => {
  const auth = await requireAdmin(ROLES.review);
  const { id } = Params.parse(params);
  const body = await readJson(req, Body);
  return decideReview(id, body, auth);
});
