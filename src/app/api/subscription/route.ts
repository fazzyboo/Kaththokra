import { NextResponse } from "next/server";
import { optionalFarmer } from "@/server/auth/session";
import { wrap } from "@/server/http/handler";
import { getSubscription } from "@/server/services/subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/subscription → Subscription | null (null when signed out or never subscribed) */
export const GET = wrap(async () => {
  const farmer = await optionalFarmer();
  const sub = farmer ? await getSubscription(farmer.user.msisdn) : null;
  return NextResponse.json(sub, { headers: { "cache-control": "no-store" } });
});
