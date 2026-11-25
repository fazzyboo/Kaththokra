import { requireAdmin } from "@/server/auth/session";
import { wrap } from "@/server/http/handler";
import { adminLogout } from "@/server/services/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/admin/logout → { ok: true } (audited when a session existed) */
export const POST = wrap(async () => {
  const auth = await requireAdmin().catch(() => null);
  return adminLogout(auth);
});
