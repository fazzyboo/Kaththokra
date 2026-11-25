import { NextResponse } from "next/server";
import { z } from "zod";
import { wrap } from "@/server/http/handler";
import { paymentStatus } from "@/server/services/payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Params = z.object({ id: z.string().regex(/^p-[0-9a-f]{1,16}$/, "invalid payment id") });

/** GET /api/pay/[id] → { status, prescriptionRef? } (polled) */
export const GET = wrap<{ id: string }>(async (_req, { params }) => {
  const { id } = Params.parse(params);
  return NextResponse.json(await paymentStatus(id), { headers: { "cache-control": "no-store" } });
});
