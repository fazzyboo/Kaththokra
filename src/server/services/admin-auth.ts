import "server-only";
import { randomBytes } from "node:crypto";
import { verify as verifyTotp } from "otplib";
import type { AdminSession } from "@/lib/session";
import { hashPassword, verifyPassword } from "../auth/password";
import { createSession, destroySession, type AdminAuth } from "../auth/session";
import { col } from "../db/collections";
import type { AdminDoc } from "../db/types";
import { AppError, rateLimited } from "../http/errors";
import { newOtpRequestId } from "../lib/ids";
import { log } from "../lib/log";
import { hitRateLimit, peekRateLimit } from "../lib/ratelimit";
import { audit } from "./audit";

/*
  Admin sign-in (BACKEND_PLAN.md §8): email + bcrypt password → challenge → TOTP → kk_a (12 h).
  The challenge is an otpRequests row with purpose "admin_totp" (TTL 5 min, 5 attempts).
*/

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MAX_TOTP_ATTEMPTS = 5;
const MAX_LOGIN_FAILS = 5;
const LOGIN_WINDOW_SEC = 15 * 60;
// When the email is unknown we still run one bcrypt compare against a real hash (made once
// per instance), so response time doesn't reveal which emails exist.
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword(randomBytes(16).toString("hex")));

export function toAdminSession(a: AdminDoc): AdminSession {
  return { email: a._id, name: a.name, role: a.role };
}

const badLogin = () => new AppError("UNAUTHORIZED", "Wrong email or password", 401);

export async function adminLogin(emailRaw: string, password: string, ip: string): Promise<{ challengeId: string }> {
  // 5 failed tries per IP per 15 min (successful sign-ins don't count, so an office
  // sharing one IP isn't locked out by normal use).
  const key = `admin-login-fail:ip:${ip}`;
  const peek = await peekRateLimit(key, LOGIN_WINDOW_SEC);
  if (peek.count >= MAX_LOGIN_FAILS) throw rateLimited(Math.max(1, Math.ceil((peek.resetAt.getTime() - Date.now()) / 1000)));
  const email = emailRaw.trim().toLowerCase();
  const admins = await col("admins");
  const admin = await admins.findOne({ _id: email });
  const ok = await verifyPassword(password, admin?.passwordHash ?? (await getDummyHash()));
  if (!admin || !ok) {
    await hitRateLimit(key, MAX_LOGIN_FAILS, LOGIN_WINDOW_SEC);
    await audit(email, "admin.login_failed", "admin", email, { step: "password", ip });
    throw badLogin();
  }
  const now = new Date();
  const otpRequests = await col("otpRequests");
  const challengeId = newOtpRequestId();
  await otpRequests.insertOne({
    _id: challengeId,
    purpose: "admin_totp",
    msisdn: "",
    referenceNo: "",
    attempts: 0,
    payload: { email },
    app: "farmer",
    createdAt: now,
    expiresAt: new Date(now.getTime() + CHALLENGE_TTL_MS),
  });
  return { challengeId };
}

export async function adminLoginTotp(challengeId: string, code: string, ip: string): Promise<AdminSession> {
  const otpRequests = await col("otpRequests");
  const now = new Date();
  const ch = await otpRequests.findOneAndUpdate(
    { _id: challengeId, purpose: "admin_totp", attempts: { $lt: MAX_TOTP_ATTEMPTS }, expiresAt: { $gt: now } },
    { $inc: { attempts: 1 } },
    { returnDocument: "after" },
  );
  if (!ch) {
    const cur = await otpRequests.findOne({ _id: challengeId, purpose: "admin_totp" });
    if (!cur || cur.expiresAt <= now) throw new AppError("EXPIRED", "Sign-in expired. Enter your password again.", 410);
    throw new AppError("LOCKED", "Too many wrong codes. Enter your password again.", 423);
  }
  const email = String(ch.payload?.email ?? "");
  const admins = await col("admins");
  const admin = await admins.findOne({ _id: email });
  if (!admin) throw badLogin();

  const result = await verifyTotp({
    secret: admin.totpSecret,
    token: code,
    epochTolerance: 30, // ±1 step of clock drift
    ...(admin.lastTotpStep !== undefined ? { afterTimeStep: admin.lastTotpStep } : {}),
  });
  if (!result.valid) {
    await hitRateLimit(`admin-login-fail:ip:${ip}`, MAX_LOGIN_FAILS, LOGIN_WINDOW_SEC);
    const attemptsLeft = Math.max(0, MAX_TOTP_ATTEMPTS - ch.attempts);
    await audit(email, "admin.login_failed", "admin", email, { step: "totp", ip, attemptsLeft });
    throw new AppError("WRONG_CODE", "Wrong code", 400, { attemptsLeft });
  }

  const step = Math.floor(Date.now() / 1000 / 30) + (result.delta ?? 0);
  await admins.updateOne({ _id: email }, { $set: { lastTotpStep: step, lastLoginAt: now } });
  await otpRequests.deleteOne({ _id: challengeId });
  await createSession("admin", email);
  await audit(email, "admin.login", "admin", email, { ip });
  log.info("admin.login", { role: admin.role });
  return toAdminSession(admin);
}

export async function adminLogout(auth: AdminAuth | null): Promise<{ ok: true }> {
  await destroySession("admin");
  if (auth) await audit(auth.admin._id, "admin.logout", "admin", auth.admin._id);
  return { ok: true };
}
