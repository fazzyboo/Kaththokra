"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { Mark } from "@/components/Brand";
import { DemoPanel } from "@/components/DemoPanel";
import { LangToggle } from "@/components/farmer/Shell";
import { Icon } from "@/components/ui/Icon";
import type { IconName } from "@/components/ui/Icon";
import type { Tone } from "@/components/ui/Display";
import { REVIEW } from "@/lib/admin-data";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n";
import { useSession } from "@/lib/session";

type NavItem = { href: string; icon: IconName; bn: string; en: string; count?: number };

const GROUPS: { bn: string; en: string; items: NavItem[] }[] = [
  {
    bn: "এক নজরে",
    en: "Overview",
    items: [
      { href: "/admin", icon: "chart", bn: "ড্যাশবোর্ড", en: "Dashboard" },
      { href: "/admin/live-log", icon: "activity", bn: "লাইভ Applink লগ", en: "Live Applink log" },
    ],
  },
  {
    bn: "কাজ",
    en: "Operations",
    items: [
      { href: "/admin/review", icon: "eye", bn: "রিভিউ সারি", en: "Review queue", count: REVIEW.filter((r) => r.status === "open").length },
      { href: "/admin/payments", icon: "wallet", bn: "পেমেন্ট খাতা", en: "Payments" },
      { href: "/admin/alerts", icon: "bell", bn: "সতর্কবার্তা", en: "Alerts" },
      { href: "/admin/heatmap", icon: "map", bn: "রোগের মানচিত্র", en: "Outbreak map" },
    ],
  },
  {
    bn: "জ্ঞান",
    en: "Knowledge",
    items: [
      { href: "/admin/kb", icon: "book", bn: "জ্ঞানভান্ডার", en: "Knowledge base" },
      { href: "/admin/model", icon: "cpu", bn: "এআই মডেল", en: "AI model" },
    ],
  },
  {
    bn: "মানুষ",
    en: "People",
    items: [
      { href: "/admin/dealers", icon: "store", bn: "ডিলার", en: "Dealers" },
      { href: "/admin/subscribers", icon: "users", bn: "গ্রাহক", en: "Subscribers" },
      { href: "/admin/team", icon: "shield", bn: "টিম ও ভূমিকা", en: "Team and roles" },
      { href: "/admin/settings", icon: "settings", bn: "সেটিংস", en: "Settings" },
    ],
  },
];

const ALL = GROUPS.flatMap((g) => g.items);
const isActive = (pathname: string, href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/admin";
  const router = useRouter();
  const { t } = useT();
  const { ready, admin, setAdmin } = useSession();

  useEffect(() => {
    if (ready && !admin) router.replace("/admin/login");
  }, [ready, admin, router]);

  if (!ready || !admin) return null;

  return (
    <div className="min-h-dvh bg-mist/60 lg:grid lg:grid-cols-[15.5rem_1fr]">
      <aside className="no-print hidden border-r border-line bg-paper lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <Link href="/admin" className="flex items-center gap-2.5 px-5 py-5">
          <Mark size={30} />
          <span className="leading-none">
            <span className="block font-display text-lg">কাঠঠোকরা</span>
            <span className="text-xs text-ink-3">{t("পরিচালনা", "Console")}</span>
          </span>
        </Link>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label={t("অ্যাডমিন মেনু", "Admin menu")}>
          {GROUPS.map((g) => (
            <div key={g.en}>
              <p className="px-2 pb-1.5 text-xs text-ink-3">{t(g.bn, g.en)}</p>
              <ul className="space-y-0.5">
                {g.items.map((it) => {
                  const active = isActive(pathname, it.href);
                  return (
                    <li key={it.href}>
                      <Link
                        href={it.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex h-9 items-center gap-2.5 rounded-lg px-2 text-sm transition-colors",
                          active ? "bg-leaf-50 font-medium text-leaf-800" : "text-ink-2 hover:bg-mist hover:text-ink",
                        )}
                      >
                        <Icon name={it.icon} size={17} />
                        <span className="flex-1">{t(it.bn, it.en)}</span>
                        {it.count ? <span className="rounded-full bg-crest px-1.5 text-[0.7rem] font-semibold leading-5 text-white">{it.count}</span> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-line px-4 py-3">
          <p className="truncate text-sm font-medium">{admin.name}</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-3">{admin.role}</span>
            <button
              onClick={() => {
                setAdmin(null);
                router.replace("/admin/login");
              }}
              className="flex items-center gap-1 text-xs text-ink-3 hover:text-ink"
            >
              <Icon name="logout" size={14} />
              {t("সাইন আউট", "Sign out")}
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="no-print sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-3 px-4 lg:px-8">
            <Link href="/admin" className="flex items-center gap-2 lg:hidden">
              <Mark size={26} />
              <span className="font-display">কাঠঠোকরা</span>
            </Link>
            <span className="hidden items-center gap-2 text-sm text-ink-3 lg:flex">
              <span className="live-dot h-2 w-2 rounded-full bg-leaf-500" />
              {t("টেস্ট মোড: শুধু হোয়াইটলিস্ট নম্বর", "Test mode: whitelisted numbers only")}
            </span>
            <div className="flex items-center gap-1.5">
              <Link href="/" className="hidden h-9 items-center rounded-full px-3 text-sm text-ink-2 hover:bg-mist sm:flex">
                {t("কৃষক অ্যাপ", "Farmer app")}
              </Link>
              <DemoPanel />
              <LangToggle />
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden" aria-label={t("অ্যাডমিন মেনু", "Admin menu")}>
            {ALL.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                className={cn(
                  "flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm",
                  isActive(pathname, it.href) ? "bg-ink text-white" : "bg-mist text-ink-2",
                )}
              >
                <Icon name={it.icon} size={15} />
                {t(it.bn, it.en)}
              </Link>
            ))}
          </nav>
        </header>
        <main className="px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

export function AdminHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-[1.9rem] leading-tight">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-[0.95rem] text-ink-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({ children, className, title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cn("min-w-0 rounded-2xl border border-line bg-paper", className)}>
      {title ? (
        <div className="flex items-center justify-between gap-3 px-5 pt-4">
          <h2 className="text-[0.98rem] font-semibold">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[40rem] border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({ className, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("border-b border-line px-4 py-2.5 text-left text-xs font-medium text-ink-3", className)} {...rest} />;
}

export function Td({ className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("border-b border-line px-4 py-3 align-middle text-ink", className)} {...rest} />;
}

/** CSV export helper (SRS ADM-7). */
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function statusTone(s: string): Tone {
  if (["S1000", "DELIVERED", "REGISTERED", "PAID", "FULFILLED", "published", "active", "sent"].includes(s)) return "leaf";
  if (s === "EXPIRED" || s === "REFUNDED_MANUAL" || s === "retired") return "neutral";
  if (s.startsWith("E") || ["FAILED", "flagged", "DISPUTED"].includes(s)) return "alarm";
  if (s.startsWith("P") || ["VERIFYING", "OTP_SENT", "review", "suggested", "PENDING_OTP", "REQUESTED", "paused"].includes(s)) return "sun";
  return "neutral";
}
