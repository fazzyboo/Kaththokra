"use client";

import { cn } from "@/lib/cn";
import { CONFIDENCE_GATE } from "@/lib/data";
import { useT } from "@/lib/i18n";

/** Calibrated confidence with the 75% gate marked, so "how sure" is visible at a glance. */
export function ConfidenceBar({ p, size = "md" }: { p: number; size?: "sm" | "md" }) {
  const { t, pct } = useT();
  const ok = p >= CONFIDENCE_GATE;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-ink-2">{t("নিশ্চয়তা", "Confidence")}</span>
        <span className={cn("font-semibold", size === "md" ? "text-xl" : "text-base", ok ? "text-leaf-700" : "text-sun")}>{pct(p)}</span>
      </div>
      <div className="relative mt-1.5 h-2.5 rounded-full bg-mist" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p * 100)}>
        <div className={cn("h-full rounded-full", ok ? "bg-leaf-500" : "bg-sun")} style={{ width: `${Math.round(p * 100)}%` }} />
        <span className="absolute -top-1 h-4.5 w-0.5 rounded bg-ink" style={{ left: `${CONFIDENCE_GATE * 100}%` }} aria-hidden="true" />
      </div>
      <p className="mt-1 text-right text-xs text-ink-3" style={{ paddingRight: `${(1 - CONFIDENCE_GATE) * 100 - 6}%` }}>
        {t(`${pct(CONFIDENCE_GATE)} সীমা`, `${pct(CONFIDENCE_GATE)} gate`)}
      </p>
    </div>
  );
}

export function CandidateList({ items }: { items: { name: string; p: number }[] }) {
  const { pct } = useT();
  return (
    <ul className="space-y-2.5">
      {items.map((c) => (
        <li key={c.name}>
          <div className="flex justify-between text-[0.95rem]">
            <span className="text-ink">{c.name}</span>
            <span className="text-ink-2">{pct(c.p)}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-mist">
            <div className="h-full rounded-full bg-ink-3" style={{ width: `${Math.max(2, Math.round(c.p * 100))}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
