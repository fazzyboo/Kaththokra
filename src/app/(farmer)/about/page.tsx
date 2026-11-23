"use client";

import { Mark } from "@/components/Brand";
import { PageHeader } from "@/components/farmer/Shell";
import { LinkButton } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Display";
import { PRICE_RX, PRICE_SUB_MONTHLY } from "@/lib/data";
import { useT } from "@/lib/i18n";

export default function AboutPage() {
  const { t, tk, d } = useT();
  const steps = [
    { bn: "পাতার ছবি তুলুন বা বাটন ফোনে লক্ষণ বাছুন", en: "Photograph the leaf, or pick symptoms on a button phone" },
    { bn: "রোগের নাম ও নিশ্চয়তা দেখুন, বিনামূল্যে", en: "See the disease name and confidence, free" },
    { bn: `চাইলে ${tk(PRICE_RX)}-এ ওষুধ, মাত্রা ও সময় SMS-এ নিন`, en: `If you want, get the spray, dose and timing by SMS for ${tk(PRICE_RX)}` },
  ];
  return (
    <div>
      <PageHeader back="/" />
      <Mark size={56} />
      <h1 className="mt-4 font-display text-[2.1rem] leading-tight">{t("কাঠঠোকরা", "Kaththokra")}</h1>
      <p className="mt-3 text-[1.05rem] leading-relaxed text-ink-2">
        {t(
          "কাঠঠোকরা গাছে ঠুকে ঠুকে লুকানো পোকা খুঁজে বের করে। আমাদের কাঠঠোকরা আপনার ফসলের পাতা দেখে লুকানো রোগ খুঁজে বের করে, বাংলায়, যেকোনো বাংলালিংক ফোনে।",
          "A woodpecker taps on trees to find what's hiding inside. Our Kaththokra looks at your crop's leaves to find hidden disease, in Bangla, on any Banglalink phone.",
        )}
      </p>

      <h2 className="mt-8 mb-3 font-semibold">{t("কীভাবে কাজ করে", "How it works")}</h2>
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={s.en} className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-leaf-50 text-sm font-semibold text-leaf-800">{d(String(i + 1))}</span>
            <span className="pt-0.5">{t(s.bn, s.en)}</span>
          </li>
        ))}
      </ol>

      <h2 className="mt-8 mb-3 font-semibold">{t("আমাদের প্রতিশ্রুতি", "Our promises")}</h2>
      <Panel className="divide-y divide-line">
        {[
          { bn: "অনিশ্চিত হলে কখনো টাকা কাটি না", en: "We never charge when we're unsure" },
          { bn: "প্রতিটি মাত্রা কৃষিবিদের অনুমোদিত", en: "Every dose is approved by an agronomist" },
          { bn: "শুধু সক্রিয় উপাদানের নাম, কোনো ব্র্যান্ডের প্রচার নয়", en: "Active ingredients only, no brand promotion" },
          { bn: "আপনার নম্বর গোপন রাখা হয়, ছবি রাখা হয় শুধু অনুমতি নিয়ে", en: "Your number stays private; photos are kept only with consent" },
        ].map((p) => (
          <p key={p.en} className="px-4 py-3 text-[0.98rem]">
            {t(p.bn, p.en)}
          </p>
        ))}
      </Panel>

      <h2 className="mt-8 mb-3 font-semibold">{t("মূল্য", "Prices")}</h2>
      <Panel className="divide-y divide-line">
        {[
          { k: t("রোগের নাম ও নিশ্চয়তা", "Disease name and confidence"), v: t("বিনামূল্যে", "Free") },
          { k: t("প্রেসক্রিপশন SMS", "Prescription SMS"), v: tk(PRICE_RX) },
          { k: t("রোগের সতর্কবার্তা", "Disease alerts"), v: t(`${tk(PRICE_SUB_MONTHLY)}/মাস`, `${tk(PRICE_SUB_MONTHLY)}/month`) },
          { k: t("প্রেসক্রিপশন আবার পাঠানো", "Re-sending a prescription"), v: t("বিনামূল্যে", "Free") },
        ].map((r) => (
          <div key={r.k} className="flex justify-between px-4 py-3">
            <span className="text-ink-2">{r.k}</span>
            <span className="font-medium">{r.v}</span>
          </div>
        ))}
      </Panel>
      <p className="mt-2 text-sm text-ink-3">{t("প্রযোজ্য কর আলাদা। বাংলালিংকের মাধ্যমে বিল হয়।", "Applicable taxes extra. Billed through Banglalink.")}</p>

      <LinkButton href="/diagnose" size="lg" icon="camera" block className="mt-8">
        {t("রোগ নির্ণয় শুরু করুন", "Start a diagnosis")}
      </LinkButton>
    </div>
  );
}
