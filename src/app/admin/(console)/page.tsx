"use client";

import Link from "next/link";
import { AdminHeader, Card } from "@/components/admin/Shell";
import { BarChart, HBars, Legend, LineChart } from "@/components/charts/Charts";
import { LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Display";
import { Icon } from "@/components/ui/Icon";
import { ALERTS, DAILY, REVIEW, REVENUE_SHARE, SUBSCRIBERS, dayLabel, kpis } from "@/lib/admin-data";
import { disease, upazila } from "@/lib/data";
import { useT } from "@/lib/i18n";

export default function AdminDashboard() {
  const { t, n, tk, pct, dm } = useT();
  const k = kpis();
  const labels = DAILY.confident.map((_, i) => dm(dayLabel(i)));
  const revenue = DAILY.paid.map((p) => p * 5 + Math.round((SUBSCRIBERS.total * SUBSCRIBERS.priceMonthly) / 30));
  const openReview = REVIEW.filter((r) => r.status === "open").length;
  const suggested = ALERTS.find((a) => a.status === "suggested");

  const tiles = [
    { label: t("রোগ নির্ণয়", "Diagnoses"), value: n(k.diagnoses), sub: t(`নিশ্চিত ${pct(k.confidentShare)}`, `${pct(k.confidentShare)} confident`) },
    { label: t("প্রেসক্রিপশন বিক্রি", "Prescriptions sold"), value: n(k.paid), sub: t(`নিশ্চিত ফলের ${pct(k.unlockConversion)}`, `${pct(k.unlockConversion)} of confident results`) },
    { label: t("চার্জ সফল", "Charge success"), value: pct(k.chargeSuccess, 1), sub: t("কোড চাওয়া থেকে পরিশোধ", "Code requested to paid") },
    { label: t("SMS পৌঁছেছে", "SMS delivered"), value: pct(k.dlrRate, 1), sub: t("ডেলিভারি রিপোর্ট অনুযায়ী", "Per delivery reports") },
    { label: t("মোট আয়", "Gross revenue"), value: tk(k.gross), sub: t(`আমাদের অংশ ${tk(k.ourShare)} (${pct(REVENUE_SHARE)} ধরে)`, `Our share ${tk(k.ourShare)} (at ${pct(REVENUE_SHARE)})`) },
    { label: t("সতর্কবার্তা গ্রাহক", "Alert subscribers"), value: n(SUBSCRIBERS.total), sub: t(`এই সপ্তাহে +${n(SUBSCRIBERS.newThisWeek)}, −${n(SUBSCRIBERS.churnThisWeek)}`, `+${SUBSCRIBERS.newThisWeek} / −${SUBSCRIBERS.churnThisWeek} this week`) },
  ];

  return (
    <div>
      <AdminHeader
        title={t("ড্যাশবোর্ড", "Dashboard")}
        description={t("গত ১৪ দিন, সব চ্যানেল। সংখ্যাগুলো পেমেন্ট খাতার সাথে মেলে।", "Last 14 days, all channels. Figures reconcile with the payment ledger.")}
        actions={
          <LinkButton href="/admin/live-log" variant="secondary" size="sm" icon="activity">
            {t("লাইভ লগ", "Live log")}
          </LinkButton>
        }
      />

      {(openReview > 0 || suggested) && (
        <div className="mb-6 grid gap-3 md:grid-cols-2">
          {suggested ? (
            <Link href="/admin/alerts" className="flex items-start gap-3 rounded-2xl border border-crest/25 bg-crest-50 px-4 py-3.5 hover:border-crest/50">
              <Icon name="alert" size={20} className="mt-0.5 shrink-0 text-crest" />
              <span className="text-sm">
                <span className="block font-semibold text-ink">
                  {t(`প্রাদুর্ভাবের সম্ভাবনা: ${disease(suggested.diseaseCode)?.name.bn}`, `Possible outbreak: ${disease(suggested.diseaseCode)?.name.en}`)}
                </span>
                <span className="text-ink-2">
                  {suggested.upazilas.map((u) => t(upazila(u)?.name ?? { bn: u, en: u })).join(", ")}. {t("সতর্কবার্তা অনুমোদনের অপেক্ষায়।", "Alert waiting for approval.")}
                </span>
              </span>
            </Link>
          ) : null}
          {openReview ? (
            <Link href="/admin/review" className="flex items-start gap-3 rounded-2xl border border-line bg-paper px-4 py-3.5 hover:border-line-2">
              <Icon name="eye" size={20} className="mt-0.5 shrink-0 text-ink-2" />
              <span className="text-sm">
                <span className="block font-semibold text-ink">{t(`${n(openReview)}টি কেস রিভিউর অপেক্ষায়`, `${openReview} cases waiting for review`)}</span>
                <span className="text-ink-2">{t("অনিশ্চিত ফল ও অভিযোগ", "Uncertain results and disputes")}</span>
              </span>
            </Link>
          ) : null}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-2xl border border-line bg-paper px-4 py-4">
            <p className="text-sm text-ink-3">{tile.label}</p>
            <p className="mt-1.5 text-[1.6rem] font-semibold leading-none tracking-tight">{tile.value}</p>
            <p className="mt-2 text-xs text-ink-3">{tile.sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title={t("দৈনিক রোগ নির্ণয়", "Daily diagnoses")}
          action={
            <Legend
              items={[
                { name: t("নিশ্চিত", "Confident"), color: "var(--color-series-1)" },
                { name: t("অনিশ্চিত", "Uncertain"), color: "var(--color-series-2)" },
              ]}
            />
          }
        >
          <div className="px-3 pb-3 pt-2">
            <LineChart
              labels={labels}
              format={(v) => n(v)}
              series={[
                { name: t("নিশ্চিত", "Confident"), values: DAILY.confident, color: "var(--color-series-1)" },
                { name: t("অনিশ্চিত", "Uncertain"), values: DAILY.uncertain, color: "var(--color-series-2)" },
              ]}
            />
          </div>
        </Card>

        <Card title={t("পেমেন্ট ফানেল", "Payment funnel")}>
          <div className="px-5 pb-5 pt-4">
            <HBars
              format={(v) => n(v)}
              rows={[
                { label: t("নিশ্চিত ফল", "Confident results"), value: k.confident },
                { label: t("আনলক চাপা", "Tapped unlock"), value: DAILY.unlockTaps.reduce((a, b) => a + b, 0) },
                { label: t("পরিশোধিত", "Paid (S1000)"), value: k.paid },
                { label: t("SMS পৌঁছেছে", "SMS delivered"), value: DAILY.delivered.reduce((a, b) => a + b, 0) },
              ]}
            />
            <p className="mt-4 text-xs text-ink-3">{t("অনিশ্চিত ফলে পেমেন্ট বোতাম দেখানো হয় না।", "Uncertain results never show a pay button.")}</p>
          </div>
        </Card>

        <Card className="xl:col-span-2" title={t("দৈনিক মোট আয়", "Daily gross revenue")}>
          <div className="px-3 pb-3 pt-2">
            <BarChart name={t("মোট আয়", "Gross")} values={revenue} labels={labels} format={(v) => tk(v)} />
          </div>
        </Card>

        <Card title={t("চ্যানেল অনুযায়ী", "By channel")}>
          <div className="px-5 pb-5 pt-4">
            <HBars
              color="var(--color-ink-2)"
              format={(v) => n(v)}
              rows={[
                { label: t("ওয়েব অ্যাপ", "Web app"), value: k.channels.web, note: pct(k.channels.web / k.diagnoses) },
                { label: "USSD", value: k.channels.ussd, note: pct(k.channels.ussd / k.diagnoses) },
                { label: t("ডিলার", "Dealer"), value: k.channels.dealer, note: pct(k.channels.dealer / k.diagnoses) },
              ]}
            />
            <div className="mt-5 flex items-center gap-2 border-t border-line pt-4 text-sm">
              <Badge tone="leaf">USSD</Badge>
              <span className="text-ink-2">{t("বাটন ফোনের কৃষক দ্বিতীয় বড় চ্যানেল", "Button-phone farmers are the second-largest channel")}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
