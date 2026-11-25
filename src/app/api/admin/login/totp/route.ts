import { z } from "zod";
import { clientIp, readJson, wrap } from "@/server/http/handler";
import { adminLoginTotp } from "@/server/services/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  challengeId: z.string().regex(/^o-[0-9a-f]{16}$/, "invalid challengeId"),
  code: z.string().regex(/^\d{6}$/, "code must be 6 digits"),
});

/** POST /api/admin/login/totp { challengeId, code } → AdminSession + kk_a (12 h) */
export const POST = wrap(async (req) => {
  const { challengeId, code } = await readJson(req, Body);
  return adminLoginTotp(challengeId, code, clientIp(req));
});
