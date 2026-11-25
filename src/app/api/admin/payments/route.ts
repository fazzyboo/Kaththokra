import { NextResponse } from "next/server";
import { z } from "zod";
import { ROLES } from "@/server/auth/roles";
import { requireAdmin } from "@/server/auth/session";
import { wrap } from "@/server/http/handler";
import { listPayments } from "@/server/services/admin-payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({ filter: z.enum(["all", "attention", "settled", "failed"]).default("all") });

/** GET /api/admin/payments?filter=all|attention|settled|failed → LedgerRow[] (max 200) */
export const GET = wrap(async (req) => {
  await requireAdmin(ROLES.payments);
  const { filter } = Query.parse({ filter: req.nextUrl.searchParams.get("filter") ?? undefined });
  return NextResponse.json(await listPayments(filter), { headers: { "cache-control": "no-store" } });
});
