import { jobRoute } from "@/server/http/jobs";
import { expirePayments } from "@/server/services/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET|POST /api/jobs/expire-payments (Bearer JOBS_SECRET) → { processed, remaining, expired, flagged } */
export const { GET, POST } = jobRoute("expire-payments", () => expirePayments());
