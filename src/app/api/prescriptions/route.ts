import { NextResponse } from "next/server";
import { optionalFarmer } from "@/server/auth/session";
import { wrap } from "@/server/http/handler";
import { listMyPrescriptions } from "@/server/services/prescriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/prescriptions → Prescription[] for the signed-in farmer's number */
export const GET = wrap(async () => {
  const list = await listMyPrescriptions(await optionalFarmer());
  return NextResponse.json(list, { headers: { "cache-control": "no-store" } });
});
