import { NextResponse } from "next/server";
import { requireDealer } from "@/server/auth/session";
import { wrap } from "@/server/http/handler";
import { toDealerSession } from "@/server/services/dealer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/dealer/me → DealerSession / 401 / 403 (paused) */
export const GET = wrap(async () => {
  const { dealer } = await requireDealer();
  return NextResponse.json(toDealerSession(dealer), { headers: { "cache-control": "no-store" } });
});
