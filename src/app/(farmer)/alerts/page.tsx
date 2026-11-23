"use client";

import { useEffect, useState } from "react";
import { CropGlyph } from "@/components/CropGlyph";
import { PageHeader } from "@/components/farmer/Shell";
import { Button } from "@/components/ui/Button";
import { Badge, KeyValue, Notice, Panel, SectionTitle, Steps } from "@/components/ui/Display";
import { Chip, Field, OtpInput, PhoneInput, Select } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";
import { requestOtp, sleep, verifyOtp } from "@/lib/api";
import { CROPS, PRICE_SUB_MONTHLY, UPAZILAS, cropName, upazila } from "@/lib/data";
import { useT } from "@/lib/i18n";
import { maskMsisdn, normalizeMsisdn } from "@/lib/phone";
import { useSession } from "@/lib/session";
import type { CropId } from "@/lib/types";

const RECENT_ALERTS = [
  {
    date: "2026-11-20T07:30:00+06:00",
    bn: "উল্লাপাড়ায় ধানের ব্লাস্ট বাড়ছে। পাতায় চোখের মতো দাগ দেখলে ছবি দিন।",
    en: "Rice blast rising in Ullapara. If you see eye-shaped spots, send a photo.",
  },
  {
    date: "2026-11-14T08:05:00+06:00",
    bn: "আগামী ৩ দিন ঘন কুয়াশা। আলুর জমিতে মড়কের ঝুঁকি বেশি।",
    en: "Dense fog for 3 days. High late-blight risk for potato.",
  },
];

type Stage = "form" | "otp";

