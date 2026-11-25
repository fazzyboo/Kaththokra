import { ROLES } from "@/server/auth/roles";
import { requireAdmin } from "@/server/auth/session";
import { wrap } from "@/server/http/handler";
import { dealersCsv } from "@/server/services/admin-dealers";
import { dhakaDate } from "@/server/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/dealers.csv → text/csv (masked numbers, audited) */
export const GET = wrap(async () => {
  const auth = await requireAdmin(ROLES.dealers);
  const csv = await dealersCsv(auth);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="kaththokra-dealers-${dhakaDate()}.csv"`,
      "cache-control": "no-store",
    },
  });
});
