import { z } from "zod";
import { callbackRoute } from "@/server/http/callbacks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z
  .object({
    requestId: z.union([z.string(), z.number()]).transform(String),
    deliveryStatus: z.string().min(1).max(40),
    destinationAddress: z.string().max(64).optional(),
    timeStamp: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough();

/** Applink SMS delivery report → smsLog.dlrStatus + prescription.sms. */
export const POST = callbackRoute("sms-dlr", {
  schema: Body,
  dedupeKey: (b) => `${b.requestId}:${b.deliveryStatus}`,
  payload: (b) => ({ requestId: b.requestId, deliveryStatus: b.deliveryStatus }),
  statusOf: (b) => b.deliveryStatus,
  addressOf: (b) => b.destinationAddress,
});
