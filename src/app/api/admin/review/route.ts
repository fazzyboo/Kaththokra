import { NextResponse } from "next/server";
import { z } from "zod";
import { ROLES } from "@/server/auth/roles";
import { requireAdmin } from "@/server/auth/session";
import { wrap } from "@/server/http/handler";
import { listReviews } from "@/server/services/admin-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({ status: z.enum(["open", "done"]).default("open") });

/** GET /api/admin/review?status=open|done → ReviewItem[] */
export const GET = wrap(async (req) => {
  await requireAdmin(ROLES.review);
  const { status } = Query.parse({ status: req.nextUrl.searchParams.get("status") ?? undefined });
  return NextResponse.json(await listReviews(status), { headers: { "cache-control": "no-store" } });
});
