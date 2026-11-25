import { NextResponse } from "next/server";
import { z } from "zod";
import { ROLES } from "@/server/auth/roles";
import { requireAdmin } from "@/server/auth/session";
import { readJson, wrap } from "@/server/http/handler";
import { adminGetSettings, adminUpdateSettings } from "@/server/services/admin-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z
  .object({
    priceRx: z.number().min(2).max(10),
    priceSubMonthly: z.number().min(1).max(70),
    confidenceGate: z.number().min(0.5).max(0.95),
    abTest: z.boolean(),
    revenueShare: z.number().min(0).max(1),
    ussdCode: z.string().trim().regex(/^\*[0-9*]{2,15}#$/, "USSD code like *123#"),
    helpline: z.string().trim().regex(/^\d{3,15}$/, "digits only"),
  })
  .partial()
  .strict()
  .refine((b) => Object.keys(b).length > 0, "nothing to change");

/** GET /api/admin/settings → all settings */
export const GET = wrap(async () => {
  await requireAdmin(ROLES.settings);
  return NextResponse.json(await adminGetSettings(), { headers: { "cache-control": "no-store" } });
});

/** PUT /api/admin/settings { priceRx? 2–10, priceSubMonthly? 1–70, confidenceGate? 0.5–0.95, abTest?, … } → settings (audited) */
export const PUT = wrap(async (req) => {
  const auth = await requireAdmin(ROLES.settings);
  const body = await readJson(req, Body);
  return adminUpdateSettings(body, auth);
});
