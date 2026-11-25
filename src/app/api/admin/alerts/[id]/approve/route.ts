import { z } from "zod";
import { ROLES } from "@/server/auth/roles";
import { requireAdmin } from "@/server/auth/session";
import { wrap } from "@/server/http/handler";
import { approveAlert } from "@/server/services/alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Params = z.object({ id: z.string().regex(/^(AL-\d{3,6}|SUG-[A-Z_]{2,40})$/, "invalid alert id") });

/** POST /api/admin/alerts/[id]/approve → AlertItem (scheduled for the next 07:00 Asia/Dhaka). SUG-<code> adopts a suggestion. */
export const POST = wrap<{ id: string }>(async (_req, { params }) => {
  const auth = await requireAdmin(ROLES.alerts);
  const { id } = Params.parse(params);
  return approveAlert(id, auth);
});
