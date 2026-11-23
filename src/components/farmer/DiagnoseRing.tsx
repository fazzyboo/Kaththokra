"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useT } from "@/lib/i18n";

/*
  The signature element: a big round tap target wrapped in tree rings.
  Rings draw in once on load; a tap sends a crest-red ripple outward, like a woodpecker's knock.
*/
export function DiagnoseRing({ href = "/diagnose" }: { href?: string }) {
  const router = useRouter();
  const { t } = useT();
  const [tapping, setTapping] = useState(false);

  const go = () => {
    setTapping(true);
    window.setTimeout(() => router.push(href), 260);
  };

  return (
    <div className="relative mx-auto flex aspect-square w-full max-w-[19rem] items-center justify-center">
      <svg viewBox="0 0 300 300" className="ring-in absolute inset-0 h-full w-full" aria-hidden="true">
        {/* slightly off-centre ellipses read as growth rings, not a target */}
        <ellipse cx="150" cy="151" rx="146" ry="143" fill="none" stroke="var(--color-leaf-100)" strokeWidth="1.5" />
        <ellipse cx="149" cy="150" rx="128" ry="126" fill="none" stroke="var(--color-leaf-100)" strokeWidth="2" />
        <ellipse cx="151" cy="149" rx="111" ry="109" fill="none" stroke="var(--color-leaf-200)" strokeWidth="1.5" />
        <ellipse cx="150" cy="150.5" rx="95" ry="94" fill="var(--color-leaf-50)" stroke="var(--color-leaf-200)" strokeWidth="1.5" />
      </svg>
      {tapping ? <span className="tap-ripple pointer-events-none absolute h-[56%] w-[56%] rounded-full border-[3px] border-crest" /> : null}
      <button
        onClick={go}
        className="relative flex h-[56%] w-[56%] flex-col items-center justify-center gap-2 rounded-full bg-leaf-600 text-white shadow-[0_18px_40px_-16px_rgba(24,90,57,0.8)] transition-transform hover:bg-leaf-700 active:scale-[0.97]"
      >
        <Icon name="camera" size={40} strokeWidth={1.6} />
        <span className="text-lg font-semibold leading-tight">{t("রোগ নির্ণয়", "Diagnose")}</span>
      </button>
    </div>
  );
}
