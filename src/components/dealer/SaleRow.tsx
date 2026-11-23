"use client";

import Link from "next/link";
import { CropGlyph } from "@/components/CropGlyph";
import { Badge } from "@/components/ui/Display";
import type { Tone } from "@/components/ui/Display";
import { disease } from "@/lib/data";
import type { DealerSale } from "@/lib/dealer-data";
import { useT } from "@/lib/i18n";

const STATUS: Record<DealerSale["status"], { bn: string; en: string; tone: Tone }> = {
  DELIVERED: { bn: "পৌঁছেছে", en: "Delivered", tone: "leaf" },
  PAID: { bn: "পরিশোধিত", en: "Paid", tone: "leaf" },
  FAILED: { bn: "ব্যর্থ", en: "Failed", tone: "neutral" },
  DISPUTED: { bn: "অভিযোগ", en: "Disputed", tone: "sun" },
};

export function SaleRow({ s }: { s: DealerSale }) {
  const { t, tk, d, date } = useT();
  const dis = disease(s.diseaseCode);
  const st = STATUS[s.status];
  return (
    <Link href={`/dealer/share/${s.ref}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-mist/70">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-mist">
        <CropGlyph crop={s.crop} size={28} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{dis ? t(dis.name) : s.diseaseCode}</span>
        <span className="block text-sm text-ink-3">
          {d(s.farmer)}, {date(s.at, true)}
        </span>
      </span>
      <span className="flex flex-col items-end gap-1">
        <span className="text-[0.95rem] font-medium">{s.commission ? `+${tk(s.commission, 2)}` : "—"}</span>
        <Badge tone={st.tone}>{t(st.bn, st.en)}</Badge>
      </span>
    </Link>
  );
}
