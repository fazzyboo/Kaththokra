import { NextResponse } from "next/server";
import { ROLES } from "@/server/auth/roles";
import { requireAdmin } from "@/server/auth/session";
import { wrap } from "@/server/http/handler";
import { modelInfo } from "@/server/services/admin-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/model → { mode, live, fallback, promptVersion, gate, lastEval } */
export const GET = wrap(async () => {
  await requireAdmin(ROLES.any);
  return NextResponse.json(await modelInfo(), { headers: { "cache-control": "no-store" } });
});
