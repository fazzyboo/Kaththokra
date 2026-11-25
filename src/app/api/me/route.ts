import { NextResponse } from "next/server";
import { requireFarmer } from "@/server/auth/session";
import { wrap } from "@/server/http/handler";
import { toMe } from "@/server/services/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/me → { msisdnMasked, msisdnLast4, msisdnLocal } or 401 */
export const GET = wrap(async () => {
  const { user } = await requireFarmer();
  return NextResponse.json(toMe(user), { headers: { "cache-control": "no-store" } });
});
