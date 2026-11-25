import "server-only";
import type { ApplinkPath } from "./types";

/*
  Thrown for any Applink outcome that is not a success, including HTTP 200 with an E… code.
  `code` is Applink's statusCode (E1308, …) or one of the transport codes below.
*/

export const APPLINK = {
  SUCCESS: "S1000",
  DEBIT_PENDING: "P1003",
  IP_NOT_ALLOWED: "E1303",
  LOW_BALANCE: "E1308",
  TRX_EXISTS: "E1337",
  /**
   * Wrong OTP. PLACEHOLDER used by the mock: confirm the real code(s) for a wrong
   * CaaS / subscriber OTP against the official Applink mock and update this constant.
   */
  WRONG_OTP: "E1850",
} as const;

/** Non-Applink failure codes. CONFIG = live mode without credentials. */
export type TransportCode = "TIMEOUT" | "NETWORK" | "BAD_RESPONSE" | "CONFIG" | `HTTP_${number}`;

export class ApplinkError extends Error {
  constructor(
    public readonly code: string,
    public readonly detail: string,
    public readonly path: ApplinkPath,
  ) {
    super(`Applink ${path} failed: ${code}${detail ? ` (${detail})` : ""}`);
    this.name = "ApplinkError";
  }

  get isTransport(): boolean {
    return !this.code.startsWith("E");
  }
}

/** S1000 always; P1003 only for direct debit. */
export function isSuccess(path: ApplinkPath, statusCode: string | undefined): boolean {
  if (statusCode === undefined) return true; // responses without a statusCode (e.g. subscription/send)
  if (statusCode === APPLINK.SUCCESS) return true;
  return path === "caas/direct/debit" && statusCode === APPLINK.DEBIT_PENDING;
}

/** HTTP status the API should answer with when an ApplinkError reaches a route. */
export function httpStatusFor(err: ApplinkError): number {
  if (err.code === APPLINK.LOW_BALANCE) return 402;
  if (err.code === APPLINK.WRONG_OTP) return 400;
  if (err.code === APPLINK.TRX_EXISTS) return 409;
  if (err.code === "TIMEOUT") return 504;
  return 502;
}
