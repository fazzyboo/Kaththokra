import { NextResponse } from "next/server";
import { ROLES } from "@/server/auth/roles";
import { requireAdmin } from "@/server/auth/session";
import { wrap } from "@/server/http/handler";
import { listSubscribers } from "@/server/services/admin-subscribers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/subscribers → SubRow[] (max 500) */
export const GET = wrap(async () => {
  await requireAdmin(ROLES.subscribers);
  return NextResponse.json(await listSubscribers(), { headers: { "cache-control": "no-store" } });
});
