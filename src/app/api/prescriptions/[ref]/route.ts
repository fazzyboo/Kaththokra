import { NextResponse } from "next/server";
import { z } from "zod";
import { optionalDealer, optionalFarmer } from "@/server/auth/session";
import { wrap } from "@/server/http/handler";
import { getPrescriptionForViewer } from "@/server/services/prescriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Params = z.object({ ref: z.string().regex(/^PD-\d{6}$/, "invalid prescription ref") });

/** GET /api/prescriptions/[ref] → Prescription & { treatment, diseaseName } (owner farmer or selling dealer, else 403) */
export const GET = wrap<{ ref: string }>(async (_req, { params }) => {
  const { ref } = Params.parse(params);
  const [farmer, dealer] = await Promise.all([optionalFarmer(), optionalDealer()]);
  const rx = await getPrescriptionForViewer(ref, { farmer, dealer });
  return NextResponse.json(rx, { headers: { "cache-control": "private, no-store" } });
});
