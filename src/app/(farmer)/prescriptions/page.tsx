"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CropGlyph } from "@/components/CropGlyph";
import { NumberVerify } from "@/components/farmer/NumberVerify";
import { PageHeader } from "@/components/farmer/Shell";
import { LinkButton } from "@/components/ui/Button";
import { Badge, EmptyState, Panel } from "@/components/ui/Display";
import { Icon } from "@/components/ui/Icon";
import { sessionPrescriptions } from "@/lib/api";
import { PRESCRIPTIONS, cropName, disease } from "@/lib/data";
import { useT } from "@/lib/i18n";
import { maskMsisdn } from "@/lib/phone";
import { useSession } from "@/lib/session";
import type { Prescription } from "@/lib/types";

export default function PrescriptionsPage() {
  const { t, d, date } = useT();
  const { ready, msisdn, signOut } = useSession();
  const [list, setList] = useState<Prescription[]>([]);

  useEffect(() => {
    if (msisdn) setList([...sessionPrescriptions(), ...PRESCRIPTIONS]);
  }, [msisdn]);

  if (!ready) return null;

  if (!msisdn)
    return (
      <div>
        <PageHeader
          title={t("আমার প্রেসক্রিপশন", "My prescriptions")}
          subtitle={t("আগের প্রেসক্রিপশন দেখতে আপনার নম্বর একবার যাচাই করুন।", "Verify your number once to see past prescriptions.")}
        />
        <NumberVerify cta={t("যাচাই করে দেখুন", "Verify and show")} />
      </div>
    );

  return (
    <div>
      <PageHeader
        title={t("আমার প্রেসক্রিপশন", "My prescriptions")}
        subtitle={
          <span className="flex items-center gap-2">
            {d(maskMsisdn(msisdn))}
            <button onClick={signOut} className="text-sm text-ink-3 underline underline-offset-2">
              {t("অন্য নম্বর", "Use another number")}
            </button>
          </span>
        }
      />
      {list.length === 0 ? (
        <EmptyState
          icon="file"
          title={t("এখনো কোনো প্রেসক্রিপশন নেই", "No prescriptions yet")}
          body={t("পাতার ছবি দিয়ে রোগ নির্ণয় করুন।", "Diagnose a leaf to get started.")}
          action={<LinkButton href="/diagnose" icon="camera">{t("রোগ নির্ণয়", "Diagnose")}</LinkButton>}
        />
      ) : (
        <Panel className="divide-y divide-line overflow-hidden">
          {list.map((rx) => {
            const dis = disease(rx.diseaseCode);
            return (
              <Link key={rx.ref} href={`/prescriptions/${rx.ref}`} className="flex items-center gap-3.5 px-4 py-4 hover:bg-mist/70">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-mist">
                  <CropGlyph crop={rx.crop} size={32} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[1.02rem] font-medium">{dis ? t(dis.name) : rx.diseaseCode}</span>
                  <span className="block text-sm text-ink-3">
                    {t(cropName(rx.crop))}, {date(rx.paidAt)}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <span className="text-xs text-ink-3">{rx.ref}</span>
                  {rx.channel === "dealer" ? <Badge>{t("ডিলার", "Dealer")}</Badge> : rx.channel === "ussd" ? <Badge>USSD</Badge> : null}
                </span>
                <Icon name="chevronRight" size={18} className="text-ink-3" />
              </Link>
            );
          })}
        </Panel>
      )}
      <p className="mt-5 text-sm text-ink-3">
        {t("রেফারেন্স কোড SMS করলে যেকোনো প্রেসক্রিপশন বিনামূল্যে আবার পাবেন।", "SMS any reference code to get that prescription again, free.")}
      </p>
    </div>
  );
}
