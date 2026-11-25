import { readJson, wrap } from "@/server/http/handler";
import { getScenario } from "@/server/lib/scenario";
import { assertMockApplink, devApplinkCall, DevApplinkSchema } from "@/server/services/dev";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Dev only: call applink() in mock mode. 404 unless APPLINK_MODE=mock. */
export const POST = wrap(async (req) => {
  assertMockApplink();
  const input = await readJson(req, DevApplinkSchema);
  return devApplinkCall(input, getScenario(req));
});
