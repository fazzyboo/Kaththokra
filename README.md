# কাঠঠোকরা (Kaththokra) — web frontend

Bangla-first crop-disease diagnosis PWA for Banglalink farmers, agro-dealers and the operations team.
Frontend only: every API call is mocked in `src/lib/api.ts`, with one function per endpoint from SRS v2.0 §5.3.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4. Fonts: Noto Sans Bengali (body) and Tiro Bangla (headings) via `next/font`.
No UI or chart libraries; icons, charts and the QR encoder are hand-written to keep the JS bundle small (SRS WEB-2).

## Demo controls

The sliders icon in the top bar opens **Demo controls**. Use it to choose what the mock backend returns:

- Diagnosis: confident, uncertain, blurry photo, healthy
- Payment: success, wrong code once, low balance (E1308), code expired, slow notification

Shortcuts there jump to the USSD simulator, dealer mode and the admin console.
Admin sign-in accepts any password of 4+ characters and any 6-digit TOTP. OTP codes accept any 6 digits (`000000` = wrong code).

## Pages

### Farmer app (`src/app/(farmer)`)
| Route | What it is | SRS |
|---|---|---|
| `/` | Home: diagnose, prescriptions, alerts, 16123 | WEB-3, WEB-4 |
| `/diagnose` | Crop → photo tips → capture/upload (resized to 512 px, EXIF dropped) → analysing | DX-1, DX-2, DX-8 |
| `/diagnose/[id]` | Result: confident / uncertain / retake / healthy, confidence vs 75% gate, locked treatment, audio read-out | DX-3…DX-6, PAY-1, WEB-5, WEB-6 |
| `/diagnose/[id]/clarify` | Up to 2 symptom questions that re-rank | DX-5 |
| `/diagnose/[id]/review` | Send to agronomist (free) | DX-5, ADM-4 |
| `/pay/[id]` | CaaS: number → code → polling → paid / low balance / expired / 3 wrong codes / "we'll SMS you" | PAY-1…PAY-9 |
| `/prescriptions` | History (number verified once) | ID-1 |
| `/prescriptions/[ref]` | Prescription, SMS preview, receipt, free re-send, print | SMS-1, SMS-3, SMS-4 |
| `/verify` | One-time number verification | ID-1, ID-5 |
| `/alerts` | Opt-in (crop + upazila, price shown, OTP) and one-step opt-out | SUB-1…SUB-3, ID-2 |
| `/help` | 16123, FAQ, USSD steps, SMS keywords | |
| `/diseases`, `/diseases/[code]` | Disease guide (signs only; doses are paid) | |
| `/ussd` | Feature-phone USSD simulator with live Applink call log | §4, USSD-1…USSD-7 |
| `/about`, `/settings`, `/privacy`, `/terms`, `/offline` | Info, language, number, offline shell | WEB-1, WEB-2 |

### Dealer mode (`src/app/dealer`)
| Route | What it is | SRS |
|---|---|---|
| `/dealer/onboard` | Shop details + OTP once → 30-day device sign-in | ID-3 |
| `/dealer` | Today / month commission, 14-day sales, recent sales | DLR-4 |
| `/dealer/diagnose`, `/dealer/diagnose/[id]` (+ clarify, review) | Same diagnosis flow, tagged to the dealer | DLR-1 |
| `/dealer/pay/[id]` | Code goes to the **farmer's** phone | DLR-2, DLR-3 |
| `/dealer/sales` | Sales and commission ledger | DLR-4 |
| `/dealer/share/[ref]` | Scannable QR + reference, print | DLR-6 |
| `/dealer/profile` | Shop info and printable shop poster | |

