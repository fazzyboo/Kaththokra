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

## Content note

Treatment text in `src/lib/data.ts` is **sample content** for UI work and is flagged as such on every prescription.
It must be replaced by agronomist-approved KB entries before any real use (BR R-7).
