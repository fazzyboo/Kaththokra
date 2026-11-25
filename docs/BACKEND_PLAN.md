# Kaththokra — Backend Plan

**Repo:** `fazzyboo/Kaththokra` (Next.js 16, App Router, React 19, TypeScript, Tailwind v4)
**Decision:** the backend lives in the same repo as **Next.js route handlers** (`src/app/api/**/route.ts`), deployed with the frontend on Vercel.
**Stack:** MongoDB Atlas (M0, free) · Google Gemini API (photo diagnosis) · Applink (OTP, CaaS, SMS, Subscription, USSD) via the **Fixie** static-IP proxy.
**Written against:** the code as it is on GitHub on 25 Nov 2026 (`src/lib/api.ts` mocks, `src/lib/types.ts`, `src/lib/session.tsx`, 44 pages).

Companion file: `kaththokra-backend-prompts.md`: backend prompts (B0–B11), credentials checklist, API test prompt (T1), frontend wiring prompts (F1–F7).

---

## 1. What the frontend does today, and what has to change

The UI is finished and every page works on mock data. The backend replaces the mocks one area at a time, and the app has to stay demoable after every step.

| Today | Where | After the backend |
|---|---|---|
| Every API call is a mock function with `sleep()` | `src/lib/api.ts` | Same function names, bodies become `fetch('/api/...')`. Pages keep calling these functions. |
| Results stored in `sessionStorage`, looked up synchronously by `getDiagnosis(id)` | `api.ts`, `DiagnosisResult`, `ClarifyFlow`, `PaymentFlow` | `GET /api/diagnose/[id]`, async. The three components load it in `useEffect` (they already handle `undefined` = loading and `null` = not found). |
| `diagnose()` never receives the photo | `DiagnoseFlow.tsx` → `diagnose(crop, scenario, opts)` | Send the resized JPEG blob as multipart. |
| Photo resized to 512 px, ≤150 KB | `src/lib/image.ts` | 1024 px, ≤350 KB, still JPEG, still EXIF-free. Better for Gemini, still small. |
| "Try a sample photo" is an SVG data URL | `image.ts` `SAMPLE_LEAF` | Render it to a canvas and export a JPEG blob (Gemini doesn't take SVG). Better still, add a real leaf photo at `public/sample-leaf.jpg`. |
| Phone number, subscription, dealer and admin "sessions" in `localStorage` | `src/lib/session.tsx` | httpOnly cookies set by the server. `SessionProvider` loads from `GET /api/me`, `/api/subscription`, `/api/dealer/me`, `/api/admin/me`. |
| Payment outcome chosen by Demo controls; prescription made in the browser | `PaymentFlow.tsx` `finish()`, `savePrescription()` | Server creates the prescription when Applink's charging notification arrives. `GET /api/pay/[id]` returns `{ status, prescriptionRef }`. |
| **Paid content (spray, dose, timing, safety) ships in the browser bundle** | `src/lib/data.ts` `DISEASES` | Split: free fields (name, symptoms, cause, care) stay in `data.ts`. Paid fields move to the server KB and come back only in `GET /api/prescriptions/[ref]` for the owner. |
| Prices, confidence gate, USSD code are constants | `data.ts` | `settings` document in Mongo, served by `GET /api/config`. Admin Settings page edits it. |
| Admin, dealer and USSD data are seeded arrays | `admin-data.ts`, `dealer-data.ts` | Aggregations over the real collections. |
| `src/lib/applink.ts` calls the old Oracle/Cloudflare proxy | `applink.ts`, `infra/applink-proxy/` | Rewrite to go through Fixie. Move `infra/applink-proxy/` to `infra/_archive/` (keep it as a fallback). |
| Demo controls pick every outcome | `DemoPanel.tsx` | Kept, but only when `NEXT_PUBLIC_DEMO_MODE=true`. In demo mode the server's Applink and Gemini clients run in **mock mode** and follow the chosen scenario (sent as an `x-kk-scenario` header). This gives a safe fallback on stage if Applink or the network fails. |

Bugs from manual testing that this plan fixes on the way:
1. "View prescription" after paying opens seeded PD-482193 → fixed by step 4 (result page reads `prescriptionRef` from the diagnosis).
2. Code `000000` on Alerts and Dealer onboarding shows no error → fixed in steps 6 and 8.
3. Dealer prescriptions always say "Ma Krishi Bitan" → fixed in step 8 (shop name from the dealer session).
4. Dealer review "Back to home" goes to `/`; dealer "View prescription" goes to farmer route → step 8.
5. QR codes point to `kaththokra.app/p/<ref>` → step 8 uses `NEXT_PUBLIC_APP_URL` and links to `/prescriptions/<ref>`.
6. "3 wrong codes" lock unreachable → server counts attempts (step 4).
7. Admin Settings and KB edits don't reach the farmer pages → steps 9b and 2.

---

## 2. Architecture

```
Phone browser (PWA)
   │  HTTPS, httpOnly cookies
   ▼
Vercel ── Next.js 16
   ├─ src/app/api/**/route.ts      thin route handlers (auth, zod, call a service, map errors)
   ├─ src/server/**                all backend logic ("server-only", no React)
   │    ├─ db/            MongoDB client + collections + indexes      ──► MongoDB Atlas M0
   │    ├─ gemini/        diagnosis prompt, schema, client             ──► Gemini API (direct)
   │    ├─ applink/       the ONLY Applink caller                      ──► Fixie ──► api.applink.com.bd
   │    ├─ services/      diagnosis, payment, identity, subscription, messaging, ussd, dealer, admin, kb
   │    └─ auth/, http/, lib/
   └─ src/app/api/callbacks/*      ◄── Applink callbacks (CaaS, SMS-MO, SMS-DLR, Subscription, USSD)

Scheduled: Vercel Cron (daily) + GitHub Actions cron (every 15 min) ──► /api/jobs/* (secret header)
```

Rules:
- Only `src/server/applink/client.ts` talks to Applink, and only it uses Fixie. Gemini and MongoDB connect directly (the Fixie free plan has a monthly request cap; check yours in the Fixie dashboard).
- Fixie gives **two** static IPs. Put **both** in Applink's "Allowed Host Address(es)".
- Every file in `src/server/` starts with `import "server-only"`.
- Every route handler that touches Mongo or Gemini: `export const runtime = "nodejs"`. Diagnose: `export const maxDuration = 30`.
- Route handlers never call Applink or Gemini directly; they call a service.

---

## 3. Folder layout (added to the existing repo)

```
src/
├─ app/api/
│  ├─ health/route.ts                         GET  db ping + mode flags
│  ├─ config/route.ts                         GET  public settings (prices, gate, USSD code, helpline)
│  ├─ me/route.ts                             GET  farmer session
│  ├─ auth/otp/request/route.ts               POST
│  ├─ auth/otp/verify/route.ts                POST
│  ├─ auth/logout/route.ts                    POST
│  ├─ diagnose/route.ts                       POST multipart
│  ├─ diagnose/[id]/route.ts                  GET
│  ├─ diagnose/[id]/answer/route.ts           POST
│  ├─ diagnose/[id]/review/route.ts           POST
│  ├─ pay/initiate/route.ts                   POST
│  ├─ pay/[id]/route.ts                       GET  (polled)
│  ├─ pay/[id]/otp/route.ts                   POST
│  ├─ prescriptions/route.ts                  GET  mine
│  ├─ prescriptions/[ref]/route.ts            GET  (owner only)
│  ├─ prescriptions/[ref]/resend/route.ts     POST
│  ├─ subscription/route.ts                   GET
│  ├─ subscribe/route.ts                      POST (→ OTP)
│  ├─ subscribe/verify/route.ts               POST
│  ├─ unsubscribe/route.ts                    POST
│  ├─ ussd/simulate/route.ts                  POST (simulator page → real state machine, mock Applink)
│  ├─ dealer/onboard/route.ts                 POST (→ OTP)
│  ├─ dealer/onboard/verify/route.ts          POST
│  ├─ dealer/me/route.ts                      GET
│  ├─ dealer/logout/route.ts                  POST
│  ├─ dealer/stats/route.ts                   GET
│  ├─ dealer/sales/route.ts                   GET
│  ├─ admin/...                               see §6
│  ├─ callbacks/caas/[token]/route.ts         POST charging notification
│  ├─ callbacks/sms-mo/[token]/route.ts       POST
│  ├─ callbacks/sms-dlr/[token]/route.ts      POST
│  ├─ callbacks/subscription/[token]/route.ts POST
│  ├─ callbacks/ussd/[token]/route.ts         POST mo-init / mo-cont
│  └─ jobs/{expire-payments,sms-retry,send-alerts,reconcile,process-inbox}/route.ts
├─ server/
│  ├─ env.ts                  zod-validated env
│  ├─ db/client.ts  db/collections.ts  db/indexes.ts
│  ├─ http/handler.ts         wrap(): parse, auth, errors → { error: { code, message } }
│  ├─ http/errors.ts          AppError + codes
│  ├─ auth/session.ts         create/read/destroy sessions; cookies kk_f, kk_d, kk_a
│  ├─ auth/totp.ts  auth/password.ts
│  ├─ applink/client.ts  applink/mock.ts  applink/errors.ts  applink/types.ts
│  ├─ gemini/client.ts  gemini/prompt.ts  gemini/schema.ts  gemini/mock.ts
│  ├─ services/diagnosis.ts payment.ts identity.ts subscription.ts messaging.ts
│  │           ussd.ts dealer.ts admin.ts kb.ts settings.ts alerts.ts audit.ts
│  ├─ kb/seed-data.ts         paid treatment fields moved out of src/lib/data.ts
│  ├─ ussd/tree.ts            USSD menu tree (moved out of the ussd page, shared)
│  └─ lib/ids.ts msisdn.ts ratelimit.ts log.ts
├─ lib/api.ts                 now real fetch calls (same function names where possible)
scripts/  ensure-indexes.ts  seed.ts  create-admin.ts  applink-smoke.ts  eval-gemini.ts
docs/     BACKEND_PLAN.md (this file)  APPLINK_CONTRACTS.md
vercel.json                   crons
.github/workflows/            ci.yml  cron-jobs.yml
```

New dependencies: `mongodb`, `@google/genai`, `undici`, `zod`, `server-only`, `bcryptjs`, `otplib`, and `tsx` (dev, for scripts).

---

## 4. Data model (MongoDB)

IDs are the same strings the UI already uses, stored as `_id` and mapped to `id` in the API response, so `src/lib/types.ts` stays valid.

| Collection | `_id` | Key fields | Indexes |
|---|---|---|---|
| `settings` | `"global"` | priceRx, priceSubMonthly, confidenceGate, abTest, ussdCode, helpline | — |
| `users` | `u-…` | msisdn (8801…), msisdnMasked, lang, verifiedAt | unique msisdn |
| `sessions` | random token (hashed) | kind: farmer/dealer/admin, subjectId, expiresAt | TTL expiresAt |
| `otpRequests` | `o-…` | purpose: verify/subscribe/dealer, msisdn, referenceNo, attempts, payload, expiresAt | TTL expiresAt |
| `diagnoses` | `d-…` | crop, status, top3, severity, ood, retakeReason, modelVersion, kbVersion, channel, upazila, userId?, dealerId?, imageId?, imageHash, gemini (raw summary), answers, reviewTicket?, prescriptionRef?, createdAt | {userId,createdAt}, {dealerId,createdAt}, {status}, {upazila,crop,createdAt}, imageHash |
| `images` | `img-…` | diagnosisId, mime, data (Binary), bytes, keepUntil (180 d if consent, else 7 d) | TTL keepUntil |
| `payments` | `p-…` | diagnosisId, msisdn, amount, status (the 10 `PaymentStatus` values), externalTrxId, requestCorrelator, internalTrxId, otpAttempts, otpExpiresAt, dealerId?, channel, failureCode?, paidAt? | unique externalTrxId, unique requestCorrelator (sparse), {status,createdAt} |
| `prescriptions` | `PD-……` | diagnosisId, paymentId, msisdn, diseaseCode, crop, amount, treatment (snapshot of KB), kbVersion, modelVersion, sms status, channel, dealerId?, dealerShop?, receiptId, paidAt | {msisdn,paidAt}, {dealerId,paidAt} |
| `kbDiseases` | disease code | free + paid fields, kbVersion, kbStatus, approvedBy/At, history[] | {crop} |
| `reviews` | `RV-…` | diagnosisId, kind: uncertain/dispute, msisdn, note, status, verdict, reply, useForTraining | {status,createdAt} |
| `subscriptions` | msisdn | crops, upazila, status, frequency, source, since, lastNotifyAt, lastReconciledAt | {status}, {upazila} |
| `alerts` | `AL-…` | crop, diseaseCode, upazilas, message, status: suggested/scheduled/sent, recipients, sendAt | {status,sendAt} |
| `smsLog` | requestId | msisdn, template, messageId, segments, dlrStatus, retries, nextRetryAt | unique messageId (sparse) |
| `callbackInbox` | auto | type, dedupeKey, bodyRedacted, receivedAt, processedAt | unique {type,dedupeKey} |
| `ussdSessions` | Applink sessionId | msisdn, stack, pendingPaymentId, expiresAt | TTL expiresAt (120 s) |
| `dealers` | `DLR-…` | shopName, upazila, msisdn, status, commissionRate, fraudFlag | unique msisdn |
| `commissionLedger` | auto | dealerId, paymentId, amount, month, paidOut | unique paymentId |
| `applinkLog` | auto | at, api, direction (out/in), path, statusCode, msisdnMasked, ms | TTL 14 days |
| `admins` | email | name, role, passwordHash, totpSecret | — |
| `auditLog` | auto | actor, action, entity, entityId, at | {at} |
| `evalRuns` | auto | model, promptVersion, n, accuracy, perClass[], at | {at} |
| `rateLimits` | key | count, windowEnd | TTL windowEnd |
| `alertDeliveries` | `<alertId>:<msisdn>` | alertId, msisdn, crop, outcome, smsLogId, at | {alertId}, {msisdn, crop, at}, TTL at 60 d |

Serverless notes: cache `MongoClient` on `globalThis`, `maxPoolSize: 5`. Atlas Network Access must allow `0.0.0.0/0` because Vercel has no fixed IP.

Implementation notes (B0):
- "Sparse unique" indexes (`payments.requestCorrelator`, `smsLog.messageId`) are built as unique with `partialFilterExpression: { <field>: { $type: "string" } }`. Same effect when the field is omitted, and a stray `null` can't collide. Omit these fields until they're known; don't write `null`.
- Scripts run as `tsx --conditions=react-server scripts/….ts` (that's what `npm run seed|indexes|create-admin` do). Without that flag, `import "server-only"` throws outside Next.js. `scripts/_env.ts` loads `.env*` the way `next dev` does.
- `npm run seed` only inserts what's missing, so admin edits survive a rerun. `npm run seed -- --force` overwrites settings and KB with the seed values.

---

## 5. Gemini diagnosis

**Flow of `POST /api/diagnose`** (multipart `crop`, `image`, `consent`, optional `upazila`):
1. Validate crop ∈ rice/potato/tomato, MIME jpeg/png/webp, size ≤ 1 MB, rate limit (per IP and per session).
2. SHA-256 of the image. Same hash + crop in the last 24 h → return that diagnosis (saves quota on double taps).
3. Call Gemini with the image inline and the prompt, using structured output (`responseMimeType: "application/json"` + `responseSchema`). Allowed `candidates[].code` values are **only that crop's codes from the KB** (e.g. rice: RICE_BLAST, RICE_BROWN_SPOT, RICE_BLB, RICE_SHEATH_BLIGHT, RICE_HEALTHY) plus `UNKNOWN`.
4. Parse with zod. On a parse failure retry once; then return a RETAKE result. On 429 or timeout (20 s) try `GEMINI_FALLBACK_MODEL` once; if that fails too, return HTTP 503 `GEMINI_BUSY` and the UI shows "busy, try again in a minute".
5. Map to the existing `Diagnosis` type:

| Gemini output | Diagnosis |
|---|---|
| `isPlantLeaf=false` | `status: "RETAKE"`, `retakeReason: "not_leaf"`, `ood ≈ 0.9` |
| `imageQuality ≠ "good"` | `RETAKE`, `retakeReason: "blurry"` |
| `detectedCrop ≠ crop` | `RETAKE`, `retakeReason: "crop_mismatch"` (the page currently shows the blurry text for this; step 2 adds a line for it) |
| top1.p ≥ gate **and** top1.p − top2.p ≥ 0.2 **and** code ≠ UNKNOWN | `CONFIDENT` (healthy codes are CONFIDENT too; the page already shows them as healthy) |
| otherwise | `UNCERTAIN` |
| `severity` | `severity` (CONFIDENT only) |
| `modelVersion` | `` `${GEMINI_MODEL}+p${PROMPT_VERSION}` `` |

6. Save `diagnoses` (+ `images` if the photo is kept) and return the `Diagnosis`.

Implementation notes (B2):
- **Hash cache deviation:** a repeat photo (same SHA-256 + crop, last 24 h) reuses the stored Gemini output but still creates a **new** diagnosis doc. Returning the old doc would let two farmers who upload the same photo (e.g. the sample leaf) share one diagnosis' status, review and payment. The quota saving is the same. The cache only runs with `GEMINI_MODE=live`, because mock output depends on the scenario header.
- Allowed codes are the crop's `published` KB entries + `UNKNOWN`. `UNKNOWN` never appears in `top3` (the UI can't show it). It feeds `ood` = max(p(UNKNOWN), 1 − Σp(known)). If Gemini's p values sum past 1, they are scaled down.
- Unparseable output twice → `RETAKE` / `blurry`. Any Gemini call error other than 429/5xx/timeout (e.g. a bad key, 400) also ends in 503 `GEMINI_BUSY`, after a log line. The SDK's own retries are turned off (`retryOptions.attempts = 1`).
- `kbVersion` = the KB version of top1, or the crop's highest version when there is no top1.
- `upazila` is `""` when not sent (no fake default).
- Image checks: ≤ 1 MB (413), declared type jpeg/png/webp, **and** magic bytes must match the declared type.
- Clarify always re-ranks from the pre-answer `initialTop3`, so answering twice doesn't compound. Only `UNCERTAIN` diagnoses can be answered or sent for review (else 409). Review is idempotent (returns the existing ticket).

**Clarify** (`POST /api/diagnose/[id]/answer`): keep the existing rule-based re-rank from the `CLARIFY` question bank (it already works and is explainable). No second Gemini call.

**Key points:**
- Gemini only classifies. It picks from our fixed code list and never writes treatment. The prescription always comes from the agronomist-approved KB.
- Treat Gemini's `p` as a ranking score. Tune the gate on 30–50 real field photos per crop with `scripts/eval-gemini.ts`, which also feeds the admin "AI model" page.
- Keep the model name in `GEMINI_MODEL`, pick the current stable Flash model on the free tier in Google AI Studio, and Flash-Lite as `GEMINI_FALLBACK_MODEL`.
- Free-tier prompts may be used by Google to improve its products. Update the consent text and `/privacy` to say the photo is analysed by Google's AI.
- Update the proposal: HLD decision D4 rejected a vision-LLM. The new answer is: constrained code list, logged model + prompt version, KB-only prescriptions, image-hash cache, mock fallback.

---

## 6. API contract (what each UI file calls)

All responses are JSON. Errors: `{ "error": { "code": "E1308" | "WRONG_CODE" | "NOT_FOUND" | …, "message": "…" } }` with a fitting HTTP status. `msisdn` in requests is `8801XXXXXXXXX` (from `normalizeMsisdn`); responses only ever contain the masked form, except in the owner's own prescription receipt.

**Farmer**

| Endpoint | Request → Response | Used by |
|---|---|---|
| `GET /api/config` | → `{ priceRx, priceSubMonthly, confidenceGate, ussdCode, helpline }` | new `useConfig()` hook, replaces constants |
| `POST /api/auth/otp/request` | `{ msisdn }` → `{ requestId }` (Applink referenceNo stays on the server) | `NumberVerify` |
| `POST /api/auth/otp/verify` | `{ requestId, code }` → `{ msisdnMasked }` + sets `kk_f` (90 d) / 400 `WRONG_CODE` | `NumberVerify` |
| `GET /api/me` / `POST /api/auth/logout` | → `{ msisdnMasked, msisdnLast4 }` or 401 | `SessionProvider`, Settings, Prescriptions |
| `POST /api/diagnose` | multipart → `Diagnosis` | `DiagnoseFlow` |
| `GET /api/diagnose/[id]` | → `Diagnosis & { prescriptionRef?, reviewTicket? }` | `DiagnosisResult`, `ClarifyFlow`, `PaymentFlow` |
| `POST /api/diagnose/[id]/answer` | `{ answers: Record<questionId, optionIndex> }` → `Diagnosis` | `ClarifyFlow` |
| `POST /api/diagnose/[id]/review` | `{ msisdn, note? }` → `{ ticket }` | `ReviewRequest` |
| `POST /api/pay/initiate` | `{ diagnosisId, msisdn }` → `{ paymentId, otpExpiresAt }` / 409 not payable | `PaymentFlow` |
| `POST /api/pay/[id]/otp` | `{ code }` → `{ result: "accepted" }` / 400 `{ code:"WRONG_CODE", attemptsLeft }` / 402 `E1308` / 410 `EXPIRED` / 423 `LOCKED` | `PaymentFlow` |
| `GET /api/pay/[id]` | → `{ status, prescriptionRef? }` | `PaymentFlow` polling |
| `GET /api/prescriptions` | → `Prescription[]` (mine) | `/prescriptions` |
| `GET /api/prescriptions/[ref]` | → `Prescription & { treatment }` (owner farmer or owning dealer only) | `/prescriptions/[ref]`, `/dealer/share/[ref]` |
| `POST /api/prescriptions/[ref]/resend` | → `{ ok: true }` (free SMS, max 3/day) | `PrescriptionView` |
| `GET /api/subscription` | → `Subscription \| null` | `SessionProvider`, `/alerts` |
| `POST /api/subscribe` | `{ crops, upazila, msisdn }` → `{ requestId }` | `/alerts` |
| `POST /api/subscribe/verify` | `{ requestId, code }` → `Subscription` / 400 `WRONG_CODE` | `/alerts` |
| `POST /api/unsubscribe` | → `{ ok: true }` | `/alerts` |
| `POST /api/ussd/simulate` | `{ sessionId, input }` → `{ text, end, log[] }` | `/ussd` simulator (optional) |

**Dealer** (cookie `kk_d`, 30 d)

| Endpoint | Used by |
|---|---|
| `POST /api/dealer/onboard` `{ shopName, upazila, msisdn }` → `{ requestId }`; `POST /api/dealer/onboard/verify` `{ requestId, code }` → `DealerSession` | `/dealer/onboard` |
| `GET /api/dealer/me`, `POST /api/dealer/logout` | `DealerShell`, `/dealer/profile` |
| `GET /api/dealer/stats` → `{ todayCommission, todaySales, monthCommission, monthSales, monthDiagnoses, lastPayout, daily[14] }` | `/dealer`, `/dealer/sales` |
| `GET /api/dealer/sales?filter=` → `DealerSale[]` | `/dealer`, `/dealer/sales` |
| Diagnose, answer, review, pay endpoints above, with the dealer cookie: diagnosis and payment get `dealerId` and `channel: "dealer"` | dealer flow pages |

**Admin** (cookie `kk_a`, 12 h, role-checked)

| Endpoint | Roles | Page |
|---|---|---|
| `POST /api/admin/login` `{ email, password }` → `{ challengeId }`; `POST /api/admin/login/totp` `{ challengeId, code }`; `GET /api/admin/me`; `POST /api/admin/logout` | all | `/admin/login`, shell |
| `GET /api/admin/kpis?days=14` → shape of `kpis()` + `DAILY` | all | `/admin` |
| `GET /api/admin/live-log?after=<ts>&api=` (polled every 3 s) | admin, analyst | `/admin/live-log` |
| `GET /api/admin/review?status=`, `GET /api/admin/review/[id]`, `POST /api/admin/review/[id]` `{ verdict, reply?, useForTraining }` | admin, agronomist | review pages |
| `GET /api/admin/payments?filter=`, `POST /api/admin/payments/[id]/refund`, `POST /api/admin/payments/[id]/fail`, `GET /api/admin/payments.csv` | admin | `/admin/payments` |
| `GET /api/admin/alerts`, `POST /api/admin/alerts`, `POST /api/admin/alerts/[id]/approve`, `DELETE /api/admin/alerts/[id]` | admin, agronomist | `/admin/alerts` |
| `GET /api/admin/heatmap?crop=` | all | `/admin/heatmap` |
| `GET /api/admin/kb`, `GET/PUT /api/admin/kb/[code]`, `POST /api/admin/kb/[code]/transition` `{ to }` | admin, agronomist | KB pages |
| `GET /api/admin/model` (Gemini model, prompt version, latest `evalRuns`) | all | `/admin/model` |
| `GET /api/admin/dealers`, `POST /api/admin/dealers/[id]/status`, `GET /api/admin/dealers.csv` | admin, dealer_manager | `/admin/dealers` |
| `GET /api/admin/subscribers`, `POST /api/admin/subscribers/reconcile` | admin | `/admin/subscribers` |
| `GET /api/admin/team`, `POST /api/admin/team` | admin | `/admin/team` |
| `GET/PUT /api/admin/settings` | admin | `/admin/settings` |

Implementation notes (B4):
- `GET /api/pay/[id]` returns `{ status, stage, prescriptionRef?, failureCode? }`. `status` collapses PAID/FULFILLED/DELIVERED to `"PAID"` (what `PaymentFlow` polls for). `stage` is the exact `PaymentStatus`. An OTP_SENT payment past `otpExpiresAt` reads as EXPIRED (and is saved as EXPIRED).
- `initiate` refuses (409 `NOT_PAYABLE`) when another payment for the diagnosis is VERIFYING or paid, since that one may still settle. Older OTP_SENT payments for the diagnosis are marked EXPIRED. The diagnosis's top1 must have a `published`, non-healthy KB entry. `externalTrxId` is a UUID.
- Debit failure (any error, incl. timeout) → FAILED, no retry. Without the OTP step no money moves.
- OTP verify: E1308 → FAILED + 402. E1337 or a transport error/timeout → VERIFYING (outcome unknown, the notification decides). E1303 → 502. Other `E…` → wrong code (real wrong-OTP code unconfirmed). Demo scenario `expired` (mock only) closes the OTP window before checking.
- `settle()` runs in a Mongo transaction (Atlas is a replica set). Concurrent settles conflict on the payment doc, and the loser retries and sees PAID. The SMS is sent by whoever atomically sets `prescriptions.smsClaimedAt`, so a re-run after a crash still sends exactly one. A notification with statusCode ≠ S1000 → FAILED (unless already paid). An amount mismatch is logged.
- Callback inbox dedupe key: `externalTrxId:statusCode` (a failure notification followed by a success isn't swallowed).
- `GET /api/prescriptions/[ref]` adds `diseaseName` (snapshot at sale time) next to `treatment`. Unknown ref → 404; exists but not yours → 403. List without a session → 401. Resend: 3 per ref per UTC day (fixed window).
- Prescription SMS: the `smsBanglish` text from `PrescriptionView`, made GSM-7 safe (– → -). All 12 seeded entries are 2 segments. Over 3 → the timing sentence is dropped; still over → error.

Implementation notes (B9):
- `scripts/create-admin.ts <email> "<name>" <role> [--print-secret]` (the `--email/--name/--role` flags also work). The password comes from `KK_ADMIN_PASSWORD` or a hidden prompt (min 12). Re-running resets the password and the TOTP secret.
- Sign-in: password (bcrypt; an unknown email still runs one bcrypt compare, so timing reveals nothing) → `challengeId` (an `otpRequests` row, purpose `admin_totp`, 5 min, 5 code attempts) → TOTP (±30 s drift) → `kk_a` 12 h. **Replay protection:** `admins.lastTotpStep`, so a code can't be used twice. **Rate limit = 5 *failed* attempts (password or code) per IP per 15 min**; successful sign-ins don't count, so an office on one IP isn't locked out. Every sign-in, failure and sign-out goes to `auditLog`.
- `GET /api/admin/kpis?days=N` → `{ days, labels[], daily (DAILY shape), subscribers (SUBSCRIBERS shape), revenueShare, kpis (kpis() shape) }`. confident = CONFIDENT+UNLOCKED, uncertain = UNCERTAIN+QUEUED_REVIEW+REVIEWED (RETAKE excluded), unlockTaps = payments created, paid = payments with `paidAt`, delivered = prescriptions with `sms: DELIVERED`. `grossRx` = sum of real paid amounts. `grossSub` is modelled like the mock (active base × monthly price × days/30). Days are Dhaka time.
- Live log: `LogEntry` with `api` = `/<path>`, `msisdn` = masked or "—", `note: "mock"` for mock calls.
- Review: `GET /api/admin/review?status=open|done` (open = open|in_progress, oldest first), `GET /api/admin/review/[id]` → `{ item: ReviewItem, diagnosis, image: data URL | null, farmer (masked), reply?, useForTraining, reviewedBy? }`, `POST` `{ verdict (CODE / UNKNOWN / …), reply? ≤300, useForTraining, sendSms? }` → closed, diagnosis → REVIEWED, SMS "Kaththokra krishibid (RV-…): <reply>" when `reply` is given (unless `sendSms: false`). A decided review → 409. `GET /api/admin/counts` → `{ openReviews }`.
- Payments: filters attention = VERIFYING+DISPUTED, settled = PAID/FULFILLED/DELIVERED/REFUNDED_MANUAL, failed = FAILED/EXPIRED. Refund also zeroes an unpaid-out dealer commission row (`reversedAt`). Fail sets `failureCode: "MANUAL"`. Wrong state → 409. CSVs quote every cell, neutralise formula injection, mask numbers, and are audited (`*.export_csv`).
- Dealers: `topFiveShare` over 30-day paid sales. Shown as `flagged` when > 0.3 **and ≥ 10 sales** (so a new shop isn't flagged on its first sales). Pausing ends all that dealer's sessions.
- Subscribers: `SubRow` (`reconciled` = reconciled in the last 36 h, `lastCharge` from `getSubscriberChargingInfo.lastChargedDate`). Reconcile checks only REGISTERED/PENDING_OTP (never re-subscribes an UNREGISTERED number), oldest-reconciled first, 10 in parallel, max 500. Also used by the B11 job.
- Roles: `src/server/auth/roles.ts`. kpis/counts/me: any role; live-log: admin, analyst; review: admin, agronomist; payments + subscribers: admin; dealers: admin, dealer_manager.

Implementation notes (B10):
- **Alerts:** `GET /api/admin/alerts` = computed suggestions (`id: "SUG-<CODE>"`, not stored; ≥ 5 CONFIDENT/UNLOCKED diagnoses of that top disease per upazila in 7 days, no scheduled/sent alert for that disease + upazila in 3 days, upazilas busiest first, default bn/en message from the KB name + helpline) followed by stored alerts. `POST` creates `status: "suggested"` (code must belong to the crop; **both** `message.bn` and `message.en` ≤ 2 SMS segments). `recipients` = REGISTERED subscribers with that crop in those upazilas, recounted on approve. `POST [id]/approve` (also accepts `SUG-<CODE>`, which saves the suggestion first) → `scheduled`, `sendAt` = next 07:00 Asia/Dhaka. `DELETE` refuses sent alerts. All audited. Roles admin, agronomist.
- **Heatmap:** `{ diseases (non-healthy KB codes, optionally one crop), upazilas (all UPAZILAS), cells[d][u] (CONFIDENT/UNLOCKED, 30 days, by top disease; < 5 → null), days, threshold }`. Any role.
- **KB versioning (deviation):** the top-level fields of `kbDiseases` are always the live **published** version. Edits live in `draft` (copy, `kbVersion + 1`, status draft → review → approved), so a disease never goes offline while it is edited. Publishing promotes the draft. Every step is pushed to `history[]` and audited. Approve and publish are limited to agronomist/admin. A `review`/`approved` draft can be sent back to `draft`. PUT accepts content fields only and only on a `draft`. List rows show the draft's status/version while a draft exists (`publishedVersion`, `hasDraft`). Publishing clears this instance's KB cache; other instances pick it up within 60 s. Prescriptions read the KB directly at settle time, so they always snapshot the latest published version.
- **Model:** `GET /api/admin/model` → `{ mode, live, fallback, promptVersion, gate, lastEval }`. `npm run eval-gemini -- <folder> [--delay 4000] [--dry]` runs `classifyLeaf` + `mapGeminiOutput` with the current gate and saves `evalRuns` `{ accuracy, perClass[{code,n,precision,recall}], coverage (share passing the gate), accAtGate, retake, gate }`.
- **Team:** `GET` lists admins without secrets. `POST { email, name, role, password? }` (admin only) returns the otpauth URL and, without `password`, a random `tempPassword`, **once**. Neither is stored in clear or logged.
- **Settings:** `GET/PUT /api/admin/settings`, admin only. Validation: priceRx 2–10, priceSubMonthly 1–70, confidenceGate 0.5–0.95, abTest bool, revenueShare 0–1, ussdCode `*…#`, helpline digits. Unknown keys → 400. The audit records before/after per changed field. Every service reads settings per request, so a change applies to the next diagnosis/payment.

**Applink callbacks** (each checks the `[token]` path segment = `CALLBACK_TOKEN`, writes `callbackInbox` first, answers `{"statusCode":"S1000","statusDetail":"Success"}` within 1 s, then processes in `after()`):

| Path | Dedupe key | Effect |
|---|---|---|
| `/api/callbacks/caas/[token]` | externalTrxId | S1000 → payment PAID → create prescription → SMS → dealer commission. Idempotent. |
| `/api/callbacks/sms-mo/[token]` | requestId | Keywords `PD ALERT <CROP> <UPZ>`, `PD STOP`, `PD HELP`, `PD-xxxxxx` (free re-send) |
| `/api/callbacks/sms-dlr/[token]` | requestId + status | Update `smsLog`, prescription `sms` field |
| `/api/callbacks/subscription/[token]` | subscriberId + status + timeStamp | Check `password` field; mirror status; welcome SMS on REGISTERED. Never log the body's password. |
| `/api/callbacks/ussd/[token]` | sessionId + requestId | Run the USSD state machine and reply with `/ussd/send` (mt-cont / mt-fin). This one waits for the reply instead of using `after()`. |

---

Implementation notes (B5):
- Every callback route is `callbackRoute(type, { schema, dedupeKey, payload, statusOf?, addressOf? })` (`src/server/http/callbacks.ts`). Steps: token check (403 + log, token never logged) → zod → `callbackInbox` insert → one `applinkLog` row with `direction: "in"` → S1000 reply → `processCallback(row)` in `after()`. A duplicate is answered S1000 and not processed again.
- `callbackInbox` keeps two copies. `bodyRedacted` (numbers masked, password/secret/token fields dropped) is for audit. `payload` holds only the fields processing needs (incl. the normalized msisdn), so the process-inbox job can re-run a row. `attempts` and `error` record failures.
- Keyword handling lives in `services/smsmo.ts`. Replies are capped at 6 per number per hour (protects against SMS loops). `PD ALERT` with an unknown upazila number → help SMS. `PD ALERT` sets the mirror to `PENDING_OTP` (the closest `Subscription.status`; B6 confirms it) unless it is already `REGISTERED`. `PD STOP` sets `UNREGISTERED` and calls `subscription/send` action `"0"`. A re-send by SMS shares the 3/day limit with the app's re-send button.
- DLR never downgrades a prescription from `DELIVERED` (a failed re-send must not hide that the first SMS arrived). `smsLog.dlrStatus` always holds the latest raw status.
- Dev route `POST /api/dev/callback { type, body, token? }` (mock only) forwards to the real callback route and passes its HTTP status through.

Implementation notes (B6):
- `services/subscription.ts`: `startSubscription` (OTP purpose `subscribe`, payload `{ crops, upazila }`), `verifySubscription` (→ REGISTERED mirror, `source: "web"`, **and** a `kk_f` session), `stopSubscription` (Applink `subscription/send` action `"0"` → UNREGISTERED; a transport error or E1303 surfaces as an error so the farmer can retry, other E-codes are taken as "already unsubscribed"), `getSubscription`, `subscribeBySms` (PD ALERT: action `"1"`, status from Applink's answer, crops merged), `applySubscriptionNotification`.
- `GET /api/subscription` returns `null` (200) when signed out, so `SessionProvider` needs no 401 handling.
- Notification callback: `callbackRoute` gained `authorize(body)`. The subscription route checks `password` against `APPLINK_PASSWORD` (constant-time; in mock mode with no password set, `"dev"`). On failure → 403 and the body is logged with the password dropped and the number masked. Nothing is stored. The dedupe key uses a hash of `subscriberId` + status + timeStamp. Status mapping: `REGISTERED` → REGISTERED; `UNREG/BLOCK/DELETE/INACTIVE/CANCEL…` → UNREGISTERED; anything else → PENDING_OTP. Applink's `frequency` is stored as `billingFrequency` (our `frequency` is the alert frequency). A notification with an older `timeStamp` than the last applied one is ignored. A number first seen in a notification gets `crops: []`, `upazila: ""`.
- The welcome SMS ("…PD STOP…") is sent once per number ever (`welcomedAt` claimed atomically), from whichever path registers first (web verify, PD ALERT or notification).

Implementation notes (B7):
- `src/server/ussd/tree.ts` is a server copy of the simulator page's tree and texts. RESULT/OTP_WAIT nodes also carry the disease code and paymentId. All FIN/status texts live in `MSG`. Prices come from settings. `npm test` (`tests/ussd.test.ts`, node:test via tsx) checks every screen is ≤ 160 plain-ASCII chars, including at prices up to Tk999.
- `services/ussd.ts` `handleUssd()`: the stack is stored in `ussdSessions` (TTL 120 s, deleted at FIN). "0" = back, "00" = MAIN. Invalid input → "Vul input." + the same screen. In SYMPTOM, any unmatched input → UNSURE (same as the page). The ALERT upazila number must exist in `UPAZILAS`.
- **Resume:** on a fresh dial, the latest `channel: "ussd"` payment in OTP_SENT with an unexpired `otpExpiresAt` (5 min) resumes at "Ager payment baki. / code din" on the same correlator. No separate per-msisdn store is needed. RESULT 1 → `createUssdDiagnosis` (CONFIDENT, `top3 [{code, p: 1}]`, `modelVersion "ussd-tree"`) → `initiatePayment`. RESULT 2 → UNCERTAIN USSD diagnosis → `requestReview` (free). Menu 5 → re-send the caller's latest prescription (shares the 3/day limit). ALERT → `subscribeBySms(…, "ussd")`.
- Callback `/api/callbacks/ussd/[token]`: inbox (dedupe `sessionId:requestId`) → `handleUssd` → `ussd/send` (mt-cont/mt-fin, same sessionId) → S1000. No `after()`. A non-Banglalink caller gets an mt-fin notice.
- `POST /api/ussd/simulate` runs **only with `APPLINK_MODE=mock`** (404 otherwise). In live mode the mock charging notification would unlock a prescription without a real charge. The msisdn comes from the farmer session, else the body, else the demo number `8801900000001`. When a code is accepted, it waits ≤ 6 s for the payment to reach FULFILLED, so `log` shows debit → verify → notification → SMS. The mock charging notification now starts immediately (with `after()` only keeping the function alive), so a caller in the same request can wait for it.

Implementation notes (B8):
- `dealers.status` uses the admin `DealerRow` values `active | paused | flagged` (was `active|suspended|pending`). **Paused → 403** on `/api/dealer/*` (except logout), and also on diagnose / answer / review / pay when the request carries a paused dealer's `kk_d` (`dealerActor()`). Flagged dealers keep working; admins review them.
- Onboarding: OTP via the dealer Applink app (`otpRequests.app = "dealer"`). Verifying an existing number updates its shop name/upazila and keeps its DLR id. A paused number can't re-onboard. New dealers: `DLR-xxx`, `commissionRate 0.3`, `kk_d` 30 days. `/api/dealer/me` returns the full number to the dealer themself (the profile page masks it).
- Attribution: diagnose → `dealerId` + `channel: "dealer"` (rate limit 30/min per dealer). Pay → dealer attribution, the dealer Applink app and `channel: "dealer"` **only when the diagnosis is that dealer's own**. A dealer's diagnosis can be paid only with that dealer's cookie or by its farmer owner (else 404). Answer/review: the owner farmer or the owner dealer.
- Commission: inserted in the settle transaction (unique `paymentId`). `amount = payment.amount × settings.revenueShare × dealer.commissionRate`, rounded to 0.01, using the amount actually charged. `month` is Dhaka time. `prescription.dealerShop` comes from the dealer doc at settle time.
- Stats: Dhaka-time day/month boundaries. `todayCommission/monthCommission` come from the ledger, sales counts from prescriptions, `monthDiagnoses` from diagnoses. `lastPayout` is `null` until a ledger row has `paidOut: true` (`paidOutAt` added for B9 payouts). `daily` = 14 values, oldest first.
- Sales: from dealer payments. PAID/FULFILLED → `PAID` (or `DELIVERED` once the DLR says so), FAILED → `FAILED`, DISPUTED/REFUNDED_MANUAL → `DISPUTED`. Unfinished payments are not listed. A failed sale has no prescription, so its `ref` is the payment id. Commission shows only on PAID/DELIVERED. Max 100, newest first.

## 7. Applink client (Fixie)

```ts
// src/server/applink/client.ts (shape)
import "server-only";
import { ProxyAgent } from "undici";
const dispatcher = env.FIXIE_URL ? new ProxyAgent(env.FIXIE_URL) : undefined;
export async function applink<T>(path: ApplinkPath, body: object, opts?: { app?: "farmer" | "dealer"; scenario?: Scenario }): Promise<T>
```
- `APPLINK_MODE=mock` → `applink/mock.ts` returns realistic responses that follow the demo scenario (P1003 on debit, E1308 on low balance, wrong code on attempt 1, etc.) and, for a successful verify, fires the charging notification to our own callback after 2 s. `APPLINK_MODE=live` → real call through Fixie.
- Adds `applicationId` + `password` (farmer app, or dealer app when `opts.app === "dealer"`; dealer creds fall back to the farmer app if unset).
- Success **only** when `statusCode === "S1000"` (or `P1003` for debit). HTTP 200 with an `E…` code is an error (AT-7). Map E1308 (low balance), E1303 (IP not allowed), E1337 (already exists → settle from notification), OTP errors.
- Writes one `applinkLog` row per call (masked number, status, ms). That's the admin live log.
- Never automatic debit retries. Timeout 10 s.
- Contracts: `docs/APPLINK_CONTRACTS.md` (copied from System Design §5 and SRS §5).

Implementation notes (B1):
- Live calls use undici's own `fetch` with the `ProxyAgent`, not the global `fetch`, because Node's bundled undici and the npm `undici` package versions differ. undici 8 needs Node ≥ 22.19 (`engines` in `package.json`).
- `applinkLog.api` values: `caas | sms | ussd | otp | sub`, plus `mode: live|mock`.
- Mock `wrong_once` counts attempts in `rateLimits` (key `mock-caas-otp:<referenceNo>`) so it works across serverless instances. The mock charging notification looks up the debit in memory first, then in `payments` by `requestCorrelator`, and is sent with `after()`.
- `callbackToken()` falls back to `"dev"` when `CALLBACK_TOKEN` is unset outside production and live mode.
- Dev route `POST /api/dev/applink` `{ path, body, app?, scenario? }` 404s unless `APPLINK_MODE=mock`.

---

## 8. Sessions and auth

| Who | How they sign in | Cookie | Lifetime |
|---|---|---|---|
| Farmer | Applink OTP once (`/otp/request` → `/otp/verify`) | `kk_f` | 90 days |
| Dealer | Applink OTP on the dealer app at onboarding | `kk_d` | 30 days |
| Admin/agronomist/analyst/dealer_manager | email + bcrypt password + TOTP (otplib), accounts made with `scripts/create-admin.ts` | `kk_a` | 12 hours |

Cookies are httpOnly, Secure, SameSite=Lax, holding a random token. Mongo stores its SHA-256 in `sessions`. Mutating routes check `Origin` matches `NEXT_PUBLIC_APP_URL`.

Implementation notes (B3):
- `src/server/auth/session.ts`: `createSession / readSession / destroySession / destroyAllSessions`, plus `optionalFarmer / requireFarmer / optionalDealer / requireDealer / requireAdmin(roles)`. Secure is set only when `NODE_ENV=production`. `SESSION_PEPPER` falls back to a fixed dev value outside production.
- OTP (`services/identity.ts`): each verify claims an attempt atomically before calling Applink, so parallel guesses can't beat the 3-attempt limit. A successful code is single-use (the `otpRequests` doc is deleted). An unknown, used or expired `requestId` → 410 `EXPIRED`. Every Applink `E…` code on verify except `E1303` counts as a wrong code. A non-`REGISTERED` result → 409 `NOT_REGISTERED`. `otpRequests.app` records which Applink app sent the code, so verify uses the same one.
- Rate-limit keys for numbers use a SHA-256 prefix, not the number.
- `GET /api/me` also returns `msisdnLocal` (01… form), to the signed-in owner only.
- Diagnosis ownership: diagnose/review attach `userId` from `kk_f`. Answer/review on a diagnosis owned by another user → 404. Anonymous diagnoses stay open. GET stays open (no PII in a diagnosis). Diagnose is also rate-limited per user (10/min).

A payment does **not** need a farmer session (a farmer can pay for a number they type). But the prescription page needs the farmer session for that number, or the dealer session that sold it. A farmer who scans the dealer QR without a session is asked to verify first, then sees it.

---

## 9. Scheduled jobs

| Job | Trigger | Does |
|---|---|---|
| `expire-payments` | GitHub Actions every 15 min | OTP_SENT older than 5 min → EXPIRED; VERIFYING older than 15 min → flagged for admin |
| `sms-retry` | every 15 min | Retry failed SMS (max 3, backoff) |
| `send-alerts` | every 15 min, sends only 07:00–09:00 Dhaka | Fan out scheduled alerts to subscribers of that crop + upazila, max 2 per crop per week |
| `process-inbox` | every 15 min | Safety net: any `callbackInbox` row without `processedAt` |
| `reconcile` | Vercel Cron daily 02:00 Dhaka | `getSubscriberChargingInfo` in batches of 10; fix the mirror |

Each job checks `Authorization: Bearer ${JOBS_SECRET}` and processes ≤ 50 items per run.

Implementation notes (B11):
- Auth: `Bearer <JOBS_SECRET>` or `Bearer <CRON_SECRET>` (Vercel Cron sends its own secret, with GET), compared in constant time; anything else → 401. Outside production with neither set, `Bearer dev` works. Routes accept GET and POST. Response: `{ processed, remaining, …counts }`. Code: `src/server/http/jobs.ts`, `src/server/services/jobs.ts`.
- `expire-payments`: OTP_SENT with `otpExpiresAt` ≤ now → EXPIRED (the 5-min OTP window). VERIFYING with `verifiedAt` > 15 min ago → `payments.needsAttentionAt` (+ a warning log); they already show under the admin "attention" filter.
- `sms-retry`: smsLog FAILED, `retries` < 3, `nextRetryAt` ≤ now. The row is claimed first (nextRetryAt pushed 2 min), so overlapping runs can't double-send. Backoff before retries 1/2/3: 5/15/60 min; after the 3rd failure `nextRetryAt` is removed. `smsLog.app` records which Applink app sent it, and the retry uses the same one.
- `send-alerts`: only 07:00–09:00 Dhaka (`?force=1` skips that outside production, for testing). New collection **`alertDeliveries`** (`_id` = `<alertId>:<msisdn>`, outcome sent/failed/capped, TTL 60 d): a row is inserted BEFORE each SMS, so a crashed or overlapping run never double-sends and the next run resumes. The weekly cap counts sent + failed deliveries for that crop in the last 7 days (rolling); over the cap → `capped`, no SMS. The text follows `users.lang` when the number has an account, else Bangla. An alert lease (`alerts.lockUntil`, 3 min) keeps two runs off the same alert. When no recipient is left the alert becomes `sent` with `sentAt` and `delivered`.
- `process-inbox`: rows without `processedAt`, received > 1 min ago, fewer than 5 attempts (a poison row stops being retried and stays visible). Processors are idempotent, so overlapping with a still-running `after()` is safe.
- `reconcile`: REGISTERED/PENDING_OTP numbers not reconciled in 24 h, oldest first, 10 in parallel, max 50 per run. With one Vercel cron a day that covers 50 numbers a day; add `reconcile` to the GitHub workflow matrix once there are more subscribers (it is a cheap no-op when nothing is stale).
- Rate limits: diagnose 10/min per IP + 30/day per IP (dealer sessions: 30/min + 300/day per dealer instead of the IP day cap, since a shop diagnoses for many farmers) + 10/min and 30/day per farmer; OTP 3/10 min per number; pay 5/10 min per number; admin sign-in 5 failures/15 min per IP. 429 body `{ error: { code: "RATE_LIMITED", message, retryAfter } }` plus a `Retry-After` header. Windows are fixed (UTC-aligned).
- `x-kk-scenario` is ignored (with a warning) if `NEXT_PUBLIC_DEMO_MODE=true` while `APPLINK_MODE=live`; env.ts already rejects that combination, this is a second guard.
- Outbound Applink bodies are built only in `src/server/applink/bodies.ts`; `scripts/contract-test.ts` posts each one to `tools/mock-applink.mjs` (started with `PORT`, or `MOCK_APPLINK_URL` for a running one) and skips if the file is missing.

---

## 10. Environment variables

```
# App
NEXT_PUBLIC_APP_URL=https://kaththokra.vercel.app
NEXT_PUBLIC_DEMO_MODE=false          # true shows Demo controls (and requires mock modes below)
# MongoDB
MONGODB_URI=
MONGODB_DB=kaththokra
# Gemini
GEMINI_MODE=live                     # live | mock
GEMINI_API_KEY=
GEMINI_MODEL=                        # current stable Flash on the free tier
GEMINI_FALLBACK_MODEL=               # Flash-Lite
# Applink
APPLINK_MODE=mock                    # mock | live
APPLINK_BASE_URL=https://api.applink.com.bd
APPLINK_APP_ID=
APPLINK_PASSWORD=
APPLINK_DEALER_APP_ID=               # optional second app for dealers
APPLINK_DEALER_PASSWORD=
FIXIE_URL=                           # http://fixie:<token>@<host>:80
CALLBACK_TOKEN=                      # long random string, part of every callback URL
# Secrets
JOBS_SECRET=
CRON_SECRET=                         # optional: set by Vercel for its cron; also accepted by /api/jobs/*
SESSION_PEPPER=
```
Validation (`src/server/env.ts`): `MONGODB_URI` is always required. Gemini key/model are required only with `GEMINI_MODE=live`. Applink app id/password, `FIXIE_URL` and `CALLBACK_TOKEN` are required only with `APPLINK_MODE=live`. `JOBS_SECRET`, `SESSION_PEPPER` and `CALLBACK_TOKEN` are required when `NODE_ENV=production` (this includes `next start` locally). `NEXT_PUBLIC_DEMO_MODE=true` together with a live mode is rejected. Defaults: `GEMINI_MODE=mock`, `APPLINK_MODE=mock`, `MONGODB_DB=kaththokra`, `NEXT_PUBLIC_APP_URL=http://localhost:3000`.

Callback URLs to register in the Applink portal: `https://kaththokra.vercel.app/api/callbacks/<type>/<CALLBACK_TOKEN>`.

---

## 11. Build order

Backend first, then credentials, then API testing, then frontend wiring. Each step has a prompt in `kaththokra-backend-prompts.md`. During phase A no page changes, so the mock frontend keeps working.

| Phase | Step | What |
|---|---|---|
| A. Backend | B0 | Foundation: deps, env, Mongo, handler, errors, `/api/health`, `/api/config`, KB seed, indexes, Applink contracts doc |
| | B1 | Applink client through Fixie + mock mode + `applinkLog` + smoke script |
| | B2 | Diagnosis API (Gemini): diagnose, get, answer, review |
| | B3 | Identity API: OTP verify, sessions, `/api/me` |
| | B4 | Payment + prescriptions API, CaaS charging-notification callback, prescription SMS |
| | B5 | Callback inbox, SMS-MO keywords, DLR |
| | B6 | Subscription API + notify callback |
| | B7 | USSD callback + simulate endpoint |
| | B8 | Dealer API: onboarding, attribution, commission, stats, sales |
| | B9 | Admin API: auth (password + TOTP), KPIs, live log, review, payments, dealers, subscribers |
| | B10 | Admin API: alerts, heatmap, KB workflow, model/eval, team, settings |
| | B11 | Jobs (cron), rate limits, security pass, contract test |
| B. Credentials | — | Atlas, Gemini key, secrets, Fixie, Applink portal (allowed IPs + callback URLs), `.env.local`, Vercel, GitHub secret; seed + create admin |
| C. API testing | T1 | `tests/api.http`, Postman collection, `scripts/api-e2e.ts` covering every flow in mock mode; then live checks |
| D. Frontend wiring | F1 | apiFetch, ConfigProvider, server-backed sessions, Demo panel flag |
| | F2 | Diagnosis pages (photo upload, 1024 px, consent text, crop mismatch, PD-482193 bug) — rows 3–10, 35–36 |
| | F3 | Verify, payment, prescriptions; paid fields removed from the client — rows 2, 11–20, 30 |
| | F4 | Alerts + USSD simulator — rows 21–22, 26 |
| | F5 | Dealer pages + QR / shop-name / home-link bugs — rows 33–40 |
| | F6 | Admin console — rows 41–56 |
| | F7 | Cleanup, privacy text, README, full checklist |

---

## 12. Go-live checklist (before judging)

- [ ] `APPLINK_MODE=live`, both Fixie IPs in Applink's allowed hosts, `scripts/applink-smoke.ts` passes (no E1303).
- [ ] All 5 callback URLs registered with the right `CALLBACK_TOKEN`.
- [ ] Real Banglalink SIM: web diagnose → pay ৳5 → SMS arrives (AT-1, AT-2).
- [ ] Wrong code twice then right → one charge (AT-3). Duplicate notification → one SMS (AT-4).
- [ ] USSD on a second phone (AT-8).
- [ ] Alert opt-in and `PD STOP` (AT-10, AT-11).
- [ ] Dealer sale shows commission (AT-13). Admin dashboard matches the ledger (AT-14).
- [ ] Gemini eval run on real photos; gate set in Settings.
- [ ] A second Vercel deployment (or env flip) with `NEXT_PUBLIC_DEMO_MODE=true` + mock modes, as the stage fallback.
