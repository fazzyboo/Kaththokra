import "server-only";

/*
  Tiny structured logger. Redacts keys that may hold secrets or phone numbers.
  Callers should pass masked msisdns anyway; this is the safety net.
*/

const SECRET_KEY = /pass(word)?|secret|token|pepper|authorization|cookie|api[-_]?key|^otp$|^code$/i;
const PHONE_VALUE = /(?:tel:)?(?:\+?88)?01[3-9]\d{8}/g;

/** Note: a key named `code` is treated as an OTP and redacted; log error codes as `errorCode`. */
export function redact(value: unknown, key = "", depth = 0): unknown {
  if (depth > 5) return "[depth]";
  if (SECRET_KEY.test(key)) return "[redacted]";
  if (typeof value === "string") return value.replace(PHONE_VALUE, (m) => `…${m.slice(-4)}`);
  if (Array.isArray(value)) return value.map((v) => redact(v, key, depth + 1));
  if (value instanceof Error) return { name: value.name, message: redact(value.message, "", depth + 1) };
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = redact(v, k, depth + 1);
    return out;
  }
  return value;
}

function emit(level: "info" | "warn" | "error", event: string, meta?: Record<string, unknown>) {
  const line = JSON.stringify({ level, event, at: new Date().toISOString(), ...(meta ? (redact(meta) as object) : {}) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (event: string, meta?: Record<string, unknown>) => emit("info", event, meta),
  warn: (event: string, meta?: Record<string, unknown>) => emit("warn", event, meta),
  error: (event: string, meta?: Record<string, unknown>) => emit("error", event, meta),
};
