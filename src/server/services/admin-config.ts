import "server-only";
import { randomBytes } from "node:crypto";
import { generateSecret, generateURI } from "otplib";
import { hashPassword } from "../auth/password";
import type { AdminAuth, AdminRole } from "../auth/session";
import { cols } from "../db/collections";
import type { EvalRunDoc } from "../db/types";
import { getEnv } from "../env";
import { MOCK_MODEL } from "../gemini/mock";
import { PROMPT_VERSION } from "../gemini/prompt";
import { conflict } from "../http/errors";
import { audit } from "./audit";
import { getSettings, updateSettings, type Settings, type SettingsPatch } from "./settings";

/*
  Admin config pages: AI model info, team (admins), app settings.
*/

// ---------------------------------------------------------------- model

export async function modelInfo(): Promise<{
  mode: "live" | "mock";
  live: string;
  fallback: string | null;
  promptVersion: number;
  gate: number;
  lastEval: (Omit<EvalRunDoc, "_id" | "at"> & { at: string }) | null;
}> {
  const env = getEnv();
  const { evalRuns } = await cols();
  const [last, settings] = await Promise.all([evalRuns.find().sort({ at: -1 }).limit(1).next(), getSettings()]);
  return {
    mode: env.GEMINI_MODE,
    live: env.GEMINI_MODE === "mock" ? MOCK_MODEL : (env.GEMINI_MODEL ?? ""),
    fallback: env.GEMINI_MODE === "mock" ? null : (env.GEMINI_FALLBACK_MODEL ?? null),
    promptVersion: PROMPT_VERSION,
    gate: settings.confidenceGate,
    lastEval: last ? { ...(({ _id, ...rest }) => (void _id, rest))(last), at: last.at.toISOString() } : null,
  };
}

// ---------------------------------------------------------------- team

export type TeamRow = { name: string; email: string; role: AdminRole; totp: boolean; last: string | null };

export async function listTeam(): Promise<TeamRow[]> {
  const { admins } = await cols();
  const rows = await admins.find({}, { projection: { passwordHash: 0, totpSecret: 0, lastTotpStep: 0 } }).sort({ createdAt: 1 }).toArray();
  return rows.map((a) => ({ name: a.name, email: a._id, role: a.role, totp: true, last: a.lastLoginAt ? a.lastLoginAt.toISOString() : null }));
}

/**
 * Add a team member. Returns, ONCE, a temporary password (unless one was given) and the
 * otpauth:// URL for their authenticator. Neither is stored in clear or logged.
 */
export async function addTeamMember(
  input: { email: string; name: string; role: AdminRole; password?: string },
  auth: AdminAuth,
): Promise<{ email: string; name: string; role: AdminRole; otpauthUrl: string; tempPassword?: string }> {
  const { admins } = await cols();
  const email = input.email.trim().toLowerCase();
  if (await admins.findOne({ _id: email }, { projection: { _id: 1 } })) throw conflict("An admin with this email already exists");
  const tempPassword = input.password ? undefined : randomBytes(12).toString("base64url");
  const totpSecret = generateSecret();
  try {
    await admins.insertOne({
      _id: email,
      name: input.name.trim(),
      role: input.role,
      passwordHash: await hashPassword(input.password ?? tempPassword!),
      totpSecret,
      createdAt: new Date(),
    });
  } catch (err) {
    if ((err as { code?: unknown }).code === 11000) throw conflict("An admin with this email already exists");
    throw err;
  }
  await audit(auth.admin._id, "team.add", "admin", email, { role: input.role });
  return {
    email,
    name: input.name.trim(),
    role: input.role,
    otpauthUrl: generateURI({ issuer: "Kaththokra", label: email, secret: totpSecret }),
    ...(tempPassword ? { tempPassword } : {}),
  };
}

// ---------------------------------------------------------------- settings

export async function adminGetSettings(): Promise<Settings> {
  return getSettings();
}

export async function adminUpdateSettings(patch: SettingsPatch, auth: AdminAuth): Promise<Settings> {
  const before = await getSettings();
  const after = await updateSettings(patch, auth.admin._id);
  const changed = Object.fromEntries(
    (Object.keys(patch) as (keyof Settings)[]).filter((k) => before[k] !== after[k]).map((k) => [k, { from: before[k], to: after[k] }]),
  );
  await audit(auth.admin._id, "settings.update", "settings", "global", changed);
  return after;
}
