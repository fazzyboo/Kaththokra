"use client";

import Link from "next/link";
import { useState } from "react";
import { AdminHeader } from "@/components/admin/Shell";
import { CropGlyph } from "@/components/CropGlyph";
import { Badge, EmptyState } from "@/components/ui/Display";
import { Segmented } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";
import { REVIEW } from "@/lib/admin-data";
import { cropName, disease, upazila } from "@/lib/data";
import { useT } from "@/lib/i18n";

type Filter = "open" | "done";

/** Uncertain cases and disputes; verdicts become training labels (SRS ADM-4). */
export default function ReviewQueuePage() {
  const { t, pct } = useT();
  const [filter, setFilter] = useState<Filter>("open");
  const list = REVIEW.filter((r) => r.status === filter);

  return (
    <div>
      <AdminHeader
        title={t("রিভিউ সারি", "Review queue")}
        description={t("অনিশ্চিত ফল ও কৃষকের অভিযোগ। কৃষিবিদের রায় পরের মডেলের প্রশিক্ষণে যায়।", "Uncertain results and farmer disputes. Agronomist verdicts train the next model.")}
      />
      <div className="mb-4">
        <Segmented<Filter>
          label={t("অবস্থা", "Status")}
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "open", label: t("খোলা", "Open") },
            { value: "done", label: t("শেষ", "Done") },
          ]}
        />
      </div>
      {list.length === 0 ? (
        <EmptyState icon="check" title={t("সব রিভিউ শেষ", "All caught up")} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((r) => {
            const top = r.top3[0];
            const u = upazila(r.upazila);
            return (
              <li key={r.id}>
                <Link href={`/admin/review/${r.id}`} className="flex gap-4 rounded-2xl border border-line bg-paper p-4 transition-colors hover:border-line-2">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-mist">
                    <CropGlyph crop={r.crop} size={30} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-semibold">{r.id}</span>
                      {r.kind === "dispute" ? <Badge tone="crest">{t("অভিযোগ", "Dispute")}</Badge> : <Badge tone="sun">{t("অনিশ্চিত", "Uncertain")}</Badge>}
                    </span>
                    <span className="mt-1 block text-sm text-ink-2">
                      {t(cropName(r.crop))}, {u ? t(u.name) : r.upazila}. {t("মডেল ভাবছে", "Model thinks")}: {top ? `${t(disease(top.code)?.name ?? { bn: top.code, en: top.code })} ${pct(top.p)}` : "—"}
                    </span>
                    {r.note ? <span className="mt-1 block truncate text-sm text-ink-3">“{r.note}”</span> : null}
                    {r.verdict ? (
                      <span className="mt-1 block text-sm text-leaf-700">
                        {t("রায়", "Verdict")}: {t(disease(r.verdict)?.name ?? { bn: r.verdict, en: r.verdict })}
                      </span>
                    ) : null}
                  </span>
                  <Icon name="chevronRight" size={18} className="mt-1 shrink-0 text-ink-3" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
