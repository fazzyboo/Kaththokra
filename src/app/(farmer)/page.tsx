"use client";

import Link from "next/link";
import { CropGlyph } from "@/components/CropGlyph";
import { DiagnoseRing } from "@/components/farmer/DiagnoseRing";
import { Badge, ListRow, Panel } from "@/components/ui/Display";
import { CROPS, HELPLINE, PRESCRIPTIONS, USSD_CODE, disease } from "@/lib/data";
import { useT } from "@/lib/i18n";
import { useSession } from "@/lib/session";

export default function HomePage() {
  const { t, n, d, date } = useT();
  const { msisdn, subscription } = useSession();
  const last = msisdn ? PRESCRIPTIONS[0] : undefined;
  const lastDisease = last ? disease(last.diseaseCode) : undefined;

  return (
    <div className="pt-7">
      <h1 className="whitespace-pre-line font-display text-[2.15rem] leading-[1.15] text-ink">{t("পাতার ছবি তুলুন,\nরোগ জানুন", "Snap a leaf,\nknow the disease")}</h1>
      <p className="mt-3 max-w-sm text-[1.02rem] leading-relaxed text-ink-2">
        {t("ধান, আলু আর টমেটোর রোগ কয়েক সেকেন্ডে। রোগের নাম জানা সম্পূর্ণ বিনামূল্যে।", "Rice, potato and tomato diseases in seconds. Knowing the disease name is free.")}
      </p>

      <div className="mt-6">
        <DiagnoseRing />
      </div>

      <div className="mt-6">
        <p className="mb-2.5 text-[0.95rem] text-ink-2">{t("অথবা ফসল বেছে নিয়ে শুরু করুন", "Or start with your crop")}</p>
        <div className="grid grid-cols-3 gap-2.5">
          {CROPS.map((c) => (
            <Link
              key={c.id}
              href={`/diagnose?crop=${c.id}`}
              className="flex flex-col items-center gap-1.5 rounded-2xl border border-line py-3.5 transition-colors hover:border-leaf-400 hover:bg-leaf-50/50"
            >
              <CropGlyph crop={c.id} size={44} />
              <span className="text-base font-medium text-ink">{t(c.name)}</span>
            </Link>
          ))}
        </div>
      </div>

      <Panel className="mt-7 divide-y divide-line overflow-hidden">
        <ListRow
          href="/prescriptions"
          icon="file"
          title={t("আমার প্রেসক্রিপশন", "My prescriptions")}
          subtitle={
            last && lastDisease
              ? t(`সর্বশেষ: ${lastDisease.name.bn}, ${date(last.paidAt)}`, `Latest: ${lastDisease.name.en}, ${date(last.paidAt)}`)
              : t("নম্বর যাচাই করলে এখানে দেখাবে", "Shows up after you verify your number")
          }
        />
        <ListRow
          href="/alerts"
          icon="bell"
          title={t("রোগের সতর্কবার্তা", "Disease alerts")}
          subtitle={t("আপনার এলাকায় রোগ ছড়ালে SMS পাবেন", "Get an SMS when disease spreads near you")}
          right={
            subscription?.status === "REGISTERED" ? (
              <Badge tone="leaf" icon="check">
                {t("চালু", "On")}
              </Badge>
            ) : undefined
          }
        />
        <ListRow
          href={`tel:${HELPLINE}`}
          icon="phone"
          title={t(`কৃষি কল সেন্টার ${d(HELPLINE)}`, `Krishi Call Centre ${HELPLINE}`)}
          subtitle={t("কৃষি বিশেষজ্ঞের সাথে সরাসরি কথা বলুন", "Talk to an agriculture expert")}
        />
        <ListRow
          href="/diseases"
          icon="book"
          title={t("রোগ পরিচিতি", "Disease guide")}
          subtitle={t(`${n(9)}টি রোগের লক্ষণ ও ছবি`, "Symptoms of 9 diseases")}
        />
      </Panel>

      <div className="mt-5 rounded-2xl bg-mist px-4 py-4">
        <p className="text-[0.95rem] font-medium text-ink">{t("বাটন ফোনেও চলে", "Works on button phones too")}</p>
        <p className="mt-0.5 text-sm text-ink-2">
          {t(`ইন্টারনেট ছাড়াই ${USSD_CODE} ডায়াল করে লক্ষণ বেছে রোগ জানুন।`, `Dial ${USSD_CODE} without internet and pick the symptoms.`)}{" "}
          <Link href="/ussd" className="font-medium text-leaf-700 underline underline-offset-2">
            {t("কেমন দেখায়", "See how")}
          </Link>
        </p>
      </div>

      <footer className="mt-8 flex flex-wrap gap-x-4 gap-y-2 text-sm text-ink-3">
        <Link href="/about" className="hover:text-ink">
          {t("কাঠঠোকরা সম্পর্কে", "About")}
        </Link>
        <Link href="/privacy" className="hover:text-ink">
          {t("গোপনীয়তা", "Privacy")}
        </Link>
        <Link href="/terms" className="hover:text-ink">
          {t("শর্তাবলি", "Terms")}
        </Link>
        <Link href="/settings" className="hover:text-ink">
          {t("সেটিংস", "Settings")}
        </Link>
        <Link href="/dealer" className="hover:text-ink">
          {t("ডিলার", "For dealers")}
        </Link>
      </footer>
    </div>
  );
}
