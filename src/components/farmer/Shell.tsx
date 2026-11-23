"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/Brand";
import { DemoPanel } from "@/components/DemoPanel";
import { Icon } from "@/components/ui/Icon";
import type { IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { HELPLINE } from "@/lib/data";
import { useLang, useT } from "@/lib/i18n";

export function LangToggle({ className }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div role="radiogroup" aria-label="Language / ভাষা" className={cn("inline-flex h-9 items-center rounded-full border border-line p-0.5 text-sm", className)}>
      {(["bn", "en"] as const).map((l) => (
        <button
          key={l}
          role="radio"
          aria-checked={lang === l}
          onClick={() => setLang(l)}
          className={cn("h-8 rounded-full px-3 font-medium transition-colors", lang === l ? "bg-ink text-white" : "text-ink-2 hover:text-ink")}
        >
          {l === "bn" ? "বাং" : "EN"}
        </button>
      ))}
    </div>
  );
}

export function TopBar() {
  const { t } = useT();
  return (
    <header className="no-print sticky top-0 z-30 border-b border-line/70 bg-paper/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-xl items-center justify-between px-4">
        <Wordmark />
        <div className="flex items-center gap-1.5">
          <DemoPanel />
          <a
            href={`tel:${HELPLINE}`}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-mist"
            aria-label={t("কৃষি কল সেন্টার ১৬১২৩", "Krishi Call Centre 16123")}
          >
            <Icon name="phone" size={20} />
          </a>
          <LangToggle />
        </div>
      </div>
    </header>
  );
}

const NAV: { href: string; icon: IconName; bn: string; en: string; match: (p: string) => boolean }[] = [
  { href: "/", icon: "home", bn: "হোম", en: "Home", match: (p) => p === "/" },
  { href: "/diagnose", icon: "camera", bn: "নির্ণয়", en: "Diagnose", match: (p) => p.startsWith("/diagnose") || p.startsWith("/pay") },
  { href: "/prescriptions", icon: "file", bn: "প্রেসক্রিপশন", en: "Prescriptions", match: (p) => p.startsWith("/prescriptions") },
  { href: "/alerts", icon: "bell", bn: "সতর্কতা", en: "Alerts", match: (p) => p.startsWith("/alerts") },
  { href: "/help", icon: "help", bn: "সাহায্য", en: "Help", match: (p) => p.startsWith("/help") },
];

export function BottomNav() {
  const pathname = usePathname() ?? "/";
  const { t } = useT();
  return (
    <nav
      aria-label={t("প্রধান মেনু", "Main menu")}
      className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid h-16 max-w-xl grid-cols-5">
        {NAV.map((n) => {
          const active = n.match(pathname);
          return (
            <li key={n.href}>
              <Link
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cn("flex h-full flex-col items-center justify-center gap-0.5 text-[0.72rem]", active ? "text-leaf-700" : "text-ink-3 hover:text-ink")}
              >
                <span className={cn("flex h-7 w-12 items-center justify-center rounded-full", active && "bg-leaf-50")}>
                  <Icon name={n.icon} size={21} strokeWidth={active ? 2.1 : 1.8} />
                </span>
                <span className={cn(active && "font-semibold")}>{t(n.bn, n.en)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function PageHeader({ title, subtitle, back, action }: { title?: ReactNode; subtitle?: ReactNode; back?: string | true; action?: ReactNode }) {
  const router = useRouter();
  const { t } = useT();
  return (
    <div className="mb-6 pt-5">
      {back ? (
        typeof back === "string" ? (
          <Link href={back} className="-ml-2 mb-3 inline-flex h-9 items-center gap-1 rounded-lg pl-1 pr-3 text-[0.95rem] text-ink-2 hover:bg-mist">
            <Icon name="chevronLeft" size={20} />
            {t("ফিরে যান", "Back")}
          </Link>
        ) : (
          <button onClick={() => router.back()} className="-ml-2 mb-3 inline-flex h-9 items-center gap-1 rounded-lg pl-1 pr-3 text-[0.95rem] text-ink-2 hover:bg-mist">
            <Icon name="chevronLeft" size={20} />
            {t("ফিরে যান", "Back")}
          </button>
        )
      ) : null}
      {title || subtitle || action ? (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? <h1 className="font-display text-[1.75rem] leading-tight text-ink">{title}</h1> : null}
            {subtitle ? <p className="mt-1.5 text-[0.98rem] leading-relaxed text-ink-2">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
    </div>
  );
}

/** The officer-consult disclaimer that every result carries (SRS WEB-5, BR R-8). */
export function Disclaimer() {
  const { t } = useT();
  return (
    <p className="flex gap-2.5 rounded-2xl border border-line px-4 py-3 text-sm leading-relaxed text-ink-2">
      <Icon name="shield" size={18} className="mt-0.5 shrink-0 text-ink-3" />
      {t(
        "এটি পরামর্শ, নিশ্চয়তা নয়। আপনার এলাকার উপসহকারী কৃষি কর্মকর্তার সাথে কথা বলুন।",
        "This is advice, not a guarantee. Consult your local agriculture officer.",
      )}
    </p>
  );
}
