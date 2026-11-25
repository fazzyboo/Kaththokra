import { requireFarmer } from "@/server/auth/session";
import { wrap } from "@/server/http/handler";
import { stopSubscription } from "@/server/services/subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/unsubscribe → { ok: true } (signed-in farmer's own number) */
export const POST = wrap(async () => {
  const { user } = await requireFarmer();
  return stopSubscription(user.msisdn);
});
