"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { CropId } from "./types";

/*
  Client-side mock session. In production these come from the API:
  - farmer: 90-day cookie after one-time number verification (SRS ID-1)
  - dealer: 30-day device-bound JWT after OTP onboarding (ID-3)
  - admin:  email + password + TOTP (ID-6)
*/

export type Subscription = {
  status: "REGISTERED" | "UNREGISTERED" | "PENDING_OTP";
  crops: CropId[];
  upazila: string;
  since: string;
};

export type DealerSession = { shopName: string; upazila: string; msisdn: string; dealerId: string };

export type AdminSession = { email: string; name: string; role: "admin" | "agronomist" | "analyst" | "dealer_manager" };

/** Demo switches so every branch of the flow can be shown without a backend. */
export type Scenario = {
  diagnosis: "confident" | "uncertain" | "retake" | "healthy";
  payment: "success" | "wrong_once" | "low_balance" | "expired" | "slow";
};

type SessionState = {
  ready: boolean;
  msisdn: string | null;
  verify: (msisdn: string) => void;
  signOut: () => void;
  subscription: Subscription | null;
  setSubscription: (s: Subscription | null) => void;
  dealer: DealerSession | null;
  setDealer: (d: DealerSession | null) => void;
  admin: AdminSession | null;
  setAdmin: (a: AdminSession | null) => void;
  scenario: Scenario;
  setScenario: (s: Partial<Scenario>) => void;
  unlocked: string[];
  unlock: (diagnosisId: string) => void;
};

const DEFAULT_SCENARIO: Scenario = { diagnosis: "confident", payment: "success" };

const Ctx = createContext<SessionState | null>(null);

function load<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [msisdn, setMsisdn] = useState<string | null>(null);
  const [subscription, setSub] = useState<Subscription | null>(null);
  const [dealer, setDealerState] = useState<DealerSession | null>(null);
  const [admin, setAdminState] = useState<AdminSession | null>(null);
  const [scenario, setScenarioState] = useState<Scenario>(DEFAULT_SCENARIO);
  const [unlocked, setUnlocked] = useState<string[]>([]);

  useEffect(() => {
    setMsisdn(load<string | null>("kk.msisdn", null));
    setSub(load<Subscription | null>("kk.sub", null));
    setDealerState(load<DealerSession | null>("kk.dealer", null));
    setAdminState(load<AdminSession | null>("kk.admin", null));
    setScenarioState({ ...DEFAULT_SCENARIO, ...load<Partial<Scenario>>("kk.scenario", {}) });
    setUnlocked(load<string[]>("kk.unlocked", []));
    setReady(true);
  }, []);

  const verify = useCallback((m: string) => {
    setMsisdn(m);
    save("kk.msisdn", m);
  }, []);

  const signOut = useCallback(() => {
    setMsisdn(null);
    save("kk.msisdn", null);
  }, []);

  const setSubscription = useCallback((s: Subscription | null) => {
    setSub(s);
    save("kk.sub", s);
  }, []);

  const setDealer = useCallback((d: DealerSession | null) => {
    setDealerState(d);
    save("kk.dealer", d);
  }, []);

  const setAdmin = useCallback((a: AdminSession | null) => {
    setAdminState(a);
    save("kk.admin", a);
  }, []);

  const setScenario = useCallback((s: Partial<Scenario>) => {
    setScenarioState((prev) => {
      const next = { ...prev, ...s };
      save("kk.scenario", next);
      return next;
    });
  }, []);

  const unlock = useCallback((id: string) => {
    setUnlocked((prev) => {
      const next = prev.includes(id) ? prev : [...prev, id];
      save("kk.unlocked", next);
      return next;
    });
  }, []);

  const value = useMemo<SessionState>(
    () => ({
      ready,
      msisdn,
      verify,
      signOut,
      subscription,
      setSubscription,
      dealer,
      setDealer,
      admin,
      setAdmin,
      scenario,
      setScenario,
      unlocked,
      unlock,
    }),
    [ready, msisdn, verify, signOut, subscription, setSubscription, dealer, setDealer, admin, setAdmin, scenario, setScenario, unlocked, unlock],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession must be used inside SessionProvider");
  return v;
}
