"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { Scenario } from "@/lib/session";

/*
  Demo switches for the hackathon walkthrough: pick which branch the mock backend takes,
  so every state (uncertain, retake, low balance, wrong code…) can be shown on stage.
  Remove this component when the real API is wired in.
*/
export function DemoPanel({ align = "right" }: { align?: "right" | "left" }) {
  const [open, setOpen] = useState(false);
  const { t } = useT();
  const { scenario, setScenario } = useSession();

  const dx: { v: Scenario["diagnosis"]; bn: string; en: string }[] = [
    { v: "confident", bn: "নিশ্চিত", en: "Confident" },
    { v: "uncertain", bn: "অনিশ্চিত", en: "Uncertain" },
    { v: "retake", bn: "ঝাপসা ছবি", en: "Blurry photo" },
    { v: "healthy", bn: "সুস্থ", en: "Healthy" },
  ];
  const pay: { v: Scenario["payment"]; bn: string; en: string }[] = [
    { v: "success", bn: "সফল", en: "Success" },
    { v: "wrong_once", bn: "ভুল কোড একবার", en: "Wrong code once" },
    { v: "low_balance", bn: "ব্যালেন্স কম (E1308)", en: "Low balance (E1308)" },
    { v: "expired", bn: "কোডের মেয়াদ শেষ", en: "Code expired" },
    { v: "slow", bn: "নোটিফিকেশন দেরি", en: "Slow notification" },
  ];

  return (
    <div className="no-print relative">
      {open ? (
        <div className={cn("absolute top-11 z-50 w-72 rounded-2xl border border-line bg-paper p-4 text-left shadow-[0_12px_40px_-12px_rgba(16,38,28,0.35)]", align === "right" ? "right-0" : "left-0")}>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">{t("ডেমো নিয়ন্ত্রণ", "Demo controls")}</p>
            <button onClick={() => setOpen(false)} aria-label={t("বন্ধ", "Close")} className="rounded-md p-1 text-ink-3 hover:bg-mist">
              <Icon name="x" size={18} />
            </button>
          </div>
          <p className="mb-1.5 text-xs text-ink-3">{t("রোগ নির্ণয়ের ফল", "Diagnosis outcome")}</p>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {dx.map((o) => (
              <button
                key={o.v}
                onClick={() => setScenario({ diagnosis: o.v })}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs",
                  scenario.diagnosis === o.v ? "border-ink bg-ink text-white" : "border-line-2 text-ink-2",
                )}
              >
                {t(o.bn, o.en)}
              </button>
            ))}
          </div>
          <p className="mb-1.5 text-xs text-ink-3">{t("পেমেন্টের ফল", "Payment outcome")}</p>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {pay.map((o) => (
              <button
                key={o.v}
                onClick={() => setScenario({ payment: o.v })}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs",
                  scenario.payment === o.v ? "border-ink bg-ink text-white" : "border-line-2 text-ink-2",
                )}
              >
                {t(o.bn, o.en)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1.5 border-t border-line pt-3 text-center text-xs">
            <Link href="/ussd" className="rounded-lg bg-mist py-2 text-ink-2 hover:text-ink">
              USSD
            </Link>
            <Link href="/dealer" className="rounded-lg bg-mist py-2 text-ink-2 hover:text-ink">
              {t("ডিলার", "Dealer")}
            </Link>
            <Link href="/admin" className="rounded-lg bg-mist py-2 text-ink-2 hover:text-ink">
              {t("অ্যাডমিন", "Admin")}
            </Link>
          </div>
        </div>
      ) : null}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={t("ডেমো নিয়ন্ত্রণ", "Demo controls")}
        title={t("ডেমো নিয়ন্ত্রণ", "Demo controls")}
        className={cn("flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-mist", open && "bg-mist text-ink")}
      >
        <Icon name="sliders" size={19} />
      </button>
    </div>
  );
}
