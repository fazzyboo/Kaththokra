import { z } from "zod";
import { callbackRoute } from "@/server/http/callbacks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const str = z.union([z.string(), z.number()]).transform(String);
const Body = z
  .object({
    externalTrxId: z.string().min(1).max(100),
    statusCode: z.string().min(1).max(20),
    internalTrxId: str.optional().default(""),
    referenceId: str.optional().default(""),
    paidAmount: str.optional().default(""),
    TotalAmount: str.optional().default(""),
    balanceDue: str.optional().default(""),
    timeStamp: str.optional(),
  })
  .passthrough();

/** Applink charging notification → settle the payment (in after()). */
export const POST = callbackRoute("caas", {
  schema: Body,
  dedupeKey: (b) => `${b.externalTrxId}:${b.statusCode}`,
  payload: (b) => ({
    externalTrxId: b.externalTrxId,
    internalTrxId: b.internalTrxId,
    referenceId: b.referenceId,
    paidAmount: b.paidAmount,
    TotalAmount: b.TotalAmount,
    balanceDue: b.balanceDue,
    statusCode: b.statusCode,
    ...(b.timeStamp ? { timeStamp: b.timeStamp } : {}),
  }),
  statusOf: (b) => b.statusCode,
});
