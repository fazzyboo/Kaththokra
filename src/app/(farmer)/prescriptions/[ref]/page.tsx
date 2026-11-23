"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useParamId } from "@/components/diagnosis/DiagnosisResult";
import { PageHeader } from "@/components/farmer/Shell";
import { PrescriptionView } from "@/components/payment/PrescriptionView";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Display";
import { getPrescription } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { Prescription } from "@/lib/types";

export default function PrescriptionPage() {
  const params = useParams<{ ref: string }>();
  const ref = useParamId(params?.ref);
  const { t } = useT();
  const [rx, setRx] = useState<Prescription | null | undefined>(undefined);

  useEffect(() => {
    setRx(getPrescription(ref) ?? null);
  }, [ref]);

  if (rx === undefined) return null;
  return (
    <div>
      <PageHeader back="/prescriptions" />
      {rx ? (
        <PrescriptionView rx={rx} />
      ) : (
        <EmptyState
          icon="file"
          title={t("প্রেসক্রিপশন পাওয়া যায়নি", "Prescription not found")}
          body={t("রেফারেন্স কোডটি আবার দেখুন।", "Check the reference code.")}
          action={<LinkButton href="/prescriptions">{t("সব প্রেসক্রিপশন", "All prescriptions")}</LinkButton>}
        />
      )}
    </div>
  );
}
