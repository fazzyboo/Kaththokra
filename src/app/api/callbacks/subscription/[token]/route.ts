import { createHash } from "node:crypto";
import { z } from "zod";
import { callbackRoute } from "@/server/http/callbacks";
import { fromApplink } from "@/server/lib/msisdn";
import { subscriptionPasswordOk } from "@/server/services/subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const str = z.union([z.string(), z.number()]).transform(String);
const Body = z
  .object({
    subscriberId: z.string().min(1).max(100),
    status: z.string().min(1).max(40),
    password: z.string().max(200).optional(),
    frequency: z.string().max(40).optional(),
    timeStamp: str.optional(),
    applicationId: z.string().max(100).optional(),
  })
  .passthrough();

const idHash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 20);

/** Applink subscription notification. The body's password must equal APPLINK_PASSWORD. */
export const POST = callbackRoute("subscription", {
  schema: Body,
  authorize: (b) => subscriptionPasswordOk(b.password),
  // Hash the subscriber id so full numbers don't sit in the unique index.
  dedupeKey: (b) => `${idHash(b.subscriberId)}:${b.status}:${b.timeStamp ?? ""}`,
  payload: (b) => ({
    msisdn: fromApplink(b.subscriberId),
    status: b.status,
    ...(b.frequency ? { frequency: b.frequency } : {}),
    ...(b.timeStamp ? { timeStamp: b.timeStamp } : {}),
  }),
  statusOf: (b) => b.status,
  addressOf: (b) => b.subscriberId,
});
