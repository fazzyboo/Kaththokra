import { NextResponse } from "next/server";
import { z } from "zod";
import { ROLES } from "@/server/auth/roles";
import { requireAdmin } from "@/server/auth/session";
import { readJson, wrap } from "@/server/http/handler";
import { addTeamMember, listTeam } from "@/server/services/admin-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  email: z.string().email().max(200),
  name: z.string().trim().min(1).max(80),
  role: z.enum(["admin", "agronomist", "analyst", "dealer_manager"]),
  password: z.string().min(12).max(200).optional(),
});

/** GET /api/admin/team → { name, email, role, totp, last }[] (no secrets) */
export const GET = wrap(async () => {
  await requireAdmin(ROLES.team);
  return NextResponse.json(await listTeam(), { headers: { "cache-control": "no-store" } });
});

/** POST /api/admin/team { email, name, role, password? } → { …, otpauthUrl, tempPassword? } (shown once) */
export const POST = wrap(async (req) => {
  const auth = await requireAdmin(ROLES.team);
  const body = await readJson(req, Body);
  return NextResponse.json(await addTeamMember(body, auth), { headers: { "cache-control": "no-store" } });
});
