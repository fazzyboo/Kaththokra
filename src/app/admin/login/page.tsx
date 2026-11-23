"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { Mark } from "@/components/Brand";
import { LangToggle } from "@/components/farmer/Shell";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Display";
import { Field, OtpInput, TextInput } from "@/components/ui/Form";
import { sleep } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useSession } from "@/lib/session";

/** Staff sign-in: email + password + TOTP from an authenticator app (SRS ID-6). Not Applink OTP. */
export default function AdminLoginPage() {
  const { t } = useT();
  const router = useRouter();
  const { setAdmin } = useSession();
  const [email, setEmail] = useState("fazle@kaththokra.app");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"password" | "totp">("password");
  const [totp, setTotp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (step === "password") {
      if (!email.includes("@") || password.length < 4) return setError(t("ইমেইল ও পাসওয়ার্ড দিন।", "Enter your email and password."));
      setBusy(true);
      await sleep(600);
      setBusy(false);
      setStep("totp");
      return;
    }
    if (totp.length !== 6) return;
    setBusy(true);
    await sleep(600);
    setBusy(false);
    setAdmin({ email, name: "Fazle Rabbi", role: "admin" });
    router.replace("/admin");
  };

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-ink lg:block">
        <svg viewBox="0 0 600 600" className="absolute -bottom-40 -right-40 h-[44rem] w-[44rem] opacity-40" aria-hidden="true">
          {[280, 240, 205, 172, 140, 110, 82, 56].map((r, i) => (
            <ellipse key={r} cx={300 + (i % 2 ? 3 : -2)} cy={300 + (i % 3 ? -2 : 2)} rx={r} ry={r - 4} fill="none" stroke="#4aa271" strokeWidth={1.4} />
          ))}
        </svg>
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white">
              <Mark size={36} />
            </span>
            <span className="font-display text-2xl">কাঠঠোকরা</span>
          </div>
          <p className="max-w-sm font-display text-[2.2rem] leading-tight">
            {t("প্রতিটি প্রেসক্রিপশনের পেছনে একজন কৃষিবিদের অনুমোদন।", "An agronomist's approval behind every prescription.")}
          </p>
        </div>
      </div>
      <div className="flex flex-col px-6 py-6">
        <div className="flex justify-end">
          <LangToggle />
        </div>
        <form onSubmit={submit} className="m-auto w-full max-w-sm space-y-5 py-10">
          <div>
            <Mark size={40} className="lg:hidden" />
            <h1 className="mt-3 font-display text-[1.9rem]">{t("টিম সাইন-ইন", "Team sign-in")}</h1>
            <p className="mt-1 text-ink-2">{t("অ্যাডমিন, কৃষিবিদ ও বিশ্লেষকদের জন্য।", "For admins, agronomists and analysts.")}</p>
          </div>
          {step === "password" ? (
            <>
              <Field label={t("ইমেইল", "Email")} htmlFor="email">
                <TextInput id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label={t("পাসওয়ার্ড", "Password")} htmlFor="pw" hint={t("ডেমো: যেকোনো ৪+ অক্ষর", "Demo: any 4+ characters")}>
                <TextInput id="pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
            </>
          ) : (
            <Field label={t("অথেনটিকেটর অ্যাপের ৬ অঙ্কের কোড", "6-digit code from your authenticator app")}>
              <OtpInput label={t("TOTP কোড", "TOTP code")} value={totp} onChange={setTotp} autoFocus />
            </Field>
          )}
          {error ? <Notice tone="alarm">{error}</Notice> : null}
          <Button type="submit" size="lg" block loading={busy} disabled={step === "totp" && totp.length !== 6}>
            {step === "password" ? t("পরের ধাপ", "Continue") : t("সাইন ইন", "Sign in")}
          </Button>
          <p className="text-center text-xs text-ink-3">{t("প্রতিটি সাইন-ইন অডিট লগে রেকর্ড হয়।", "Every sign-in is recorded in the audit log.")}</p>
        </form>
      </div>
    </main>
  );
}
