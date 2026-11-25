import "server-only";
import { createHash } from "node:crypto";
import { applink } from "../applink/client";
import { bodies } from "../applink/bodies";
import { APPLINK, ApplinkError } from "../applink/errors";
import type { ApplinkApp } from "../applink/types";
import { createSession } from "../auth/session";
import { col, cols } from "../db/collections";
import type { OtpPurpose, OtpRequestDoc, UserDoc } from "../db/types";
import { AppError, badRequest } from "../http/errors";
import { newOtpRequestId, newUserId } from "../lib/ids";
import { log } from "../lib/log";
import { maskMsisdn, normalizeMsisdn } from "../lib/msisdn";
import { enforceRateLimit } from "../lib/ratelimit";
import type { Scenario } from "../lib/scenario";

/*
  Number verification with Applink's subscriber OTP (BACKEND_PLAN.md §6, §8).
  The client only ever sees our requestId ("o-…"); Applink's referenceNo stays here.
*/

export const OTP_TTL_MS = 5 * 60 * 1000;
export const MAX_OTP_ATTEMPTS = 3;

/** Rate-limit keys use a hash, so full numbers aren't stored in rateLimits ids. */
const numberKey = (msisdn: string) => createHash("sha256").update(msisdn).digest("hex").slice(0, 20);

export type RequestOtpOptions = {
  payload?: Record<string, unknown>;
  app?: ApplinkApp;
  ip: string;
  scenario?: Scenario | null;
};

export async function requestOtp(rawMsisdn: string, purpose: OtpPurpose, opts: RequestOtpOptions): Promise<{ requestId: string }> {
  const msisdn = normalizeMsisdn(rawMsisdn);
  if (!msisdn) throw badRequest("Enter a Banglalink number (019 or 014)");

  await enforceRateLimit(`otp:ip:${opts.ip}`, 10, 60 * 60);
  await enforceRateLimit(`otp:n:${numberKey(msisdn)}`, 3, 10 * 60);

  const app = opts.app ?? "farmer";
  const res = await applink(
    "otp/request",
    bodies.otpRequest(msisdn),
    { app, scenario: opts.scenario },
  );

  const now = new Date();
  const doc: OtpRequestDoc = {
    _id: newOtpRequestId(),
    purpose,
    msisdn,
    referenceNo: res.referenceNo,
    attempts: 0,
    ...(opts.payload ? { payload: opts.payload } : {}),
    app,
    createdAt: now,
    expiresAt: new Date(now.getTime() + OTP_TTL_MS),
  };
  const otpRequests = await col("otpRequests");
  await otpRequests.insertOne(doc);
  log.info("otp.requested", { purpose, msisdn: maskMsisdn(msisdn), requestId: doc._id });
  return { requestId: doc._id };
}

const expired = () => new AppError("EXPIRED", "This code has expired. Ask for a new one.", 410);
const locked = () => new AppError("LOCKED", "Too many wrong codes. Ask for a new one.", 423);

export type VerifiedOtp = { user: UserDoc; request: OtpRequestDoc };

/**
 * Check a code. 3 attempts per request: wrong → 400 WRONG_CODE { attemptsLeft },
 * then 423 LOCKED; past 5 min (or unknown id) → 410 EXPIRED. Success is single-use and
 * upserts the user.
 */
export async function verifyOtp(requestId: string, code: string, purpose: OtpPurpose, scenario?: Scenario | null): Promise<VerifiedOtp> {
  const otpRequests = await col("otpRequests");
  const now = new Date();

  // Claim an attempt atomically, so parallel guesses can't exceed the limit.
  const req = await otpRequests.findOneAndUpdate(
    { _id: requestId, purpose, attempts: { $lt: MAX_OTP_ATTEMPTS }, expiresAt: { $gt: now } },
    { $inc: { attempts: 1 } },
    { returnDocument: "after" },
  );
  if (!req) {
    const existing = await otpRequests.findOne({ _id: requestId, purpose });
    if (!existing || existing.expiresAt <= now) throw expired();
    throw locked();
  }

  try {
    const res = await applink("otp/verify", bodies.otpVerify({ referenceNo: req.referenceNo, otp: code }), { app: req.app, scenario });
    if (res.subscriptionStatus !== "REGISTERED") {
      log.warn("otp.not_registered", { requestId, subscriptionStatus: res.subscriptionStatus });
      throw new AppError("NOT_REGISTERED", "This number could not be registered. Try again later.", 409);
    }
  } catch (err) {
    // Any Applink E-code on verify counts as a wrong code, except our IP being blocked.
    if (err instanceof ApplinkError && err.code.startsWith("E") && err.code !== APPLINK.IP_NOT_ALLOWED) {
      const attemptsLeft = Math.max(0, MAX_OTP_ATTEMPTS - req.attempts);
      log.info("otp.wrong_code", { requestId, applinkCode: err.code, attemptsLeft });
      throw new AppError("WRONG_CODE", "Wrong code", 400, { attemptsLeft });
    }
    throw err;
  }

  await otpRequests.deleteOne({ _id: requestId });
  const user = await upsertUser(req.msisdn);
  log.info("otp.verified", { purpose, msisdn: maskMsisdn(req.msisdn), userId: user._id });
  return { user, request: req };
}

async function upsertUser(msisdn: string): Promise<UserDoc> {
  const { users } = await cols();
  const now = new Date();
  const run = () =>
    users.findOneAndUpdate(
      { msisdn },
      {
        $set: { verifiedAt: now },
        $setOnInsert: { _id: newUserId(), msisdn, msisdnMasked: maskMsisdn(msisdn), lang: "bn" as const, createdAt: now },
      },
      { upsert: true, returnDocument: "after" },
    );
  try {
    return (await run())!;
  } catch (err) {
    // Two first-time verifies of the same number at once: the loser hits the unique index.
    if ((err as { code?: unknown }).code !== 11000) throw err;
    return (await run())!;
  }
}

// ---------------------------------------------------------------- farmer sign-in

export type Me = { msisdnMasked: string; msisdnLast4: string; msisdnLocal: string };

export function toMe(user: UserDoc): Me {
  return {
    msisdnMasked: user.msisdnMasked,
    msisdnLast4: user.msisdn.slice(-4),
    msisdnLocal: user.msisdn.startsWith("88") ? user.msisdn.slice(2) : user.msisdn,
  };
}

/** POST /api/auth/otp/verify: check the code, start a 90-day farmer session. */
export async function signInFarmer(requestId: string, code: string, scenario?: Scenario | null): Promise<{ msisdnMasked: string }> {
  const { user } = await verifyOtp(requestId, code, "verify", scenario);
  await createSession("farmer", user._id);
  return { msisdnMasked: user.msisdnMasked };
}
