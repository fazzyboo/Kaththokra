"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/farmer/Shell";
import { Button, LinkButton } from "@/components/ui/Button";
import { Badge, EmptyState, KeyValue, Notice, Panel, Steps } from "@/components/ui/Display";
import { Field, OtpInput, PhoneInput } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";
import { getDiagnosis, getPayment, initiatePayment, newPrescriptionRef, savePrescription, submitPaymentOtp } from "@/lib/api";
import type { PayInit } from "@/lib/api";
import { HELPLINE, PRICE_RX, cropName, disease } from "@/lib/data";
import { useT } from "@/lib/i18n";
import { maskMsisdn, normalizeMsisdn } from "@/lib/phone";
import { useSession } from "@/lib/session";
import type { Diagnosis } from "@/lib/types";

type Stage = "number" | "otp" | "verifying" | "paid" | "low_balance" | "expired" | "locked" | "timeout";

const OTP_TTL_S = 5 * 60; // 5 minutes on the same correlator (PAY-5)
const MAX_ATTEMPTS = 3;
const POLL_EVERY_MS = 2000; // PAY-9
const POLL_FOR_MS = 60000;

/**
 * CaaS payment, two calls (SRS PAY-1…PAY-9):
 *   /caas/direct/debit → P1003 + correlator → user enters code → /caas/otp/verify
 *   → poll until the charging notification (S1000) marks the payment PAID.
 * In dealer mode the code goes to the farmer's phone (DLR-2).
 */
