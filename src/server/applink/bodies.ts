import "server-only";
import { toApplink } from "../lib/msisdn";
import type {
  CaasOtpVerifyRequest,
  ChargingInfoRequest,
  DebitRequest,
  OtpRequestRequest,
  OtpVerifyRequest,
  SmsSendRequest,
  SubscriptionSendRequest,
  UssdSendRequest,
} from "./types";

/*
  Every outbound Applink request body we build, in one place (credentials are added by
  client.ts). The services call these, and scripts/contract-test.ts runs each one through
  tools/mock-applink.mjs, so a change here is checked against the contract.
  msisdn arguments are the normalized 8801XXXXXXXXX form.
*/

export const bodies = {
  debit: (i: { externalTrxId: string; amount: number; msisdn: string }): DebitRequest => ({
    externalTrxId: i.externalTrxId,
    amount: i.amount.toFixed(2),
    paymentInstrumentName: "Mobile Account",
    subscriberId: toApplink(i.msisdn),
    Currency: "BDT",
  }),

  caasOtpVerify: (i: { requestCorrelator: string; otp: string; msisdn: string }): CaasOtpVerifyRequest => ({
    referenceNo: i.requestCorrelator,
    otp: i.otp,
    sourceAddress: toApplink(i.msisdn),
  }),

  otpRequest: (msisdn: string): OtpRequestRequest => ({
    subscriberId: toApplink(msisdn),
    applicationMetaData: { client: "WEBAPP" },
  }),

  otpVerify: (i: { referenceNo: string; otp: string }): OtpVerifyRequest => ({ referenceNo: i.referenceNo, otp: i.otp }),

  subscriptionSend: (msisdn: string, action: "1" | "0"): SubscriptionSendRequest => ({ subscriberId: toApplink(msisdn), action }),

  chargingInfo: (msisdn: string): ChargingInfoRequest => ({ subscriberId: toApplink(msisdn) }),

  smsSend: (msisdn: string, message: string): SmsSendRequest => ({
    version: "1.0",
    message,
    destinationAddresses: [toApplink(msisdn)],
    deliveryStatusRequest: "1",
  }),

  /** destinationAddress is passed through exactly as the USSD callback's sourceAddress. */
  ussdSend: (i: { sessionId: string; message: string; end: boolean; destinationAddress: string }): UssdSendRequest => ({
    sessionId: i.sessionId,
    message: i.message,
    ussdOperation: i.end ? "mt-fin" : "mt-cont",
    destinationAddress: i.destinationAddress,
  }),
};
