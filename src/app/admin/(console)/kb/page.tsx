"use client";

import Link from "next/link";
import { AdminHeader, Card, Table, Td, Th, statusTone } from "@/components/admin/Shell";
import { CropGlyph } from "@/components/CropGlyph";
import { Badge } from "@/components/ui/Display";
import { Icon } from "@/components/ui/Icon";
import { KB_LABEL, KB_STATUS_ORDER } from "@/lib/admin-data";
import { cn } from "@/lib/cn";
import { CROPS, DISEASES } from "@/lib/data";
import { useT } from "@/lib/i18n";

/** Knowledge base: draft → review → approved → published (SRS ADM-3, BR R-7). */
export default function KbListPage() {
  const { t, n } = useT();
  const counts = KB_STATUS_ORDER.slice(0, 4).map((s) => ({ s, c: DISEASES.filter((d) => d.kbStatus === s).length }));

  return (
    <div>
      <AdminHeader
        title={t("জ্ঞানভান্ডার", "Knowledge base")}
        description={t(
          "কৃষিবিদ অনুমোদন না করলে কোনো মাত্রা প্রকাশ হয় না। প্রতিটি প্রেসক্রিপশন তার সংস্করণ ধরে রাখে।",
          "No dose is published until an agronomist approves it. Every prescription pins its KB version.",
        )}
      />

      <ol className="mb-6 grid grid-cols-2 gap-2 md:grid-cols-4">
        {counts.map(({ s, c }, i) => (
          <li key={s} className="flex items-center gap-2">
            <div className={cn("flex-1 rounded-2xl border px-4 py-3", s === "published" ? "border-leaf-200 bg-leaf-50/60" : "border-line bg-paper")}>
              <p className="text-sm text-ink-3">{t(KB_LABEL[s])}</p>
              <p className="text-xl font-semibold">{n(c)}</p>
            </div>
            {i < counts.length - 1 ? <Icon name="chevronRight" size={16} className="hidden shrink-0 text-ink-3 md:block" /> : null}
          </li>
        ))}
      </ol>

      {CROPS.map((c) => (
        <Card key={c.id} className="mb-5">
          <div className="flex items-center gap-2 px-5 pt-4">
            <CropGlyph crop={c.id} size={24} />
            <h2 className="font-semibold">{t(c.name)}</h2>
          </div>
          <Table className="mt-2">
            <thead>
              <tr>
                <Th>{t("রোগ", "Disease")}</Th>
                <Th>{t("কোড", "Code")}</Th>
                <Th>{t("সক্রিয় উপাদান", "Active ingredient")}</Th>
                <Th>{t("সংস্করণ", "Version")}</Th>
                <Th>{t("অবস্থা", "Status")}</Th>
                <Th>{t("অনুমোদন", "Approved by")}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {DISEASES.filter((d) => d.crop === c.id).map((d) => (
                <tr key={d.code} className="hover:bg-mist/60">
                  <Td className="font-medium">
                    <Link href={`/admin/kb/${d.code}`} className="hover:underline">
                      {t(d.name)}
                    </Link>
                  </Td>
                  <Td className="font-mono text-xs text-ink-2">{d.code}</Td>
                  <Td className="text-ink-2">{d.healthy ? "—" : t(d.activeIngredient)}</Td>
                  <Td className="tabular-nums">v{d.kbVersion}</Td>
                  <Td>
                    <Badge tone={statusTone(d.kbStatus)}>{t(KB_LABEL[d.kbStatus])}</Badge>
                  </Td>
                  <Td className="text-ink-2">{d.approvedBy ?? "—"}</Td>
                  <Td className="text-right">
                    <Link href={`/admin/kb/${d.code}`} className="text-sm text-leaf-700">
                      {t("খুলুন", "Open")}
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ))}
    </div>
  );
}
