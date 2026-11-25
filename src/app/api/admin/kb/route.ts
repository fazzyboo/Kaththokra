import { NextResponse } from "next/server";
import { ROLES } from "@/server/auth/roles";
import { requireAdmin } from "@/server/auth/session";
import { wrap } from "@/server/http/handler";
import { listKb } from "@/server/services/admin-kb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/kb → (Disease & { publishedVersion, hasDraft, updatedAt })[] */
export const GET = wrap(async () => {
  await requireAdmin(ROLES.kb);
  return NextResponse.json(await listKb(), { headers: { "cache-control": "no-store" } });
});
