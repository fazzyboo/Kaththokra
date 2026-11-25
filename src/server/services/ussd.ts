import "server-only";
import { UPAZILAS } from "@/lib/data";
import { applink } from "../applink/client";
import { bodies } from "../applink/bodies";
import { APPLINK, ApplinkError } from "../applink/errors";
import { col, cols } from "../db/collections";
import type { ApplinkLogDoc } from "../db/types";
import { AppError } from "../http/errors";
import { log } from "../lib/log";
import { fromApplink, maskMsisdn } from "../lib/msisdn";
import { hitRateLimit } from "../lib/ratelimit";
import type { Scenario } from "../lib/scenario";
import { CROP_IDS, MAX_SCREEN, MSG, TREE, screenText, type Prices, type UssdNode } from "../ussd/tree";
import { createUssdDiagnosis, requestReview } from "./diagnosis";
import { logInboundCallback, markProcessed, receiveCallback } from "./inbox";
import { prescriptionSms, sendSms } from "./messaging";
import { initiatePayment, submitPaymentOtp } from "./payment";
import { getSettings } from "./settings";
import { subscribeBySms } from "./subscription";

/*
  USSD state machine (BACKEND_PLAN.md §6; spec = src/app/(farmer)/ussd/page.tsx).
  Session stack in ussdSessions (TTL 120 s). 0 = back, 00 = main menu, invalid input
  re-prompts. No Gemini on this path: the symptom tree picks the code.
*/

const SESSION_TTL_MS = 120_000;

export type UssdRequest = { sessionId: string; msisdn: string; input: string; isInit: boolean; scenario: Scenario | null };
export type UssdResult = { text: string; end: boolean; paymentAccepted?: string };

type Step = { stack: UssdNode[]; prefix?: string; paymentAccepted?: string };
type Ctx = { msisdn: string; userId?: string; scenario: Scenario | null };

const fin = (stack: UssdNode[], text: string): Step => ({ stack: [...stack, { id: "FIN", text }] });
const push = (stack: UssdNode[], n: UssdNode): Step => ({ stack: [...stack, n] });
const leafName = (code: string) =>
  Object.values(TREE)
    .flat()
    .find((o) => o.leaf.kind === "dx" && o.leaf.code === code)?.leaf as { name: string } | undefined;

/** A fresh dial: resume an unfinished payment (OTP_SENT, within its 5-min window) or show MAIN. */
async function initialStack(msisdn: string): Promise<{ stack: UssdNode[]; pendingPaymentId?: string }> {
  const { payments, diagnoses } = await cols();
  const p = await payments.findOne(
    { msisdn, channel: "ussd", status: "OTP_SENT", otpExpiresAt: { $gt: new Date() } },
    { sort: { createdAt: -1 } },
  );
  if (p) {
    const d = await diagnoses.findOne({ _id: p.diagnosisId }, { projection: { top3: 1 } });
    const name = leafName(d?.top3[0]?.code ?? "")?.name ?? "rog";
    return { stack: [{ id: "MAIN" }, { id: "OTP_WAIT", name, paymentId: p._id, note: MSG.resumeNote }], pendingPaymentId: p._id };
  }
  return { stack: [{ id: "MAIN" }] };
}

async function resendLatest(msisdn: string): Promise<string> {
  const prescriptions = await col("prescriptions");
  const rx = await prescriptions.find({ msisdn }).sort({ paidAt: -1 }).limit(1).next();
  if (!rx) return MSG.noPrescription;
  const lim = await hitRateLimit(`resend:${rx._id}`, 3, 24 * 60 * 60); // shared with app + SMS re-send
  if (!lim.ok) return MSG.resendCapped;
  const text = prescriptionSms({ ref: rx._id, crop: rx.crop, amount: rx.amount, banglish: rx.disease.banglish, treatment: rx.treatment });
  await sendSms(msisdn, text, "prescription-resend", { ref: rx._id });
  return MSG.resend(rx._id);
}