### Admin console (`src/app/admin`)
| Route | What it is | SRS |
|---|---|---|
| `/admin/login` | Email + password + TOTP | ID-6 |
| `/admin` | KPIs, daily diagnoses, payment funnel, revenue, channel split | ADM-1 |
| `/admin/live-log` | Live Applink requests and callbacks, masked numbers | ADM-2 |
| `/admin/review`, `/admin/review/[id]` | Uncertain cases and disputes → verdict, training label | ADM-4 |
| `/admin/payments` | Ledger, state machine, reconcile, manual refund, CSV | PAY-10, R-10, ADM-7 |
| `/admin/alerts` | Outbreak-suggested alerts, composer with recipient preview | SUB-6…SUB-8 |
| `/admin/heatmap` | Disease × upazila, cells under 5 hidden | ADM-5 |
| `/admin/kb`, `/admin/kb/[code]` | Knowledge base: draft → review → approved → published, SMS length check, brand check | ADM-3, R-6, R-7 |
| `/admin/model` | Live vs shadow model, macro-F1, calibration, per-class metrics | NFR-2 |
| `/admin/dealers` | Commission, fraud flag (> 30% to the same 5 numbers), CSV | DLR-5, ADM-7 |
| `/admin/subscribers` | Subscription mirror and reconciliation | SUB-4, SUB-5 |
| `/admin/team`, `/admin/settings` | Roles; prices (৳2–10, ৳1–70), confidence gate | ADM-6, R-1 |

## Wiring the real backend

Replace the function bodies in `src/lib/api.ts` with `fetch` calls to the FastAPI service; the pages only call those functions.
Session state (`src/lib/session.tsx`) is localStorage for the demo; in production it comes from the 90-day cookie, the dealer JWT and the staff session.

The old Oracle-VM Applink proxy is archived in `infra/_archive/`; the backend below calls Applink directly through Fixie.

## Backend

Route handlers in `src/app/api/**` (thin: validate, auth, one service call) and all logic in `src/server/**`.
MongoDB Atlas, Gemini for diagnosis, Applink (Banglalink) through the Fixie static-IP proxy.
`docs/BACKEND_PLAN.md` is the source of truth for endpoints, collections and response shapes; `docs/APPLINK_CONTRACTS.md` has the Applink request/response shapes.

### Environment

Copy `.env.example` to `.env.local` and fill it in. Set the same names in Vercel → Settings → Environment Variables.
`src/server/env.ts` validates them on the first request and fails with a list of problems (names only, never values).

| Variable | Needed | What |
|---|---|---|
| `MONGODB_URI`, `MONGODB_DB` | always | Atlas connection string (Network Access must allow `0.0.0.0/0`); database name (default `kaththokra`) |
| `NEXT_PUBLIC_APP_URL` | always | Public base URL; the Origin check on POST/PUT/DELETE uses it in production |
| `NEXT_PUBLIC_DEMO_MODE` | optional | `true` shows the Demo controls; only allowed with both modes on `mock` |
| `GEMINI_MODE` | optional | `mock` (default) or `live` |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL` | `GEMINI_MODE=live` | Google AI Studio key; Flash model; optional Flash-Lite fallback |
| `APPLINK_MODE` | optional | `mock` (default) or `live` |
| `APPLINK_BASE_URL` | optional | default `https://api.applink.com.bd` |
| `APPLINK_APP_ID`, `APPLINK_PASSWORD` | `APPLINK_MODE=live` | Farmer app credentials |
| `APPLINK_DEALER_APP_ID`, `APPLINK_DEALER_PASSWORD` | optional | Dealer app; falls back to the farmer app |
| `FIXIE_URL` | `APPLINK_MODE=live` | `http://fixie:<token>@<host>:80`; put **both** Fixie IPs in Applink's allowed hosts |
| `CALLBACK_TOKEN` | live + production | Long random string, part of every callback URL |
| `JOBS_SECRET` | production | Bearer token for `/api/jobs/*` (GitHub Actions) |
| `CRON_SECRET` | optional | Set by Vercel for its cron calls; also accepted by `/api/jobs/*` |
| `SESSION_PEPPER` | production | Mixed into session-token hashes |

Generate each secret with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
Never put a secret in a `NEXT_PUBLIC_` variable: those reach the browser.

### First run

```bash
npm install
npm run indexes                 # create every MongoDB index (safe to re-run)
npm run seed                    # settings + knowledge base; --force overwrites admin edits
KK_ADMIN_PASSWORD='…' npm run create-admin -- you@example.com "Your Name" admin
npm run dev
```

