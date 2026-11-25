import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { after } from "next/server";
import { col } from "../db/collections";
import { callbackToken, getEnv } from "../env";
import { log } from "../lib/log";
import { hitRateLimit } from "../lib/ratelimit";
import { DEFAULT_SCENARIO, type Scenario } from "../lib/scenario";
import { APPLINK } from "./errors";
import type {
  ApplinkPath,
  ApplinkRequest,
  ApplinkStatus,
  CaasOtpVerifyRequest,
  ChargingNotification,
  DebitRequest,
  OtpRequestRequest,
  OtpVerifyRequest,
  SmsSendRequest,
  SubscriptionSendRequest,
} from "./types";

/*
  APPLINK_MODE=mock. Realistic Applink answers that follow the demo Scenario:
  - caas/direct/debit → P1003 + RC-xxxxx
  - caas/otp/verify   → wrong code on attempt 1 (payment=wrong_once), E1308 (low_balance), else S1000.
                        On S1000 POSTs a charging notification to our own /api/callbacks/caas/<token>:
                        ~0.3 s for success, 2 s otherwise, never for slow.
  - otp/request → referenceNo; otp/verify → wrong for "000000", else REGISTERED
  - sms/send → requestId + messageIds; ussd/send, subscription/send → S1000
  - subscription/getSubscriberChargingInfo → REGISTERED for every number
  Nothing here leaves the server except the self-callback.
*/

type DebitRecord = { externalTrxId: string; internalTrxId: string; amount: string; subscriberId: string };
type MockState = { debits: Map<string, DebitRecord>; otps: Map<string, string> };
const g = globalThis as typeof globalThis & { __kkApplinkMock?: MockState };
const state: MockState = (g.__kkApplinkMock ??= { debits: new Map(), otps: new Map() });

const hex = (n: number) => randomBytes(n).toString("hex");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ok = (extra: object = {}): ApplinkStatus => ({ statusCode: APPLINK.SUCCESS, statusDetail: "Success", ...extra });
const wrongOtp = (): ApplinkStatus => ({ statusCode: APPLINK.WRONG_OTP, statusDetail: "Invalid OTP (mock)" });

export async function mockApplink<P extends ApplinkPath>(
  path: P,
  body: ApplinkRequest<P>,
  scenario: Scenario | null,
): Promise<ApplinkStatus> {
  const sc = scenario ?? DEFAULT_SCENARIO;
  await sleep(80 + randomInt(0, 120)); // look like a network call in the live log

  switch (path) {
    case "caas/direct/debit": {
      const b = body as DebitRequest;
      // Long enough not to collide with old payments (unique index on requestCorrelator).
      const requestCorrelator = `RC-${hex(6)}`;
      const internalTrxId = `IT${Date.now()}${randomInt(100, 1000)}`;
      state.debits.set(requestCorrelator, { externalTrxId: b.externalTrxId, internalTrxId, amount: b.amount, subscriberId: b.subscriberId });
      return { statusCode: APPLINK.DEBIT_PENDING, statusDetail: "Request accepted, OTP sent", requestCorrelator, internalTrxId } as ApplinkStatus;
    }

    case "caas/otp/verify": {
      const b = body as CaasOtpVerifyRequest;
      if (b.otp === "000000") return wrongOtp();
      if (sc.payment === "wrong_once") {
        // Persistent attempt counter so it works across serverless instances.
        const { count } = await hitRateLimit(`mock-caas-otp:${b.referenceNo}`, 1, 3600);
        if (count === 1) return wrongOtp();
      }
      if (sc.payment === "low_balance") return { statusCode: APPLINK.LOW_BALANCE, statusDetail: "Insufficient balance (mock)" };
      if (sc.payment !== "slow") scheduleChargingNotification(b.referenceNo, sc.payment === "success" ? 300 : 2000);
      return ok();
    }

    case "otp/request": {
      const b = body as OtpRequestRequest;
      const referenceNo = `MREF-${hex(6)}`;
      state.otps.set(referenceNo, b.subscriberId);
      return ok({ referenceNo });
    }

    case "otp/verify": {
      const b = body as OtpVerifyRequest;
      if (b.otp === "000000") return wrongOtp();
      return ok({ subscriptionStatus: "REGISTERED", subscriberId: state.otps.get(b.referenceNo) ?? "tel:unknown" });
    }

    case "subscription/send": {
      const b = body as SubscriptionSendRequest;
      return ok({ subscriptionStatus: b.action === "1" ? "REGISTERED" : "UNREGISTERED" });
    }

    case "subscription/query-base":
      return ok({ baseSize: "0" });

    case "subscription/getSubscriberChargingInfo": {
      const b = body as { subscriberId: string };
      return ok({ subscriberId: b.subscriberId, subscriptionStatus: "REGISTERED" });
    }

    case "sms/send": {
      const b = body as SmsSendRequest;
      return ok({
        requestId: `MSMS-${hex(6)}`,
        destinationResponses: b.destinationAddresses.map((address) => ({
          address,
          messageId: `MMSG-${hex(6)}`,
          statusCode: APPLINK.SUCCESS,
          statusDetail: "Success",
        })),
      });
    }

    case "ussd/send":
      return ok();

    default:
      return { statusCode: "E1001", statusDetail: `Unknown path ${String(path)} (mock)` };
  }
}

/** Debit details for a requestCorrelator: this instance's memory first, then the payments collection. */
async function findDebit(requestCorrelator: string): Promise<DebitRecord | null> {
  const mem = state.debits.get(requestCorrelator);
  if (mem) return mem;
  try {
    const payments = await col("payments");
    const p = await payments.findOne({ requestCorrelator });
    if (!p) return null;
    return {
      externalTrxId: p.externalTrxId,
      internalTrxId: p.internalTrxId ?? `IT${Date.now()}`,
      amount: p.amount.toFixed(2),
      subscriberId: `tel:${p.msisdn}`,
    };
  } catch {
    return null;
  }
}

function scheduleChargingNotification(requestCorrelator: string, delayMs: number) {
  const send = async () => {
    await sleep(delayMs);
    const debit = await findDebit(requestCorrelator);
    if (!debit) {
      log.warn("applink.mock.notify_skipped", { reason: "unknown requestCorrelator", requestCorrelator });
      return;
    }
    const notification: ChargingNotification = {
      externalTrxId: debit.externalTrxId,
      internalTrxId: debit.internalTrxId,
      referenceId: requestCorrelator,
      paidAmount: debit.amount,
      TotalAmount: debit.amount,
      balanceDue: "0.00",
      statusCode: APPLINK.SUCCESS,
      timeStamp: new Date().toISOString(),
    };
    const base = getEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
    try {
      const res = await fetch(`${base}/api/callbacks/caas/${callbackToken()}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(notification),
        signal: AbortSignal.timeout(10_000),
      });
      log.info("applink.mock.notify_sent", { status: res.status, externalTrxId: debit.externalTrxId });
    } catch (err) {
      log.warn("applink.mock.notify_failed", { err: (err as Error).name, externalTrxId: debit.externalTrxId });
    }
    state.debits.delete(requestCorrelator);
  };

  // Inside a request: after() keeps the function alive on Vercel. Outside (scripts): plain promise.
  // Start now (so a caller in the same request can wait for it); after() only keeps the
  // serverless function alive until it finishes. Outside a request (scripts) after() throws.
  const task = send().catch(() => undefined);
  try {
    after(() => task);
  } catch {
    /* not in a request: the promise runs on its own */
  }
}
