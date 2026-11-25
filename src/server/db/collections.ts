import "server-only";
import type { Collection, Db, Document } from "mongodb";
import { getDb } from "./client";
import type {
  AdminDoc,
  AlertDeliveryDoc,
  AlertDoc,
  ApplinkLogDoc,
  AuditLogDoc,
  CallbackInboxDoc,
  CommissionLedgerDoc,
  DealerDoc,
  DiagnosisDoc,
  EvalRunDoc,
  ImageDoc,
  KbDiseaseDoc,
  OtpRequestDoc,
  PaymentDoc,
  PrescriptionDoc,
  RateLimitDoc,
  ReviewDoc,
  SessionDoc,
  SettingsDoc,
  SmsLogDoc,
  SubscriptionDoc,
  UserDoc,
  UssdSessionDoc,
} from "./types";

/** Collection name → document type. The single list of collections. */
export type CollectionMap = {
  settings: SettingsDoc;
  users: UserDoc;
  sessions: SessionDoc;
  otpRequests: OtpRequestDoc;
  diagnoses: DiagnosisDoc;
  images: ImageDoc;
  payments: PaymentDoc;
  prescriptions: PrescriptionDoc;
  kbDiseases: KbDiseaseDoc;
  reviews: ReviewDoc;
  subscriptions: SubscriptionDoc;
  alerts: AlertDoc;
  alertDeliveries: AlertDeliveryDoc;
  smsLog: SmsLogDoc;
  callbackInbox: CallbackInboxDoc;
  ussdSessions: UssdSessionDoc;
  dealers: DealerDoc;
  commissionLedger: CommissionLedgerDoc;
  applinkLog: ApplinkLogDoc;
  admins: AdminDoc;
  auditLog: AuditLogDoc;
  evalRuns: EvalRunDoc;
  rateLimits: RateLimitDoc;
};

export type CollectionName = keyof CollectionMap;

export type Collections = { [K in CollectionName]: Collection<CollectionMap[K] & Document> };

const NAMES: CollectionName[] = [
  "settings",
  "users",
  "sessions",
  "otpRequests",
  "diagnoses",
  "images",
  "payments",
  "prescriptions",
  "kbDiseases",
  "reviews",
  "subscriptions",
  "alerts",
  "alertDeliveries",
  "smsLog",
  "callbackInbox",
  "ussdSessions",
  "dealers",
  "commissionLedger",
  "applinkLog",
  "admins",
  "auditLog",
  "evalRuns",
  "rateLimits",
];

export function collectionsOf(db: Db): Collections {
  const out = {} as Record<CollectionName, Collection<Document>>;
  for (const name of NAMES) out[name] = db.collection(name);
  return out as unknown as Collections;
}

/** `const { payments } = await cols();` */
export async function cols(): Promise<Collections> {
  return collectionsOf(await getDb());
}

/** Single typed collection. */
export async function col<K extends CollectionName>(name: K): Promise<Collections[K]> {
  return (await cols())[name];
}
