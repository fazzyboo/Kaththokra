import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { jobsSecrets } from "../env";
import { log } from "../lib/log";
import { AppError } from "./errors";
import { wrap } from "./handler";

/*
  /api/jobs/* (BACKEND_PLAN.md §9). Auth: `Authorization: Bearer <JOBS_SECRET>` (GitHub Actions)
  or `Bearer <CRON_SECRET>` (Vercel Cron, which calls with GET). Compared in constant time,
  never logged. Both GET and POST run the job.
*/

function sameSecret(got: string, expected: string): boolean {
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function assertJobAuth(req: Request, job: string): void {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const ok = !!token && jobsSecrets().some((s) => sameSecret(token, s));
  if (!ok) {
    log.warn("job.unauthorized", { job, hasHeader: !!header });
    throw new AppError("UNAUTHORIZED", "Job secret required", 401);
  }
}

export function jobRoute(job: string, run: (req: NextRequest) => Promise<unknown>) {
  const handler = wrap(async (req) => {
    assertJobAuth(req, job);
    const started = Date.now();
    const result = await run(req);
    log.info("job.done", { job, ms: Date.now() - started, ...(result as object) });
    return result;
  });
  return { GET: handler, POST: handler };
}
