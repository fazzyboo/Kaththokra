import { NextResponse } from "next/server";
import { z } from "zod";
import { requireDealer } from "@/server/auth/session";
import { wrap } from "@/server/http/handler";
import { dealerSales } from "@/server/services/dealer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({ filter: z.enum(["all", "paid", "issues"]).default("all") });

/** GET /api/dealer/sales?filter=all|paid|issues → DealerSale[] */
export const GET = wrap(async (req) => {
  const { filter } = Query.parse({ filter: req.nextUrl.searchParams.get("filter") ?? undefined });
  const auth = await requireDealer();
  return NextResponse.json(await dealerSales(auth, filter), { headers: { "cache-control": "no-store" } });
});
