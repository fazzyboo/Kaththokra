import "server-only";
import { timingSafeEqual } from "node:crypto";
import { after, NextResponse } from "next/server";
import type { ZodType } from "zod";
import type { CallbackType } from "../db/types";
import { callbackToken } from "../env";
import { log } from "../lib/log";
import { logInboundCallback, processCallback, receiveCallback, redactBody } from "../services/inbox";
import { AppError } from "./errors";
import { readJson, wrap } from "./handler";

/*
  Applink callbacks: /api/callbacks/<type>/<CALLBACK_TOKEN>. The token is the only
  authentication Applink gives us, so compare it in constant time and never log it.
  callbackRoute(): token check → parse → applinkLog "in" → inbox → S1000 → process in after().
*/

export function assertCallbackToken(token: string | undefined, type: string): void {
  const expected = Buffer.from(callbackToken());
  const got = Buffer.from(token ?? "");
  const ok = got.length === expected.length && timingSafeEqual(got, expected);
  if (!ok) {
    log.warn("callback.bad_token", { type });
    throw new AppError("FORBIDDEN", "Forbidden", 403);
  }
}

/** The answer Applink expects from every callback. */
export const applinkAck = () => NextResponse.json({ statusCode: "S1000", statusDetail: "Success" });

export type CallbackSpec<T> = {
  schema: ZodType<T>;
  dedupeKey: (body: T) => string;
  /** Fields processing needs; stored unredacted in callbackInbox.payload. */
  payload: (body: T) => Record<string, unknown>;
  statusOf?: (body: T) => string | undefined;
  addressOf?: (body: T) => string | undefined;
  /** Extra check on the body (e.g. the subscription notification's password). false → 403, body logged redacted. */
  authorize?: (body: T) => boolean;
};

export function callbackRoute<T>(type: CallbackType, spec: CallbackSpec<T>) {
  return wrap<{ token: string }>(async (req, { params }) => {
    const started = Date.now();
    assertCallbackToken(params.token, type);
    const body = await readJson(req, spec.schema);
    if (spec.authorize && !spec.authorize(body)) {
      log.warn("callback.unauthorized_body", { type, body: redactBody(body) });
      throw new AppError("FORBIDDEN", "Forbidden", 403);
    }

    const { duplicate, row } = await receiveCallback(type, spec.dedupeKey(body), body, spec.payload(body));

    await logInboundCallback(type, { statusCode: spec.statusOf?.(body), address: spec.addressOf?.(body), ms: Date.now() - started });

    if (!duplicate && row) after(() => processCallback(row).then(() => undefined));
    return applinkAck();
  });
}
