"use client";

import { useState } from "react";
import { AdminHeader, Card, Table, Td, Th } from "@/components/admin/Shell";
import { Button } from "@/components/ui/Button";
import { Badge, Notice } from "@/components/ui/Display";
import { sleep } from "@/lib/api";
import { MODELS, PER_CLASS } from "@/lib/admin-data";
import { cn } from "@/lib/cn";
import { CONFIDENCE_GATE, disease } from "@/lib/data";
import { useT } from "@/lib/i18n";

/** Model registry: live vs shadow, field-test metrics, per-class precision/recall. */
export default function ModelPage() {
  const { t, n, pct } = useT();
  const [models, setModels] = useState(MODELS);
  const [busy, setBusy] = useState(false);
  const live = models.find((m) => m.status === "live")!;
  const shadow = models.find((m) => m.status === "shadow");

  const promote = async () => {
    if (!shadow) return;
    setBusy(true);
    await sleep(900);
    setBusy(false);
    setModels((ms) =>
      ms.map((m) => (m.version === shadow.version ? { ...m, status: "live" as const } : m.status === "live" ? { ...m, status: "retired" as const } : m)),
    );
  };

  const metric = (label: string, v: string, hint: string, good: boolean) => (
    <div className="rounded-2xl border border-line bg-paper px-4 py-3.5">
      <p className="text-sm text-ink-3">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold", good ? "text-ink" : "text-alarm")}>{v}</p>
      <p className="text-xs text-ink-3">{hint}</p>
    </div>
  );

  return (
    <div>
      <AdminHeader
        title={t("এআই মডেল", "AI model")}
        description={t(
          "EfficientNet-B0, ক্যালিব্রেটেড, প্রত্যাখ্যান শ্রেণিসহ। মেট্রিক আমাদের নিজেদের মাঠের ছবিতে, যা প্রশিক্ষণে ব্যবহার হয়নি।",
          "EfficientNet-B0, calibrated, with a reject class. Metrics are on our own field photos, never used in training.",
        )}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {metric("Macro-F1", n(live.macroF1, { minimumFractionDigits: 2 }), t("লক্ষ্য ≥ ০.৮৫", "target ≥ 0.85"), live.macroF1 >= 0.85)}
        {metric(t("ক্যালিব্রেশন ত্রুটি", "Calibration error"), n(live.ece, { minimumFractionDigits: 3 }), t("লক্ষ্য ≤ ০.০৫", "target ≤ 0.05"), live.ece <= 0.05)}
        {metric(t("কভারেজ", "Coverage"), pct(live.coverage), t(`${pct(CONFIDENCE_GATE)} সীমার উপরে`, `above the ${pct(CONFIDENCE_GATE)} gate`), true)}
        {metric(t("সীমায় নির্ভুলতা", "Accuracy at gate"), pct(live.accAtGate), t("নিশ্চিত ফলগুলোর মধ্যে", "among confident results"), true)}
      </div>

      {shadow ? (
        <Notice tone="neutral" className="mb-6" title={t(`শ্যাডো মোডে: ${shadow.version}`, `In shadow mode: ${shadow.version}`)}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {t(
                `Macro-F1 ${n(shadow.macroF1)} বনাম ${n(live.macroF1)}। রিভিউ সারির ${n(shadow.trainedOn - live.trainedOn)}টি নতুন লেবেলে প্রশিক্ষিত।`,
                `Macro-F1 ${shadow.macroF1} vs ${live.macroF1}. Trained on ${shadow.trainedOn - live.trainedOn} new labels from the review queue.`,
              )}
            </span>
            <Button size="sm" variant="dark" loading={busy} onClick={promote}>
              {t("লাইভ করুন", "Promote to live")}
            </Button>
          </div>
        </Notice>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title={t("সংস্করণ", "Versions")}>
          <Table className="mt-2">
            <thead>
              <tr>
                <Th>{t("সংস্করণ", "Version")}</Th>
                <Th>{t("অবস্থা", "Status")}</Th>
                <Th className="text-right">F1</Th>
                <Th className="text-right">ECE</Th>
                <Th className="text-right">{t("ছবি", "Images")}</Th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.version}>
                  <Td className="font-mono text-xs">{m.version}</Td>
                  <Td>
                    <Badge tone={m.status === "live" ? "leaf" : m.status === "shadow" ? "sun" : "neutral"}>{m.status}</Badge>
                  </Td>
                  <Td className="text-right tabular-nums">{m.macroF1.toFixed(2)}</Td>
                  <Td className="text-right tabular-nums">{m.ece.toFixed(3)}</Td>
                  <Td className="text-right tabular-nums">{n(m.trainedOn)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card title={t("শ্রেণি অনুযায়ী", "Per class")}>
          <Table className="mt-2">
            <thead>
              <tr>
                <Th>{t("শ্রেণি", "Class")}</Th>
                <Th className="text-right">{t("প্রিসিশন", "Precision")}</Th>
                <Th className="text-right">{t("রিকল", "Recall")}</Th>
              </tr>
            </thead>
            <tbody>
              {PER_CLASS.map((c) => (
                <tr key={c.code}>
                  <Td>{t(disease(c.code)?.name ?? { bn: c.code, en: c.code })}</Td>
                  <Td className={cn("text-right tabular-nums", c.p < 0.8 && "text-sun")}>{c.p.toFixed(2)}</Td>
                  <Td className={cn("text-right tabular-nums", c.r < 0.8 && "text-sun")}>{c.r.toFixed(2)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
