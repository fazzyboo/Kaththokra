import "server-only";
import { maskMsisdn, normalizeMsisdn } from "@/lib/phone";

/*
  Server-side phone helpers. Normalization and masking are shared with the UI
  (src/lib/phone.ts) so both sides agree on 8801XXXXXXXXX and 019••••5678.
*/

export { maskMsisdn, normalizeMsisdn };

/** 8801912345678 → tel:8801912345678 (Applink subscriberId / address format). */
export function toApplink(msisdn: string): string {
  return msisdn.startsWith("tel:") ? msisdn : `tel:${msisdn}`;
}

/** tel:8801912345678 (or any accepted input) → 8801912345678, or null if not Banglalink. */
export function fromApplink(address: string): string | null {
  return normalizeMsisdn(address.replace(/^tel:/, ""));
}

export function last4(msisdn: string): string {
  return msisdn.slice(-4);
}
