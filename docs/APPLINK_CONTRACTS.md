# Applink API contracts

Request and response shapes the backend relies on. `src/server/applink/client.ts` is the only caller; it adds `applicationId` + `password` to every outbound body and goes through Fixie (see BACKEND_PLAN.md §7).

> **To confirm:** check field casing (e.g. `Currency`) against the official Applink mock/simulator before going live. Update this file if anything differs.

Base URL: `APPLINK_BASE_URL` (default `https://api.applink.com.bd`). Subscriber addresses are `tel:8801XXXXXXXXX` (`toApplink()` in `src/server/lib/msisdn.ts`).

## CaaS (charging)

### Direct debit
`POST /caas/direct/debit`
```json
{ "applicationId": "…", "password": "…", "externalTrxId": "…", "amount": "5.00", "paymentInstrumentName": "Mobile Account", "subscriberId": "tel:880…", "Currency": "BDT" }
```
→
```json
{ "statusCode": "P1003", "requestCorrelator": "…", "internalTrxId": "…" }
```

### OTP verify (charge confirmation)
`POST /caas/otp/verify`
```json
{ "applicationId": "…", "password": "…", "referenceNo": "<requestCorrelator>", "otp": "…", "sourceAddress": "tel:880…" }
```
→
```json
{ "statusCode": "S1000" }
```
Money settles **only** on the charging notification, never on this response.

### Charging notification (inbound)
Applink → `POST /api/callbacks/caas/<CALLBACK_TOKEN>`
```json
{ "externalTrxId": "…", "internalTrxId": "…", "referenceId": "…", "paidAmount": "…", "TotalAmount": "…", "balanceDue": "…", "statusCode": "S1000" }
```
Reply:
```json
{ "statusCode": "S1000", "statusDetail": "Success" }
```

## Subscriber OTP (number verification)

### Request
`POST /otp/request`
```json
{ "subscriberId": "…", "applicationMetaData": { "client": "WEBAPP" } }
```
→
```json
{ "statusCode": "S1000", "referenceNo": "…" }
```

### Verify
`POST /otp/verify`
```json
{ "referenceNo": "…", "otp": "…" }
```
→
```json
{ "statusCode": "S1000", "subscriptionStatus": "REGISTERED", "subscriberId": "…" }
```

## Subscription

`POST /subscription/send`
```json
{ "subscriberId": "…", "action": "1" | "0" }
```
→
```json
{ "subscriptionStatus": "…" }
```

### Base size and charging info (shapes to confirm)
Used by the admin subscribers page and the daily `reconcile` job. These shapes are **assumptions**: check them against the official docs and fix `src/server/applink/types.ts` if they differ.

`POST /subscription/query-base` `{}` → `{ "statusCode": "S1000", "baseSize": "…" }`

`POST /subscription/getSubscriberChargingInfo` `{ "subscriberId": "tel:880…" }` → `{ "statusCode": "S1000", "subscriberId": "…", "subscriptionStatus": "REGISTERED" }`

## SMS

`POST /sms/send`
```json
{ "version": "1.0", "message": "…", "destinationAddresses": ["tel:880…"], "deliveryStatusRequest": "1" }
```
→
```json
{ "requestId": "…", "destinationResponses": [{ "messageId": "…", "statusCode": "…" }] }
```

## USSD

`POST /ussd/send`
```json
{ "sessionId": "…", "message": "…", "ussdOperation": "mt-cont" | "mt-fin", "destinationAddress": "…" }
```
→
```json
{ "statusCode": "S1000" }
```

## Status codes

| Code | Meaning |
|---|---|
| `S1000` | Success. The **only** success code, except debit. |
| `P1003` | Debit accepted, pending OTP. The success code for `/caas/direct/debit`. |
| `E1303` | IP not allowed (Fixie IPs missing from "Allowed Host Address(es)"). |
| `E1308` | Permanent charge failure (low balance). |
| `E1337` | Transaction exists. Settle from the charging notification. |

HTTP 200 with any `E…` code is an error.

**Wrong OTP:** the real code for a wrong CaaS or subscriber OTP isn't confirmed yet. The mock uses the placeholder `E1850` (`APPLINK.WRONG_OTP` in `src/server/applink/errors.ts`). Replace it with the real code(s) once known.

Transport failures (no Applink status) surface as `ApplinkError` codes `TIMEOUT` (10 s), `NETWORK`, `BAD_RESPONSE`, `HTTP_<n>`, and `CONFIG` (live mode without credentials).

## Inbound SMS and delivery reports (shapes to confirm)

These are the fields our callback routes read. Extra fields are accepted and kept (redacted) in `callbackInbox.bodyRedacted`. Check them against the official docs.

### SMS-MO (inbound)
Applink → `POST /api/callbacks/sms-mo/<CALLBACK_TOKEN>`
```json
{ "version": "1.0", "applicationId": "…", "sourceAddress": "tel:880…", "message": "PD HELP", "requestId": "…", "encoding": "0" }
```
Dedupe key: `requestId`. Reply `{ "statusCode": "S1000", "statusDetail": "Success" }`.

### SMS delivery report (inbound)
Applink → `POST /api/callbacks/sms-dlr/<CALLBACK_TOKEN>`
```json
{ "destinationAddress": "tel:880…", "timeStamp": "…", "requestId": "<requestId from /sms/send>", "deliveryStatus": "DELIVERED" }
```
Dedupe key: `requestId:deliveryStatus`. `DELIVERED / DELIVRD / SUCCESS / S1000` → prescription `sms: DELIVERED`. Statuses containing `UNDELIV / FAIL / EXPIRED / REJECT / UNKNOWN / DELETED` → `UNDELIVERABLE`. Any other status is stored on `smsLog.dlrStatus` only.

### Subscription notification (inbound, shape to confirm)
Applink → `POST /api/callbacks/subscription/<CALLBACK_TOKEN>`
```json
{ "version": "1.0", "applicationId": "…", "password": "…", "subscriberId": "tel:880…", "frequency": "monthly", "status": "REGISTERED", "timeStamp": "20261125100000" }
```
`password` must equal `APPLINK_PASSWORD`, else 403. It is never stored or logged. Reply `{ "statusCode": "S1000", "statusDetail": "Success" }`.

### USSD MO (inbound, shape to confirm)
Applink → `POST /api/callbacks/ussd/<CALLBACK_TOKEN>`
```json
{ "version": "1.0", "applicationId": "…", "sessionId": "…", "ussdOperation": "mo-init" | "mo-cont", "sourceAddress": "tel:880…", "message": "1", "requestId": "…", "encoding": "440" }
```
We reply with `POST /ussd/send` (`mt-cont` / `mt-fin`, same `sessionId`, `destinationAddress` = `sourceAddress`) **before** answering `{ "statusCode": "S1000", "statusDetail": "Success" }`.
