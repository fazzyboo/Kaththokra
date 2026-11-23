"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/Brand";
import { DemoPanel } from "@/components/DemoPanel";
import { LangToggle } from "@/components/farmer/Shell";
import { Icon } from "@/components/ui/Icon";
import type { IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n";
import { useSession } from "@/lib/session";

const NAV: { href: string; icon: IconName; bn: string; en: string; match: (p: string) => boolean }[] = [
  { href: "/dealer", icon: "home", bn: "হোম", en: "Home", match: (p) => p === "/dealer" },
  { href: "/dealer/diagnose", icon: "camera", bn: "নির্ণয়", en: "Diagnose", match: (p) => p.startsWith("/dealer/diagnose") || p.startsWith("/dealer/pay") },
  { href: "/dealer/sales", icon: "wallet", bn: "বিক্রি", en: "Sales", match: (p) => p.startsWith("/dealer/sales") || p.startsWith("/dealer/share") },
  { href: "/dealer/profile", icon: "store", bn: "দোকান", en: "Shop", match: (p) => p.startsWith("/dealer/profile") },
];

export function DealerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/dealer";
  const router = useRouter();
  const { t } = useT();
  const { ready, dealer } = useSession();
  const isOnboard = pathname.startsWith("/dealer/onboard");

  // Dealer pages need the 30-day device token from OTP onboarding (SRS ID-3).
  useEffect(() => {
    if (ready && !dealer && !isOnboard) router.replace("/dealer/onboard");
  }, [ready, dealer, isOnboard, router]);

  return (
    <div className="min-h-dvh bg-paper">
      <header className="no-print sticky top-0 z-30 border-b border-line/70 bg-paper/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-xl items-center justify-between px-4">
          <Wordmark href={dealer ? "/dealer" : "/"} sub={t("ডিলার", "Dealer")} />
          <div className="flex items-center gap-1.5">
            <DemoPanel />
            <LangToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 pb-32">{ready && (dealer || isOnboard) ? children : null}</main>
      {dealer && !isOnboard ? (
        <nav aria-label={t("ডিলার মেনু", "Dealer menu")} className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <ul className="mx-auto grid h-16 max-w-xl grid-cols-4">
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
      ) : null}
    </div>
  );
}
