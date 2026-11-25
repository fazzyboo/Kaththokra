import { z } from "zod";
import { applinkAck, assertCallbackToken } from "@/server/http/callbacks";
import { readJson, wrap } from "@/server/http/handler";
import { handleUssdCallback } from "@/server/services/ussd";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const str = z.union([z.string(), z.number()]).transform(String);
const Body = z
  .object({
    sessionId: str,
    ussdOperation: z.string().min(1).max(20),
    sourceAddress: z.string().min(1).max(64),
    message: z.string().max(200).default(""),
    requestId: str.optional().default(""),
  })
  .passthrough();

/** Applink USSD mo-init / mo-cont. Replies with /ussd/send first, then answers S1000 (no after()). */
export const POST = wrap<{ token: string }>(async (req, { params }) => {
  assertCallbackToken(params.token, "ussd");
  const body = await readJson(req, Body);
  await handleUssdCallback(body);
  return applinkAck();
});
