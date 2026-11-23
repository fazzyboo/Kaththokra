"use client";

import { useState } from "react";
import { AdminHeader, Card, Table, Td, Th, downloadCsv, statusTone } from "@/components/admin/Shell";
import { Button } from "@/components/ui/Button";
import { Badge, Notice } from "@/components/ui/Display";
import { DEALERS } from "@/lib/admin-data";
import type { DealerRow } from "@/lib/admin-data";
import { upazila } from "@/lib/data";
import { useT } from "@/lib/i18n";

const FRAUD_LIMIT = 0.3; // > 30% of charges to the same 5 numbers (SRS DLR-5)

export default function AdminDealersPage() {
  const { t, n, tk, pct } = useT();
  const [rows, setRows] = useState<DealerRow[]>(DEALERS);
  const flagged = rows.filter((r) => r.topFiveShare > FRAUD_LIMIT);
  const total = rows.reduce((a, r) => a + r.monthCommission, 0);

  const setStatus = (id: string, status: DealerRow["status"]) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));

  return (
    <div>
      <AdminHeader
        title={t("ডিলার", "Dealers")}
        description={t("কমিশন = আমাদের আয়ের ৩০%, প্রতি মাসে Applink-এর বাইরে পরিশোধ।", "Commission = 30% of our share, paid monthly outside Applink.")}
        actions={
          <Button
            size="sm"
            variant="secondary"
            icon="download"
            onClick={() =>
              downloadCsv("kaththokra-dealer-commissions.csv", [
                ["dealerId", "shop", "upazila", "monthSales", "monthCommission", "topFiveShare", "status"],
                ...rows.map((r) => [r.id, r.shop, r.upazila, r.monthSales, r.monthCommission.toFixed(2), r.topFiveShare, r.status]),
              ])
            }
          >
            {t("কমিশন CSV", "Commission CSV")}
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { k: t("সক্রিয় ডিলার", "Active dealers"), v: n(rows.filter((r) => r.status === "active").length) },
          { k: t("এই মাসে বিক্রি", "Sales this month"), v: n(rows.reduce((a, r) => a + r.monthSales, 0)) },
          { k: t("দেয় কমিশন", "Commission owed"), v: tk(total, 2) },
          { k: t("সন্দেহজনক", "Flagged"), v: n(flagged.length) },
        ].map((s) => (
          <div key={s.k} className="rounded-2xl border border-line bg-paper px-4 py-3.5">
            <p className="text-sm text-ink-3">{s.k}</p>
            <p className="mt-1 text-xl font-semibold">{s.v}</p>
          </div>
        ))}
      </div>

      {flagged.length ? (
        <Notice tone="alarm" className="mb-5" title={t("প্রতারণার সম্ভাবনা", "Possible fraud")}>
          {t(
            `${flagged.map((f) => f.shop).join(", ")}: চার্জের ${pct(FRAUD_LIMIT)}-এর বেশি একই ৫টি নম্বরে। পরিশোধের আগে দেখুন।`,
            `${flagged.map((f) => f.shop).join(", ")}: over ${pct(FRAUD_LIMIT)} of charges go to the same 5 numbers. Review before payout.`,
          )}
        </Notice>
      ) : null}

      <Card>
        <Table>
          <thead>
            <tr>
              <Th>{t("দোকান", "Shop")}</Th>
              <Th>{t("উপজেলা", "Upazila")}</Th>
              <Th className="text-right">{t("নির্ণয়", "Diagnoses")}</Th>
              <Th className="text-right">{t("বিক্রি", "Sales")}</Th>
              <Th className="text-right">{t("কমিশন", "Commission")}</Th>
              <Th className="text-right">{t("একই ৫ নম্বর", "Same 5 numbers")}</Th>
              <Th>{t("অবস্থা", "Status")}</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <Td>
                  <span className="block font-medium">{r.shop}</span>
                  <span className="text-xs text-ink-3">
                    {r.id}, {r.msisdn}
                  </span>
                </Td>
                <Td>{t(upazila(r.upazila)?.name ?? { bn: r.upazila, en: r.upazila })}</Td>
                <Td className="text-right tabular-nums">{n(r.diagnoses)}</Td>
                <Td className="text-right tabular-nums">{n(r.monthSales)}</Td>
                <Td className="text-right tabular-nums">{tk(r.monthCommission, 2)}</Td>
                <Td className={r.topFiveShare > FRAUD_LIMIT ? "text-right font-semibold text-alarm tabular-nums" : "text-right tabular-nums text-ink-2"}>{pct(r.topFiveShare)}</Td>
                <Td>
                  <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                </Td>
                <Td className="text-right">
                  {r.status === "active" ? (
                    <Button size="sm" variant="ghost" onClick={() => setStatus(r.id, "paused")}>
                      {t("স্থগিত", "Pause")}
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setStatus(r.id, "active")}>
                      {t("চালু", "Activate")}
                    </Button>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
