"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/farmer/Shell";
import { Button, LinkButton } from "@/components/ui/Button";
import { Notice, Steps } from "@/components/ui/Display";
import { Icon } from "@/components/ui/Icon";
import { answerClarify, getDiagnosis } from "@/lib/api";
import { cn } from "@/lib/cn";
import { CLARIFY, HELPLINE } from "@/lib/data";
import { useT } from "@/lib/i18n";
import type { Diagnosis } from "@/lib/types";

/** Up to two symptom questions that re-rank the candidates (SRS DX-5). */
export function ClarifyFlow({ id, base }: { id: string; base: string }) {
  const { t, d } = useT();
  const router = useRouter();
  const [dx, setDx] = useState<Diagnosis | null>(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [stillUnsure, setStillUnsure] = useState(false);

  useEffect(() => {
    setDx(getDiagnosis(id) ?? null);
  }, [id]);

  const questions = dx ? CLARIFY.filter((q) => q.crop === dx.crop).slice(0, 2) : [];
  const q = questions[step];

  const choose = async (idx: number) => {
    if (!q) return;
    const next = { ...answers, [q.id]: idx };
    setAnswers(next);
    if (step < questions.length - 1) {
      setStep(step + 1);
      return;
    }
    setBusy(true);
    const res = await answerClarify(id, next);
    setBusy(false);
    if (res.status === "CONFIDENT") router.replace(`${base}/${id}`);
    else setStillUnsure(true);
  };

  if (!dx) return null;

  if (stillUnsure) {
    return (
      <div>
        <PageHeader
          back={`${base}/${id}`}
          title={t("এখনো নিশ্চিত নই", "Still not sure")}
          subtitle={t("ভুল পরামর্শ দেওয়ার চেয়ে বিশেষজ্ঞকে দেখানো ভালো।", "Better to ask an expert than give wrong advice.")}
        />
        <div className="grid gap-3">
          <LinkButton href={`${base}/${id}/review`} size="lg" block icon="user">
            {t("কৃষিবিদকে দেখান (বিনামূল্যে)", "Ask an agronomist (free)")}
          </LinkButton>
          <LinkButton href={`tel:${HELPLINE}`} variant="secondary" size="lg" block icon="phone">
            {t(`${d(HELPLINE)}-এ কল করুন`, `Call ${HELPLINE}`)}
          </LinkButton>
        </div>
        <Notice className="mt-5" icon="wallet">
          {t("কোনো টাকা কাটা হয়নি।", "Nothing was charged.")}
        </Notice>
      </div>
    );
  }

  return (
    <div>
      <PageHeader back={`${base}/${id}`} title={t("লক্ষণ মিলিয়ে দেখি", "Let's match the signs")} />
      <Steps steps={questions.map((_, i) => t(`প্রশ্ন ${d(String(i + 1))}`, `Question ${i + 1}`))} current={step} />
      {q ? (
        <section className="mt-6" aria-live="polite">
          <h2 className="font-display text-[1.5rem] leading-snug">{t(q.q)}</h2>
          <div className="mt-5 grid gap-2.5">
            {q.options.map((o, i) => (
              <button
                key={o.label.en}
                disabled={busy}
                onClick={() => choose(i)}
                className={cn(
                  "flex min-h-14 items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-[1.02rem] transition-colors hover:border-leaf-400",
                  answers[q.id] === i ? "border-leaf-600 bg-leaf-50" : "border-line",
                )}
              >
                {t(o.label)}
                <Icon name="chevronRight" className="shrink-0 text-ink-3" />
              </button>
            ))}
          </div>
          {step > 0 ? (
            <Button variant="ghost" className="mt-4" icon="chevronLeft" onClick={() => setStep(step - 1)}>
              {t("আগের প্রশ্ন", "Previous question")}
            </Button>
          ) : null}
          {busy ? <p className="mt-4 text-center text-ink-2">{t("আবার হিসাব করা হচ্ছে…", "Re-checking…")}</p> : null}
        </section>
      ) : null}
    </div>
  );
}
