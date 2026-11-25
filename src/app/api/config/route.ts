import { NextResponse } from "next/server";
import { wrap } from "@/server/http/handler";
import { getPublicConfig } from "@/server/services/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = wrap(async () => {
  const config = await getPublicConfig();
  return NextResponse.json(config, { headers: { "cache-control": "no-store" } });
});
