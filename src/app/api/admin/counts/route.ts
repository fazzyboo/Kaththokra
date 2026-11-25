import { NextResponse } from "next/server";
import { ROLES } from "@/server/auth/roles";
import { requireAdmin } from "@/server/auth/session";
import { wrap } from "@/server/http/handler";
import { adminCounts } from "@/server/services/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/counts → { openReviews } (sidebar badge) */
export const GET = wrap(async () => {
  await requireAdmin(ROLES.any);
  return NextResponse.json(await adminCounts(), { headers: { "cache-control": "no-store" } });
});
