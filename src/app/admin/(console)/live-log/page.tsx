"use client";

import { useEffect, useRef, useState } from "react";
import { AdminHeader, Card, Table, Td, Th, statusTone } from "@/components/admin/Shell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Display";
import { Segmented } from "@/components/ui/Form";
import { LOG_TEMPLATES, seedLog } from "@/lib/admin-data";
import type { LogEntry } from "@/lib/admin-data";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n";

type Filter = "all" | "caas" | "sms" | "ussd" | "sub";

const match = (f: Filter, api: string) =>
  f === "all" ||
  (f === "caas" && api.includes("caas")) ||
  (f === "sms" && api.includes("sms")) ||
  (f === "ussd" && api.includes("ussd")) ||
  (f === "sub" && (api.includes("otp/") || api.includes("subscription")));

/** Every Applink request and callback, numbers masked (SRS ADM-2). */
export default function LiveLogPage() {
  const { t, n } = useT();
  const [rows, setRows] = useState<LogEntry[]>(() => seedLog());
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const cursor = useRef(0);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      const tpl = LOG_TEMPLATES[cursor.current % LOG_TEMPLATES.length];
      cursor.current += 1;
      setRows((r) => [{ ...tpl, id: `live-${Date.now()}`, at: new Date().toISOString() }, ...r].slice(0, 60));
    }, 2500);
    return () => window.clearInterval(id);
  }, [paused]);

  const visible = rows.filter((r) => match(filter, r.api));
  const errors = rows.filter((r) => r.status.startsWith("E")).length;

  return (
    <div>
      <AdminHeader
        title={t("লাইভ Applink লগ", "Live Applink log")}
        description={t(
          "প্রতিটি অনুরোধ ও কলব্যাক। নম্বর মাস্ক করা; সাবস্ক্রিপশন নোটিফাইয়ের বডি কখনো লগ হয় না।",
          "Every request and callback. Numbers are masked; subscription notify bodies are never logged.",
        )}
        actions={
          <Button size="sm" variant={paused ? "primary" : "secondary"} icon={paused ? "refresh" : "clock"} onClick={() => setPaused((p) => !p)}>
            {paused ? t("আবার চালু", "Resume") : t("থামান", "Pause")}
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented<Filter>
          label={t("API ফিল্টার", "API filter")}
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: t("সব", "All") },
            { value: "caas", label: "CaaS" },
            { value: "sms", label: "SMS" },
            { value: "ussd", label: "USSD" },
            { value: "sub", label: t("OTP ও সাবস্ক্রিপশন", "OTP and subscription") },
          ]}
        />
        <p className="flex items-center gap-2 text-sm text-ink-3">
          {!paused ? <span className="live-dot h-2 w-2 rounded-full bg-leaf-500" /> : null}
          {t(`${n(rows.length)}টি ইভেন্ট, ${n(errors)}টি ত্রুটি`, `${rows.length} events, ${errors} errors`)}
        </p>
      </div>
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>{t("সময়", "Time")}</Th>
              <Th>{t("দিক", "Dir")}</Th>
              <Th>API</Th>
              <Th>{t("নম্বর", "Number")}</Th>
              <Th>{t("স্ট্যাটাস", "Status")}</Th>
              <Th className="text-right">ms</Th>
              <Th>{t("নোট", "Note")}</Th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id} className={cn(r.id.startsWith("live") && "row-new")}>
                <Td className="whitespace-nowrap tabular-nums text-ink-2">{new Date(r.at).toLocaleTimeString("en-GB")}</Td>
                <Td>
                  <span className={cn("text-xs font-medium", r.dir === "out" ? "text-ink-2" : "text-leaf-700")}>{r.dir === "out" ? "→ Applink" : "← Applink"}</span>
                </Td>
                <Td className="font-mono text-[0.8rem]">{r.api}</Td>
                <Td className="tabular-nums">{r.msisdn}</Td>
                <Td>
                  <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                </Td>
                <Td className="text-right tabular-nums text-ink-2">{r.ms ?? "—"}</Td>
                <Td className="text-ink-2">{r.note ?? ""}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