async function step(stack: UssdNode[], v: string, ctx: Ctx): Promise<Step | null> {
  const node = stack[stack.length - 1];
  if (v === "00") return { stack: [{ id: "MAIN" }] };
  if (v === "0") return { stack: stack.length > 1 ? stack.slice(0, -1) : stack };
  const k = Number(v);

  switch (node.id) {
    case "MAIN":
      if (k >= 1 && k <= 3) return push(stack, { id: "PART", crop: k });
      if (k === 4) return push(stack, { id: "ALERT_CROP" });
      if (k === 5) return fin(stack, await resendLatest(ctx.msisdn));
      return null;

    case "PART":
      if (k >= 1 && k <= 3) return push(stack, { id: "SYMPTOM", crop: node.crop, part: k });
      return null;

    case "SYMPTOM": {
      const o = (TREE[`${node.crop}-${node.part}`] ?? [])[k - 1];
      if (!o || o.leaf.kind === "unsure") return fin(stack, MSG.unsure); // "Onno" and anything else
      if (o.leaf.kind === "consult") return fin(stack, MSG.consult);
      return push(stack, { id: "RESULT", crop: node.crop, name: o.leaf.name, code: o.leaf.code });
    }

    case "RESULT": {
      const crop = CROP_IDS[node.crop - 1];
      if (k === 1) {
        try {
          const d = await createUssdDiagnosis({ crop, code: node.code, status: "CONFIDENT", userId: ctx.userId });
          const { paymentId } = await initiatePayment(d.id, ctx.msisdn, { userId: ctx.userId, scenario: ctx.scenario });
          return push(stack, { id: "OTP_WAIT", name: node.name, paymentId });
        } catch (err) {
          if (err instanceof ApplinkError && err.code === APPLINK.LOW_BALANCE) return fin(stack, MSG.lowBalance);
          if (err instanceof AppError && err.code === "NOT_PAYABLE") return fin(stack, MSG.notPayable);
          log.warn("ussd.pay_init_failed", { msisdn: maskMsisdn(ctx.msisdn), err: (err as Error).message });
          return fin(stack, MSG.payBusy);
        }
      }
      if (k === 2) {
        try {
          const d = await createUssdDiagnosis({ crop, code: node.code, status: "UNCERTAIN", userId: ctx.userId });
          await requestReview(d.id, { msisdn: ctx.msisdn, note: `USSD: ${node.name}` }, { userId: ctx.userId });
        } catch (err) {
          log.warn("ussd.review_failed", { msisdn: maskMsisdn(ctx.msisdn), err: (err as Error).message });
        }
        return fin(stack, MSG.review);
      }
      return null;
    }

    case "OTP_WAIT": {
      if (!/^\d{6}$/.test(v)) return null;
      try {
        await submitPaymentOtp(node.paymentId, v, { scenario: ctx.scenario });
        return { ...fin(stack, MSG.paidOk), paymentAccepted: node.paymentId };
      } catch (err) {
        if (err instanceof AppError) {
          if (err.code === "WRONG_CODE") {
            const left = Number(err.details?.attemptsLeft ?? 0);
            return left > 0 ? { stack, prefix: MSG.wrongCode(left) } : fin(stack, MSG.locked);
          }
          if (err.code === "LOCKED") return fin(stack, MSG.locked);
          if (err.code === "EXPIRED") return fin(stack, MSG.expired);
        }
        if (err instanceof ApplinkError && err.code === APPLINK.LOW_BALANCE) return fin(stack, MSG.lowBalance);
        log.warn("ussd.otp_failed", { paymentId: node.paymentId, err: (err as Error).message });
        return fin(stack, MSG.payBusy);
      }
    }

    case "ALERT_CROP":
      if (k >= 1 && k <= 3) return push(stack, { id: "ALERT_UPZ", crop: k });
      return null;

    case "ALERT_UPZ":
      if (/^\d{3}$/.test(v) && UPAZILAS.some((u) => u.num === v)) return push(stack, { id: "ALERT_CONFIRM", crop: node.crop, upz: v });
      return null;

    case "ALERT_CONFIRM": {
      if (k !== 1) return null;
      const upazila = UPAZILAS.find((u) => u.num === node.upz)!.code;
      try {
        const status = await subscribeBySms(ctx.msisdn, CROP_IDS[node.crop - 1], upazila, "ussd");
        return fin(stack, status === "REGISTERED" ? MSG.alertOn : MSG.alertPending);
      } catch (err) {
        log.warn("ussd.alert_failed", { msisdn: maskMsisdn(ctx.msisdn), err: (err as Error).message });
        return fin(stack, MSG.alertBusy);
      }
    }

    case "FIN":
      return null;
  }
}

function render(stack: UssdNode[], prices: Prices, prefix?: string): string {
  const base = screenText(stack[stack.length - 1], prices);
  const withPrefix = prefix ? `${prefix}\n${base}` : base;
  return withPrefix.length <= MAX_SCREEN ? withPrefix : base;
}

