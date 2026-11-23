"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { NumberVerify } from "@/components/farmer/NumberVerify";
import { PageHeader } from "@/components/farmer/Shell";
import { useT } from "@/lib/i18n";

function VerifyInner() {
  const { t } = useT();
  const router = useRouter();
  const next = useSearchParams()?.get("next") ?? "/prescriptions";
  return (
    <div>
      <PageHeader
        back
        title={t("নম্বর যাচাই", "Verify your number")}
        subtitle={t("আপনার প্রেসক্রিপশন ও সতর্কবার্তা আপনার নম্বরের সাথে রাখা থাকে।", "Your prescriptions and alerts are kept with your number.")}
      />
      <NumberVerify onDone={() => router.replace(next)} />
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyInner />
    </Suspense>
  );
}
