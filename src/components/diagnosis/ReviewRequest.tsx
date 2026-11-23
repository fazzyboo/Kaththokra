"use client";

import { useState } from "react";
import { PageHeader } from "@/components/farmer/Shell";
import { Button, LinkButton } from "@/components/ui/Button";
import { KeyValue, Notice, Panel } from "@/components/ui/Display";
import { Field, PhoneInput, TextArea } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";
import { queueForReview } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { normalizeMsisdn } from "@/lib/phone";
import { useSession } from "@/lib/session";

/** Send an uncertain case to the agronomist review queue (DX-5, ADM-4). Always free. */
export function ReviewRequest({ id, base }: { id: string; base: string }) {
  const { t, d } = useT();
  const { msisdn } = useSession();
  const [phone, setPhone] = useState(msisdn ? msisdn.slice(2) : "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [ticket, setTicket] = useState<string | null>(null);
  const valid = normalizeMsisdn(phone) !== null;

  const submit = async () => {
    setBusy(true);
    const r = await queueForReview(id);
    setBusy(false);
    setTicket(r.ticket);
  };

  if (ticket) {
    return (
      <div className="pt-8 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-leaf-50 text-leaf-700">
          <Icon name="check" size={32} />
        </span>
        <h1 className="mt-5 font-display text-[1.75rem]">{t("কৃষিবিদের কাছে পাঠানো হয়েছে", "Sent to an agronomist")}</h1>
        <p className="mx-auto mt-2 max-w-xs text-ink-2">
          {t("উত্তর SMS-এ পাবেন, সাধারণত ২৪ ঘণ্টার মধ্যে। এর জন্য কোনো টাকা লাগবে না।", "You'll get the answer by SMS, usually within 24 hours. It's free.")}
        </p>
        <Panel className="mx-auto mt-6 max-w-sm px-4 text-left">
          <KeyValue
            rows={[
              { k: t("টিকিট", "Ticket"), v: ticket },
              { k: t("নম্বর", "Number"), v: d(phone) },
            ]}
          />
        </Panel>
        <LinkButton href="/" variant="secondary" size="lg" className="mt-6">
          {t("হোমে ফিরুন", "Back to home")}
        </LinkButton>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        back={`${base}/${id}`}
        title={t("কৃষিবিদকে দেখান", "Ask an agronomist")}
        subtitle={t("আমাদের কৃষিবিদ আপনার ছবি দেখে SMS-এ উত্তর দেবেন।", "Our agronomist will look at your photo and reply by SMS.")}
      />
      <div className="space-y-5">
        <Field label={t("উত্তর পাওয়ার নম্বর", "Number for the reply")} htmlFor="rv-phone" error={phone.length >= 11 && !valid ? t("বাংলালিংক নম্বর দিন (০১৯ বা ০১৪)", "Enter a Banglalink number (019 or 014)") : undefined}>
          <PhoneInput id="rv-phone" value={phone} onChange={setPhone} invalid={phone.length >= 11 && !valid} />
        </Field>
        <Field label={t("কিছু বলতে চান? (ঐচ্ছিক)", "Anything to add? (optional)")} htmlFor="rv-note" hint={t("যেমন: কত দিন ধরে, কতটা জমিতে", "e.g. how long, how much of the field")}>
          <TextArea id="rv-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
        </Field>
        <Notice icon="wallet">{t("এই সেবা বিনামূল্যে।", "This is free.")}</Notice>
        <Button size="lg" block icon="send" disabled={!valid} loading={busy} onClick={submit}>
          {t("পাঠান", "Send for review")}
        </Button>
      </div>
    </div>
  );
}
