import { NextResponse } from "next/server";
import { z } from "zod";
import { ROLES } from "@/server/auth/roles";
import { requireAdmin } from "@/server/auth/session";
import { readJson, wrap } from "@/server/http/handler";
import { createAlert, listAlerts } from "@/server/services/alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Tx = z.object({ bn: z.string().trim().min(1).max(600), en: z.string().trim().min(1).max(600) });
const Body = z.object({
  crop: z.enum(["rice", "potato", "tomato"]),
  diseaseCode: z.string().regex(/^[A-Z][A-Z_]{1,39}$/),
  upazilas: z.array(z.string().max(20)).min(1).max(20),
  message: Tx,
});

/** GET /api/admin/alerts → AlertItem[] (computed suggestions first, then stored alerts) */
export const GET = wrap(async () => {
  await requireAdmin(ROLES.alerts);
  return NextResponse.json(await listAlerts(), { headers: { "cache-control": "no-store" } });
});

/** POST /api/admin/alerts { crop, diseaseCode, upazilas, message:{bn,en} } → AlertItem (status suggested; ≤ 2 SMS segments) */
export const POST = wrap(async (req) => {
  const auth = await requireAdmin(ROLES.alerts);
  const body = await readJson(req, Body);
  return createAlert(body, auth);
});
