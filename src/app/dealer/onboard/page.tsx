"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/farmer/Shell";
import { Button } from "@/components/ui/Button";
import { Notice, Steps } from "@/components/ui/Display";
import { Field, OtpInput, PhoneInput, Select, TextInput } from "@/components/ui/Form";
import { requestOtp, verifyOtp } from "@/lib/api";
import { UPAZILAS } from "@/lib/data";
import { useT } from "@/lib/i18n";
import { maskMsisdn, normalizeMsisdn } from "@/lib/phone";
import { useSession } from "@/lib/session";

/** Dealer onboarding: shop details → OTP once → 30-day device token (SRS ID-3, §2.4). */
export default function DealerOnboardPage() {
  const { t, d } = useT();
  const router = useRouter();
  const { setDealer } = useSession();
  const [shop, setShop] = useState("");
  const [upz, setUpz] = useState("SRJ-ULL");
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);
  const [ref, setRef] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const normalized = normalizeMsisdn(phone);

  const send = async () => {
    setTouched(true);
    if (!normalized || shop.trim().length < 2) return;
    setBusy(true);
    const r = await requestOtp(normalized);
    setBusy(false);
    setRef(r.referenceNo);
  };

  const confirm = async () => {
    if (!ref || !normalized) return;
    setBusy(true);
    const r = await verifyOtp(ref, code);
    setBusy(false);
    if (r !== "REGISTERED") return;
    setDealer({ shopName: shop.trim(), upazila: upz, msisdn: normalized, dealerId: `DLR-${Math.floor(100 + Math.random() * 899)}` });
    router.replace("/dealer");
  };

  return (
    <div>
      <PageHeader
        title={t("ডিলার হিসেবে যোগ দিন", "Join as a dealer")}
        subtitle={t(
          "কৃষকের পাতার ছবি তুলে রোগ নির্ণয় করুন। প্রতিটি বিক্রিত প্রেসক্রিপশনে কমিশন পাবেন।",
          "Diagnose leaves for farmers at your shop. Earn commission on every prescription sold.",
        )}
      />
      <Steps steps={[t("দোকান", "Shop"), t("কোড", "Code")]} current={ref ? 1 : 0} />

      {!ref ? (
        <div className="mt-6 space-y-5">
          <Field label={t("দোকানের নাম", "Shop name")} htmlFor="shop" error={touched && shop.trim().length < 2 ? t("দোকানের নাম দিন", "Enter your shop name") : undefined}>
            <TextInput id="shop" value={shop} onChange={(e) => setShop(e.target.value)} placeholder={t("যেমন: মা কৃষি বিতান", "e.g. Ma Krishi Bitan")} />
          </Field>
          <Field label={t("উপজেলা", "Upazila")} htmlFor="d-upz">
            <Select id="d-upz" value={upz} onChange={(e) => setUpz(e.target.value)}>
              {UPAZILAS.map((u) => (
                <option key={u.code} value={u.code}>
                  {t(u.name)}, {t(u.district)}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={t("আপনার বাংলালিংক নম্বর", "Your Banglalink number")}
            htmlFor="d-phone"
            error={touched && !normalized ? t("০১৯ বা ০১৪ দিয়ে শুরু ১১ অঙ্কের নম্বর দিন", "Enter an 11-digit number starting 019 or 014") : undefined}
          >
            <PhoneInput id="d-phone" value={phone} onChange={setPhone} invalid={touched && !normalized} />
          </Field>
          <Notice icon="wallet">
            {t("কমিশন: কাঠঠোকরার আয়ের ৩০%, প্রতি মাসে পরিশোধ।", "Commission: 30% of Kaththokra's share, paid monthly.")}
          </Notice>
          <Button size="lg" block icon="sms" loading={busy} onClick={send}>
            {t("কোড পাঠান", "Send code")}
          </Button>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <p className="text-[1.02rem]">{t(`${d(maskMsisdn(normalized ?? ""))} নম্বরে কোড গেছে।`, `Code sent to ${maskMsisdn(normalized ?? "")}.`)}</p>
          <OtpInput label={t("কোড", "Code")} value={code} onChange={setCode} autoFocus />
          <Button size="lg" block disabled={code.length !== 6} loading={busy} onClick={confirm}>
            {t("নিবন্ধন সম্পন্ন করুন", "Finish sign-up")}
          </Button>
          <p className="text-center text-sm text-ink-3">{t("এই ফোনে ৩০ দিন সাইন-ইন থাকবে।", "This phone stays signed in for 30 days.")}</p>
        </div>
      )}
    </div>
  );
}
