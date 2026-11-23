"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type Lang = "bn" | "en";

/** A bilingual string. Every user-facing string in mock data uses this shape. */
export type Tx = { bn: string; en: string };

type LangState = { lang: Lang; setLang: (l: Lang) => void; toggle: () => void };

const LangContext = createContext<LangState>({ lang: "bn", setLang: () => {}, toggle: () => {} });

const STORAGE_KEY = "kk.lang";

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("bn");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "bn" || saved === "en") setLangState(saved);
    } catch {
      /* storage unavailable: keep Bangla */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<LangState>(
    () => ({ lang, setLang, toggle: () => setLang(lang === "bn" ? "en" : "bn") }),
    [lang, setLang],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

export function toBnDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
}

export type Translator = {
  (bn: string, en: string): string;
  (x: Tx): string;
};

/**
 * Bangla-first translator.
 *   t("ধান", "Rice")  or  t({ bn: "ধান", en: "Rice" })
 * Plus number helpers that switch to Bangla digits.
 */
export function useT() {
  const { lang } = useLang();

  const t = useCallback(
    ((a: string | Tx, b?: string) => {
      if (typeof a === "string") return lang === "bn" ? a : (b ?? a);
      return lang === "bn" ? a.bn : a.en;
    }) as Translator,
    [lang],
  );

  /** Locale-aware number: 1,234 → ১,২৩৪ */
  const n = useCallback(
    (v: number, opts?: Intl.NumberFormatOptions) => {
      const s = new Intl.NumberFormat("en-IN", opts).format(v);
      return lang === "bn" ? toBnDigits(s) : s;
    },
    [lang],
  );

  /** Taka amount: ৳5 / ৳১,২০০ */
  const tk = useCallback(
    (v: number, decimals = 0) => `৳${n(v, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`,
    [n],
  );

  /** Percent from a 0..1 ratio */
  const pct = useCallback((v: number, decimals = 0) => `${n(v * 100, { maximumFractionDigits: decimals })}%`, [n]);

  /** Digits only (phone numbers, codes) */
  const d = useCallback((s: string) => (lang === "bn" ? toBnDigits(s) : s), [lang]);

  const date = useCallback(
    (iso: string, withTime = false) => {
      const dt = new Date(iso);
      const s = dt.toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", {
        day: "numeric",
        month: "short",
        year: withTime ? undefined : "numeric",
        hour: withTime ? "numeric" : undefined,
        minute: withTime ? "2-digit" : undefined,
      });
      return s;
    },
    [lang],
  );

  /** Short day + month: 23 Nov / ২৩ নভে */
  const dm = useCallback(
    (iso: string) => new Date(iso).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short" }),
    [lang],
  );

  return { t, n, tk, pct, d, date, dm, lang };
}
