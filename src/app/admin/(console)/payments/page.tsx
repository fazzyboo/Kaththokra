"use client";

import { Fragment, useState } from "react";
import { AdminHeader, Card, Table, Td, Th, downloadCsv, statusTone } from "@/components/admin/Shell";
import { Button } from "@/components/ui/Button";
import { Badge, Notice } from "@/components/ui/Display";
import { Segmented } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";
import { LEDGER } from "@/lib/admin-data";
import type { LedgerRow } from "@/lib/admin-data";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n";
import type { PaymentStatus } from "@/lib/types";

type Filter = "all" | "attention" | "settled" | "failed";

const SETTLED: PaymentStatus[] = ["PAID", "FULFILLED", "DELIVERED"];
const FLOW: PaymentStatus[] = ["CREATED", "OTP_SENT", "VERIFYING", "PAID", "FULFILLED", "DELIVERED"];

/** Payment ledger with reconciliation and manual refunds (PAY-10, BR R-10, ADM-7). */
export default function PaymentsPage() {
  const { t, tk, n } = useT();
  const [rows, setRows] = useState<LedgerRow[]>(LEDGER);
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const attention = (r: LedgerRow) => r.status === "DISPUTED" || r.status === "VERIFYING";
  const list = rows.filter((r) =>
    filter === "all" ? true : filter === "attention" ? attention(r) : filter === "settled" ? SETTLED.includes(r.status) : ["FAILED", "EXPIRED"].includes(r.status),
  );
  const settledTotal = rows.filter((r) => SETTLED.includes(r.status)).reduce((a, r) => a + r.amount, 0);

  const update = (id: string, status: PaymentStatus, msg: string) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
    setToast(msg);
    window.setTimeout(() => setToast(null), 3500);
  };

  return (
    <div>
      <AdminHeader
        title={t("পেমেন্ট খাতা", "Payment ledger")}
        description={t(
          "শুধু চার্জিং নোটিফিকেশন (S1000) পেমেন্টকে PAID করে। খাতা শুধু যোগ হয়, মোছা যায় না।",
          "Only a charging notification (S1000) marks a payment PAID. The ledger is append-only.",
        )}
        actions={
          <Button
            size="sm"
            variant="secondary"
            icon="download"
            onClick={() =>
              downloadCsv("kaththokra-payments.csv", [
                ["id", "externalTrxId", "correlator", "msisdn", "amount", "status", "channel", "dealer", "createdAt", "ref"],
                ...rows.map((r) => [r.id, r.externalTrxId, r.correlator, r.msisdn, r.amount, r.status, r.channel, r.dealer ?? "", r.createdAt, r.ref ?? ""]),
              ])
            }
          >
            CSV
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { k: t("নিষ্পন্ন", "Settled"), v: tk(settledTotal) },
          { k: t("মনোযোগ দরকার", "Needs attention"), v: n(rows.filter(attention).length) },
          { k: t("ব্যর্থ বা মেয়াদোত্তীর্ণ", "Failed or expired"), v: n(rows.filter((r) => r.status === "FAILED" || r.status === "EXPIRED").length) },
          { k: t("দ্বিগুণ চার্জ", "Double charges"), v: n(0) },
        ].map((s) => (
          <div key={s.k} className="rounded-2xl border border-line bg-paper px-4 py-3.5">
            <p className="text-sm text-ink-3">{s.k}</p>
            <p className="mt-1 text-xl font-semibold">{s.v}</p>
          </div>
        ))}
      </div>

      {toast ? (
        <Notice tone="leaf" className="mb-4">
          {toast}
        </Notice>
      ) : null}

      <div className="mb-4">
        <Segmented<Filter>
          label={t("ফিল্টার", "Filter")}
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: t("সব", "All") },
            { value: "attention", label: t("মনোযোগ দরকার", "Needs attention") },
            { value: "settled", label: t("নিষ্পন্ন", "Settled") },
            { value: "failed", label: t("ব্যর্থ", "Failed") },
          ]}
        />
      </div>

      <Card>
        <Table>
          <thead>
            <tr>
              <Th>{t("পেমেন্ট", "Payment")}</Th>
              <Th>{t("নম্বর", "Number")}</Th>
              <Th>{t("চ্যানেল", "Channel")}</Th>
              <Th className="text-right">{t("পরিমাণ", "Amount")}</Th>
              <Th>{t("অবস্থা", "State")}</Th>
              <Th>{t("রেফ", "Ref")}</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const idx = FLOW.indexOf(r.status);
              return (
                <Fragment key={r.id}>
                  <tr className={cn("cursor-pointer hover:bg-mist/60", open === r.id && "bg-mist/60")} onClick={() => setOpen(open === r.id ? null : r.id)}>
                    <Td>
                      <span className="block font-medium">{r.correlator}</span>
                      <span className="block text-xs text-ink-3">{new Date(r.createdAt).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}</span>
                    </Td>
                    <Td className="tabular-nums">{r.msisdn}</Td>
                    <Td>
                      {r.channel === "dealer" ? (
                        <span>
                          {t("ডিলার", "Dealer")}
                          <span className="block text-xs text-ink-3">{r.dealer}</span>
                        </span>
                      ) : r.channel === "ussd" ? (
                        "USSD"
                      ) : (
                        t("ওয়েব", "Web")
                      )}
                    </Td>
                    <Td className="text-right tabular-nums">{tk(r.amount, 2)}</Td>
                    <Td>
                      <Badge tone={r.status === "EXPIRED" || r.status === "REFUNDED_MANUAL" ? "neutral" : statusTone(r.status)}>{r.status}</Badge>
                    </Td>
                    <Td className="text-ink-2">{r.ref ?? "—"}</Td>
                    <Td className="text-right">
                      <Icon name="chevronDown" size={16} className={cn("inline text-ink-3 transition-transform", open === r.id && "rotate-180")} />
                    </Td>
                  </tr>
                  {open === r.id ? (
                    <tr>
                      <td colSpan={7} className="border-b border-line bg-mist/40 px-4 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-6">
                          <div>
                            <p className="mb-2 text-xs text-ink-3">{t("অবস্থার ধারা", "State machine")}</p>
                            <ol className="flex flex-wrap items-center gap-1.5 text-xs">
                              {FLOW.map((s, i) => (
                                <li key={s} className="flex items-center gap-1.5">
                                  <span className={cn("rounded-full px-2 py-0.5", idx >= i ? "bg-leaf-600 text-white" : "bg-paper text-ink-3 ring-1 ring-line")}>{s}</span>
                                  {i < FLOW.length - 1 ? <Icon name="chevronRight" size={12} className="text-ink-3" /> : null}
                                </li>
                              ))}
                            </ol>
                            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                              <dt className="text-ink-3">externalTrxId</dt>
                              <dd className="font-mono">{r.externalTrxId}…</dd>
                              <dt className="text-ink-3">requestCorrelator</dt>
                              <dd className="font-mono">{r.correlator}</dd>
                              <dt className="text-ink-3">{t("শেষ কোড", "Last code")}</dt>
                              <dd className="font-mono">{r.code}</dd>
                            </dl>
                          </div>
                          <div className="flex gap-2">
                            {r.status === "DISPUTED" ? (
                              <Button
                                size="sm"
                                variant="dark"
                                icon="refresh"
                                onClick={() => update(r.id, "REFUNDED_MANUAL", t(`${r.correlator} ফেরত অনুমোদিত, অডিট লগে রেকর্ড হয়েছে।`, `Refund for ${r.correlator} approved and logged.`))}
                              >
                                {t("ফেরত অনুমোদন", "Approve refund")}
                              </Button>
                            ) : null}
                            {r.status === "VERIFYING" ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                icon="search"
                                onClick={() => update(r.id, "FAILED", t(`${r.correlator}: কোনো নোটিফিকেশন নেই, FAILED করা হয়েছে।`, `${r.correlator}: no notification found, marked FAILED.`))}
                              >
                                {t("মিলিয়ে দেখুন", "Reconcile")}
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </Table>
      </Card>
      <p className="mt-3 text-xs text-ink-3">
        {t("১০ মিনিটের বেশি VERIFYING থাকলে পেমেন্ট মিলিয়ে দেখার সারিতে যায়। ডেবিট কখনো স্বয়ংক্রিয়ভাবে আবার চালানো হয় না।", "Payments stuck in VERIFYING for 10 minutes go to reconciliation. A debit is never retried automatically.")}
      </p>
    </div>
  );
}
