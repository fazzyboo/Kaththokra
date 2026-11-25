import "server-only";
import type { ChargingNotification } from "../applink/types";
import { col } from "../db/collections";
import type { ApplinkLogDoc, CallbackInboxDoc, CallbackType } from "../db/types";
import { getEnv } from "../env";
import { fromApplink, maskMsisdn } from "../lib/msisdn";
import { log } from "../lib/log";
import { settlePayment } from "./payment";
import { handleDlr, handleSmsMo, type DlrPayload, type SmsMoPayload } from "./smsmo";
import { applySubscriptionNotification, type SubscriptionNotifyPayload } from "./subscription";

/*
  Callback inbox (BACKEND_PLAN.md §6). Every Applink callback is written here first
  (unique on type + dedupeKey), answered at once, then processed. Rows without
  processedAt are retried by the process-inbox job (B11).
*/

const PHONE = /(?:tel:)?(?:\+?88)?01[3-9]\d{8}/g;
const PASSWORD_KEY = /pass(word)?|secret|token/i;

/** Mask phone numbers everywhere and drop password-like fields entirely. */
export function redactBody(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[depth]";
  if (typeof value === "string") return value.replace(PHONE, (m) => `…${m.slice(-4)}`);
  if (Array.isArray(value)) return value.map((v) => redactBody(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (PASSWORD_KEY.test(k)) continue;
      out[k] = redactBody(v, depth + 1);
    }
    return out;
  }
  return value;
}

export async function receiveCallback(
  type: CallbackType,
  dedupeKey: string,
  body: unknown,
  payload: Record<string, unknown>,
): Promise<{ duplicate: boolean; row?: CallbackInboxDoc }> {
  const inbox = await col("callbackInbox");
  const row: CallbackInboxDoc = {
    type,
    dedupeKey,
    bodyRedacted: redactBody(body) as Record<string, unknown>,
    payload,
    receivedAt: new Date(),
    attempts: 0,
  };
  try {
    const r = await inbox.insertOne(row);
    return { duplicate: false, row: { ...row, _id: r.insertedId } };
  } catch (err) {
    if ((err as { code?: unknown }).code === 11000) {
      log.info("callback.duplicate", { type, dedupeKey });
      return { duplicate: true };
    }
    throw err;
  }
}

const API_OF: Record<CallbackType, ApplinkLogDoc["api"]> = {
  caas: "caas",
  "sms-mo": "sms",
  "sms-dlr": "sms",
  subscription: "sub",
  ussd: "ussd",
};

/** One applinkLog row with direction "in" per callback (masked number only). */
export async function logInboundCallback(type: CallbackType, opts: { statusCode?: string; address?: string; ms: number }) {
  const n = opts.address ? fromApplink(opts.address) : null;
  try {
    const applinkLog = await col("applinkLog");
    await applinkLog.insertOne({
      at: new Date(),
      api: API_OF[type],
      direction: "in",
      path: `callbacks/${type}`,
      ...(opts.statusCode ? { statusCode: opts.statusCode } : {}),
      ...(n ? { msisdnMasked: maskMsisdn(n) } : {}),
      ms: opts.ms,
      mode: getEnv().APPLINK_MODE,
    });
  } catch (err) {
    log.warn("applink.log_write_failed", { err });
  }
}

export async function markProcessed(row: CallbackInboxDoc, error?: string) {
  const inbox = await col("callbackInbox");
  await inbox.updateOne(
    { _id: row._id },
    error ? { $set: { error: error.slice(0, 200) }, $inc: { attempts: 1 } } : { $set: { processedAt: new Date() }, $inc: { attempts: 1 } },
  );
}

/** Run one inbox row. Sets processedAt on success, error + attempts on failure. Never throws. */
export async function processCallback(row: CallbackInboxDoc): Promise<boolean> {
  const inbox = await col("callbackInbox");
  try {
    switch (row.type) {
      case "caas":
        await settlePayment(row.payload as unknown as ChargingNotification);
        break;
      case "sms-mo":
        await handleSmsMo(row.payload as unknown as SmsMoPayload);
        break;
      case "sms-dlr":
        await handleDlr(row.payload as unknown as DlrPayload);
        break;
      case "subscription":
        await applySubscriptionNotification(row.payload as unknown as SubscriptionNotifyPayload);
        break;
      case "ussd":
        // Handled synchronously in the callback (the reply IS the processing); a USSD
        // session can't be replayed later, so the safety-net job just closes it.
        break;
      default:
        throw new Error(`no processor for callback type ${row.type}`);
    }
    await inbox.updateOne({ _id: row._id }, { $set: { processedAt: new Date() }, $unset: { error: "" }, $inc: { attempts: 1 } });
    return true;
  } catch (err) {
    log.error("callback.process_failed", { type: row.type, dedupeKey: row.dedupeKey, err });
    await inbox
      .updateOne({ _id: row._id }, { $set: { error: String((err as Error)?.message ?? err).slice(0, 200) }, $inc: { attempts: 1 } })
      .catch(() => {});
    return false;
  }
}
