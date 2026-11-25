import { NextResponse } from "next/server";
import { z } from "zod";
import { ROLES } from "@/server/auth/roles";
import { requireAdmin } from "@/server/auth/session";
import { wrap } from "@/server/http/handler";
import { adminKpis } from "@/server/services/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({ days: z.coerce.number().int().min(1).max(90).default(14) });

/** GET /api/admin/kpis?days=14 → { days, labels, daily (DAILY shape), subscribers, revenueShare, kpis (kpis() shape) } */
export const GET = wrap(async (req) => {
  await requireAdmin(ROLES.any);
  const { days } = Query.parse({ days: req.nextUrl.searchParams.get("days") ?? undefined });
  return NextResponse.json(await adminKpis(days), { headers: { "cache-control": "no-store" } });
});
