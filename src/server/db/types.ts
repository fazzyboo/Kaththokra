import "server-only";
import type { Binary, ObjectId } from "mongodb";
import type { Tx } from "@/lib/i18n";
import type {
  Channel,
  CropId,
  DiagnosisStatus,
  KbStatus,
  PaymentStatus,
  Prescription,
  Severity,
} from "@/lib/types";
import type { AdminSession, Subscription } from "@/lib/session";
import type { UssdNode } from "../ussd/tree";

/*
  Document shapes for every collection in BACKEND_PLAN.md §4.
  String `_id`s are the same ids the UI uses; services map `_id` → `id` in responses.
  msisdn is always the normalized 8801XXXXXXXXX form.
*/

export type SettingsDoc = {
  _id: "global";
  priceRx: number;
  priceSubMonthly: number;
  confidenceGate: number;
  abTest: boolean;
  revenueShare: number;
  ussdCode: string;
  helpline: string;
  updatedAt: Date;
  updatedBy?: string;
};

export type UserDoc = {
  _id: string; // u-…
  msisdn: string;
  msisdnMasked: string;
  lang: "bn" | "en";
  verifiedAt: Date;
  createdAt: Date;
};

export type SessionKind = "farmer" | "dealer" | "admin";

export type SessionDoc = {
  _id: string; // SHA-256 of the cookie token (never the token itself)
  kind: SessionKind;
  subjectId: string; // users._id | dealers._id | admins._id
  createdAt: Date;
  expiresAt: Date;
};

/** admin_totp = the second step of admin sign-in (password OK, waiting for the TOTP code). */
export type OtpPurpose = "verify" | "subscribe" | "dealer" | "admin_totp";

export type OtpRequestDoc = {
  _id: string; // o-…
  purpose: OtpPurpose;
  msisdn: string;
  referenceNo: string; // Applink referenceNo, never returned to the client
  attempts: number;
  payload?: Record<string, unknown>;
  app: "farmer" | "dealer"; // which Applink app sent the OTP (verify must use the same one)
  createdAt: Date;
  expiresAt: Date;
};

export type DiagnosisDoc = {
  _id: string; // d-…
  crop: CropId;
  status: DiagnosisStatus;
  top3: { code: string; p: number }[];
  severity?: Severity;
  ood: number;
  retakeReason?: "blurry" | "not_leaf" | "crop_mismatch";
  modelVersion: string;
  kbVersion: number;
  channel: Channel;
  upazila: string;
  userId?: string;
  dealerId?: string;
  imageId?: string;
  imageHash: string;
  gemini?: Record<string, unknown>; // raw summary of the model output
  answers?: Record<string, number>;
  /** top3 before clarify answers; re-ranking always starts from this. */
  initialTop3?: { code: string; p: number }[];
  reviewTicket?: string;
  prescriptionRef?: string;
  createdAt: Date;
  updatedAt?: Date;
};

export type ImageDoc = {
  _id: string; // img-…
  diagnosisId: string;
  mime: "image/jpeg" | "image/png" | "image/webp";
  data: Binary;
  bytes: number;
  keepUntil: Date; // 180 d with consent, else 7 d
  createdAt: Date;
};