`create-admin` prints an `otpauth://` URL once: add it to an authenticator app. Re-running it for the same email resets the password and the TOTP secret.
Roles: `admin`, `agronomist`, `analyst`, `dealer_manager`.

Other scripts: `npm run applink-smoke -- 019XXXXXXXX [--ip]` (Fixie + allow-list check; sends a real OTP in live mode),
`npm run eval-gemini -- <folder>` (accuracy on labelled photos), `npm run contract-test` (outbound Applink bodies against `tools/mock-applink.mjs`; skips if that file is missing),
`npm test`, `npm run typecheck`.

### Mock vs live

- **Mock** (default): nothing leaves the server. Gemini and Applink answers follow the Demo controls scenario (`x-kk-scenario` header). Callbacks can be simulated with `POST /api/dev/callback` and USSD with `/api/ussd/simulate`. The OTP code is `123456`.
- **Live**: `GEMINI_MODE=live` and/or `APPLINK_MODE=live`. The scenario header is ignored for live parts. Real SMS and real charges happen.
- `NEXT_PUBLIC_DEMO_MODE=true` is rejected together with a live mode.
- `/api/health` reports the database status and the two modes.

### Applink callback URLs

Register these in the Applink portal, with your `CALLBACK_TOKEN` in place of `<token>`:

```
https://kaththokra.vercel.app/api/callbacks/caas/<token>           CaaS charging notification
https://kaththokra.vercel.app/api/callbacks/sms-mo/<token>         SMS MO (PD keywords)
https://kaththokra.vercel.app/api/callbacks/sms-dlr/<token>        SMS delivery reports
https://kaththokra.vercel.app/api/callbacks/subscription/<token>   Subscription notification
https://kaththokra.vercel.app/api/callbacks/ussd/<token>           USSD session
```

A wrong token gets 403. Every callback is stored in `callbackInbox` first, answered `S1000`, then processed.

### Scheduled jobs

| Job | Schedule | Does |
|---|---|---|
| `/api/jobs/expire-payments` | GitHub Actions, every 15 min | OTP_SENT past expiry → EXPIRED; VERIFYING > 15 min → flagged for an admin |
| `/api/jobs/sms-retry` | every 15 min | Resend failed SMS (max 3; 5 / 15 / 60 min backoff) |
| `/api/jobs/send-alerts` | every 15 min, sends only 07:00–09:00 Dhaka | Approved alerts → registered subscribers of that crop + upazila, max 2 per crop per week |
| `/api/jobs/process-inbox` | every 15 min | Re-run callbacks not processed after 1 min |
| `/api/jobs/reconcile` | Vercel Cron, 20:00 UTC (02:00 Dhaka) | Check subscriptions against Applink, 10 at a time |

Each job needs `Authorization: Bearer <JOBS_SECRET>` (or Vercel's `CRON_SECRET`), handles at most 50 items, is safe to re-run, and returns `{ processed, remaining }`.

```bash
curl -X POST -H "Authorization: Bearer $JOBS_SECRET" https://kaththokra.vercel.app/api/jobs/expire-payments
```

Setup: add `JOBS_SECRET` to Vercel and as a GitHub repository secret (Settings → Secrets and variables → Actions) for `.github/workflows/cron-jobs.yml`.
Vercel sets `CRON_SECRET` itself when the project has crons (`vercel.json`). `.github/workflows/ci.yml` runs typecheck and build on every push and PR.

### Rate limits

Diagnose: 10/min per IP and 30/day per IP or farmer (a dealer session has 30/min and 300/day per dealer instead of the IP day cap). OTP: 3 per 10 min per number. Payment: 5 per 10 min per number. Admin sign-in: 5 failed attempts per 15 min per IP.
Over the limit: HTTP 429 `{ "error": { "code": "RATE_LIMITED", "message", "retryAfter" } }` (seconds) and a `Retry-After` header.

## Content note

Treatment text in `src/lib/data.ts` is **sample content** for UI work and is flagged as such on every prescription.
It must be replaced by agronomist-approved KB entries before any real use (BR R-7).
