import { NextResponse } from "next/server";
import { getEnv } from "@/server/env";
import { pingDb } from "@/server/db/client";
import { wrap } from "@/server/http/handler";
import { log } from "@/server/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = wrap(async () => {
  const env = getEnv();
  let db: "up" | "down" = "down";
  try {
    await Promise.race([
      pingDb(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("ping timeout")), 6_000)),
    ]);
    db = "up";
  } catch (err) {
    log.warn("health.db_down", { err });
  }
  const body = { ok: db === "up", db, modes: { applink: env.APPLINK_MODE, gemini: env.GEMINI_MODE }, time: new Date().toISOString() };
  return NextResponse.json(body, { status: db === "up" ? 200 : 503, headers: { "cache-control": "no-store" } });
});
