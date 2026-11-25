import { NextResponse } from "next/server";
import { z } from "zod";
import { ROLES } from "@/server/auth/roles";
import { requireAdmin } from "@/server/auth/session";
import { wrap } from "@/server/http/handler";
import { liveLog } from "@/server/services/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({
  after: z.iso.datetime({ offset: true }).optional(),
  api: z.enum(["all", "caas", "sms", "ussd", "sub"]).default("all"),
});

/** GET /api/admin/live-log?after=<iso>&api=all|caas|sms|ussd|sub → LogEntry[] (newest first, max 100) */
export const GET = wrap(async (req) => {
  await requireAdmin(ROLES.liveLog);
  const sp = req.nextUrl.searchParams;
  const q = Query.parse({ after: sp.get("after") ?? undefined, api: sp.get("api") ?? undefined });
  const rows = await liveLog(q.after ? new Date(q.after) : null, q.api);
  return NextResponse.json(rows, { headers: { "cache-control": "no-store" } });
});
