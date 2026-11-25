import "server-only";

/*
  Applink request/response shapes (docs/APPLINK_CONTRACTS.md).
  Request types exclude applicationId/password: client.ts adds them.
  Addresses are "tel:8801XXXXXXXXX" (toApplink() in src/server/lib/msisdn.ts).
*/

export type ApplinkPath =
  | "caas/direct/debit"
  | "caas/otp/verify"
  | "otp/request"
  | "otp/verify"
  | "subscription/send"
  | "subscription/query-base"
  | "subscription/getSubscriberChargingInfo"
  | "sms/send"
  | "ussd/send";

export type ApplinkApp = "farmer" | "dealer";

export type Credentials = { applicationId: string; password: string };

/** Every response may carry these; success is S1000 (P1003 for debit only). */
export type ApplinkStatus = { statusCode?: string; statusDetail?: string };

// ---------- CaaS ----------
export type DebitRequest = {
  externalTrxId: string;
  amount: string; // "5.00"
  paymentInstrumentName: "Mobile Account";
  subscriberId: string; // tel:880…
  Currency: "BDT";
};
export type DebitResponse = ApplinkStatus & { requestCorrelator: string; internalTrxId: string };

export type CaasOtpVerifyRequest = {
  referenceNo: string; // requestCorrelator from debit
  otp: string;
  sourceAddress: string; // tel:880…
};
export type CaasOtpVerifyResponse = ApplinkStatus;

/** Inbound charging notification (Applink → /api/callbacks/caas/<token>). */
export type ChargingNotification = {
  externalTrxId: string;
  internalTrxId: string;
  referenceId: string;
  paidAmount: string;
  TotalAmount: string;
  balanceDue: string;
  statusCode: string;
  timeStamp?: string;
};

// ---------- Subscriber OTP ----------
export type OtpRequestRequest = { subscriberId: string; applicationMetaData: { client: "WEBAPP" } };
export type OtpRequestResponse = ApplinkStatus & { referenceNo: string };

export type OtpVerifyRequest = { referenceNo: string; otp: string };
export type OtpVerifyResponse = ApplinkStatus & { subscriptionStatus: string; subscriberId: string };

// ---------- Subscription ----------
export type SubscriptionSendRequest = { subscriberId: string; action: "1" | "0" };
export type SubscriptionSendResponse = ApplinkStatus & { subscriptionStatus: string };

/** Shape to confirm against the official docs (see APPLINK_CONTRACTS.md). */
export type QueryBaseRequest = Record<string, never>;
export type QueryBaseResponse = ApplinkStatus & { baseSize: string };

/** Shape to confirm against the official docs (see APPLINK_CONTRACTS.md). */
export type ChargingInfoRequest = { subscriberId: string };
export type ChargingInfoResponse = ApplinkStatus & { subscriberId: string; subscriptionStatus: string; lastChargedDate?: string };

// ---------- SMS ----------
export type SmsSendRequest = {
  version: "1.0";
  message: string;
  destinationAddresses: string[];
  deliveryStatusRequest: "1" | "0";
};
export type SmsSendResponse = ApplinkStatus & {
  requestId: string;
  destinationResponses: { address?: string; messageId: string; statusCode: string; statusDetail?: string }[];
};

// ---------- USSD ----------
export type UssdSendRequest = {
  sessionId: string;
  message: string;
  ussdOperation: "mt-cont" | "mt-fin";
  destinationAddress: string;
};
export type UssdSendResponse = ApplinkStatus;

/** Path → [request, response]. Drives the types of applink(). */
export type ApplinkCalls = {
  "caas/direct/debit": [DebitRequest, DebitResponse];
  "caas/otp/verify": [CaasOtpVerifyRequest, CaasOtpVerifyResponse];
  "otp/request": [OtpRequestRequest, OtpRequestResponse];
  "otp/verify": [OtpVerifyRequest, OtpVerifyResponse];
  "subscription/send": [SubscriptionSendRequest, SubscriptionSendResponse];
  "subscription/query-base": [QueryBaseRequest, QueryBaseResponse];
  "subscription/getSubscriberChargingInfo": [ChargingInfoRequest, ChargingInfoResponse];
  "sms/send": [SmsSendRequest, SmsSendResponse];
  "ussd/send": [UssdSendRequest, UssdSendResponse];
};

export type ApplinkRequest<P extends ApplinkPath> = ApplinkCalls[P][0];
export type ApplinkResponse<P extends ApplinkPath> = ApplinkCalls[P][1];

export const APPLINK_PATHS: ApplinkPath[] = [
  "caas/direct/debit",
  "caas/otp/verify",
  "otp/request",
  "otp/verify",
  "subscription/send",
  "subscription/query-base",
  "subscription/getSubscriberChargingInfo",
  "sms/send",
  "ussd/send",
];
