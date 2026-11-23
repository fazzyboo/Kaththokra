"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CropGlyph } from "@/components/CropGlyph";
import { Disclaimer } from "@/components/farmer/Shell";
import { Button, LinkButton } from "@/components/ui/Button";
import { Badge, EmptyState, Notice, Panel, Skeleton } from "@/components/ui/Display";
import { Icon } from "@/components/ui/Icon";
import { getDiagnosis } from "@/lib/api";
import { HELPLINE, PRESCRIPTIONS, PRICE_RX, cropName, disease } from "@/lib/data";
import { useT } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { Diagnosis, Severity } from "@/lib/types";
import { CandidateList, ConfidenceBar } from "./Confidence";

const SEVERITY: Record<Severity, { bn: string; en: string; tone: "leaf" | "sun" | "alarm" }> = {
  mild: { bn: "হালকা আক্রমণ", en: "Mild", tone: "leaf" },
  moderate: { bn: "মাঝারি আক্রমণ", en: "Moderate", tone: "sun" },
  severe: { bn: "তীব্র আক্রমণ", en: "Severe", tone: "alarm" },
};

/** Free part of the diagnosis (DX-3) + the gate to payment (DX-4, PAY-1). */
export function DiagnosisResult({ id, base, payBase }: { id: string; base: string; payBase: string }) {
  const { t, tk, d: digits } = useT();
  const { unlocked } = useSession();
  const [dx, setDx] = useState<Diagnosis | null | undefined>(undefined);

  useEffect(() => {
    setDx(getDiagnosis(id) ?? null);
  }, [id]);

  if (dx === undefined)
    return (
      <div className="space-y-4 pt-8">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );

  if (dx === null)
    return (
      <EmptyState
        icon="search"
        title={t("এই ফলাফল পাওয়া যায়নি", "This result was not found")}
        body={t("লিংকটি পুরোনো হতে পারে। নতুন করে ছবি দিন।", "The link may be old. Start a new diagnosis.")}
        action={<LinkButton href={base}>{t("নতুন নির্ণয়", "New diagnosis")}</LinkButton>}
      />
    );

  const top = dx.top3[0];
  const dis = top ? disease(top.code) : undefined;

  /* ---------- Retake: blurry / not a leaf (DX-6) ---------- */
  if (dx.status === "RETAKE") {
    return (
      <div className="pt-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sun-50 text-sun">
          <Icon name="focus" size={32} />
        </div>
        <h1 className="mt-5 font-display text-[1.75rem] leading-tight">{t("ছবিটি পরিষ্কার নয়", "The photo isn't clear")}</h1>
        <p className="mt-2 text-ink-2">
          {dx.retakeReason === "not_leaf"
            ? t("ছবিতে পাতা খুঁজে পাইনি। শুধু আক্রান্ত পাতার ছবি দিন।", "We couldn't find a leaf. Photograph just the sick leaf.")
            : t("ছবিটি ঝাপসা। ফোন স্থির রেখে আবার তুলুন।", "The photo is blurry. Hold the phone steady and try again.")}
        </p>
        <ul className="mt-6 space-y-3">
          {[
            t("একটি পাতা হাতের তালুতে রাখুন", "Hold one leaf flat on your palm"),
            t("ছায়ায় নয়, দিনের আলোয় তুলুন", "Shoot in daylight, not shade"),
            t("পাতা যেন পুরো ফ্রেম ভরে থাকে", "Let the leaf fill the frame"),
          ].map((s) => (
            <li key={s} className="flex items-start gap-3">
              <Icon name="check" size={20} className="mt-0.5 shrink-0 text-leaf-600" />
              <span>{s}</span>
            </li>
          ))}
        </ul>
        <Notice tone="neutral" className="mt-6" icon="wallet">
          {t("কোনো টাকা কাটা হয়নি।", "Nothing was charged.")}
        </Notice>
        <LinkButton href={`${base}?crop=${dx.crop}`} size="lg" block icon="camera" className="mt-6">
          {t("আবার ছবি তুলুন", "Take the photo again")}
        </LinkButton>
      </div>
    );
  }

  /* ---------- Uncertain: never charged (DX-4, DX-5, BR R-2) ---------- */
  if (dx.status === "UNCERTAIN" || dx.status === "QUEUED_REVIEW") {
    return (
      <div className="pt-6">
        <Badge tone="sun" icon="alert">
          {t("নিশ্চিত নয়", "Not certain")}
        </Badge>
        <h1 className="mt-3 font-display text-[1.75rem] leading-tight">{t("আরও একটু জানতে হবে", "We need a little more")}</h1>
        <p className="mt-2 text-ink-2">
          {t(
            "ছবি দেখে নিশ্চিত হতে পারিনি। ভুল ওষুধ যেন না দেন, তাই এখন কোনো প্রেসক্রিপশন দিচ্ছি না।",
            "We couldn't be sure from the photo. To avoid a wrong spray, we won't give a prescription yet.",
          )}
        </p>

        <Panel className="mt-5 p-4">
          <p className="mb-3 text-sm text-ink-2">{t("সম্ভাব্য রোগ", "Possible diseases")}</p>
          <CandidateList items={dx.top3.map((c) => ({ name: t(disease(c.code)?.name ?? { bn: c.code, en: c.code }), p: c.p }))} />
        </Panel>

        {dx.status === "QUEUED_REVIEW" ? (
          <Notice tone="leaf" className="mt-5" title={t("কৃষিবিদের কাছে পাঠানো হয়েছে", "Sent to an agronomist")}>
            {t("উত্তর SMS-এ পাবেন, সাধারণত ২৪ ঘণ্টার মধ্যে।", "You'll get the answer by SMS, usually within 24 hours.")}
          </Notice>
        ) : (
          <div className="mt-6 grid gap-3">
            <LinkButton href={`${base}/${dx.id}/clarify`} size="lg" block icon="list">
              {t("২টি প্রশ্নের উত্তর দিন", "Answer 2 quick questions")}
            </LinkButton>
            <LinkButton href={`${base}/${dx.id}/review`} variant="secondary" size="lg" block icon="user">
              {t("কৃষিবিদকে দেখান", "Ask an agronomist")}
            </LinkButton>
            <LinkButton href={`tel:${HELPLINE}`} variant="ghost" block icon="phone">
              {t(`${digits(HELPLINE)}-এ কল করুন`, `Call ${HELPLINE}`)}
            </LinkButton>
          </div>
        )}
        <Notice tone="neutral" className="mt-5" icon="wallet">
          {t("অনিশ্চিত ফলাফলে কখনো টাকা কাটা হয় না।", "Uncertain results are never charged.")}
        </Notice>
      </div>
    );
  }

  if (!dis || !top) return null;

  /* ---------- Healthy ---------- */
  if (dis.healthy) {
    return (
      <div className="pt-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-leaf-50 text-leaf-700">
          <Icon name="leaf" size={32} />
        </div>
        <h1 className="mt-5 font-display text-[1.9rem] leading-tight">{t(dis.name)}</h1>
        <p className="mt-2 text-ink-2">
          {t("এই পাতায় রোগের লক্ষণ পাইনি। এখন কোনো ওষুধ লাগবে না।", "No disease signs on this leaf. No spray needed now.")}
        </p>
        <div className="mt-5">
          <ConfidenceBar p={top.p} />
        </div>
        <Panel className="mt-5 p-4 text-[0.95rem] text-ink-2">
          {t(
            "জমির অন্য অংশে দাগ দেখলে সেই পাতার ছবি দিন। অপ্রয়োজনে স্প্রে করলে টাকা ও মাটি দুটোই নষ্ট হয়।",
            "If other parts of the field show spots, photograph those leaves. Spraying without need wastes money and harms the soil.",
          )}
        </Panel>
        <div className="mt-5">
          <Disclaimer />
        </div>
        <LinkButton href={base} variant="secondary" size="lg" block icon="camera" className="mt-5">
          {t("অন্য পাতা পরীক্ষা করুন", "Check another leaf")}
        </LinkButton>
      </div>
    );
  }

  /* ---------- Confident ---------- */
  const isUnlocked = unlocked.includes(dx.id) || dx.status === "UNLOCKED";
  const rxRef = PRESCRIPTIONS.find((p) => p.diagnosisId === dx.id)?.ref;
  const sev = dx.severity ? SEVERITY[dx.severity] : undefined;

  const speak = () => {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(
      t(`সম্ভাব্য রোগ: ${dis.name.bn}। এটি পরামর্শ, নিশ্চয়তা নয়।`, `Likely disease: ${dis.name.en}. This is advice, not a guarantee.`),
    );
    u.lang = t("bn-BD", "en-US");
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  return (
    <div className="pt-6">
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full bg-mist py-1 pl-1.5 pr-3 text-sm text-ink-2">
          <CropGlyph crop={dx.crop} size={20} />
          {t(cropName(dx.crop))}
        </span>
        {sev ? <Badge tone={sev.tone}>{t(sev.bn, sev.en)}</Badge> : null}
      </div>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.95rem] text-ink-2">{t("সম্ভাব্য রোগ", "Likely disease")}</p>
          <h1 className="font-display text-[2.1rem] leading-tight text-ink">{t(dis.name)}</h1>
          <p className="text-ink-3">{t(dis.name.en, dis.name.bn)}</p>
        </div>
        <button
          onClick={speak}
          className="mt-6 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-ink-2 hover:bg-mist"
          aria-label={t("ফলাফল শুনুন", "Listen to the result")}
        >
          <Icon name="volume" size={20} />
        </button>
      </div>

      <div className="mt-5">
        <ConfidenceBar p={top.p} />
      </div>

      <section className="mt-6">
        <h2 className="mb-2 font-semibold">{t("যে লক্ষণ মিলেছে", "Signs that match")}</h2>
        <ul className="space-y-2">
          {dis.symptoms.map((s) => (
            <li key={s.en} className="flex gap-2.5 text-[0.98rem] text-ink-2">
              <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-leaf-500" />
              {t(s)}
            </li>
          ))}
        </ul>
      </section>

      {/* Locked prescription: the paid tier (BR R-2) */}
      <Panel className="mt-6 overflow-hidden">
        <div className="relative px-4 pb-4 pt-4">
          <p className="flex items-center gap-2 font-semibold">
            <Icon name={isUnlocked ? "unlock" : "lock"} size={18} className="text-ink-2" />
            {t("চিকিৎসা ও ওষুধের মাত্রা", "Treatment and dose")}
          </p>
          {isUnlocked ? (
            <p className="mt-2 text-ink-2">{t("এই প্রেসক্রিপশন আপনি কিনেছেন।", "You've already unlocked this prescription.")}</p>
          ) : (
            <div className="mt-3 space-y-2 blur-[5px] select-none" aria-hidden="true">
              <p>{t("ওষুধ: ████████ ৭৫% WP", "Active: ████████ 75% WP")}</p>
              <p>{t("মাত্রা: প্রতি শতকে ███ লিটারে █ গ্রাম", "Dose: █ g in ███ L per shotok")}</p>
              <p>{t("কখন: ██████, ██ দিন পর আবার", "When: ██████, repeat after ██ days")}</p>
            </div>
          )}
        </div>
        <div className="border-t border-line bg-mist/60 px-4 py-4">
          {isUnlocked ? (
            <LinkButton href={`/prescriptions/${rxRef ?? "PD-482193"}`} size="lg" block icon="file">
              {t("প্রেসক্রিপশন দেখুন", "View prescription")}
            </LinkButton>
          ) : (
            <>
              <LinkButton href={`${payBase}/${dx.id}`} size="lg" block icon="unlock">
                {t(`চিকিৎসা দেখুন – ${tk(PRICE_RX)}`, `Unlock treatment – ${tk(PRICE_RX)}`)}
              </LinkButton>
              <p className="mt-2 text-center text-sm text-ink-3">
                {t("বাংলালিংক ব্যালেন্স থেকে, আপনার কোড দেওয়ার পরেই কাটা হবে", "From Banglalink balance, charged only after you enter your code")}
              </p>
            </>
          )}
        </div>
      </Panel>

      {dx.top3.length > 1 ? (
        <details className="group mt-5 rounded-2xl border border-line px-4 py-3">
          <summary className="flex cursor-pointer list-none items-center justify-between text-[0.95rem] text-ink-2">
            {t("অন্য সম্ভাবনা", "Other possibilities")}
            <Icon name="chevronDown" size={18} className="transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-3">
            <CandidateList items={dx.top3.map((c) => ({ name: t(disease(c.code)?.name ?? { bn: c.code, en: c.code }), p: c.p }))} />
          </div>
        </details>
      ) : null}

      <div className="mt-5">
        <Disclaimer />
      </div>

      <div className="mt-5 flex items-center justify-between text-xs text-ink-3">
        <span>
          {t("মডেল", "Model")} {dx.modelVersion}, KB v{dx.kbVersion}
        </span>
        <Link href={`${base}?crop=${dx.crop}`} className="text-sm text-leaf-700 underline underline-offset-2">
          {t("অন্য ছবি দিন", "Try another photo")}
        </Link>
      </div>
    </div>
  );
}

export function useParamId(raw: string | string[] | undefined): string {
  return Array.isArray(raw) ? raw[0] : (raw ?? "");
}

export function RetryButton({ onClick }: { onClick: () => void }) {
  const { t } = useT();
  return (
    <Button variant="secondary" icon="refresh" onClick={onClick}>
      {t("আবার চেষ্টা করুন", "Try again")}
    </Button>
  );
}
