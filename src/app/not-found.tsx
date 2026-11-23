"use client";

import { Mark } from "@/components/Brand";
import { LinkButton } from "@/components/ui/Button";
import { useT } from "@/lib/i18n";

export default function NotFound() {
  const { t } = useT();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Mark size={64} />
      <h1 className="mt-6 font-display text-[2rem]">{t("এই পাতাটি নেই", "This page doesn't exist")}</h1>
      <p className="mt-2 max-w-xs text-ink-2">{t("কাঠঠোকরা খুঁজে দেখেছে, কিন্তু কিছু পায়নি।", "Kaththokra tapped around but found nothing here.")}</p>
      <LinkButton href="/" size="lg" icon="home" className="mt-7">
        {t("হোমে ফিরুন", "Go home")}
      </LinkButton>
    </main>
  );
}
