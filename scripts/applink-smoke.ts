import "./_env";
import { fetch as undiciFetch, ProxyAgent } from "undici";
import { applink } from "@/server/applink/client";
import { APPLINK, ApplinkError } from "@/server/applink/errors";
import { closeDb } from "@/server/db/client";
import { getEnv } from "@/server/env";
import { maskMsisdn, normalizeMsisdn, toApplink } from "@/server/lib/msisdn";

/*
  Applink connectivity check that spends no money:
    npm run applink-smoke -- 019XXXXXXXX [--ip]
  Calls otp/request through Fixie (in live mode). S1000 = Fixie + allow-list OK.
  NOTE: in live mode this sends a real OTP SMS to that number.
  --ip also prints the egress IP seen through Fixie (one extra Fixie request to api.ipify.org).
*/

async function main() {
  const raw = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const msisdn = raw ? normalizeMsisdn(raw) : null;
  if (!msisdn) throw new Error("Usage: npm run applink-smoke -- 019XXXXXXXX [--ip]   (Banglalink 019/014 number)");

  const env = getEnv();
  console.log(`Mode: APPLINK_MODE=${env.APPLINK_MODE}${env.APPLINK_MODE === "mock" ? " (nothing leaves this machine; set APPLINK_MODE=live to test Fixie)" : ""}`);
  console.log(`Base: ${env.APPLINK_BASE_URL}   Proxy: ${env.FIXIE_URL ? "Fixie" : "none"}   Number: ${maskMsisdn(msisdn)}`);

  if (process.argv.includes("--ip") && env.FIXIE_URL) {
    const res = await undiciFetch("https://api.ipify.org?format=json", {
      dispatcher: new ProxyAgent(env.FIXIE_URL),
      signal: AbortSignal.timeout(10_000),
    });
    console.log(`Egress IP via Fixie: ${((await res.json()) as { ip: string }).ip}`);
  }

  try {
    const res = await applink("otp/request", { subscriberId: toApplink(msisdn), applicationMetaData: { client: "WEBAPP" } });
    console.log(`statusCode: ${res.statusCode}  ${env.APPLINK_MODE === "live" ? "✓ Applink reachable, our IP is allowed" : "(mock answer)"}`);
  } catch (err) {
    if (!(err instanceof ApplinkError)) throw err;
    console.log(`statusCode: ${err.code}${err.detail ? `  (${err.detail})` : ""}`);
    if (err.code === APPLINK.IP_NOT_ALLOWED) {
      console.log("✗ Applink rejected our IP: check both Fixie IPs are in the Applink allow-list.");
    }
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
