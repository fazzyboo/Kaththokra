import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import type { AdminSession } from "@/lib/session";
import { col } from "../db/collections";
import type { AdminDoc, DealerDoc, SessionDoc, SessionKind, UserDoc } from "../db/types";
import { sessionPepper } from "../env";
import { forbidden, unauthorized } from "../http/errors";
import { newSessionToken } from "../lib/ids";

/*
  Server sessions (BACKEND_PLAN.md §8). The cookie holds a random 32-byte token; Mongo
  stores only SHA-256(token + SESSION_PEPPER). Cookies: httpOnly, Secure in production,
  SameSite=Lax, Path=/.
*/

export const SESSION_COOKIE: Record<SessionKind, string> = { farmer: "kk_f", dealer: "kk_d", admin: "kk_a" };

/** Lifetimes in days: farmer 90, dealer 30, admin 12 h. */
export const SESSION_DAYS: Record<SessionKind, number> = { farmer: 90, dealer: 30, admin: 0.5 };

const DAY_MS = 24 * 60 * 60 * 1000;

export function hashToken(token: string): string {
  return createHash("sha256").update(token + sessionPepper()).digest("hex");
}

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

export async function createSession(kind: SessionKind, subjectId: string, days = SESSION_DAYS[kind]): Promise<{ expiresAt: Date }> {
  const token = newSessionToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + days * DAY_MS);
  const sessions = await col("sessions");
  await sessions.insertOne({ _id: hashToken(token), kind, subjectId, createdAt: now, expiresAt });
  (await cookies()).set(SESSION_COOKIE[kind], token, cookieOptions(expiresAt));
  return { expiresAt };
}

export async function readSession(kind: SessionKind): Promise<SessionDoc | null> {
  const token = (await cookies()).get(SESSION_COOKIE[kind])?.value;
  if (!token || token.length > 128) return null;
  const sessions = await col("sessions");
  // The TTL monitor runs about once a minute, so check expiry here too.
  return sessions.findOne({ _id: hashToken(token), kind, expiresAt: { $gt: new Date() } });
}

export async function destroySession(kind: SessionKind): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE[kind])?.value;
  if (token && token.length <= 128) {
    const sessions = await col("sessions");
    await sessions.deleteOne({ _id: hashToken(token) });
  }
  store.set(SESSION_COOKIE[kind], "", { ...cookieOptions(new Date(0)), maxAge: 0 });
}

/** Delete every session of one subject (e.g. dealer suspended, admin removed). */
export async function destroyAllSessions(kind: SessionKind, subjectId: string): Promise<number> {
  const sessions = await col("sessions");
  const r = await sessions.deleteMany({ kind, subjectId });
  return r.deletedCount;
}

// ---------------------------------------------------------------- helpers for routes

export type FarmerAuth = { session: SessionDoc; user: UserDoc };

export async function optionalFarmer(): Promise<FarmerAuth | null> {
  const session = await readSession("farmer");
  if (!session) return null;
  const users = await col("users");
  const user = await users.findOne({ _id: session.subjectId });
  return user ? { session, user } : null;
}

export async function requireFarmer(): Promise<FarmerAuth> {
  const auth = await optionalFarmer();
  if (!auth) throw unauthorized("Verify your number first");
  return auth;
}

export type DealerAuth = { session: SessionDoc; dealer: DealerDoc };

export async function optionalDealer(): Promise<DealerAuth | null> {
  const session = await readSession("dealer");
  if (!session) return null;
  const dealers = await col("dealers");
  const dealer = await dealers.findOne({ _id: session.subjectId });
  return dealer ? { session, dealer } : null;
}

export async function requireDealer(): Promise<DealerAuth> {
  const auth = await optionalDealer();
  if (!auth) throw unauthorized("Dealer sign-in required");
  if (auth.dealer.status === "paused") throw forbidden("Dealer account is paused");
  return auth;
}

/**
 * For farmer-facing routes the dealer app also uses (diagnose, review, pay): the dealer
 * session if any, 403 if that dealer is paused, null without a dealer cookie.
 */
export async function dealerActor(): Promise<DealerAuth | null> {
  const auth = await optionalDealer();
  if (auth && auth.dealer.status === "paused") throw forbidden("Dealer account is paused");
  return auth;
}

export type AdminRole = AdminSession["role"];
export type AdminAuth = { session: SessionDoc; admin: AdminDoc };

/** `roles` empty = any signed-in admin role. */
export async function requireAdmin(roles: AdminRole[] = []): Promise<AdminAuth> {
  const session = await readSession("admin");
  if (!session) throw unauthorized("Admin sign-in required");
  const admins = await col("admins");
  const admin = await admins.findOne({ _id: session.subjectId });
  if (!admin) throw unauthorized("Admin sign-in required");
  if (roles.length && !roles.includes(admin.role)) throw forbidden("Your role can't do this");
  return { session, admin };
}
