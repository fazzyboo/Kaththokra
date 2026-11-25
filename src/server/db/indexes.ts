import "server-only";
import type { CreateIndexesOptions, Db, IndexSpecification } from "mongodb";
import type { CollectionName } from "./collections";

/*
  Every index from BACKEND_PLAN.md §4. Names are explicit so reruns are no-ops.
  "Sparse unique" fields use a partial filter on { $type: "string" }: stricter than
  sparse (a stray null can't collide), same effect when the field is omitted.
*/

type IndexDef = { key: IndexSpecification; options: CreateIndexesOptions & { name: string } };

const DAY = 24 * 60 * 60;

export const INDEXES: Partial<Record<CollectionName, IndexDef[]>> = {
  users: [{ key: { msisdn: 1 }, options: { name: "msisdn_unique", unique: true } }],
  sessions: [{ key: { expiresAt: 1 }, options: { name: "expiresAt_ttl", expireAfterSeconds: 0 } }],
  otpRequests: [{ key: { expiresAt: 1 }, options: { name: "expiresAt_ttl", expireAfterSeconds: 0 } }],
  diagnoses: [
    { key: { userId: 1, createdAt: -1 }, options: { name: "userId_createdAt" } },
    { key: { dealerId: 1, createdAt: -1 }, options: { name: "dealerId_createdAt" } },
    { key: { status: 1 }, options: { name: "status" } },
    { key: { upazila: 1, crop: 1, createdAt: -1 }, options: { name: "upazila_crop_createdAt" } },
    { key: { imageHash: 1 }, options: { name: "imageHash" } },
  ],
  images: [{ key: { keepUntil: 1 }, options: { name: "keepUntil_ttl", expireAfterSeconds: 0 } }],
  payments: [
    { key: { externalTrxId: 1 }, options: { name: "externalTrxId_unique", unique: true } },
    {
      key: { requestCorrelator: 1 },
      options: {
        name: "requestCorrelator_unique",
        unique: true,
        partialFilterExpression: { requestCorrelator: { $type: "string" } },
      },
    },
    { key: { status: 1, createdAt: -1 }, options: { name: "status_createdAt" } },
  ],
  prescriptions: [
    { key: { msisdn: 1, paidAt: -1 }, options: { name: "msisdn_paidAt" } },
    { key: { dealerId: 1, paidAt: -1 }, options: { name: "dealerId_paidAt" } },
  ],
  kbDiseases: [{ key: { crop: 1 }, options: { name: "crop" } }],
  reviews: [{ key: { status: 1, createdAt: -1 }, options: { name: "status_createdAt" } }],
  subscriptions: [
    { key: { status: 1 }, options: { name: "status" } },
    { key: { upazila: 1 }, options: { name: "upazila" } },
    { key: { status: 1, lastReconciledAt: 1 }, options: { name: "status_lastReconciledAt" } },
  ],
  alerts: [{ key: { status: 1, sendAt: 1 }, options: { name: "status_sendAt" } }],
  alertDeliveries: [
    { key: { alertId: 1 }, options: { name: "alertId" } },
    { key: { msisdn: 1, crop: 1, at: -1 }, options: { name: "msisdn_crop_at" } },
    { key: { at: 1 }, options: { name: "at_ttl_60d", expireAfterSeconds: 60 * DAY } },
  ],
  smsLog: [
    {
      key: { messageId: 1 },
      options: {
        name: "messageId_unique",
        unique: true,
        partialFilterExpression: { messageId: { $type: "string" } },
      },
    },
    {
      key: { nextRetryAt: 1 },
      options: { name: "retry_queue", partialFilterExpression: { status: "FAILED", nextRetryAt: { $type: "date" } } },
    },
  ],
  callbackInbox: [
    { key: { type: 1, dedupeKey: 1 }, options: { name: "type_dedupeKey_unique", unique: true } },
    // Partial indexes can't express "$exists: false", so a compound index serves the process-inbox query.
    { key: { processedAt: 1, receivedAt: 1 }, options: { name: "processedAt_receivedAt" } },
  ],
  ussdSessions: [{ key: { expiresAt: 1 }, options: { name: "expiresAt_ttl", expireAfterSeconds: 0 } }],
  dealers: [{ key: { msisdn: 1 }, options: { name: "msisdn_unique", unique: true } }],
  commissionLedger: [{ key: { paymentId: 1 }, options: { name: "paymentId_unique", unique: true } }],
  applinkLog: [{ key: { at: 1 }, options: { name: "at_ttl_14d", expireAfterSeconds: 14 * DAY } }],
  auditLog: [{ key: { at: -1 }, options: { name: "at" } }],
  evalRuns: [{ key: { at: -1 }, options: { name: "at" } }],
  rateLimits: [{ key: { windowEnd: 1 }, options: { name: "windowEnd_ttl", expireAfterSeconds: 0 } }],
};

export async function ensureIndexes(db: Db): Promise<{ collection: string; index: string }[]> {
  const done: { collection: string; index: string }[] = [];
  for (const [name, defs] of Object.entries(INDEXES) as [CollectionName, IndexDef[]][]) {
    const c = db.collection(name);
    for (const d of defs) {
      const index = await c.createIndex(d.key, d.options);
      done.push({ collection: name, index });
    }
  }
  return done;
}
