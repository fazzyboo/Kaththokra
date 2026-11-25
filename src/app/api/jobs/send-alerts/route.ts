import { jobRoute } from "@/server/http/jobs";
import { sendDueAlerts } from "@/server/services/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET|POST /api/jobs/send-alerts (Bearer JOBS_SECRET) → { processed, remaining, sent, failed, capped, alertsCompleted }
 * Sends only 07:00–09:00 Asia/Dhaka. `?force=1` skips the window check outside production (testing).
 */
export const { GET, POST } = jobRoute("send-alerts", (req) =>
  sendDueAlerts(new Date(), { force: process.env.NODE_ENV !== "production" && req.nextUrl.searchParams.get("force") === "1" }),
);
