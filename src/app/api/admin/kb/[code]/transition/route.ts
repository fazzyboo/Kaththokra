import { z } from "zod";
import { ROLES } from "@/server/auth/roles";
import { requireAdmin } from "@/server/auth/session";
import { readJson, wrap } from "@/server/http/handler";
import { transitionKb } from "@/server/services/admin-kb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Params = z.object({ code: z.string().regex(/^[A-Z][A-Z_]{1,39}$/, "invalid disease code") });
const Body = z.object({ to: z.enum(["draft", "review", "approved", "published"]), note: z.string().trim().max(300).optional() });

/** POST /api/admin/kb/[code]/transition { to, note? } → { published, draft, history } */
export const POST = wrap<{ code: string }>(async (req, { params }) => {
  const auth = await requireAdmin(ROLES.kb);
  const { code } = Params.parse(params);
  const { to, note } = await readJson(req, Body);
  return transitionKb(code, to, auth, note);
});