export default function AlertsPage() {
  const { t, tk, d, date } = useT();
  const { ready, msisdn, verify, subscription, setSubscription } = useSession();
  const [crops, setCrops] = useState<CropId[]>(["rice"]);
  const [upz, setUpz] = useState("SRJ-ULL");
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);
  const [stage, setStage] = useState<Stage>("form");
  const [ref, setRef] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const [stopped, setStopped] = useState(false);

  useEffect(() => {
    if (msisdn) setPhone(msisdn.slice(2));
  }, [msisdn]);

  const normalized = normalizeMsisdn(phone);
  const toggle = (c: CropId) => setCrops((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  const start = async () => {
    setTouched(true);
    if (!normalized || crops.length === 0) return;
    setBusy(true);
    const r = await requestOtp(normalized);
    setBusy(false);
    setRef(r.referenceNo);
    setStage("otp");
  };

  const confirm = async () => {
    if (!ref || !normalized) return;
    setBusy(true);
    const r = await verifyOtp(ref, code);
    setBusy(false);
    if (r !== "REGISTERED") return;
    verify(normalized);
    setSubscription({ status: "REGISTERED", crops, upazila: upz, since: new Date().toISOString() });
    setStopped(false);
    setStage("form");
  };

  const stop = async () => {
    setBusy(true);
    await sleep(800);
    setBusy(false);
    setSubscription(null);
    setConfirmStop(false);
    setStopped(true);
  };

  if (!ready) return null;

  /* ---------- Subscribed ---------- */
  if (subscription?.status === "REGISTERED") {
    const u = upazila(subscription.upazila);
    return (
      <div>
        <PageHeader title={t("রোগের সতর্কবার্তা", "Disease alerts")} />
        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between bg-leaf-50 px-4 py-3.5">
            <span className="flex items-center gap-2 font-semibold text-leaf-900">
              <Icon name="bell" size={20} />
              {t("সতর্কবার্তা চালু আছে", "Alerts are on")}
            </span>
            <Badge tone="leaf" icon="check">
              {t("নিবন্ধিত", "Registered")}
            </Badge>
          </div>
          <div className="px-4">
            <KeyValue
              rows={[
                {
                  k: t("ফসল", "Crops"),
                  v: subscription.crops.map((c) => t(cropName(c))).join(", "),
                },
                { k: t("এলাকা", "Area"), v: u ? `${t(u.name)}, ${t(u.district)}` : subscription.upazila },
                { k: t("মূল্য", "Price"), v: t(`${tk(PRICE_SUB_MONTHLY)}/মাস`, `${tk(PRICE_SUB_MONTHLY)}/month`) },
                { k: t("নম্বর", "Number"), v: msisdn ? d(maskMsisdn(msisdn)) : "—" },
              ]}
            />
          </div>
        </Panel>

        <section className="mt-7">
          <SectionTitle>{t("সাম্প্রতিক সতর্কবার্তা", "Recent alerts")}</SectionTitle>
          <ul className="space-y-3">
            {RECENT_ALERTS.map((a) => (
              <li key={a.date} className="rounded-2xl rounded-tl-md bg-mist px-4 py-3">
                <p className="text-[0.98rem] leading-relaxed">{t(a.bn, a.en)}</p>
                <p className="mt-1 text-xs text-ink-3">{date(a.date, true)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8 border-t border-line pt-6">
          {!confirmStop ? (
            <Button variant="danger" block icon="x" onClick={() => setConfirmStop(true)}>
              {t("সতর্কবার্তা বন্ধ করুন", "Turn off alerts")}
            </Button>
          ) : (
            <div className="space-y-3 rounded-2xl border border-line p-4">
              <p className="font-medium">{t("সতর্কবার্তা বন্ধ করবেন?", "Turn off alerts?")}</p>
              <p className="text-sm text-ink-2">{t("সঙ্গে সঙ্গে বন্ধ হবে, পরের মাসে টাকা কাটা হবে না।", "Stops immediately. No charge next month.")}</p>
              <div className="grid grid-cols-2 gap-2.5">
                <Button variant="secondary" onClick={() => setConfirmStop(false)}>
                  {t("না, চালু থাক", "Keep them")}
                </Button>
                <Button variant="dark" loading={busy} onClick={stop}>
                  {t("হ্যাঁ, বন্ধ করুন", "Yes, turn off")}
                </Button>
              </div>
            </div>
          )}
          <p className="mt-3 text-center text-sm text-ink-3">{t("অথবা SMS করুন: PD STOP", "Or SMS: PD STOP")}</p>
        </section>
      </div>
    );
  }

  /* ---------- Opt-in (SUB-1, SUB-2, ID-2) ---------- */
  return (
    <div>
      <PageHeader
        title={t("রোগের সতর্কবার্তা", "Disease alerts")}
        subtitle={t("আপনার এলাকায় কোনো রোগ ছড়াতে শুরু করলে সকালে SMS পাবেন।", "Get a morning SMS when a disease starts spreading in your area.")}
      />
      {stopped ? (
        <Notice tone="leaf" className="mb-5" title={t("সতর্কবার্তা বন্ধ হয়েছে", "Alerts turned off")}>
          {t("আর কোনো টাকা কাটা হবে না। চাইলে আবার চালু করতে পারেন।", "You won't be charged again. You can turn them back on anytime.")}
        </Notice>
      ) : null}

      <Steps steps={[t("পছন্দ", "Choose"), t("কোড", "Code")]} current={stage === "form" ? 0 : 1} />

      {stage === "form" ? (
        <div className="mt-6 space-y-6">
          <Field label={t("কোন ফসলের সতর্কবার্তা?", "Alerts for which crops?")} error={touched && crops.length === 0 ? t("অন্তত একটি ফসল বাছুন", "Pick at least one crop") : undefined}>
            <div className="flex flex-wrap gap-2">
              {CROPS.map((c) => (
                <Chip key={c.id} selected={crops.includes(c.id)} onClick={() => toggle(c.id)}>
                  {!crops.includes(c.id) ? <CropGlyph crop={c.id} size={20} /> : null}
                  {t(c.name)}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label={t("আপনার উপজেলা", "Your upazila")} htmlFor="upz">
            <Select id="upz" value={upz} onChange={(e) => setUpz(e.target.value)}>
              {UPAZILAS.map((u) => (
                <option key={u.code} value={u.code}>
                  {t(u.name)}, {t(u.district)}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={t("বাংলালিংক নম্বর", "Banglalink number")}
            htmlFor="al-phone"
            error={touched && !normalized ? t("০১৯ বা ০১৪ দিয়ে শুরু ১১ অঙ্কের নম্বর দিন", "Enter an 11-digit number starting 019 or 014") : undefined}
          >
            <PhoneInput id="al-phone" value={phone} onChange={setPhone} invalid={touched && !normalized} />
          </Field>

          <div className="rounded-2xl border border-leaf-200 bg-leaf-50/60 px-4 py-4">
            <p className="text-2xl font-semibold text-ink">
              {tk(PRICE_SUB_MONTHLY)}
              <span className="text-base font-normal text-ink-2">{t(" / মাস", " / month")}</span>
            </p>
            <ul className="mt-2 space-y-1 text-[0.95rem] text-ink-2">
              <li>{t("প্রতি ফসলে সপ্তাহে সর্বোচ্চ ২টি SMS, সকাল ৭–৯টায়", "Up to 2 SMS per crop per week, 7–9 AM")}</li>
              <li>{t("বাংলালিংক ব্যালেন্স থেকে প্রতি মাসে কাটা হবে", "Charged monthly from Banglalink balance")}</li>
              <li>{t("যেকোনো সময় এক ধাপে বন্ধ করা যায়", "Turn off anytime in one step")}</li>
            </ul>
          </div>

          <Button size="lg" block icon="sms" loading={busy} onClick={start}>
            {t("কোড পাঠান", "Send code")}
          </Button>
          <p className="text-center text-sm text-ink-3">
            {t(
              `SMS দিয়েও চালু করা যায়: PD ALERT DHAN ${d(upazila(upz)?.num ?? "101")}`,
              `Or by SMS: PD ALERT DHAN ${upazila(upz)?.num ?? "101"}`,
            )}
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <p className="text-[1.02rem]">
            {t(
              `${d(maskMsisdn(normalized ?? ""))} নম্বরে কোড গেছে। কোড দিলে ${tk(PRICE_SUB_MONTHLY)}/মাসে সতর্কবার্তা চালু হবে।`,
              `Code sent to ${maskMsisdn(normalized ?? "")}. Entering it turns on alerts at ${tk(PRICE_SUB_MONTHLY)}/month.`,
            )}
          </p>
          <OtpInput label={t("কোড", "Code")} value={code} onChange={setCode} autoFocus />
          <Button size="lg" block disabled={code.length !== 6} loading={busy} onClick={confirm}>
            {t("সতর্কবার্তা চালু করুন", "Turn on alerts")}
          </Button>
          <button onClick={() => setStage("form")} className="w-full text-center text-sm text-ink-3 underline underline-offset-2">
            {t("পেছনে যান", "Go back")}
          </button>
        </div>
      )}
    </div>
  );
}
