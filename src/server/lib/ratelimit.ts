import "server-only";
import { col } from "../db/collections";
import { rateLimited } from "../http/errors";

/*
  Fixed-window counter on the `rateLimits` collection. One doc per key per window;
  the TTL index on windowEnd cleans up old windows.
*/

export type RateResult = { ok: boolean; count: number; remaining: number; resetAt: Date };

export async function hitRateLimit(key: string, limit: number, windowSec: number): Promise<RateResult> {
  const windowMs = windowSec * 1000;
  const start = Math.floor(Date.now() / windowMs) * windowMs;
  const windowEnd = new Date(start + windowMs);
  const _id = `${key}:${start}`;
  const rateLimits = await col("rateLimits");

  const bump = () =>
    rateLimits.findOneAndUpdate(
      { _id },
      { $inc: { count: 1 }, $setOnInsert: { windowEnd } },
      { upsert: true, returnDocument: "after" },
    );

  let doc;
  try {
    doc = await bump();
  } catch (err) {
    // Two concurrent upserts on a new key: one loses with E11000; the doc exists now.
    if ((err as { code?: unknown }).code !== 11000) throw err;
    doc = await bump();
  }
  const count = doc?.count ?? 1;
  return { ok: count <= limit, count, remaining: Math.max(0, limit - count), resetAt: windowEnd };
}

/** Current window's count without incrementing (for "count only failures" limits). */
export async function peekRateLimit(key: string, windowSec: number): Promise<RateResult & { limitKey: string }> {
  const windowMs = windowSec * 1000;
  const start = Math.floor(Date.now() / windowMs) * windowMs;
  const rateLimits = await col("rateLimits");
  const doc = await rateLimits.findOne({ _id: `${key}:${start}` });
  const count = doc?.count ?? 0;
  return { ok: true, count, remaining: 0, resetAt: new Date(start + windowMs), limitKey: key };
}

/** Throws 429 RATE_LIMITED when over the limit. */
export async function enforceRateLimit(key: string, limit: number, windowSec: number): Promise<RateResult> {
  const r = await hitRateLimit(key, limit, windowSec);
  if (!r.ok) throw rateLimited(Math.max(1, Math.ceil((r.resetAt.getTime() - Date.now()) / 1000)));
  return r;
}
