import { NextResponse } from "next/server";
import { ROLES } from "@/server/auth/roles";
import { requireAdmin } from "@/server/auth/session";
import { wrap } from "@/server/http/handler";
import { listDealers } from "@/server/services/admin-dealers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/dealers → DealerRow[] (status "flagged" when > 30% of 30-day sales go to the same 5 numbers) */
export const GET = wrap(async () => {
  await requireAdmin(ROLES.dealers);
  return NextResponse.json(await listDealers(), { headers: { "cache-control": "no-store" } });
});
