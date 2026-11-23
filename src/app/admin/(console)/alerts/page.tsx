"use client";

import { useState } from "react";
import { AdminHeader, Card, Table, Td, Th, statusTone } from "@/components/admin/Shell";
import { Button } from "@/components/ui/Button";
import { Badge, Notice } from "@/components/ui/Display";
import { Chip, Field, Select, TextArea } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";
import { sleep } from "@/lib/api";
import { ALERTS } from "@/lib/admin-data";
import type { AlertItem } from "@/lib/admin-data";
import { CROPS, DISEASES, UPAZILAS, disease, upazila } from "@/lib/data";
import { useT } from "@/lib/i18n";
import type { CropId } from "@/lib/types";

/** REGISTERED subscribers per upazila (from the reconciled mirror). */
const SUBS_PER_UPZ: Record<string, number> = {
  "SRJ-ULL": 212, "SRJ-SHZ": 174, "PBN-CHT": 142, "PBN-ISW": 96, "BOG-SHB": 121, "BOG-SHR": 88, "RNG-PIR": 77, "RNG-MIT": 69, "MUN-SRN": 158, "JSR-JKG": 147,
};

/** Admin creates or approves an alert, previews recipients, sends 7–9 AM (SUB-6, SUB-7, SUB-8). */
export default function AdminAlertsPage() {
  const { t, n, date } = useT();
  const [items, setItems] = useState<AlertItem[]>(ALERTS);
  const [crop, setCrop] = useState<CropId>("rice");
  const [dis, setDis] = useState("RICE_BLAST");
  const [upzs, setUpzs] = useState<string[]>(["SRJ-ULL"]);
  const [msg, setMsg] = useState(
    "কাঠঠোকরা সতর্কতা: আপনার এলাকায় ধানের ব্লাস্ট দেখা যাচ্ছে। চোখের মতো দাগ দেখলে ছবি দিন বা ১৬১২৩-এ কল করুন। বন্ধ: PD STOP",
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const recipients = upzs.reduce((a, u) => a + Math.round((SUBS_PER_UPZ[u] ?? 0) * (crop === "rice" ? 0.8 : 0.35)), 0);
  const segments = Math.ceil(msg.length / 70);

  const approve = async (id: string) => {
    setBusy(id);
    await sleep(700);
    setBusy(null);
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, status: "scheduled" } : x)));
    setFlash(t("অনুমোদিত। আগামীকাল সকাল ৭টায় পাঠানো হবে।", "Approved. Sends tomorrow at 7 AM."));
  };

  const create = async () => {
    setBusy("new");
    await sleep(800);
    setBusy(null);
    setItems((xs) => [
      { id: `AL-${113 + xs.length}`, crop, diseaseCode: dis, upazilas: upzs, message: { bn: msg, en: msg }, status: "scheduled", recipients, at: new Date().toISOString() },
      ...xs,
    ]);
    setFlash(t(`${n(recipients)} জনের জন্য নির্ধারিত, আগামীকাল সকাল ৭–৯টা।`, `Scheduled for ${recipients} subscribers, tomorrow 7–9 AM.`));
  };

  const suggested = items.filter((a) => a.status === "suggested");

  return (
    <div>
      <AdminHeader
        title={t("সতর্কবার্তা", "Alerts")}
        description={t(
          "শুধু REGISTERED গ্রাহকদের কাছে যায়। প্রতি ফসলে সপ্তাহে সর্বোচ্চ ২টি, সকাল ৭–৯টায়।",
          "Goes only to REGISTERED subscribers. At most 2 per crop per week, sent 7–9 AM.",
        )}
      />

      {flash ? (
        <Notice tone="leaf" className="mb-5">
          {flash}
        </Notice>
      ) : null}

      {suggested.length ? (
        <section className="mb-6 space-y-3">
          {suggested.map((a) => (
            <div key={a.id} className="rounded-2xl border border-crest/30 bg-paper p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 font-semibold">
                    <Icon name="alert" size={18} className="text-crest" />
                    {t("প্রাদুর্ভাব থেকে প্রস্তাবিত", "Suggested from an outbreak")}: {t(disease(a.diseaseCode)?.name ?? { bn: "", en: "" })}
                  </p>
                  <p className="mt-1 text-sm text-ink-2">
                    {a.upazilas.map((u) => t(upazila(u)?.name ?? { bn: u, en: u })).join(", ")}. {a.trigger}
                  </p>
                </div>
                <Badge tone="sun">{t(`${n(a.recipients)} প্রাপক`, `${a.recipients} recipients`)}</Badge>
              </div>
              <p className="mt-3 rounded-xl rounded-tl-sm bg-mist px-4 py-3 text-sm leading-relaxed">{t(a.message)}</p>
              <div className="mt-4 flex gap-2">
                <Button size="sm" icon="check" loading={busy === a.id} onClick={() => approve(a.id)}>
                  {t("অনুমোদন ও নির্ধারণ", "Approve and schedule")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setItems((xs) => xs.filter((x) => x.id !== a.id))}>
                  {t("বাদ দিন", "Dismiss")}
                </Button>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <Card title={t("নতুন সতর্কবার্তা", "New alert")}>
          <div className="space-y-4 px-5 pb-5 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("ফসল", "Crop")} htmlFor="a-crop">
                <Select
                  id="a-crop"
                  size="sm"
                  value={crop}
                  onChange={(e) => {
                    const c = e.target.value as CropId;
                    setCrop(c);
                    setDis(DISEASES.find((d) => d.crop === c && !d.healthy)?.code ?? "");
                  }}
                >
                  {CROPS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {t(c.name)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("রোগ", "Disease")} htmlFor="a-dis">
                <Select id="a-dis" size="sm" value={dis} onChange={(e) => setDis(e.target.value)}>
                  {DISEASES.filter((d) => d.crop === crop && !d.healthy).map((d) => (
                    <option key={d.code} value={d.code}>
                      {t(d.name)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label={t("উপজেলা", "Upazilas")}>
              <div className="flex flex-wrap gap-1.5">
                {UPAZILAS.map((u) => (
                  <Chip key={u.code} size="sm" selected={upzs.includes(u.code)} onClick={() => setUpzs((x) => (x.includes(u.code) ? x.filter((y) => y !== u.code) : [...x, u.code]))}>
                    {t(u.name)}
                  </Chip>
                ))}
              </div>
            </Field>
            <Field label={t("বার্তা (কৃষিবিদ-অনুমোদিত টেমপ্লেট)", "Message (agronomist-approved template)")} htmlFor="a-msg" hint={t(`${n(msg.length)} অক্ষর, ${n(segments)}টি SMS অংশ`, `${msg.length} characters, ${segments} SMS segments`)}>
              <TextArea id="a-msg" value={msg} onChange={(e) => setMsg(e.target.value)} />
            </Field>
            <div className="flex items-center justify-between rounded-xl bg-mist px-4 py-3">
              <span className="text-sm text-ink-2">{t("প্রাপক (মিলিয়ে দেখা)", "Recipients (reconciled)")}</span>
              <span className="text-xl font-semibold">{n(recipients)}</span>
            </div>
            <Button block icon="send" disabled={upzs.length === 0 || !msg.trim()} loading={busy === "new"} onClick={create}>
              {t("সকাল ৭টায় পাঠান", "Schedule for 7 AM")}
            </Button>
          </div>
        </Card>

        <Card title={t("ইতিহাস", "History")}>
          <Table className="mt-2">
            <thead>
              <tr>
                <Th>ID</Th>
                <Th>{t("রোগ ও এলাকা", "Disease and area")}</Th>
                <Th className="text-right">{t("প্রাপক", "Sent to")}</Th>
                <Th>{t("অবস্থা", "Status")}</Th>
              </tr>
            </thead>
            <tbody>
              {items
                .filter((a) => a.status !== "suggested")
                .map((a) => (
                  <tr key={a.id}>
                    <Td>
                      <span className="block font-medium">{a.id}</span>
                      <span className="text-xs text-ink-3">{date(a.at)}</span>
                    </Td>
                    <Td>
                      {t(disease(a.diseaseCode)?.name ?? { bn: "", en: "" })}
                      <span className="block text-xs text-ink-3">{a.upazilas.map((u) => t(upazila(u)?.name ?? { bn: u, en: u })).join(", ")}</span>
                    </Td>
                    <Td className="text-right tabular-nums">
                      {n(a.recipients)}
                      {a.delivered ? <span className="block text-xs text-ink-3">{t(`${n(a.delivered)} পৌঁছেছে`, `${a.delivered} delivered`)}</span> : null}
                    </Td>
                    <Td>
                      <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                    </Td>
                  </tr>
                ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
