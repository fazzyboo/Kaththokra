import { z } from "zod";
import { readJson, wrap } from "@/server/http/handler";
import { assertMockApplink, forwardDevCallback } from "@/server/services/dev";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  type: z.enum(["caas", "sms-mo", "sms-dlr", "subscription", "ussd"]),
  body: z.record(z.string(), z.unknown()),
  /** Override the token, to test the 403 path. */
  token: z.string().max(200).optional(),
});

/** Dev only: POST { type, body } to /api/callbacks/<type>/<token>. 404 unless APPLINK_MODE=mock. */
export const POST = wrap(async (req) => {
  assertMockApplink();
  const input = await readJson(req, Body);
  return forwardDevCallback(req.nextUrl.origin, input);
});
