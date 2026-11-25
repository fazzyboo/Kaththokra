import "server-only";
import { z } from "zod";
import { col } from "../db/collections";
import type { SettingsDoc } from "../db/types";

/*
  The single "global" settings document. Missing doc → defaults (run `npm run seed`
  to persist them). Admin Settings edits it through updateSettings().
*/

export type Settings = Omit<SettingsDoc, "_id" | "updatedAt" | "updatedBy">;

export const DEFAULT_SETTINGS: Settings = {
  priceRx: 5,
  priceSubMonthly: 20,
  confidenceGate: 0.75,
  abTest: false,
  revenueShare: 0.5,
  ussdCode: "*XXX#",
  helpline: "16123",
};

export const SettingsPatchSchema = z
  .object({
    priceRx: z.number().positive().max(1000),
    priceSubMonthly: z.number().positive().max(10000),
    confidenceGate: z.number().min(0).max(1),
    abTest: z.boolean(),
    revenueShare: z.number().min(0).max(1),
    ussdCode: z.string().trim().min(1).max(32),
    helpline: z.string().trim().min(1).max(32),
  })
  .partial()
  .strict();

export type SettingsPatch = z.infer<typeof SettingsPatchSchema>;

export type PublicConfig = Pick<Settings, "priceRx" | "priceSubMonthly" | "confidenceGate" | "ussdCode" | "helpline">;

function strip(doc: SettingsDoc | null): Settings {
  if (!doc) return { ...DEFAULT_SETTINGS };
  const { _id, updatedAt, updatedBy, ...rest } = doc;
  void _id;
  void updatedAt;
  void updatedBy;
  return { ...DEFAULT_SETTINGS, ...rest };
}

export async function getSettings(): Promise<Settings> {
  const settings = await col("settings");
  return strip(await settings.findOne({ _id: "global" }));
}

export async function updateSettings(patch: SettingsPatch, actor: string): Promise<Settings> {
  const clean = SettingsPatchSchema.parse(patch);
  const settings = await col("settings");
  const { _id, ...defaults } = { _id: "global" as const, ...DEFAULT_SETTINGS };
  void _id;
  // Fields not in the patch keep their stored value, or get the default on first write.
  const setOnInsert = Object.fromEntries(Object.entries(defaults).filter(([k]) => !(k in clean)));
  const doc = await settings.findOneAndUpdate(
    { _id: "global" },
    { $set: { ...clean, updatedAt: new Date(), updatedBy: actor }, $setOnInsert: setOnInsert },
    { upsert: true, returnDocument: "after" },
  );
  return strip(doc);
}

export function toPublicConfig(s: Settings): PublicConfig {
  return {
    priceRx: s.priceRx,
    priceSubMonthly: s.priceSubMonthly,
    confidenceGate: s.confidenceGate,
    ussdCode: s.ussdCode,
    helpline: s.helpline,
  };
}

export async function getPublicConfig(): Promise<PublicConfig> {
  return toPublicConfig(await getSettings());
}
