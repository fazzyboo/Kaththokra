import { z } from "zod";
import { callbackRoute } from "@/server/http/callbacks";
import { fromApplink } from "@/server/lib/msisdn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z
  .object({
    sourceAddress: z.string().min(1).max(64),
    message: z.string().max(1000).default(""),
    requestId: z.union([z.string(), z.number()]).transform(String),
  })
  .passthrough();

/** Applink SMS-MO → keyword handling (PD ALERT / STOP / HELP / PD-xxxxxx). */
export const POST = callbackRoute("sms-mo", {
  schema: Body,
  dedupeKey: (b) => b.requestId,
  payload: (b) => ({ msisdn: fromApplink(b.sourceAddress), message: b.message, requestId: b.requestId }),
  addressOf: (b) => b.sourceAddress,
});
