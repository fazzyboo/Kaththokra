import { wrap } from "@/server/http/handler";
import { dealerLogout } from "@/server/services/dealer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/dealer/logout → { ok: true }, clears kk_d (paused dealers can log out too) */
export const POST = wrap(async () => dealerLogout());
