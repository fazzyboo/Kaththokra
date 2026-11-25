import { NextResponse } from "next/server";
import { z } from "zod";
import { ROLES } from "@/server/auth/roles";
import { requireAdmin } from "@/server/auth/session";
import { readJson, wrap } from "@/server/http/handler";
import { editKbDraft, getKb } from "@/server/services/admin-kb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Params = z.object({ code: z.string().regex(/^[A-Z][A-Z_]{1,39}$/, "invalid disease code") });
const Tx = z.object({ bn: z.string().trim().min(1).max(600), en: z.string().trim().min(1).max(600) });
const Body = z
  .object({
    name: Tx,
    banglish: z.string().trim().min(1).max(60),
    symptoms: z.array(Tx).min(1).max(8),
    cause: Tx,
    care: z.array(Tx).max(8),
    activeIngredient: Tx,
    dose: Tx,
    timing: Tx,
    phiDays: z.number().int().min(0).max(120),
    safety: Tx,
  })
  .partial()
  .strict()
  .refine((b) => Object.keys(b).length > 0, "nothing to change");

/** GET /api/admin/kb/[code] → { published, draft | null, history[] } */
export const GET = wrap<{ code: string }>(async (_req, { params }) => {
  await requireAdmin(ROLES.kb);
  const { code } = Params.parse(params);
  return NextResponse.json(await getKb(code), { headers: { "cache-control": "no-store" } });
});

/** PUT /api/admin/kb/[code] { …fields } → edits the draft (only while it is "draft") */
export const PUT = wrap<{ code: string }>(async (req, { params }) => {
  const auth = await requireAdmin(ROLES.kb);
  const { code } = Params.parse(params);
  const body = await readJson(req, Body);
  return editKbDraft(code, body, auth);
});
