import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { MongoNetworkError, MongoServerSelectionError } from "mongodb";
import { ZodError, type ZodType } from "zod";
import { ApplinkError, httpStatusFor } from "../applink/errors";
import { EnvError, getEnv } from "../env";
import { log } from "../lib/log";
import { AppError } from "./errors";

/*
  wrap(): the only error boundary for route handlers.
  - Origin check on mutating methods (skipped for callbacks, jobs, and outside production).
  - AppError → its status + { error: { code, message } }.
  - ZodError → 400 VALIDATION_ERROR.
  - Anything else → logged (no stack to the client) + 500 INTERNAL.
  A handler may return a Response (used as-is) or plain data (sent as 200 JSON).
*/

type Params = Record<string, string | string[] | undefined>;
type Ctx<P extends Params> = { params: Promise<P> };
type Handler<P extends Params> = (req: NextRequest, ctx: { params: P }) => Promise<Response | unknown> | Response | unknown;

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const ORIGIN_EXEMPT = ["/api/callbacks/", "/api/jobs/"];

function checkOrigin(req: NextRequest) {
  if (!MUTATING.has(req.method)) return;
  if (process.env.NODE_ENV !== "production") return;
  const path = req.nextUrl.pathname;
  if (ORIGIN_EXEMPT.some((p) => path.startsWith(p))) return;
  const expected = new URL(getEnv().NEXT_PUBLIC_APP_URL).origin;
  const origin = req.headers.get("origin");
  if (origin !== expected) throw new AppError("BAD_ORIGIN", "Request origin not allowed", 403);
}

export function errorResponse(err: unknown, req?: NextRequest): Response {
  if (err instanceof AppError) {
    const retryAfter = err.code === "RATE_LIMITED" ? err.details?.retryAfter : undefined;
    return NextResponse.json(err.toBody(), {
      status: err.status,
      ...(typeof retryAfter === "number" ? { headers: { "retry-after": String(retryAfter) } } : {}),
    });
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const where = first?.path.length ? `${first.path.join(".")}: ` : "";
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: `${where}${first?.message ?? "Invalid input"}` } },
      { status: 400 },
    );
  }
  if (err instanceof EnvError) {
    log.error("env.invalid", { problems: err.problems });
    return NextResponse.json({ error: { code: "INTERNAL", message: "Server is not configured" } }, { status: 500 });
  }
  if (err instanceof ApplinkError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.detail || "Mobile operator request failed" } },
      { status: httpStatusFor(err) },
    );
  }
  if (err instanceof MongoServerSelectionError || err instanceof MongoNetworkError) {
    log.error("db.unavailable", { method: req?.method, path: req?.nextUrl.pathname, err: err.message });
    return NextResponse.json({ error: { code: "DB_UNAVAILABLE", message: "Service busy, try again shortly" } }, { status: 503 });
  }
  log.error("unhandled", {
    method: req?.method,
    path: req?.nextUrl.pathname,
    err: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : String(err),
  });
  return NextResponse.json({ error: { code: "INTERNAL", message: "Something went wrong" } }, { status: 500 });
}

export function wrap<P extends Params = Params>(fn: Handler<P>) {
  return async (req: NextRequest, ctx: Ctx<P>): Promise<Response> => {
    try {
      checkOrigin(req);
      const params = ((await ctx?.params) ?? {}) as P;
      const out = await fn(req, { params });
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (err) {
      return errorResponse(err, req);
    }
  };
}

/** Parse a JSON body with a zod schema. Bad JSON → 400 BAD_JSON, bad shape → 400 VALIDATION_ERROR. */
export async function readJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new AppError("BAD_JSON", "Body must be valid JSON", 400);
  }
  return schema.parse(body);
}

/** Best-effort client IP for rate limiting (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}