export type PaymentDoc = {
  _id: string; // p-…
  diagnosisId: string;
  msisdn: string;
  amount: number;
  status: PaymentStatus;
  externalTrxId: string;
  requestCorrelator?: string; // omit (not null) until Applink returns it
  internalTrxId?: string;
  otpAttempts: number;
  otpExpiresAt?: Date;
  dealerId?: string;
  channel: Channel;
  failureCode?: string;
  verifiedAt?: Date; // caas/otp/verify returned S1000
  paidAt?: Date; // charging notification S1000 (the only thing that makes it PAID)
  paidAmount?: string; // as reported by the notification
  prescriptionRef?: string;
  /** Set by the expire-payments job: VERIFYING for > 15 min with no charging notification. */
  needsAttentionAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type TreatmentSnapshot = {
  activeIngredient: Tx;
  dose: Tx;
  timing: Tx;
  phiDays: number;
  safety: Tx;
  care: Tx[];
};

export type PrescriptionDoc = Omit<Prescription, "ref" | "paidAt"> & {
  _id: string; // PD-…
  paymentId: string;
  treatment: TreatmentSnapshot;
  /** Disease name at the time of sale, for the SMS and receipt. */
  disease: { name: Tx; banglish: string };
  dealerId?: string;
  paidAt: Date;
  /** Set atomically by the one process that sends the prescription SMS. */
  smsClaimedAt?: Date;
  smsLogId?: string;
  createdAt: Date;
};

export type KbHistoryEntry = {
  kbVersion: number;
  kbStatus: KbStatus;
  by: string;
  at: Date;
  note?: string;
};

export type KbFreeFields = {
  crop: CropId;
  name: Tx;
  banglish: string;
  healthy?: boolean;
  symptoms: Tx[];
  cause: Tx;
  care: Tx[];
};

export type KbPaidFields = {
  activeIngredient: Tx;
  dose: Tx;
  timing: Tx;
  phiDays: number;
  safety: Tx;
};

/** Work-in-progress version of a KB entry (draft → review → approved → published). */
export type KbDraft = KbFreeFields &
  KbPaidFields & {
    kbVersion: number; // published version + 1
    kbStatus: "draft" | "review" | "approved";
    approvedBy?: string;
    approvedAt?: string;
    updatedBy: string;
    updatedAt: Date;
  };

/**
 * Top-level fields are ALWAYS the latest published version (what diagnosis and prescriptions
 * use), so editing never takes a disease offline. Edits live in `draft` until published.
 */
export type KbDiseaseDoc = KbFreeFields &
  KbPaidFields & {
    _id: string; // disease code, e.g. RICE_BLAST
    kbVersion: number;
    kbStatus: KbStatus;
    approvedBy?: string;
    approvedAt?: string;
    draft?: KbDraft;
    history: KbHistoryEntry[];
    updatedAt: Date;
  };

export type ReviewDoc = {
  _id: string; // RV-…
  diagnosisId: string;
  kind: "uncertain" | "dispute";
  msisdn: string;
  userId?: string; // farmer session that asked, if any
  note?: string;
  status: "open" | "in_progress" | "closed";
  verdict?: string;
  reply?: string;
  useForTraining: boolean;
  reviewedBy?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type SubscriptionDoc = {
  _id: string; // msisdn
  crops: CropId[];
  upazila: string;
  status: Subscription["status"];
  frequency: "weekly" | "on_outbreak"; // how often WE send alerts
  source: Channel | "sms";
  since: Date;
  lastNotifyAt?: Date; // last alert SMS sent
  lastReconciledAt?: Date;
  /** Applink's charging frequency from the subscription notification (e.g. "monthly"). */
  billingFrequency?: string;
  /** timeStamp of the last subscription notification applied (older ones are ignored). */
  lastStatusTs?: string;
  /** Set once when the welcome SMS is sent. */
  welcomedAt?: Date;
  /** From getSubscriberChargingInfo during reconcile. */
  lastChargedAt?: string;
  updatedAt?: Date;
};

export type AlertDoc = {
  _id: string; // AL-…
  crop: CropId;
  diseaseCode: string;
  upazilas: string[];
  message: Tx;
  status: "suggested" | "scheduled" | "sent";
  recipients: number;
  sendAt?: Date;
  trigger?: string;
  createdBy?: string;
  approvedBy?: string;
  sentAt?: Date;
  delivered?: number;
  /** send-alerts job lease, so two overlapping runs don't fan out the same alert. */
  lockUntil?: Date;
  createdAt: Date;
};

/**
 * One row per (alert, subscriber), written BEFORE the SMS is sent: makes send-alerts
 * resumable and idempotent, and is what the "max 2 alerts per crop per week" cap counts.
 */
export type AlertDeliveryDoc = {
  _id: string; // `${alertId}:${msisdn}`
  alertId: string;
  msisdn: string;
  crop: CropId;
  /** sent = SMS accepted; failed = send failed (sms-retry picks it up); capped = over the weekly cap, not sent. */
  outcome: "sent" | "failed" | "capped";
  smsLogId?: string;
  at: Date;
};

export type SmsLogDoc = {
  _id: string; // Applink requestId, or "sms-…" when the send failed before Applink answered
  msisdn: string;
  template: string;
  text: string; // kept so the retry job can resend
  ref?: string; // prescription ref, or the alert id for template "alert"
  app?: "farmer" | "dealer"; // which Applink app sent it (the retry uses the same one)
  messageId?: string; // omit (not null) until known
  segments: number;
  status: "SENT" | "FAILED";
  lastError?: string;
  dlrStatus?: string;
  retries: number;
  nextRetryAt?: Date; // set on failures; the sms-retry job picks these up
  createdAt: Date;
  updatedAt: Date;
};

export type CallbackType = "caas" | "sms-mo" | "sms-dlr" | "subscription" | "ussd";

export type CallbackInboxDoc = {
  _id?: ObjectId;
  type: CallbackType;
  dedupeKey: string;
  /** What Applink sent, numbers masked and password fields dropped: for audit / admin. */
  bodyRedacted: Record<string, unknown>;
  /** Just the fields processing needs (normalized msisdn included), so process-inbox can re-run it. */
  payload: Record<string, unknown>;
  receivedAt: Date;
  processedAt?: Date;
  attempts?: number;
  error?: string;
};

export type UssdSessionDoc = {
  _id: string; // Applink sessionId
  msisdn: string;
  stack: UssdNode[];
  pendingPaymentId?: string;
  expiresAt: Date; // now + 120 s
};

export type DealerDoc = {
  _id: string; // DLR-…
  shopName: string;
  upazila: string;
  msisdn: string;
  status: "active" | "paused" | "flagged"; // same values as the admin DealerRow; paused → 403
  commissionRate: number;
  fraudFlag: boolean;
  createdAt: Date;
};

export type CommissionLedgerDoc = {
  _id?: ObjectId;
  dealerId: string;
  paymentId: string;
  amount: number;
  month: string; // YYYY-MM (Dhaka time)
  paidOut: boolean;
  paidOutAt?: Date;
  /** Set when the payment is refunded; amount is then 0. */
  reversedAt?: Date;
  createdAt: Date;
};

export type ApplinkLogDoc = {
  _id?: ObjectId;
  at: Date;
  api: "caas" | "sms" | "ussd" | "otp" | "sub";
  direction: "out" | "in";
  path: string;
  statusCode?: string;
  msisdnMasked?: string;
  ms?: number;
  mode?: "live" | "mock";
};

export type AdminDoc = {
  _id: string; // email (lower-case)
  name: string;
  role: AdminSession["role"];
  passwordHash: string;
  totpSecret: string;
  /** Last accepted TOTP time step: the same code can't be used twice (replay protection). */
  lastTotpStep?: number;
  lastLoginAt?: Date;
  createdAt: Date;
};

export type AuditLogDoc = {
  _id?: ObjectId;
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  at: Date;
  meta?: Record<string, unknown>;
};

export type EvalRunDoc = {
  _id?: ObjectId;
  model: string;
  promptVersion: string;
  n: number;
  accuracy: number;
  perClass: { code: string; n: number; precision: number; recall: number }[];
  /** Share of photos that passed the confidence gate (CONFIDENT). */
  coverage?: number;
  /** Accuracy among the photos that passed the gate. */
  accAtGate?: number;
  gate?: number;
  retake?: number;
  at: Date;
};

export type RateLimitDoc = {
  _id: string; // bucket key + window start
  count: number;
  windowEnd: Date;
};
