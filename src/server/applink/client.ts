import "server-only";
import { fetch as undiciFetch, ProxyAgent } from "undici";
import { col } from "../db/collections";
import type { ApplinkLogDoc } from "../db/types";
import { getEnv } from "../env";
import { log } from "../lib/log";
import { fromApplink, maskMsisdn } from "../lib/msisdn";
import type { Scenario } from "../lib/scenario";
import { APPLINK, ApplinkError, isSuccess } from "./errors";
import { mockApplink } from "./mock";
import type { ApplinkApp, ApplinkPath, ApplinkRequest, ApplinkResponse, ApplinkStatus, Credentials } from "./types";

/*
  The ONLY Applink caller (BACKEND_PLAN.md §7).
  - live: POST ${APPLINK_BASE_URL}/${path} through Fixie (undici ProxyAgent), 10 s timeout, never retried.
  - mock: src/server/applink/mock.ts, driven by the demo Scenario.
  Success only on S1000 (P1003 for caas/direct/debit). Anything else throws ApplinkError.
  One applinkLog row per call: masked number, status, ms. Never credentials or full numbers.
*/

const TIMEOUT_MS = 10_000;

export type ApplinkOptions = { app?: ApplinkApp; scenario?: Scenario | null };

type ProxyCache = { url?: string; agent?: ProxyAgent };
const g = globalThis as typeof globalThis & { __kkFixie?: ProxyCache };
const proxyCache: ProxyCache = (g.__kkFixie ??= {});

function fixieDispatcher(): ProxyAgent | undefined {
  const url = getEnv().FIXIE_URL;
  if (!url) return undefined;
  if (proxyCache.url !== url || !proxyCache.agent) {
    proxyCache.agent = new ProxyAgent(url);
    proxyCache.url = url;
  }
  return proxyCache.agent;
}

function credentials(app: ApplinkApp, path: ApplinkPath): Credentials {
  const env = getEnv();
  const useDealer = app === "dealer" && env.APPLINK_DEALER_APP_ID && env.APPLINK_DEALER_PASSWORD;
  const applicationId = useDealer ? env.APPLINK_DEALER_APP_ID : env.APPLINK_APP_ID;
  const password = useDealer ? env.APPLINK_DEALER_PASSWORD : env.APPLINK_PASSWORD;
  if (!applicationId || !password) {
    throw new ApplinkError("CONFIG", "Applink credentials are not set", path);
  }
  return { applicationId, password };
}

function apiOf(path: ApplinkPath): ApplinkLogDoc["api"] {
  if (path.startsWith("caas/")) return "caas";
  if (path.startsWith("otp/")) return "otp";
  if (path.startsWith("subscription/")) return "sub";
  if (path.startsWith("sms/")) return "sms";
  return "ussd";
}

/** Masked number of the (first) subscriber in a request body, for the log. */
function maskedFrom(body: unknown): string | undefined {
  const b = (body ?? {}) as Record<string, unknown>;
  const raw =
    (b.subscriberId as string | undefined) ??
    (b.sourceAddress as string | undefined) ??
    (b.destinationAddress as string | undefined) ??
    (Array.isArray(b.destinationAddresses) ? (b.destinationAddresses[0] as string | undefined) : undefined);
  if (typeof raw !== "string" || !raw) return undefined;
  const n = fromApplink(raw);
  if (n) return maskMsisdn(n);
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 4 ? `••••${digits.slice(-4)}` : undefined;
}

async function writeLog(row: Omit<ApplinkLogDoc, "_id">) {
  try {
    const applinkLog = await col("applinkLog");
    await applinkLog.insertOne(row);
  } catch (err) {
    log.warn("applink.log_write_failed", { err });
  }
}

async function liveCall(path: ApplinkPath, payload: object): Promise<ApplinkStatus> {
  const env = getEnv();
  const url = `${env.APPLINK_BASE_URL.replace(/\/+$/, "")}/${path}`;
  let res: Awaited<ReturnType<typeof undiciFetch>>;
  try {
    res = await undiciFetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload),
      dispatcher: fixieDispatcher(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const e = err as Error & { cause?: { code?: string } };
    if (e.name === "TimeoutError" || e.name === "AbortError") throw new ApplinkError("TIMEOUT", `no answer in ${TIMEOUT_MS / 1000} s`, path);
    // Only the error name/cause code: messages can contain the proxy URL (with its token).
    throw new ApplinkError("NETWORK", e.cause?.code ?? e.name, path);
  }

  const text = await res.text();
  let json: ApplinkStatus & Record<string, unknown>;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new ApplinkError(res.ok ? "BAD_RESPONSE" : `HTTP_${res.status}`, `non-JSON body (HTTP ${res.status})`, path);
  }
  if (!res.ok) {
    const code = typeof json.statusCode === "string" && json.statusCode.startsWith("E") ? json.statusCode : `HTTP_${res.status}`;
    throw new ApplinkError(code, String(json.statusDetail ?? ""), path);
  }
  return json;
}

export async function applink<P extends ApplinkPath>(
  path: P,
  body: ApplinkRequest<P>,
  opts: ApplinkOptions = {},
): Promise<ApplinkResponse<P>> {
  const env = getEnv();
  const mode = env.APPLINK_MODE;
  const started = Date.now();
  let statusCode: string | undefined;

  try {
    const res =
      mode === "mock"
        ? await mockApplink(path, body, opts.scenario ?? null)
        : await liveCall(path, { ...credentials(opts.app ?? "farmer", path), ...body });

    statusCode = res.statusCode;
    if (!isSuccess(path, statusCode)) {
      throw new ApplinkError(statusCode ?? "BAD_RESPONSE", String(res.statusDetail ?? ""), path);
    }
    return res as ApplinkResponse<P>;
  } catch (err) {
    if (err instanceof ApplinkError) {
      statusCode = err.code;
      if (err.code === APPLINK.IP_NOT_ALLOWED) {
        log.error("applink.ip_rejected", {
          message: "Applink rejected our IP: check both Fixie IPs are in the Applink allow-list",
          path,
        });
      } else if (err.isTransport) {
        log.warn("applink.transport_error", { path, errorCode: err.code, detail: err.detail });
      }
    } else {
      statusCode = "INTERNAL";
    }
    throw err;
  } finally {
    await writeLog({
      at: new Date(),
      api: apiOf(path),
      direction: "out",
      path,
      statusCode,
      msisdnMasked: maskedFrom(body),
      ms: Date.now() - started,
      mode,
    });
  }
}
