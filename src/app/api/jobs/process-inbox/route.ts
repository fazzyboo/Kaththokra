import { jobRoute } from "@/server/http/jobs";
import { processInbox } from "@/server/services/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET|POST /api/jobs/process-inbox (Bearer JOBS_SECRET) → { processed, remaining, ok, failed } */
export const { GET, POST } = jobRoute("process-inbox", () => processInbox());
