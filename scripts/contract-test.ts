import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { bodies } from "@/server/applink/bodies";
import type { ApplinkPath } from "@/server/applink/types";

/*
  Contract test: every outbound Applink body we build (src/server/applink/bodies.ts, the same
  builders the services use) is POSTed to tools/mock-applink.mjs, the reference mock of the
  Applink API. Skips with a message when that file doesn't exist.
    npm run contract-test
  The mock is started as `node tools/mock-applink.mjs` with PORT set (also passed as argv[2]).
  To use a mock that is already running, set MOCK_APPLINK_URL=http://host:port instead.
  A body passes when the mock answers HTTP 2xx with JSON carrying a statusCode. Dummy test
  credentials are added the way src/server/applink/client.ts adds them. No real number is used.
*/

const MOCK_FILE = resolve(process.cwd(), "tools/mock-applink.mjs");
const CREDS = { applicationId: "APP_CONTRACT_TEST", password: "contract-test-password" };
const MSISDN = "8801900000001"; // test number, never a real subscriber

async function freePort(): Promise<number> {
  return new Promise((ok, fail) => {
    const s = createServer();
    s.once("error", fail);
    s.listen(0, "127.0.0.1", () => {
      const port = (s.address() as { port: number }).port;
      s.close(() => ok(port));
    });
  });
}

async function waitUp(base: string, child: ChildProcess | null) {
  for (let i = 0; i < 50; i++) {
    if (child && child.exitCode !== null) throw new Error(`mock-applink exited with code ${child.exitCode}`);
    try {
      await fetch(base, { method: "GET", signal: AbortSignal.timeout(500) });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw new Error(`mock-applink did not start on ${base}`);
}

type Outcome = { path: ApplinkPath; ok: boolean; status: string; json?: Record<string, unknown> };

async function post(base: string, path: ApplinkPath, body: object): Promise<Outcome> {
  try {
    const res = await fetch(`${base.replace(/\/+$/, "")}/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ ...CREDS, ...body }),
      signal: AbortSignal.timeout(10_000),
    });
    const text = await res.text();
    let json: Record<string, unknown> | undefined;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      return { path, ok: false, status: `HTTP ${res.status}, not JSON: ${text.slice(0, 80)}` };
    }
    const code = typeof json?.statusCode === "string" ? json.statusCode : undefined;
    const detail = typeof json?.statusDetail === "string" ? ` ${json.statusDetail}` : "";
    if (!res.ok) return { path, ok: false, status: `HTTP ${res.status} ${code ?? ""}${detail}`, json };
    if (!code) return { path, ok: false, status: `HTTP ${res.status}, no statusCode in response`, json };
    return { path, ok: true, status: `${code}${detail}`, json };
  } catch (err) {
    return { path, ok: false, status: `request failed: ${(err as Error).message}` };
  }
}

async function main() {
  let base = process.env.MOCK_APPLINK_URL;
  let child: ChildProcess | null = null;
  if (!base) {
    if (!existsSync(MOCK_FILE)) {
      console.log("SKIP: tools/mock-applink.mjs not found. Add it (or set MOCK_APPLINK_URL) to run the contract test.");
      return;
    }
    const port = await freePort();
    base = `http://127.0.0.1:${port}`;
    child = spawn(process.execPath, [MOCK_FILE, String(port)], { env: { ...process.env, PORT: String(port) }, stdio: ["ignore", "inherit", "inherit"] });
  }

  try {
    await waitUp(base, child);
    console.log(`Contract test against ${base}\n`);
    const results: Outcome[] = [];
    const run = async (path: ApplinkPath, body: object) => {
      const r = await post(base!, path, body);
      results.push(r);
      console.log(`${r.ok ? "PASS" : "FAIL"}  ${path.padEnd(40)} ${r.status}`);
      return r;
    };

    // CaaS: debit, then verify on the correlator the mock returned.
    const debit = await run("caas/direct/debit", bodies.debit({ externalTrxId: `ct-${Date.now()}`, amount: 5, msisdn: MSISDN }));
    const correlator = typeof debit.json?.requestCorrelator === "string" ? debit.json.requestCorrelator : "CT-CORRELATOR";
    await run("caas/otp/verify", bodies.caasOtpVerify({ requestCorrelator: correlator, otp: "123456", msisdn: MSISDN }));

    // Subscriber OTP: request, then verify on the referenceNo.
    const otp = await run("otp/request", bodies.otpRequest(MSISDN));
    const referenceNo = typeof otp.json?.referenceNo === "string" ? otp.json.referenceNo : "CT-REFERENCE";
    await run("otp/verify", bodies.otpVerify({ referenceNo, otp: "123456" }));

    // Subscription.
    await run("subscription/send", bodies.subscriptionSend(MSISDN, "1"));
    await run("subscription/getSubscriberChargingInfo", bodies.chargingInfo(MSISDN));
    await run("subscription/send", bodies.subscriptionSend(MSISDN, "0"));

    // SMS: a GSM-7 prescription-style text and a Bangla (UCS-2) alert.
    await run("sms/send", bodies.smsSend(MSISDN, "Dhaner blast (Rice). Osudh: Tricyclazole 75 WP. Ref PD-000000. Tk5 paid."));
    await run("sms/send", bodies.smsSend(MSISDN, "কাঠঠোকরা সতর্কতা: ধানে ব্লাস্ট দেখা যাচ্ছে।"));

    // USSD replies (continue + final).
    await run("ussd/send", bodies.ussdSend({ sessionId: "ct-session-1", message: "1. Dhan\n2. Alu", end: false, destinationAddress: `tel:${MSISDN}` }));
    await run("ussd/send", bodies.ussdSend({ sessionId: "ct-session-1", message: "Dhonnobad", end: true, destinationAddress: `tel:${MSISDN}` }));

    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} passed`);
    if (failed.length) process.exitCode = 1;
  } finally {
    child?.kill();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
