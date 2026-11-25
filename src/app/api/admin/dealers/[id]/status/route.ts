import { z } from "zod";
import { ROLES } from "@/server/auth/roles";
import { requireAdmin } from "@/server/auth/session";
import { readJson, wrap } from "@/server/http/handler";
import { setDealerStatus } from "@/server/services/admin-dealers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Params = z.object({ id: z.string().regex(/^DLR-\d{3,6}$/, "invalid dealer id") });
const Body = z.object({ status: z.enum(["active", "paused", "flagged"]) });

/** POST /api/admin/dealers/[id]/status { status } → { id, status } (paused signs the dealer out) */
export const POST = wrap<{ id: string }>(async (req, { params }) => {
  const auth = await requireAdmin(ROLES.dealers);
  const { id } = Params.parse(params);
  const { status } = await readJson(req, Body);
  return setDealerStatus(id, status, auth);
});