export async function handleUssd(req: UssdRequest): Promise<UssdResult> {
  const { ussdSessions, users } = await cols();
  const settings = await getSettings();
  const prices: Prices = { priceRx: settings.priceRx, priceSubMonthly: settings.priceSubMonthly };
  const now = new Date();

  let sess = req.isInit ? null : await ussdSessions.findOne({ _id: req.sessionId, expiresAt: { $gt: now } });
  if (sess && sess.msisdn !== req.msisdn) sess = null;

  let stack: UssdNode[];
  let prefix: string | undefined;
  let paymentAccepted: string | undefined;
  let pendingPaymentId = sess?.pendingPaymentId;

  if (!sess) {
    const init = await initialStack(req.msisdn);
    stack = init.stack;
    pendingPaymentId = init.pendingPaymentId;
  } else {
    const user = await users.findOne({ msisdn: req.msisdn }, { projection: { _id: 1 } });
    const r = await step(sess.stack, req.input.trim(), { msisdn: req.msisdn, userId: user?._id, scenario: req.scenario });
    if (r) {
      stack = r.stack;
      prefix = r.prefix;
      paymentAccepted = r.paymentAccepted;
    } else {
      stack = sess.stack;
      prefix = MSG.invalid; // invalid input: same screen again
    }
    const top = stack[stack.length - 1];
    if (top.id === "OTP_WAIT") pendingPaymentId = top.paymentId;
  }

  const top = stack[stack.length - 1];
  const end = top.id === "FIN";
  const text = render(stack, prices, prefix);

  if (end) {
    await ussdSessions.deleteOne({ _id: req.sessionId });
  } else {
    await ussdSessions.updateOne(
      { _id: req.sessionId },
      {
        $set: {
          msisdn: req.msisdn,
          stack,
          expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
          ...(pendingPaymentId ? { pendingPaymentId } : {}),
        },
      },
      { upsert: true },
    );
  }
  return { text, end, ...(paymentAccepted ? { paymentAccepted } : {}) };
}

// ---------------------------------------------------------------- Applink callback

export type UssdCallbackBody = {
  sessionId: string;
  ussdOperation: string;
  sourceAddress: string;
  message: string;
  requestId: string;
};

/**
 * mo-init / mo-cont: run the state machine, reply with ussd/send (mt-cont / mt-fin) on the
 * same sessionId, and only then let the route answer S1000. No after() on this path.
 */
export async function handleUssdCallback(body: UssdCallbackBody): Promise<void> {
  const started = Date.now();
  const { duplicate, row } = await receiveCallback(
    "ussd",
    `${body.sessionId}:${body.requestId}`,
    body,
    { sessionId: body.sessionId, requestId: body.requestId, op: body.ussdOperation },
  );
  await logInboundCallback("ussd", { statusCode: body.ussdOperation, address: body.sourceAddress, ms: Date.now() - started });
  if (duplicate || !row) return;

  const msisdn = fromApplink(body.sourceAddress);
  let result: UssdResult;
  try {
    result = msisdn
      ? await handleUssd({ sessionId: body.sessionId, msisdn, input: body.message ?? "", isInit: body.ussdOperation === "mo-init", scenario: null })
      : { text: MSG.notBanglalink, end: true };
  } catch (err) {
    log.error("ussd.handle_failed", { err });
    result = { text: MSG.payBusy, end: true };
  }

  try {
    await applink("ussd/send", bodies.ussdSend({ sessionId: body.sessionId, message: result.text, end: result.end, destinationAddress: body.sourceAddress }));
    await markProcessed(row);
  } catch (err) {
    log.warn("ussd.reply_failed", { errorCode: err instanceof ApplinkError ? err.code : "INTERNAL" });
    await markProcessed(row, `ussd/send failed: ${(err as Error).message}`);
  }
}

// ---------------------------------------------------------------- simulator

export type SimLogRow = Pick<ApplinkLogDoc, "api" | "direction" | "path" | "statusCode" | "ms"> & { at: string };

/**
 * POST /api/ussd/simulate (mock Applink only). Runs the real state machine. When a payment
 * code was accepted, waits (≤ 6 s) for the mock charging notification to settle it, so the
 * returned log shows debit → verify → notification → SMS.
 */
export async function simulateUssd(input: { sessionId: string; input: string; msisdn: string; scenario: Scenario | null }) {
  const started = new Date();
  const r = await handleUssd({ sessionId: input.sessionId, msisdn: input.msisdn, input: input.input, isInit: false, scenario: input.scenario });

  const { payments, applinkLog } = await cols();
  if (r.paymentAccepted) {
    for (let i = 0; i < 30; i++) {
      const p = await payments.findOne({ _id: r.paymentAccepted }, { projection: { status: 1 } });
      // FULFILLED = prescription created and SMS handed to Applink.
      if (p && ["FULFILLED", "DELIVERED", "FAILED", "EXPIRED"].includes(p.status)) break;
      if (input.scenario?.payment === "slow") break;
      await new Promise((res) => setTimeout(res, 200));
    }
  }
  const masked = maskMsisdn(input.msisdn);
  const rows = await applinkLog
    .find({ at: { $gte: started }, $or: [{ msisdnMasked: masked }, { msisdnMasked: { $exists: false } }] })
    .sort({ at: 1 })
    .limit(30)
    .toArray();
  const logRows: SimLogRow[] = rows.map((x) => ({
    at: x.at.toISOString(),
    api: x.api,
    direction: x.direction,
    path: x.path,
    ...(x.statusCode ? { statusCode: x.statusCode } : {}),
    ...(x.ms !== undefined ? { ms: x.ms } : {}),
  }));
  return { text: r.text, end: r.end, log: logRows };
}
