import { jobRoute } from "@/server/http/jobs";
import { reconcileJob } from "@/server/services/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET|POST /api/jobs/reconcile (Bearer JOBS_SECRET or Vercel's CRON_SECRET) → { processed, remaining, checked, changed, failed } */
export const { GET, POST } = jobRoute("reconcile", () => reconcileJob());
