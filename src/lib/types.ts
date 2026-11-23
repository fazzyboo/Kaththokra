import type { Tx } from "./i18n";

export type CropId = "rice" | "potato" | "tomato";

export type KbStatus = "draft" | "review" | "approved" | "published" | "retired";

export type Severity = "mild" | "moderate" | "severe";

export type Disease = {
  code: string;
  crop: CropId;
  name: Tx;
  banglish: string;
  healthy?: boolean;
  /** What a farmer sees on the leaf */
  symptoms: Tx[];
  cause: Tx;
  /** Generic active ingredient only — never a brand (BR R-6) */
  activeIngredient: Tx;
  dose: Tx;
  timing: Tx;
  phiDays: number;
  safety: Tx;
  care: Tx[];
  kbVersion: number;
  kbStatus: KbStatus;
  approvedBy?: string;
  approvedAt?: string;
};

export type DiagnosisStatus = "CONFIDENT" | "UNCERTAIN" | "RETAKE" | "QUEUED_REVIEW" | "REVIEWED" | "UNLOCKED";

export type Channel = "web" | "ussd" | "dealer";

export type Diagnosis = {
  id: string;
  crop: CropId;
  status: DiagnosisStatus;
  createdAt: string;
  top3: { code: string; p: number }[];
  severity?: Severity;
  ood: number;
  modelVersion: string;
  kbVersion: number;
  channel: Channel;
  upazila: string;
  retakeReason?: "blurry" | "not_leaf" | "crop_mismatch";
};

export type PaymentStatus =
  | "CREATED"
  | "OTP_SENT"
  | "VERIFYING"
  | "PAID"
  | "FULFILLED"
  | "DELIVERED"
  | "FAILED"
  | "EXPIRED"
  | "DISPUTED"
  | "REFUNDED_MANUAL";

export type Prescription = {
  ref: string;
  diagnosisId: string;
  diseaseCode: string;
  crop: CropId;
  paidAt: string;
  amount: number;
  msisdn: string;
  kbVersion: number;
  modelVersion: string;
  sms: "DELIVERED" | "SENT" | "PENDING" | "UNDELIVERABLE";
  channel: Channel;
  dealerShop?: string;
  receiptId: string;
};

export type Upazila = { code: string; num: string; name: Tx; district: Tx };

export type ClarifyQuestion = {
  id: string;
  crop: CropId;
  q: Tx;
  options: { label: Tx; boost: Record<string, number> }[];
};
