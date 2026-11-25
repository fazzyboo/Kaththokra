import { NextResponse } from "next/server";
import { z } from "zod";
import { ROLES } from "@/server/auth/roles";
import { requireAdmin } from "@/server/auth/session";
import { wrap } from "@/server/http/handler";
import { heatmap } from "@/server/services/alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({ crop: z.enum(["rice", "potato", "tomato"]).optional() });

/** GET /api/admin/heatmap?crop= → { diseases, upazilas, cells[][] (null when < 5), days, threshold } */
export const GET = wrap(async (req) => {
  await requireAdmin(ROLES.any);
  const { crop } = Query.parse({ crop: req.nextUrl.searchParams.get("crop") || undefined });
  return NextResponse.json(await heatmap(crop), { headers: { "cache-control": "no-store" } });
});
