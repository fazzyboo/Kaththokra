import { destroySession } from "@/server/auth/session";
import { wrap } from "@/server/http/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/auth/logout → { ok: true } and clears kk_f */
export const POST = wrap(async () => {
  await destroySession("farmer");
  return { ok: true };
});
