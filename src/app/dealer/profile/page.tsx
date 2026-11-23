"use client";

import { useRouter } from "next/navigation";
import { Mark } from "@/components/Brand";
import { QrCode } from "@/components/QrCode";
import { PageHeader } from "@/components/farmer/Shell";
import { Button } from "@/components/ui/Button";
import { KeyValue, Panel, SectionTitle } from "@/components/ui/Display";
import { HELPLINE, PRICE_RX, USSD_CODE, upazila } from "@/lib/data";
import { DEALER_COMMISSION_RATE } from "@/lib/dealer-data";
import { useT } from "@/lib/i18n";
import { maskMsisdn } from "@/lib/phone";
import { useSession } from "@/lib/session";

export default function DealerProfilePage() {
  const { t, d, pct, tk } = useT();
  const router = useRouter();
  const { dealer, setDealer } = useSession();
  if (!dealer) return null;
  const u = upazila(dealer.upazila);

  return (
    <div>
      <PageHeader title={t("দোকান", "Shop")} />
      <Panel className="px-4">
        <KeyValue
          rows={[
            { k: t("দোকান", "Shop"), v: dealer.shopName },
            { k: t("ডিলার আইডি", "Dealer ID"), v: dealer.dealerId },
            { k: t("উপজেলা", "Upazila"), v: u ? t(u.name) : dealer.upazila },
            { k: t("নম্বর", "Number"), v: d(maskMsisdn(dealer.msisdn)) },
            { k: t("কমিশন", "Commission"), v: t(`আয়ের ${pct(DEALER_COMMISSION_RATE)}`, `${pct(DEALER_COMMISSION_RATE)} of share`) },
          ]}
        />
      </Panel>

      <section id="poster" className="mt-8">
        <SectionTitle
          action={
            <Button size="sm" variant="secondary" icon="printer" className="no-print" onClick={() => window.print()}>
              {t("প্রিন্ট", "Print")}
            </Button>
          }
        >
          {t("দোকানের পোস্টার", "Shop poster")}
        </SectionTitle>
        <div className="overflow-hidden rounded-sheet border-2 border-ink">
          <div className="flex items-center gap-3 bg-ink px-5 py-4 text-white">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white">
              <Mark size={40} />
            </span>
            <div>
              <p className="font-display text-3xl leading-none">কাঠঠোকরা</p>
              <p className="mt-1 text-sm text-white/75">ফসলের রোগ নির্ণয়, বাংলায়</p>
            </div>
          </div>
          <div className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-5">
            <div>
              <p className="font-display text-[1.6rem] leading-snug">পাতার ছবি দেখান, রোগ জানুন</p>
              <p className="mt-2 text-[0.95rem] text-ink-2">রোগের নাম ফ্রি। প্রেসক্রিপশন {tk(PRICE_RX)}, বাংলালিংক ব্যালেন্স থেকে।</p>
              <p className="mt-4 text-sm text-ink-3">বাটন ফোনে ডায়াল করুন</p>
              <p className="font-display text-3xl">{USSD_CODE}</p>
            </div>
            <QrCode value="https://kaththokra.app" size={112} label="kaththokra.app QR" />
          </div>
          <p className="border-t border-line bg-mist px-5 py-2.5 text-sm text-ink-2">
            {dealer.shopName}, {u ? u.name.bn : ""}. সাহায্য: {d(HELPLINE)}
          </p>
        </div>
      </section>

      <Button
        variant="danger"
        block
        icon="logout"
        className="no-print mt-8"
        onClick={() => {
          setDealer(null);
          router.replace("/dealer/onboard");
        }}
      >
        {t("এই ফোন থেকে সাইন আউট", "Sign out on this phone")}
      </Button>
    </div>
  );
}
