"use client";

import { useState } from "react";
import { AdminHeader, Card } from "@/components/admin/Shell";
import { Button } from "@/components/ui/Button";
import { KeyValue, Notice } from "@/components/ui/Display";
import { Field, Segmented, TextInput } from "@/components/ui/Form";
import { sleep } from "@/lib/api";
import { CONFIDENCE_GATE, MODEL_VERSION, PRICE_RX, PRICE_SUB_MONTHLY } from "@/lib/data";
import { useT } from "@/lib/i18n";

/** Configurable values from the SRS: price within ৳2–10 (CaaS) and ৳1–70 (subscription), confidence gate. */
export default function AdminSettingsPage() {
  const { t } = useT();
  const [rx, setRx] = useState(String(PRICE_RX));
  const [sub, setSub] = useState(String(PRICE_SUB_MONTHLY));
  const [gate, setGate] = useState(String(CONFIDENCE_GATE));
  const [ab, setAb] = useState<"off" | "on">("off");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const rxN = Number(rx);
  const subN = Number(sub);
  const gateN = Number(gate);
  const rxBad = !(rxN >= 2 && rxN <= 10);
  const subBad = !(subN >= 1 && subN <= 70);
  const gateBad = !(gateN >= 0.5 && gateN <= 0.95);

  const save = async () => {
    setBusy(true);
    await sleep(700);
    setBusy(false);
    setSaved(true);
  };

  return (
    <div>
      <AdminHeader title={t("সেটিংস", "Settings")} description={t("পরিবর্তন অডিট লগে রেকর্ড হয়।", "Changes are recorded in the audit log.")} />
      {saved ? (
        <Notice tone="leaf" className="mb-5">
          {t("সংরক্ষিত। নতুন মূল্য পরবর্তী পেমেন্ট থেকে কার্যকর।", "Saved. New prices apply from the next payment.")}
        </Notice>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title={t("মূল্য", "Prices")}>
          <div className="space-y-4 px-5 pb-5 pt-3">
            <Field label={t("প্রেসক্রিপশন (৳)", "Prescription (৳)")} htmlFor="rx" error={rxBad ? t("CaaS: ৳২–১০", "CaaS allows ৳2–10") : undefined} hint={t("CaaS সীমা ৳২–১০", "CaaS range ৳2–10")}>
              <TextInput id="rx" size="sm" inputMode="decimal" value={rx} onChange={(e) => setRx(e.target.value)} />
            </Field>
            <Field label={t("সতর্কবার্তা, মাসিক (৳)", "Alerts, monthly (৳)")} htmlFor="sub" error={subBad ? t("সাবস্ক্রিপশন: ৳১–৭০", "Subscription allows ৳1–70") : undefined} hint={t("সাবস্ক্রিপশন সীমা ৳১–৭০", "Subscription range ৳1–70")}>
              <TextInput id="sub" size="sm" inputMode="decimal" value={sub} onChange={(e) => setSub(e.target.value)} />
            </Field>
            <Field label={t("৳৩ বনাম ৳৫ A/B পরীক্ষা", "A/B test ৳3 vs ৳5")}>
              <Segmented<"off" | "on">
                label="A/B"
                size="sm"
                value={ab}
                onChange={setAb}
                options={[
                  { value: "off", label: t("বন্ধ", "Off") },
                  { value: "on", label: t("চালু", "On") },
                ]}
              />
            </Field>
          </div>
        </Card>
        <Card title={t("রোগ নির্ণয়", "Diagnosis")}>
          <div className="space-y-4 px-5 pb-5 pt-3">
            <Field
              label={t("নিশ্চয়তার সীমা", "Confidence gate")}
              htmlFor="gate"
              error={gateBad ? t("০.৫ থেকে ০.৯৫ এর মধ্যে", "Between 0.5 and 0.95") : undefined}
              hint={t("এর নিচে ফল অনিশ্চিত: পেমেন্ট বোতাম থাকে না", "Below this a result is uncertain and has no pay button")}
            >
              <TextInput id="gate" size="sm" inputMode="decimal" value={gate} onChange={(e) => setGate(e.target.value)} />
            </Field>
            <KeyValue
              rows={[
                { k: t("লাইভ মডেল", "Live model"), v: <span className="font-mono text-xs">{MODEL_VERSION}</span> },
                { k: t("প্রতি ফসলে সপ্তাহে সতর্কবার্তা", "Alerts per crop per week"), v: "2" },
                { k: t("সতর্কবার্তা পাঠানোর সময়", "Alert send window"), v: "07:00–09:00" },
                { k: t("ছবি রাখার মেয়াদ", "Photo retention"), v: t("১৮০ দিন", "180 days") },
              ]}
            />
          </div>
        </Card>
        <Card title="Applink" className="xl:col-span-2">
          <div className="px-5 pb-5 pt-1">
            <KeyValue
              rows={[
                { k: "Base URL", v: <span className="font-mono text-xs">https://api.applink.com.bd</span> },
                { k: "applicationId", v: <span className="font-mono text-xs">APP_000123</span> },
                { k: t("পাসওয়ার্ড", "Password"), v: t("সার্ভারের env-এ; এখানে দেখানো হয় না", "In server env; never shown here") },
                { k: t("স্ট্যাটিক IP", "Static egress IP"), v: <span className="font-mono text-xs">203.0.113.24</span> },
                { k: t("মোড", "Mode"), v: t("টেস্ট (হোয়াইটলিস্ট নম্বর)", "Test (whitelisted numbers)") },
              ]}
            />
          </div>
        </Card>
      </div>
      <div className="mt-6 flex justify-end">
        <Button icon="check" disabled={rxBad || subBad || gateBad} loading={busy} onClick={save}>
          {t("সংরক্ষণ করুন", "Save changes")}
        </Button>
      </div>
    </div>
  );
}
