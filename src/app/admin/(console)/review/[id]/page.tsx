"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AdminHeader, Card } from "@/components/admin/Shell";
import { CandidateList } from "@/components/diagnosis/Confidence";
import { useParamId } from "@/components/diagnosis/DiagnosisResult";
import { Button } from "@/components/ui/Button";
import { Badge, EmptyState, KeyValue, Notice } from "@/components/ui/Display";
import { Field, Select, TextArea } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";
import { sleep } from "@/lib/api";
import { REVIEW } from "@/lib/admin-data";
import { DISEASES, cropName, disease, upazila } from "@/lib/data";
import { SAMPLE_LEAF } from "@/lib/image";
import { useT } from "@/lib/i18n";

export default function ReviewDetailPage() {
  const params = useParams<{ id: string }>();
  const id = useParamId(params?.id);
  const { t, date } = useT();
  const item = REVIEW.find((r) => r.id === id);
  const [verdict, setVerdict] = useState(item?.verdict ?? item?.top3[0]?.code ?? "");
  const [reply, setReply] = useState("");
  const [useForTraining, setUseForTraining] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(item?.status === "done");

  if (!item)
    return (
      <EmptyState
        icon="eye"
        title={t("কেস পাওয়া যায়নি", "Case not found")}
        action={
          <Link href="/admin/review" className="text-leaf-700 underline">
            {t("সারিতে ফিরুন", "Back to queue")}
          </Link>
        }
      />
    );

  const u = upazila(item.upazila);
  const submit = async () => {
    setBusy(true);
    await sleep(800);
    setBusy(false);
    setDone(true);
  };

  return (
    <div>
      <Link href="/admin/review" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink">
        <Icon name="chevronLeft" size={16} />
        {t("রিভিউ সারি", "Review queue")}
      </Link>
      <AdminHeader
        title={item.id}
        description={`${t(cropName(item.crop))}, ${u ? `${t(u.name)}, ${t(u.district)}` : item.upazila}. ${date(item.at, true)}`}
        actions={item.kind === "dispute" ? <Badge tone="crest">{t("অভিযোগ", "Dispute")}</Badge> : <Badge tone="sun">{t("অনিশ্চিত", "Uncertain")}</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-6">
          <Card>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={SAMPLE_LEAF} alt={t("কৃষকের পাঠানো পাতার ছবি", "Leaf photo sent by the farmer")} className="aspect-[4/3] w-full rounded-t-2xl object-cover" />
            <p className="px-5 py-3 text-xs text-ink-3">{t("৫১২ px, EXIF মুছে ফেলা। প্রশিক্ষণে ব্যবহারের অনুমতি আছে।", "512 px, EXIF removed. Consent given for training use.")}</p>
          </Card>
          <Card title={t("মডেলের অনুমান", "Model's guess")}>
            <div className="px-5 pb-5 pt-3">
              <CandidateList items={item.top3.map((c) => ({ name: t(disease(c.code)?.name ?? { bn: c.code, en: c.code }), p: c.p }))} />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {item.answers || item.note ? (
            <Card title={t("কৃষক যা বলেছেন", "What the farmer said")}>
              <div className="px-5 pb-4">
                <KeyValue
                  rows={[
                    ...(item.answers ?? []).map((a, i) => ({ k: t(`প্রশ্ন ${i + 1}`, `Question ${i + 1}`), v: a })),
                    ...(item.note ? [{ k: t("নোট", "Note"), v: item.note }] : []),
                  ]}
                />
              </div>
            </Card>
          ) : null}

          <Card title={t("আপনার রায়", "Your verdict")}>
            <div className="space-y-4 px-5 pb-5 pt-3">
              {done ? (
                <Notice tone="leaf" title={t("রায় পাঠানো হয়েছে", "Verdict sent")}>
                  {t("কৃষককে SMS গেছে। লেবেল প্রশিক্ষণ সেটে যোগ হয়েছে।", "The farmer got an SMS. The label was added to the training set.")}
                </Notice>
              ) : (
                <>
                  <Field label={t("রোগ", "Disease")} htmlFor="verdict">
                    <Select id="verdict" size="sm" value={verdict} onChange={(e) => setVerdict(e.target.value)}>
                      {DISEASES.filter((d) => d.crop === item.crop).map((d) => (
                        <option key={d.code} value={d.code}>
                          {t(d.name)}
                        </option>
                      ))}
                      <option value="OUT_OF_SCOPE">{t("আমাদের তালিকার বাইরে", "Not in our list")}</option>
                      <option value="NOT_A_LEAF">{t("পাতা নয় / অস্পষ্ট", "Not a leaf / unclear")}</option>
                    </Select>
                  </Field>
                  <Field label={t("কৃষককে SMS (ঐচ্ছিক)", "SMS to the farmer (optional)")} htmlFor="reply" hint={t("খালি রাখলে অনুমোদিত টেমপ্লেট যাবে", "Leave empty to send the approved template")}>
                    <TextArea id="reply" value={reply} onChange={(e) => setReply(e.target.value)} maxLength={300} />
                  </Field>
                  <label className="flex items-center gap-2 text-sm text-ink-2">
                    <input type="checkbox" className="h-4 w-4 accent-leaf-600" checked={useForTraining} onChange={(e) => setUseForTraining(e.target.checked)} />
                    {t("প্রশিক্ষণের লেবেল হিসেবে রাখুন", "Keep as a training label")}
                  </label>
                  {item.kind === "dispute" ? (
                    <Notice tone="sun">{t("অভিযোগ: ফেরত দিতে পেমেন্ট খাতায় যান।", "Dispute: to refund, open the payment ledger.")}</Notice>
                  ) : null}
                  <Button block icon="send" loading={busy} onClick={submit}>
                    {t("রায় পাঠান", "Send verdict")}
                  </Button>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
