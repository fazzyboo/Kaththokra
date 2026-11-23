"use client";

import Link from "next/link";
import { LangToggle, PageHeader } from "@/components/farmer/Shell";
import { Button, LinkButton } from "@/components/ui/Button";
import { ListRow, Panel, SectionTitle } from "@/components/ui/Display";
import { useT } from "@/lib/i18n";
import { maskMsisdn } from "@/lib/phone";
import { useSession } from "@/lib/session";

export default function SettingsPage() {
  const { t, d } = useT();
  const { msisdn, signOut, subscription } = useSession();

  return (
    <div>
      <PageHeader back="/" title={t("সেটিংস", "Settings")} />

      <SectionTitle>{t("ভাষা", "Language")}</SectionTitle>
      <Panel className="flex items-center justify-between px-4 py-3.5">
        <span>{t("অ্যাপের ভাষা", "App language")}</span>
        <LangToggle />
      </Panel>

      <SectionTitle className="mt-7">{t("আমার নম্বর", "My number")}</SectionTitle>
      <Panel className="px-4 py-4">
        {msisdn ? (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-medium">{d(maskMsisdn(msisdn))}</p>
              <p className="text-sm text-ink-3">{t("যাচাই করা, ৯০ দিন মনে থাকবে", "Verified, remembered for 90 days")}</p>
            </div>
            <Button variant="secondary" size="sm" icon="logout" onClick={signOut}>
              {t("সরান", "Remove")}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-ink-2">{t("কোনো নম্বর যাচাই করা নেই", "No number verified")}</p>
            <LinkButton href="/verify?next=/settings" size="sm" variant="soft">
              {t("যাচাই করুন", "Verify")}
            </LinkButton>
          </div>
        )}
      </Panel>

      <SectionTitle className="mt-7">{t("আরও", "More")}</SectionTitle>
      <Panel className="divide-y divide-line overflow-hidden">
        <ListRow href="/alerts" icon="bell" tone="neutral" title={t("সতর্কবার্তা", "Alerts")} subtitle={subscription?.status === "REGISTERED" ? t("চালু", "On") : t("বন্ধ", "Off")} />
        <ListRow href="/privacy" icon="shield" tone="neutral" title={t("গোপনীয়তা নীতি", "Privacy policy")} />
        <ListRow href="/terms" icon="file" tone="neutral" title={t("ব্যবহারের শর্ত", "Terms of use")} />
        <ListRow href="/about" icon="info" tone="neutral" title={t("কাঠঠোকরা সম্পর্কে", "About Kaththokra")} />
      </Panel>

      <p className="mt-8 text-center text-xs text-ink-3">
        {t("সংস্করণ", "Version")} 0.1.0.{" "}
        <Link href="/offline" className="underline">
          {t("অফলাইন পাতা", "Offline page")}
        </Link>
      </p>
    </div>
  );
}
