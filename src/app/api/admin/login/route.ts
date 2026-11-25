import { z } from "zod";
import { clientIp, readJson, wrap } from "@/server/http/handler";
import { adminLogin } from "@/server/services/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200) });

/** POST /api/admin/login { email, password } → { challengeId } (5 tries / 15 min / IP) */
export const POST = wrap(async (req) => {
  const { email, password } = await readJson(req, Body);
  return adminLogin(email, password, clientIp(req));
});
