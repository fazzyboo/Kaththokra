import { ROLES } from "@/server/auth/roles";
import { requireAdmin } from "@/server/auth/session";
import { wrap } from "@/server/http/handler";
import { reconcileSubscribers } from "@/server/services/admin-subscribers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST /api/admin/subscribers/reconcile → { checked, changed, failed } (getSubscriberChargingInfo, batches of 10) */
export const POST = wrap(async () => {
  const auth = await requireAdmin(ROLES.subscribers);
  return reconcileSubscribers(500, auth);
});
