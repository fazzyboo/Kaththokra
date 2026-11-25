import { NextResponse } from "next/server";
import { requireDealer } from "@/server/auth/session";
import { wrap } from "@/server/http/handler";
import { dealerStats } from "@/server/services/dealer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/dealer/stats → { todayCommission, todaySales, monthCommission, monthSales, monthDiagnoses, lastPayout, daily[14] } */
export const GET = wrap(async () => {
  const auth = await requireDealer();
  return NextResponse.json(await dealerStats(auth), { headers: { "cache-control": "no-store" } });
});