export function PaymentFlow({ diagnosisId, dealer, resultBase }: { diagnosisId: string; dealer?: boolean; resultBase: string }) {
  const { t, tk, d } = useT();
  const { msisdn, scenario, unlock } = useSession();
  const [dx, setDx] = useState<Diagnosis | null | undefined>(undefined);
  const [stage, setStage] = useState<Stage>("number");
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [init, setInit] = useState<PayInit | null>(null);
  const [code, setCode] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(OTP_TTL_S);
  const [rxRef, setRxRef] = useState<string | null>(null);
  const pollStart = useRef(0);

  useEffect(() => {
    setDx(getDiagnosis(diagnosisId) ?? null);
  }, [diagnosisId]);

  useEffect(() => {
    if (!dealer && msisdn) setPhone(msisdn.slice(2));
  }, [dealer, msisdn]);

  // OTP countdown; "expired" demo scenario shortens it so the state can be shown live.
  useEffect(() => {
    if (stage !== "otp") return;
    const id = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          window.clearInterval(id);
          setStage("expired");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [stage]);

  const normalized = normalizeMsisdn(phone);
  const dis = dx?.top3[0] ? disease(dx.top3[0].code) : undefined;

  const startDebit = async () => {
    setTouched(true);
    if (!normalized) return;
    setBusy(true);
    const res = await initiatePayment(diagnosisId, normalized);
    setBusy(false);
    setInit(res);
    setCode("");
    setAttempts(0);
    setCodeError(null);
    setSecondsLeft(scenario.payment === "expired" ? 8 : OTP_TTL_S);
    setStage("otp");
  };

  const finish = useCallback(() => {
    const ref = newPrescriptionRef();
    if (dx && dis && normalized) {
      savePrescription({
        ref,
        diagnosisId: dx.id,
        diseaseCode: dis.code,
        crop: dx.crop,
        paidAt: new Date().toISOString(),
        amount: PRICE_RX,
        msisdn: normalized,
        kbVersion: dis.kbVersion,
        modelVersion: dx.modelVersion,
        sms: "SENT",
        channel: dealer ? "dealer" : "web",
        dealerShop: dealer ? "Ma Krishi Bitan" : undefined,
        receiptId: `REF-${Math.floor(1000 + Math.random() * 8999)}`,
      });
    }
    unlock(diagnosisId);
    setRxRef(ref);
    setStage("paid");
  }, [dx, dis, normalized, dealer, unlock, diagnosisId]);

  const poll = useCallback(async () => {
    pollStart.current = Date.now();
    let count = 0;
    while (Date.now() - pollStart.current < POLL_FOR_MS) {
      const s = await getPayment(scenario.payment, count++);
      if (s === "PAID") return finish();
      await new Promise((r) => setTimeout(r, POLL_EVERY_MS));
    }
    setStage("timeout");
  }, [scenario.payment, finish]);

  const submitCode = async () => {
    if (code.length !== 6) return;
    setBusy(true);
    setCodeError(null);
    const attempt = attempts + 1;
    const res = await submitPaymentOtp(scenario.payment, attempt);
    setBusy(false);
    setAttempts(attempt);
    if (res === "wrong") {
      if (attempt >= MAX_ATTEMPTS) return setStage("locked");
      setCode("");
      setCodeError(
        t(`কোড মেলেনি। আর ${d(String(MAX_ATTEMPTS - attempt))} বার চেষ্টা করতে পারবেন।`, `That code didn't match. ${MAX_ATTEMPTS - attempt} tries left.`),
      );
      return;
    }
    if (res === "E1308") return setStage("low_balance");
    setStage("verifying");
    void poll();
  };

  if (dx === undefined) return null;
  if (dx === null || !dis || dx.status !== "CONFIDENT" || dis.healthy)
    return (
      <EmptyState
        icon="lock"
        title={t("এই ফলাফলের জন্য পেমেন্ট নেই", "No payment for this result")}
        body={t("শুধু নিশ্চিত ফলাফলের প্রেসক্রিপশন কেনা যায়। অনিশ্চিত ফলে কখনো টাকা কাটা হয় না।", "Only confident results can be unlocked. Uncertain results are never charged.")}
        action={<LinkButton href={resultBase}>{t("নতুন নির্ণয়", "New diagnosis")}</LinkButton>}
      />
    );

  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const stepIdx = stage === "number" ? 0 : stage === "otp" || stage === "verifying" ? 1 : 2;

  return (
    <div>
      <PageHeader
        back={stage === "number" ? `${resultBase}/${diagnosisId}` : undefined}
        title={stage === "paid" ? t("পেমেন্ট সম্পন্ন", "Payment complete") : t("প্রেসক্রিপশন কিনুন", "Unlock prescription")}
      />
      {stage !== "paid" ? <Steps steps={[t("নম্বর", "Number"), t("কোড", "Code"), t("প্রেসক্রিপশন", "Prescription")]} current={stepIdx} /> : null}

      {/* Price is shown before any action (PAY-1, BR R-1) */}
      <Panel className="mt-5 px-4">
        <KeyValue
          rows={[
            { k: t("রোগ", "Disease"), v: `${t(dis.name)} (${t(cropName(dx.crop))})` },
            { k: t("যা পাবেন", "You get"), v: t("ওষুধ, মাত্রা ও সময় — SMS-এ", "Spray, dose and timing by SMS") },
            { k: t("মূল্য", "Price"), v: <span className="text-lg">{tk(PRICE_RX)}</span> },
          ]}
        />
      </Panel>

      {stage === "number" ? (
        <section className="mt-6 space-y-5">
          <Field
            htmlFor="pay-phone"
            label={dealer ? t("কৃষকের বাংলালিংক নম্বর", "Farmer's Banglalink number") : t("আপনার বাংলালিংক নম্বর", "Your Banglalink number")}
            hint={dealer ? t("কোড কৃষকের ফোনে যাবে। কৃষক নিজে কোড বলবেন বা লিখবেন।", "The code goes to the farmer's phone. The farmer reads or types it.") : t("টাকা এই নম্বরের ব্যালেন্স থেকে কাটা হবে", "Charged to this number's balance")}
            error={touched && !normalized ? t("সঠিক বাংলালিংক নম্বর দিন (০১৯ বা ০১৪ দিয়ে শুরু, ১১ অঙ্ক)", "Enter a valid Banglalink number (starts 019 or 014, 11 digits)") : undefined}
          >
            <PhoneInput id="pay-phone" value={phone} onChange={setPhone} invalid={touched && !normalized} autoFocus />
          </Field>
          <Button size="lg" block icon="sms" loading={busy} onClick={startDebit}>
            {dealer ? t("কৃষকের ফোনে কোড পাঠান", "Send code to farmer") : t("কোড পাঠান", "Send me a code")}
          </Button>
          <p className="text-center text-sm text-ink-3">{t("কোড দেওয়ার আগে কোনো টাকা কাটা হবে না।", "Nothing is charged until the code is entered.")}</p>
        </section>
      ) : null}

      {stage === "otp" && init && normalized ? (
        <section className="mt-6 space-y-5">
          <div>
            <p className="text-[1.02rem]">
              {dealer
                ? t(`কৃষকের ${d(maskMsisdn(normalized))} নম্বরে ৬ অঙ্কের কোড গেছে। কৃষককে কোডটি বলতে বলুন।`, `A 6-digit code went to the farmer's ${maskMsisdn(normalized)}. Ask the farmer for it.`)
                : t(`${d(maskMsisdn(normalized))} নম্বরে SMS-এ ৬ অঙ্কের কোড পাঠানো হয়েছে।`, `We sent a 6-digit code by SMS to ${maskMsisdn(normalized)}.`)}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-3">
              <Icon name="clock" size={16} />
              {t(`কোডের মেয়াদ ${d(`${mm}:${ss}`)} মিনিট`, `Code valid for ${mm}:${ss}`)}
            </p>
          </div>
          <OtpInput label={t("কোড", "Code")} value={code} onChange={setCode} invalid={!!codeError} autoFocus disabled={busy} />
          {codeError ? <Notice tone="alarm">{codeError}</Notice> : null}
          <Button size="lg" block disabled={code.length !== 6} loading={busy} onClick={submitCode}>
            {t(`কোড দিন ও ${tk(PRICE_RX)} দিন`, `Confirm and pay ${tk(PRICE_RX)}`)}
          </Button>
          <button onClick={() => setStage("number")} className="w-full text-center text-sm text-ink-3 underline underline-offset-2">
            {t("নম্বর বদলান", "Change number")}
          </button>
        </section>
      ) : null}

      {stage === "verifying" ? (
        <section className="mt-10 flex flex-col items-center text-center" aria-live="polite">
          <span className="relative flex h-16 w-16 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-leaf-100" />
            <Icon name="wallet" size={30} className="relative text-leaf-700" />
          </span>
          <p className="mt-5 font-display text-xl">{t("বাংলালিংক থেকে নিশ্চিতকরণের অপেক্ষা…", "Waiting for Banglalink to confirm…")}</p>
          <p className="mt-1.5 max-w-xs text-sm text-ink-2">{t("সাধারণত কয়েক সেকেন্ড লাগে। এই পাতা বন্ধ করবেন না।", "Usually a few seconds. Keep this page open.")}</p>
        </section>
      ) : null}

      {stage === "paid" && rxRef ? (
        <section className="mt-6" aria-live="polite">
          <div className="flex items-center gap-3 rounded-2xl bg-leaf-50 px-4 py-4 text-leaf-900">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-leaf-600 text-white">
              <Icon name="check" size={22} />
            </span>
            <div>
              <p className="font-semibold">{t(`${tk(PRICE_RX)} পরিশোধ হয়েছে`, `${tk(PRICE_RX)} paid`)}</p>
              <p className="text-sm">
                {dealer ? t("প্রেসক্রিপশন কৃষকের ফোনে SMS-এ যাচ্ছে", "Prescription is on its way to the farmer by SMS") : t("প্রেসক্রিপশন SMS-এ যাচ্ছে", "Prescription is on its way by SMS")}
              </p>
            </div>
          </div>
          <Panel className="mt-4 px-4">
            <KeyValue
              rows={[
                { k: t("রেফারেন্স", "Reference"), v: rxRef },
                ...(dealer ? [{ k: t("কমিশন", "Commission"), v: <Badge tone="leaf">{t("যোগ হয়েছে", "Added")}</Badge> }] : []),
              ]}
            />
          </Panel>
          <div className="mt-5 grid gap-3">
            <LinkButton href={dealer ? `/dealer/share/${rxRef}` : `/prescriptions/${rxRef}`} size="lg" block icon={dealer ? "qr" : "file"}>
              {dealer ? t("কৃষককে QR দেখান", "Show QR to farmer") : t("প্রেসক্রিপশন দেখুন", "View prescription")}
            </LinkButton>
            <LinkButton href={dealer ? "/dealer" : "/"} variant="secondary" size="lg" block>
              {dealer ? t("ডিলার হোম", "Dealer home") : t("হোম", "Home")}
            </LinkButton>
          </div>
        </section>
      ) : null}

      {stage === "low_balance" ? (
        <section className="mt-6 space-y-4">
          <Notice tone="alarm" title={t("ব্যালেন্স কম", "Balance kom — not enough balance")}>
            {t(`${tk(PRICE_RX)} কাটার মতো ব্যালেন্স নেই। কোনো টাকা কাটা হয়নি। রিচার্জ করে আবার চেষ্টা করুন।`, `There isn't ${tk(PRICE_RX)} in balance. Nothing was charged. Recharge and try again.`)}
          </Notice>
          <Button size="lg" variant="secondary" block icon="refresh" onClick={() => setStage("number")}>
            {t("আবার চেষ্টা করুন", "Try again")}
          </Button>
        </section>
      ) : null}

      {stage === "expired" ? (
        <section className="mt-6 space-y-4">
          <Notice tone="sun" title={t("কোডের মেয়াদ শেষ", "The code expired")}>
            {t("৫ মিনিটে কোড দেওয়া হয়নি। কোনো টাকা কাটা হয়নি।", "The code wasn't entered within 5 minutes. Nothing was charged.")}
          </Notice>
          <Button size="lg" block icon="sms" loading={busy} onClick={startDebit}>
            {t("নতুন কোড নিন", "Get a new code")}
          </Button>
        </section>
      ) : null}

      {stage === "locked" ? (
        <section className="mt-6 space-y-4">
          <Notice tone="alarm" title={t("৩ বার ভুল কোড", "3 wrong codes")}>
            {t("নিরাপত্তার জন্য এই পেমেন্ট বন্ধ করা হয়েছে। কোনো টাকা কাটা হয়নি।", "This payment was stopped for safety. Nothing was charged.")}
          </Notice>
          <Button size="lg" variant="secondary" block icon="refresh" onClick={() => setStage("number")}>
            {t("নতুন করে শুরু করুন", "Start over")}
          </Button>
        </section>
      ) : null}

      {stage === "timeout" ? (
        <section className="mt-6 space-y-4">
          <Notice tone="neutral" icon="sms" title={t("নিশ্চিত হলে SMS পাবেন", "We'll SMS you")}>
            {t(
              "বাংলালিংকের নিশ্চিতকরণ আসতে দেরি হচ্ছে। টাকা কাটা হলে প্রেসক্রিপশন SMS-এ চলে যাবে; একবারের বেশি কাটা হবে না।",
              "Banglalink's confirmation is slow. If the charge goes through, the prescription arrives by SMS. You'll never be charged twice.",
            )}
          </Notice>
          <LinkButton href={`tel:${HELPLINE}`} variant="secondary" size="lg" block icon="phone">
            {t(`সমস্যা হলে ${d(HELPLINE)}`, `Problems? Call ${HELPLINE}`)}
          </LinkButton>
        </section>
      ) : null}
    </div>
  );
}
