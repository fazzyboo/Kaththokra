"use client";

import { useState } from "react";
import { AdminHeader, Card, Table, Td, Th, statusTone } from "@/components/admin/Shell";
import { Button } from "@/components/ui/Button";
import { Badge, Notice } from "@/components/ui/Display";
import { sleep } from "@/lib/api";
import { SUBS, SUBSCRIBERS } from "@/lib/admin-data";
import { cropName, upazila } from "@/lib/data";
import { useT } from "@/lib/i18n";

/**
 * Local subscription mirror. Applink has no status endpoint, so state comes from the notify
 * callback plus a nightly getSubscriberChargingInfo check in batches of 10 (SUB-4, SUB-5).
 */
export default function SubscribersPage() {
  const { t, n, date } = useT();
  const [rows, setRows] = useState(SUBS);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const reconcile = async () => {
    setBusy(true);
    await sleep(1200);
    setBusy(false);
    setRows((rs) => rs.map((r) => ({ ...r, reconciled: true })));
    setDone(true);
  };

  return (
    <div>
      <AdminHeader
        title={t("সতর্কবার্তার গ্রাহক", "Alert subscribers")}
        description={t(
          "স্থানীয় প্রতিলিপি, নোটিফাই কলব্যাক ও রাতের যাচাই দিয়ে হালনাগাদ। সতর্কবার্তা শুধু দুই জায়গাতেই REGISTERED নম্বরে যায়।",
          "Local mirror, updated by the notify callback and a nightly check. Alerts go only to numbers REGISTERED in both.",
        )}
        actions={
          <Button size="sm" variant="secondary" icon="refresh" loading={busy} onClick={reconcile}>
            {t("এখন মিলিয়ে দেখুন", "Reconcile now")}
          </Button>
        }
      />
      <div className="mb-5 grid grid-cols-3 gap-3">
        {[
          { k: t("নিবন্ধিত", "Registered"), v: n(SUBSCRIBERS.total) },
          { k: t("এই সপ্তাহে নতুন", "New this week"), v: n(SUBSCRIBERS.newThisWeek) },
          { k: t("এই সপ্তাহে বন্ধ", "Stopped this week"), v: n(SUBSCRIBERS.churnThisWeek) },
        ].map((s) => (
          <div key={s.k} className="rounded-2xl border border-line bg-paper px-4 py-3.5">
            <p className="text-sm text-ink-3">{s.k}</p>
            <p className="mt-1 text-xl font-semibold">{s.v}</p>
          </div>
        ))}
      </div>
      {done ? (
        <Notice tone="leaf" className="mb-4">
          {t("সব নম্বর মিলেছে।", "All numbers reconciled.")}
        </Notice>
      ) : null}
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>{t("নম্বর", "Number")}</Th>
              <Th>{t("ফসল", "Crops")}</Th>
              <Th>{t("উপজেলা", "Upazila")}</Th>
              <Th>{t("উৎস", "Source")}</Th>
              <Th>{t("অবস্থা", "Status")}</Th>
              <Th>{t("শেষ চার্জ", "Last charge")}</Th>
              <Th>{t("মিলেছে", "Reconciled")}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.msisdn}>
                <Td className="tabular-nums">{r.msisdn}</Td>
                <Td>{r.crops.map((c) => t(cropName(c))).join(", ")}</Td>
                <Td>{t(upazila(r.upazila)?.name ?? { bn: r.upazila, en: r.upazila })}</Td>
                <Td className="uppercase text-ink-2">{r.source}</Td>
                <Td>
                  <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                </Td>
                <Td className="text-ink-2">{r.lastCharge ? date(r.lastCharge) : "—"}</Td>
                <Td>{r.reconciled ? <Badge tone="leaf" icon="check">{t("হ্যাঁ", "Yes")}</Badge> : <Badge tone="sun">{t("অপেক্ষায়", "Pending")}</Badge>}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
