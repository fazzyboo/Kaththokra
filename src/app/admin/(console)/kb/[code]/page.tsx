"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AdminHeader, Card, statusTone } from "@/components/admin/Shell";
import { useParamId } from "@/components/diagnosis/DiagnosisResult";
import { Button } from "@/components/ui/Button";
import { Badge, EmptyState, Notice } from "@/components/ui/Display";
import { Field, TextArea, TextInput } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";
import { sleep } from "@/lib/api";
import { KB_LABEL, KB_STATUS_ORDER } from "@/lib/admin-data";
import { cn } from "@/lib/cn";
import { DISEASES, cropName } from "@/lib/data";
import { useT } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { KbStatus } from "@/lib/types";

const BRANDISH = /[®™]|\b(ltd|limited|company|corp)\b/i;

export default function KbEditorPage() {
  const params = useParams<{ code: string }>();
  const code = useParamId(params?.code);
  const { t, n } = useT();
  const { admin } = useSession();
  const base = DISEASES.find((d) => d.code === code);

  const [status, setStatus] = useState<KbStatus>(base?.kbStatus ?? "draft");
  const [version, setVersion] = useState(base?.kbVersion ?? 1);
  const [nameBn, setNameBn] = useState(base?.name.bn ?? "");
  const [nameEn, setNameEn] = useState(base?.name.en ?? "");
  const [banglish, setBanglish] = useState(base?.banglish ?? "");
  const [symptoms, setSymptoms] = useState(base?.symptoms.map((s) => s.bn).join("\n") ?? "");
  const [ai, setAi] = useState(base?.activeIngredient.en ?? "");
  const [dose, setDose] = useState(base?.dose.en ?? "");
  const [timing, setTiming] = useState(base?.timing.en ?? "");
  const [phi, setPhi] = useState(String(base?.phiDays ?? 0));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  if (!base)
    return (
      <EmptyState
        icon="book"
        title={t("রোগটি পাওয়া যায়নি", "Disease not found")}
        action={
          <Link href="/admin/kb" className="text-leaf-700 underline">
            {t("জ্ঞানভান্ডার", "Knowledge base")}
          </Link>
        }
      />
    );

  const sms = `${banglish} (${cropName(base.crop).en}). Osudh: ${ai}. Matra: ${dose}. ${timing}. Fosol tolar ${phi} din age sesh spray. Mask-glove porun. Label porun. Ref PD-XXXXXX. Tk5 paid.`;
  const segs = Math.ceil(sms.length / 153);
  const brandWarning = BRANDISH.test(ai);
  const isAgronomist = admin?.role === "agronomist" || admin?.role === "admin";

  const transition = async (to: KbStatus, msg: string) => {
    setBusy(true);
    await sleep(600);
    setBusy(false);
    if (to === "draft") setVersion((v) => v + 1);
    setStatus(to);
    setSaved(msg);
  };

  const step = KB_STATUS_ORDER.indexOf(status);

  return (
    <div>
      <Link href="/admin/kb" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink">
        <Icon name="chevronLeft" size={16} />
        {t("জ্ঞানভান্ডার", "Knowledge base")}
      </Link>
      <AdminHeader
        title={t(base.name)}
        description={`${base.code}, ${t(cropName(base.crop))}`}
        actions={
          <>
            <Badge tone="neutral">v{n(version)}</Badge>
            <Badge tone={statusTone(status)}>{t(KB_LABEL[status])}</Badge>
          </>
        }
      />

      <ol className="mb-6 flex flex-wrap items-center gap-2 text-sm">
        {KB_STATUS_ORDER.slice(0, 4).map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span className={cn("rounded-full px-3 py-1", i < step ? "bg-leaf-50 text-leaf-800" : i === step ? "bg-ink text-white" : "bg-mist text-ink-3")}>{t(KB_LABEL[s])}</span>
            {i < 3 ? <Icon name="chevronRight" size={14} className="text-ink-3" /> : null}
          </li>
        ))}
      </ol>

      {saved ? (
        <Notice tone="leaf" className="mb-5">
          {saved}
        </Notice>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Card title={t("বিষয়বস্তু", "Content")}>
          <fieldset disabled={status !== "draft"} className="grid gap-4 px-5 pb-5 pt-3 disabled:opacity-80 sm:grid-cols-2">
            <Field label={t("নাম (বাংলা)", "Name (Bangla)")} htmlFor="nbn">
              <TextInput id="nbn" size="sm" value={nameBn} onChange={(e) => setNameBn(e.target.value)} />
            </Field>
            <Field label={t("নাম (ইংরেজি)", "Name (English)")} htmlFor="nen">
              <TextInput id="nen" size="sm" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
            </Field>
            <Field label={t("বাংলিশ নাম (USSD/SMS)", "Banglish name (USSD/SMS)")} htmlFor="bgl">
              <TextInput id="bgl" size="sm" value={banglish} onChange={(e) => setBanglish(e.target.value)} />
            </Field>
            <Field label={t("ফসল তোলার আগে বিরতি (দিন)", "Pre-harvest interval (days)")} htmlFor="phi">
              <TextInput id="phi" size="sm" inputMode="numeric" value={phi} onChange={(e) => setPhi(e.target.value.replace(/\D/g, ""))} />
            </Field>
            <Field className="sm:col-span-2" label={t("লক্ষণ (প্রতি লাইনে একটি)", "Symptoms (one per line)")} htmlFor="sym">
              <TextArea id="sym" value={symptoms} onChange={(e) => setSymptoms(e.target.value)} />
            </Field>
            <Field
              className="sm:col-span-2"
              label={t("সক্রিয় উপাদান (জেনেরিক)", "Active ingredient (generic)")}
              htmlFor="ai"
              error={brandWarning ? t("ব্র্যান্ডের নাম দেবেন না, শুধু সক্রিয় উপাদান।", "No brand names, only the active ingredient.") : undefined}
              hint={t("ব্র্যান্ডের প্রচার নিষেধ", "Brand promotion is not allowed")}
            >
              <TextInput id="ai" size="sm" value={ai} onChange={(e) => setAi(e.target.value)} />
            </Field>
            <Field label={t("প্রতি শতকে মাত্রা", "Dose per shotok")} htmlFor="dose">
              <TextInput id="dose" size="sm" value={dose} onChange={(e) => setDose(e.target.value)} />
            </Field>
            <Field label={t("সময় ও পুনরাবৃত্তি", "Timing and repeat")} htmlFor="tim">
              <TextInput id="tim" size="sm" value={timing} onChange={(e) => setTiming(e.target.value)} />
            </Field>
          </fieldset>
        </Card>

        <div className="space-y-6">
          <Card title={t("SMS প্রিভিউ", "SMS preview")}>
            <div className="px-5 pb-5 pt-3">
              <p className="rounded-xl rounded-tl-sm bg-mist px-4 py-3 text-sm leading-relaxed">{sms}</p>
              <p className={cn("mt-2 text-xs", segs > 3 ? "text-alarm" : "text-ink-3")}>
                {t(`${n(sms.length)} অক্ষর, ${n(segs)}টি অংশ (সর্বোচ্চ ৩)`, `${sms.length} characters, ${segs} segments (max 3)`)}
              </p>
            </div>
          </Card>

          <Card title={t("কাজ", "Workflow")}>
            <div className="space-y-3 px-5 pb-5 pt-3">
              {status === "draft" ? (
                <Button block icon="send" loading={busy} disabled={brandWarning || segs > 3} onClick={() => transition("review", t("রিভিউর জন্য পাঠানো হয়েছে।", "Sent for review."))}>
                  {t("রিভিউতে পাঠান", "Submit for review")}
                </Button>
              ) : null}
              {status === "review" ? (
                <>
                  <Button block icon="check" loading={busy} disabled={!isAgronomist} onClick={() => transition("approved", t("অনুমোদিত। প্রকাশের জন্য তৈরি।", "Approved. Ready to publish."))}>
                    {t("কৃষিবিদ হিসেবে অনুমোদন", "Approve as agronomist")}
                  </Button>
                  <Button block variant="secondary" onClick={() => transition("draft", t("খসড়ায় ফেরত গেছে।", "Sent back to draft."))}>
                    {t("পরিবর্তন চান", "Request changes")}
                  </Button>
                </>
              ) : null}
              {status === "approved" ? (
                <Button block icon="upload" loading={busy} onClick={() => transition("published", t(`v${version} প্রকাশিত। নতুন প্রেসক্রিপশন এই সংস্করণ ব্যবহার করবে।`, `v${version} published. New prescriptions use this version.`))}>
                  {t("প্রকাশ করুন", "Publish")}
                </Button>
              ) : null}
              {status === "published" ? (
                <Button block variant="secondary" icon="edit" loading={busy} onClick={() => transition("draft", t(`নতুন খসড়া v${version + 1} তৈরি হয়েছে।`, `New draft v${version + 1} created.`))}>
                  {t("নতুন সংস্করণ লিখুন", "Start a new version")}
                </Button>
              ) : null}
              <p className="text-xs text-ink-3">
                {base.approvedBy
                  ? t(`শেষ অনুমোদন: ${base.approvedBy}, ${base.approvedAt}`, `Last approved by ${base.approvedBy} on ${base.approvedAt}`)
                  : t("এখনো অনুমোদিত হয়নি", "Not approved yet")}
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
