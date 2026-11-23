"use client";

import { useState } from "react";
import { SaleRow } from "@/components/dealer/SaleRow";
import { PageHeader } from "@/components/farmer/Shell";
import { EmptyState, KeyValue, Panel } from "@/components/ui/Display";
import { Segmented } from "@/components/ui/Form";
import { DEALER_SALES, DEALER_STATS, DEV_SHARE_PER_RX, DEALER_COMMISSION_RATE } from "@/lib/dealer-data";
import { useT } from "@/lib/i18n";

type Filter = "all" | "paid" | "issues";

export default function DealerSalesPage() {
  const { t, tk, n, pct, date } = useT();
  const [filter, setFilter] = useState<Filter>("all");
  const list = DEALER_SALES.filter((s) =>
    filter === "all" ? true : filter === "paid" ? s.status === "PAID" || s.status === "DELIVERED" : s.status === "FAILED" || s.status === "DISPUTED",
  );

  return (
    <div>
      <PageHeader title={t("বিক্রি ও কমিশন", "Sales and commission")} />

      <Panel className="px-4">
        <KeyValue
          rows={[
            { k: t("এই মাসে বিক্রি", "Sold this month"), v: n(DEALER_STATS.monthSales) },
            { k: t("এই মাসে নির্ণয়", "Diagnoses this month"), v: n(DEALER_STATS.monthDiagnoses) },
            { k: t("জমা কমিশন", "Commission so far"), v: <span className="text-lg">{tk(DEALER_STATS.monthCommission, 2)}</span> },
            {
              k: t("শেষ পরিশোধ", "Last payout"),
              v: t(`${tk(DEALER_STATS.lastPayout.amount, 2)}, ${date(DEALER_STATS.lastPayout.paidOn)}`, `${tk(DEALER_STATS.lastPayout.amount, 2)} on ${date(DEALER_STATS.lastPayout.paidOn)}`),
            },
          ]}
        />
      </Panel>
      <p className="mt-2 text-sm text-ink-3">
        {t(
          `প্রতি প্রেসক্রিপশনে কাঠঠোকরার আয় ${tk(DEV_SHARE_PER_RX, 2)}-এর ${pct(DEALER_COMMISSION_RATE)} আপনার। মাসের শুরুতে পরিশোধ।`,
          `You get ${pct(DEALER_COMMISSION_RATE)} of Kaththokra's ${tk(DEV_SHARE_PER_RX, 2)} per prescription. Paid at the start of each month.`,
        )}
      </p>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="font-semibold">{t("সব বিক্রি", "All sales")}</h2>
        <Segmented<Filter>
          label={t("ফিল্টার", "Filter")}
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: t("সব", "All") },
            { value: "paid", label: t("পরিশোধিত", "Paid") },
            { value: "issues", label: t("সমস্যা", "Issues") },
          ]}
        />
      </div>
      <Panel className="mt-3 divide-y divide-line overflow-hidden">
        {list.length ? list.map((s) => <SaleRow key={s.ref} s={s} />) : <EmptyState icon="wallet" title={t("কিছু নেই", "Nothing here")} />}
      </Panel>
      <p className="mt-4 text-sm text-ink-3">
        {t("ব্যর্থ পেমেন্ট বা অভিযোগ থাকা বিক্রিতে কমিশন যোগ হয় না।", "Failed or disputed sales don't earn commission.")}
      </p>
    </div>
  );
}
