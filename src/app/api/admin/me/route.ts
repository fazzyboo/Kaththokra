import { NextResponse } from "next/server";
import { ROLES } from "@/server/auth/roles";
import { requireAdmin } from "@/server/auth/session";
import { wrap } from "@/server/http/handler";
import { toAdminSession } from "@/server/services/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/me → AdminSession or 401 */
export const GET = wrap(async () => {
  const { admin } = await requireAdmin(ROLES.any);
  return NextResponse.json(toAdminSession(admin), { headers: { "cache-control": "no-store" } });
});
