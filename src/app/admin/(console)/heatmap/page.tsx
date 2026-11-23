"use client";

import Link from "next/link";
import { useState } from "react";
import { AdminHeader, Card } from "@/components/admin/Shell";
import { Segmented } from "@/components/ui/Form";
import { ALERTS, HEAT, HEAT_DISEASES, HEAT_UPAZILAS, OUTBREAK_THRESHOLD } from "@/lib/admin-data";
import { cn } from "@/lib/cn";
import { disease, upazila } from "@/lib/data";
import { useT } from "@/lib/i18n";
import type { CropId } from "@/lib/types";

const STEPS = [
  { min: 5, bg: "#d9eee1", fg: "var(--color-ink)" },
  { min: 10, bg: "#a5d2b6", fg: "var(--color-ink)" },
  { min: 15, bg: "#4aa271", fg: "#fff" },
  { min: 25, bg: "#1f7046", fg: "#fff" },
  { min: 35, bg: "#0d3622", fg: "#fff" },
];
const stepFor = (v: number) => [...STEPS].reverse().find((s) => v >= s.min);

/** Outbreak heatmap by upazila; cells under 5 cases are hidden for privacy (SRS ADM-5). */
export default function HeatmapPage() {
  const { t, n } = useT();
  const [crop, setCrop] = useState<"all" | CropId>("all");
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  const rows = HEAT_DISEASES.map((code, i) => ({ code, i })).filter((r) => crop === "all" || disease(r.code)?.crop === crop);

  const alertFor = (code: string, upz: string) => ALERTS.find((a) => a.diseaseCode === code && a.upazilas.includes(upz));

  const hotspots = HEAT_DISEASES.flatMap((code, r) => HEAT_UPAZILAS.map((u, c) => ({ code, u, v: HEAT[r][c] })))
    .filter((x) => x.v >= OUTBREAK_THRESHOLD && (crop === "all" || disease(x.code)?.crop === crop))
    .sort((a, b) => b.v - a.v)
    .slice(0, 5);

  const hv = hover ? HEAT[hover.r][hover.c] : null;

  return (
    <div>
      <AdminHeader
        title={t("রোগের মানচিত্র", "Outbreak map")}
        description={t(
          "গত ৭ দিনে নিশ্চিত রোগ নির্ণয়, উপজেলা অনুযায়ী। ৫টির কম হলে ঘর লুকানো থাকে।",
          "Confident diagnoses in the last 7 days, by upazila. Cells with fewer than 5 cases are hidden.",
        )}
        actions={
          <Segmented<"all" | CropId>
            label={t("ফসল", "Crop")}
            size="sm"
            value={crop}
            onChange={setCrop}
            options={[
              { value: "all", label: t("সব", "All") },
              { value: "rice", label: t("ধান", "Rice") },
              { value: "potato", label: t("আলু", "Potato") },
              { value: "tomato", label: t("টমেটো", "Tomato") },
            ]}
          />
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_18rem]">
        <Card>
          <div className="overflow-x-auto p-4">
            <table className="w-full min-w-[46rem] border-separate border-spacing-0.5 text-xs" onMouseLeave={() => setHover(null)}>
              <thead>
                <tr>
                  <th />
                  {HEAT_UPAZILAS.map((u) => (
                    <th key={u} className="px-1 pb-2 text-center font-medium text-ink-2">
                      <span className="block">{t(upazila(u)?.name ?? { bn: u, en: u })}</span>
                      <span className="block font-normal text-ink-3">{t(upazila(u)?.district ?? { bn: "", en: "" })}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ code, i }) => (
                  <tr key={code}>
                    <th className="whitespace-nowrap pr-3 text-left text-[0.8rem] font-medium text-ink">{t(disease(code)?.name ?? { bn: code, en: code })}</th>
                    {HEAT_UPAZILAS.map((u, c) => {
                      const v = HEAT[i][c];
                      const s = stepFor(v);
                      const al = alertFor(code, u);
                      return (
                        <td key={u} className="p-0">
                          <button
                            type="button"
                            onMouseEnter={() => setHover({ r: i, c })}
                            onFocus={() => setHover({ r: i, c })}
                            aria-label={`${disease(code)?.name.en}, ${upazila(u)?.name.en}: ${v < OUTBREAK_THRESHOLD ? "fewer than 5" : v}`}
                            className={cn(
                              "flex h-10 w-full items-center justify-center rounded-md text-[0.8rem] font-medium tabular-nums",
                              al?.status === "suggested" && "ring-2 ring-crest ring-offset-1",
                              al?.status === "sent" && "ring-2 ring-ink ring-offset-1",
                            )}
                            style={
                              s
                                ? { background: s.bg, color: s.fg }
                                : { background: "repeating-linear-gradient(135deg, var(--color-mist) 0 4px, #fff 4px 8px)", color: "var(--color-ink-3)" }
                            }
                          >
                            {s ? n(v) : ""}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-5 py-3 text-xs text-ink-2">
            <span className="flex items-center gap-1">
              {STEPS.map((s) => (
                <span key={s.min} className="h-3 w-6 first:rounded-l last:rounded-r" style={{ background: s.bg }} />
              ))}
              <span className="ml-1.5">{t("৫ থেকে ৩৫+ কেস", "5 to 35+ cases")}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-5 rounded-sm" style={{ background: "repeating-linear-gradient(135deg, var(--color-mist) 0 3px, #fff 3px 6px)" }} />
              {t("৫-এর কম, লুকানো", "Under 5, hidden")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-5 rounded-sm ring-2 ring-crest" />
              {t("সতর্কবার্তা প্রস্তাবিত", "Alert suggested")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-5 rounded-sm ring-2 ring-ink" />
              {t("সতর্কবার্তা পাঠানো", "Alert sent")}
            </span>
          </div>
        </Card>

        <div className="space-y-6">
          <Card title={t("বিস্তারিত", "Details")}>
            <div className="px-5 pb-5 pt-2 text-sm">
              {hover && hv !== null ? (
                <>
                  <p className="font-medium">{t(disease(HEAT_DISEASES[hover.r])?.name ?? { bn: "", en: "" })}</p>
                  <p className="text-ink-2">{t(upazila(HEAT_UPAZILAS[hover.c])?.name ?? { bn: "", en: "" })}</p>
                  <p className="mt-2 text-2xl font-semibold">{hv < OUTBREAK_THRESHOLD ? t("৫-এর কম", "Under 5") : n(hv)}</p>
                  <p className="text-ink-3">{t("নিশ্চিত কেস, ৭ দিন", "confident cases, 7 days")}</p>
                </>
              ) : (
                <p className="text-ink-3">{t("কোনো ঘরের উপর রাখুন।", "Hover a cell to see details.")}</p>
              )}
            </div>
          </Card>
          <Card title={t("সবচেয়ে বেশি", "Top hotspots")}>
            <ol className="space-y-2.5 px-5 pb-5 pt-3 text-sm">
              {hotspots.map((h, i) => (
                <li key={`${h.code}-${h.u}`} className="flex items-baseline justify-between gap-3">
                  <span className="text-ink-2">
                    <span className="mr-2 text-ink-3">{n(i + 1)}</span>
                    {t(disease(h.code)?.name ?? { bn: "", en: "" })}, {t(upazila(h.u)?.name ?? { bn: "", en: "" })}
                  </span>
                  <span className="font-medium tabular-nums">{n(h.v)}</span>
                </li>
              ))}
            </ol>
            <div className="border-t border-line px-5 py-3">
              <Link href="/admin/alerts" className="text-sm text-leaf-700 underline underline-offset-2">
                {t("সতর্কবার্তা পাঠান", "Send an alert")}
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
