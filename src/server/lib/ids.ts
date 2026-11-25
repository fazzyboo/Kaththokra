import "server-only";
import { randomBytes, randomInt } from "node:crypto";

/*
  Ids in the formats the UI already shows. Short ids can collide, so insert them with
  retryOnDuplicate(), which regenerates on Mongo E11000.
*/

const hex = (bytes: number) => randomBytes(bytes).toString("hex");
const digits = (n: number) => String(randomInt(0, 10 ** n)).padStart(n, "0");
/** n digits, first one non-zero (RV-1234 never becomes RV-0234). */
const digitsNz = (n: number) => String(randomInt(10 ** (n - 1), 10 ** n));

export const newDiagnosisId = () => `d-${hex(2)}`; // d-81f2
export const newPaymentId = () => `p-${hex(2)}`; // p-3c9a
export const newPrescriptionRef = () => `PD-${digitsNz(6)}`; // PD-482193
export const newReviewTicket = () => `RV-${digitsNz(4)}`; // RV-1234
export const newDealerId = () => `DLR-${digitsNz(3)}`; // DLR-123
export const newAlertId = () => `AL-${digitsNz(3)}`; // AL-123

export const newUserId = () => `u-${hex(6)}`;
export const newOtpRequestId = () => `o-${hex(8)}`;
export const newImageId = () => `img-${hex(6)}`;
/** externalTrxId for CaaS debit: digits only, unique per attempt. */
export const newExternalTrxId = () => `${Date.now()}${digits(4)}`;
/** Opaque session token for cookies (store only its hash). */
export const newSessionToken = () => randomBytes(32).toString("base64url");

const isDuplicateKey = (err: unknown) =>
  typeof err === "object" && err !== null && (err as { code?: unknown }).code === 11000;

/**
 * `await retryOnDuplicate(newDiagnosisId, (id) => diagnoses.insertOne({ _id: id, ... }))`
 * Retries only on duplicate-key errors.
 */
export async function retryOnDuplicate<T>(gen: () => string, insert: (id: string) => Promise<T>, tries = 5): Promise<{ id: string; result: T }> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    const id = gen();
    try {
      return { id, result: await insert(id) };
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
      lastErr = err;
    }
  }
  throw lastErr;
}
