/** Banglalink numbers: 014 / 019 prefixes (SRS PAY-2). */
const BL_RE = /^(?:\+?88)?(01[49]\d{8})$/;

export function normalizeMsisdn(raw: string): string | null {
  const clean = raw.replace(/[\s-]/g, "").replace(/[০-৯]/g, (c) => String("০১২৩৪৫৬৭৮৯".indexOf(c)));
  const m = clean.match(BL_RE);
  return m ? `88${m[1]}` : null;
}

export function isBanglalink(raw: string): boolean {
  return normalizeMsisdn(raw) !== null;
}

/** 8801912345678 → 019••••5678 */
export function maskMsisdn(msisdn: string): string {
  const local = msisdn.startsWith("88") ? msisdn.slice(2) : msisdn;
  return `${local.slice(0, 3)}••••${local.slice(-4)}`;
}

export function prettyMsisdn(msisdn: string): string {
  const local = msisdn.startsWith("88") ? msisdn.slice(2) : msisdn;
  return `${local.slice(0, 5)}-${local.slice(5)}`;
}
