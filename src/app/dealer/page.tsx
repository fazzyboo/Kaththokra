"use client";

import Link from "next/link";
import { useState } from "react";
import { SaleRow } from "@/components/dealer/SaleRow";
import { LinkButton } from "@/components/ui/Button";
import { Panel, SectionTitle } from "@/components/ui/Display";
import { Icon } from "@/components/ui/Icon";
import { upazila } from "@/lib/data";
import { DEALER_DAILY, DEALER_SALES, DEALER_STATS } from "@/lib/dealer-data";
import { useT } from "@/lib/i18n";
import { useSession } from "@/lib/session";

export default function DealerHomePage() {
  const { t, n, tk, d } = useT();
  const { dealer } = useSession();
  const [hover, setHover] = useState<number | null>(null);
  if (!dealer) return null;
  const u = upazila(dealer.upazila);
  const max = Math.max(...DEALER_DAILY);

  return (
    <div className="pt-6">
      <p className="text-ink-2">{u ? `${t(u.name)}, ${t(u.district)}` : null}</p>
      <h1 className="font-display text-[2rem] leading-tight">{dealer.shopName}</h1>

      <Link
        href="/dealer/diagnose"
        className="mt-5 flex items-center gap-4 rounded-sheet bg-leaf-600 px-5 py-5 text-white hover:bg-leaf-700"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15">
          <Icon name="camera" size={28} />
        </span>
        <span className="flex-1">
          <span className="block text-xl font-semibold">{t("কৃষকের জন্য নির্ণয়", "Diagnose for a farmer")}</span>
          <span className="block text-sm text-white/80">{t("কৃষকের পাতার ছবি তুলুন", "Photograph the farmer's leaf")}</span>
        </span>
        <Icon name="chevronRight" />
      </Link>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Panel className="px-4 py-4">
          <p className="text-sm text-ink-3">{t("আজ", "Today")}</p>
          <p className="mt-1 text-2xl font-semibold">{tk(DEALER_STATS.todayCommission, 2)}</p>
          <p className="text-sm text-ink-2">{t(`${n(DEALER_STATS.todaySales)}টি প্রেসক্রিপশন`, `${DEALER_STATS.todaySales} prescriptions`)}</p>
        </Panel>
        <Panel className="px-4 py-4">
          <p className="text-sm text-ink-3">{t("এই মাস", "This month")}</p>
          <p className="mt-1 text-2xl font-semibold">{tk(DEALER_STATS.monthCommission, 2)}</p>
          <p className="text-sm text-ink-2">{t(`${n(DEALER_STATS.monthSales)}টি প্রেসক্রিপশন`, `${DEALER_STATS.monthSales} prescriptions`)}</p>
        </Panel>
      </div>

      <Panel className="mt-3 px-4 pb-3 pt-4">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium">{t("গত ১৪ দিনের বিক্রি", "Sales, last 14 days")}</p>
          <p className="text-xs text-ink-3">{hover !== null ? t(`${n(DEALER_DAILY[hover])}টি, ${d(String(13 - hover))} দিন আগে`, `${DEALER_DAILY[hover]} sold, ${13 - hover}d ago`) : t("দিন অনুযায়ী", "per day")}</p>
        </div>
        <div className="mt-3 flex h-16 items-end gap-1" onMouseLeave={() => setHover(null)}>
          {DEALER_DAILY.map((v, i) => (
            <button
              key={i}
              type="button"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              aria-label={t(`${n(v)}টি, ${d(String(13 - i))} দিন আগে`, `${v} sold, ${13 - i} days ago`)}
              className="flex h-full flex-1 items-end"
            >
              <span
                className={i === DEALER_DAILY.length - 1 || hover === i ? "w-full rounded-t bg-leaf-600" : "w-full rounded-t bg-leaf-200"}
                style={{ height: `${Math.max(4, (v / max) * 100)}%` }}
              />
            </button>
          ))}
        </div>
      </Panel>

      <section className="mt-7">
        <SectionTitle
          action={
            <Link href="/dealer/sales" className="text-sm text-leaf-700">
              {t("সব দেখুন", "See all")}
            </Link>
          }
        >
          {t("সাম্প্রতিক বিক্রি", "Recent sales")}
        </SectionTitle>
        <Panel className="divide-y divide-line overflow-hidden">
          {DEALER_SALES.slice(0, 3).map((s) => (
            <SaleRow key={s.ref} s={s} />
          ))}
        </Panel>
      </section>

      <Panel className="mt-7 flex items-center gap-4 px-4 py-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-mist text-ink-2">
          <Icon name="printer" size={22} />
        </span>
        <div className="flex-1">
          <p className="font-medium">{t("দোকানের পোস্টার", "Shop poster")}</p>
          <p className="text-sm text-ink-3">{t("USSD কোড ও অ্যাপের QR সহ", "With the USSD code and app QR")}</p>
        </div>
        <LinkButton href="/dealer/profile#poster" size="sm" variant="secondary">
          {t("দেখুন", "View")}
        </LinkButton>
      </Panel>
    </div>
  );
}
