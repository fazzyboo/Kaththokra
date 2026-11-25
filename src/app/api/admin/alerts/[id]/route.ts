import { z } from "zod";
import { ROLES } from "@/server/auth/roles";
import { requireAdmin } from "@/server/auth/session";
import { wrap } from "@/server/http/handler";
import { deleteAlert } from "@/server/services/alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Params = z.object({ id: z.string().regex(/^AL-\d{3,6}$/, "invalid alert id") });

/** DELETE /api/admin/alerts/[id] → { ok: true } (not for sent alerts) */
export const DELETE = wrap<{ id: string }>(async (_req, { params }) => {
  const auth = await requireAdmin(ROLES.alerts);
  const { id } = Params.parse(params);
  return deleteAlert(id, auth);
});
