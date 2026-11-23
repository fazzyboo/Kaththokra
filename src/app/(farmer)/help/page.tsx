"use client";

import Link from "next/link";
import { PageHeader } from "@/components/farmer/Shell";
import { LinkButton } from "@/components/ui/Button";
import { Panel, SectionTitle } from "@/components/ui/Display";
import { Icon } from "@/components/ui/Icon";
import { FAQ, HELPLINE, USSD_CODE } from "@/lib/data";
import { useT } from "@/lib/i18n";

export default function HelpPage() {
  const { t, d } = useT();

  const keywords = [
    { k: "PD ALERT DHAN 101", bn: "ধানের সতর্কবার্তা চালু (১০১ = উপজেলা কোড)", en: "Turn on rice alerts (101 = upazila code)" },
    { k: "PD STOP", bn: "সতর্কবার্তা বন্ধ", en: "Turn off alerts" },
    { k: "PD HELP", bn: "সাহায্যের তথ্য", en: "Help info" },
    { k: "PD-482193", bn: "সেই প্রেসক্রিপশন আবার পাঠাও (ফ্রি)", en: "Re-send that prescription (free)" },
  ];

  return (
    <div>
      <PageHeader title={t("সাহায্য", "Help")} />

      <a href={`tel:${HELPLINE}`} className="flex items-center gap-4 rounded-sheet bg-leaf-700 px-5 py-5 text-white hover:bg-leaf-800">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15">
          <Icon name="phone" size={24} />
        </span>
        <span className="flex-1">
          <span className="block text-sm text-white/80">{t("কৃষি কল সেন্টার, বিনামূল্যে", "Krishi Call Centre, free")}</span>
          <span className="block font-display text-3xl leading-tight">{d(HELPLINE)}</span>
        </span>
        <Icon name="chevronRight" />
      </a>

      <section className="mt-8">
        <SectionTitle>{t("সাধারণ প্রশ্ন", "Common questions")}</SectionTitle>
        <Panel className="divide-y divide-line">
          {FAQ.map((f) => (
            <details key={f.q.en} className="group px-4 py-3.5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
                {t(f.q)}
                <Icon name="chevronDown" size={18} className="shrink-0 text-ink-3 transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-2 text-[0.96rem] leading-relaxed text-ink-2">{t(f.a)}</p>
            </details>
          ))}
        </Panel>
      </section>

      <section className="mt-8">
        <SectionTitle>{t("বাটন ফোনে কীভাবে", "On a button phone")}</SectionTitle>
        <ol className="space-y-3">
          {[
            t(`${USSD_CODE} ডায়াল করুন`, `Dial ${USSD_CODE}`),
            t("ফসল, গাছের অংশ ও লক্ষণ বেছে নিন", "Pick the crop, plant part and sign"),
            t("রোগের নাম দেখুন, চাইলে ৳৫-এ প্রেসক্রিপশন নিন", "See the disease; get the prescription for ৳5 if you want"),
            t("SMS-এ আসা ৬ অঙ্কের কোড দিন", "Enter the 6-digit code from the SMS"),
          ].map((s, i) => (
            <li key={s} className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mist text-sm font-semibold text-ink-2">{d(String(i + 1))}</span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
        <LinkButton href="/ussd" variant="secondary" icon="keypad" className="mt-4">
          {t("USSD দেখে নিন", "Try the USSD menu")}
        </LinkButton>
      </section>

      <section className="mt-8">
        <SectionTitle>{t("SMS কি-ওয়ার্ড", "SMS keywords")}</SectionTitle>
        <Panel className="divide-y divide-line">
          {keywords.map((k) => (
            <div key={k.k} className="flex items-center justify-between gap-3 px-4 py-3">
              <code className="shrink-0 whitespace-nowrap rounded-md bg-mist px-2 py-1 text-sm font-semibold text-ink">{k.k}</code>
              <span className="text-right text-sm text-ink-2">{t(k.bn, k.en)}</span>
            </div>
          ))}
        </Panel>
      </section>

      <p className="mt-8 text-sm text-ink-3">
        {t("রোগ চেনার জন্য দেখুন ", "To learn the signs, see the ")}
        <Link href="/diseases" className="text-leaf-700 underline underline-offset-2">
          {t("রোগ পরিচিতি", "disease guide")}
        </Link>
        .
      </p>
    </div>
  );
}
