"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Display";
import { Field, OtpInput, PhoneInput } from "@/components/ui/Form";
import { requestOtp, verifyOtp } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { maskMsisdn, normalizeMsisdn } from "@/lib/phone";
import { useSession } from "@/lib/session";

/**
 * One-time number verification (SRS ID-1): /otp/request → /otp/verify, once per number per
 * device, then a 90-day session. Never used for routine logins (ID-4).
 */
export function NumberVerify({ onDone, cta }: { onDone?: (msisdn: string) => void; cta?: string }) {
  const { t, d } = useT();
  const { verify } = useSession();
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);
  const [ref, setRef] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const normalized = normalizeMsisdn(phone);

  const send = async () => {
    setTouched(true);
    if (!normalized) return;
    setBusy(true);
    const r = await requestOtp(normalized);
    setBusy(false);
    setRef(r.referenceNo);
  };

  const confirm = async () => {
    if (!ref || !normalized) return;
    setBusy(true);
    setError(null);
    const r = await verifyOtp(ref, code);
    setBusy(false);
    if (r === "WRONG") {
      setCode("");
      setError(t("কোড মেলেনি। SMS-এর কোডটি আবার দেখুন।", "That code didn't match. Check the SMS again."));
      return;
    }
    verify(normalized);
    onDone?.(normalized);
  };

  if (!ref)
    return (
      <div className="space-y-4">
        <Field
          htmlFor="v-phone"
          label={t("বাংলালিংক নম্বর", "Banglalink number")}
          error={touched && !normalized ? t("০১৯ বা ০১৪ দিয়ে শুরু ১১ অঙ্কের নম্বর দিন", "Enter an 11-digit number starting 019 or 014") : undefined}
          hint={t("একবারই যাচাই করতে হবে। এই ফোনে ৯০ দিন মনে থাকবে।", "You verify once. This phone remembers you for 90 days.")}
        >
          <PhoneInput id="v-phone" value={phone} onChange={setPhone} invalid={touched && !normalized} />
        </Field>
        <Button size="lg" block icon="sms" loading={busy} onClick={send}>
          {t("কোড পাঠান", "Send code")}
        </Button>
      </div>
    );

  return (
    <div className="space-y-4">
      <p className="text-[1.02rem]">
        {t(`${d(maskMsisdn(normalized ?? ""))} নম্বরে ৬ অঙ্কের কোড পাঠানো হয়েছে।`, `We sent a 6-digit code to ${maskMsisdn(normalized ?? "")}.`)}
      </p>
      <OtpInput label={t("কোড", "Code")} value={code} onChange={setCode} invalid={!!error} autoFocus />
      {error ? <Notice tone="alarm">{error}</Notice> : null}
      <Button size="lg" block disabled={code.length !== 6} loading={busy} onClick={confirm}>
        {cta ?? t("যাচাই করুন", "Verify")}
      </Button>
      <button onClick={() => setRef(null)} className="w-full text-center text-sm text-ink-3 underline underline-offset-2">
        {t("নম্বর বদলান", "Change number")}
      </button>
      <p className="text-center text-xs text-ink-3">{t("ঘণ্টায় সর্বোচ্চ ৩টি কোড পাঠানো যায়।", "Up to 3 codes per hour.")}</p>
    </div>
  );
}
