"use client";

import { useState } from "react";
import { Disclaimer } from "@/components/farmer/Shell";
import { Button } from "@/components/ui/Button";
import { Badge, KeyValue, Notice, Panel } from "@/components/ui/Display";
import { Icon } from "@/components/ui/Icon";
import type { IconName } from "@/components/ui/Icon";
import { sleep } from "@/lib/api";
import { cropName, disease } from "@/lib/data";
import { toBnDigits, useT } from "@/lib/i18n";
import { maskMsisdn } from "@/lib/phone";
import type { Prescription } from "@/lib/types";

/** The paid prescription (SRS SMS-1): generic active ingredient, dose per shotok, timing, PHI, gear, "read the label". */
export function PrescriptionView({ rx, compact }: { rx: Prescription; compact?: boolean }) {
  const { t, tk, d, date, n } = useT();
  const [resent, setResent] = useState<"idle" | "busy" | "done">("idle");
  const dis = disease(rx.diseaseCode);
  if (!dis) return null;

  const resend = async () => {
    setResent("busy");
    await sleep(900);
    setResent("done");
  };

  const smsBn = `${dis.name.bn} (${cropName(rx.crop).bn})। ওষুধ: ${dis.activeIngredient.bn}। মাত্রা: ${dis.dose.bn}। ${dis.timing.bn}। ফসল তোলার ${toBnDigits(dis.phiDays)} দিন আগে শেষ স্প্রে। মাস্ক-গ্লাভস পরুন। লেবেল পড়ুন। Ref ${rx.ref}। ৳${toBnDigits(rx.amount)} পরিশোধিত।`;
  const smsBanglish = `${dis.banglish} (${cropName(rx.crop).en}). Osudh: ${dis.activeIngredient.en}. Matra: ${dis.dose.en}. ${dis.timing.en}. Fosol tolar ${dis.phiDays} din age sesh spray. Mask-glove porun. Label porun. Ref ${rx.ref}. Tk${rx.amount} paid.`;

  const block = (icon: IconName, title: string, body: string) => (
    <div className="flex gap-3.5 py-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-leaf-50 text-leaf-700">
        <Icon name={icon} size={20} />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-ink-3">{title}</p>
        <p className="mt-0.5 text-[1.05rem] font-medium leading-snug text-ink">{body}</p>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="ink">{rx.ref}</Badge>
        <span className="text-sm text-ink-3">{date(rx.paidAt, true)}</span>
      </div>
      <h1 className="mt-3 font-display text-[2rem] leading-tight">{t(dis.name)}</h1>
      <p className="text-ink-2">{t(cropName(rx.crop))}</p>

      <Notice tone="sun" className="mt-4" icon="info">
        {t("ডেমো তথ্য: এই মাত্রা এখনো কৃষিবিদের অনুমোদিত নয়। ব্যবহারের আগে কৃষি কর্মকর্তার পরামর্শ নিন।", "Demo content: these doses are not yet agronomist-approved. Check with an agriculture officer before use.")}
      </Notice>

      <Panel className="mt-5 divide-y divide-line px-4">
        {block("leaf", t("ওষুধ (সক্রিয় উপাদান)", "Spray (active ingredient)"), t(dis.activeIngredient))}
        {block("activity", t("মাত্রা", "Dose"), t(dis.dose))}
        {block("clock", t("কখন ও কতবার", "When and how often"), t(dis.timing))}
        {dis.phiDays > 0
          ? block("flag", t("ফসল তোলার আগে বিরতি", "Before harvest"), t(`ফসল তোলার অন্তত ${n(dis.phiDays)} দিন আগে শেষ স্প্রে`, `Last spray at least ${dis.phiDays} days before harvest`))
          : null}
        {block("shield", t("নিরাপত্তা", "Safety"), t(dis.safety))}
      </Panel>

      {dis.care.length ? (
        <section className="mt-5">
          <h2 className="mb-2 font-semibold">{t("সাথে যা করবেন", "Also do this")}</h2>
          <ul className="space-y-1.5">
            {dis.care.map((c) => (
              <li key={c.en} className="flex gap-2.5 text-ink-2">
                <Icon name="check" size={18} className="mt-1 shrink-0 text-leaf-600" />
                {t(c)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mt-5 rounded-2xl bg-mist px-4 py-3 text-sm text-ink-2">
        {t("আমরা শুধু ওষুধের সক্রিয় উপাদানের নাম বলি, কোনো ব্র্যান্ড নয়। দোকানে এই উপাদানের যেকোনো ব্র্যান্ড নিতে পারেন। লেবেল পড়ুন।", "We name only the active ingredient, never a brand. Any brand with this ingredient works. Read the label.")}
      </p>

      {!compact ? (
        <>
          <section className="mt-6">
            <h2 className="mb-2 font-semibold">{t("SMS-এ যা গেছে", "What the SMS says")}</h2>
            <div className="rounded-2xl rounded-tl-md bg-mist px-4 py-3 text-[0.95rem] leading-relaxed text-ink">{t(smsBn, smsBanglish)}</div>
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-3">
              <Icon name={rx.sms === "DELIVERED" ? "check" : "clock"} size={14} />
              {rx.sms === "DELIVERED" ? t("ফোনে পৌঁছেছে", "Delivered to phone") : t("পাঠানো হয়েছে", "Sent")}
            </p>
          </section>

          <Panel className="mt-6 px-4">
            <p className="pt-3 text-sm font-semibold text-ink">{t("রসিদ", "Receipt")}</p>
            <KeyValue
              rows={[
                { k: t("পরিশোধ", "Paid"), v: tk(rx.amount) },
                { k: t("নম্বর", "Number"), v: d(maskMsisdn(rx.msisdn)) },
                { k: t("রসিদ নং", "Receipt no."), v: rx.receiptId },
                { k: t("মাধ্যম", "Channel"), v: rx.channel === "dealer" ? t(`ডিলার: ${rx.dealerShop ?? ""}`, `Dealer: ${rx.dealerShop ?? ""}`) : rx.channel === "ussd" ? "USSD" : t("অ্যাপ", "App") },
                { k: t("পরামর্শের সংস্করণ", "Advice version"), v: `KB v${rx.kbVersion}${dis.approvedBy ? `, ${dis.approvedBy}` : ""}` },
              ]}
            />
          </Panel>

          <div className="no-print mt-6 grid grid-cols-2 gap-3">
            <Button variant="secondary" icon={resent === "done" ? "check" : "sms"} loading={resent === "busy"} disabled={resent === "done"} onClick={resend}>
              {resent === "done" ? t("পাঠানো হয়েছে", "Re-sent") : t("ফ্রি আবার SMS", "Re-send free")}
            </Button>
            <Button variant="secondary" icon="printer" onClick={() => window.print()}>
              {t("প্রিন্ট", "Print")}
            </Button>
          </div>
        </>
      ) : null}

      <div className="mt-6">
        <Disclaimer />
      </div>
    </div>
  );
}
