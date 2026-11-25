import { jobRoute } from "@/server/http/jobs";
import { retryFailedSms } from "@/server/services/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET|POST /api/jobs/sms-retry (Bearer JOBS_SECRET) → { processed, remaining, sent, failed, gaveUp } */
export const { GET, POST } = jobRoute("sms-retry", () => retryFailedSms());
