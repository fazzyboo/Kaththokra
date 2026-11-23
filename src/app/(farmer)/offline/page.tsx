"use client";

import { Button, LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { HELPLINE, USSD_CODE } from "@/lib/data";
import { useT } from "@/lib/i18n";

/** Served by the service worker when there is no connection (SRS WEB-2). */
export default function OfflinePage() {
  const { t, d } = useT();
  return (
    <div className="flex flex-col items-center pt-16 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-mist text-ink-2">
        <Icon name="wifiOff" size={30} />
      </span>
      <h1 className="mt-5 font-display text-[1.75rem]">{t("ইন্টারনেট নেই", "You're offline")}</h1>
      <p className="mt-2 max-w-xs text-ink-2">
        {t(`সংযোগ ফিরলে আবার চেষ্টা করুন। ততক্ষণ ${USSD_CODE} ডায়াল করে লক্ষণ দেখে রোগ জানতে পারেন।`, `Try again when you're back online. Meanwhile, dial ${USSD_CODE} to check symptoms without internet.`)}
      </p>
      <div className="mt-7 grid w-full max-w-xs gap-3">
        <Button size="lg" icon="refresh" onClick={() => window.location.reload()}>
          {t("আবার চেষ্টা করুন", "Try again")}
        </Button>
        <LinkButton href={`tel:${HELPLINE}`} variant="secondary" size="lg" icon="phone">
          {t(`${d(HELPLINE)}-এ কল`, `Call ${HELPLINE}`)}
        </LinkButton>
      </div>
    </div>
  );
}
