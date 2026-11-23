"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { QrCode } from "@/components/QrCode";
import { useParamId } from "@/components/diagnosis/DiagnosisResult";
import { PageHeader } from "@/components/farmer/Shell";
import { PrescriptionView } from "@/components/payment/PrescriptionView";
import { Button } from "@/components/ui/Button";
import { EmptyState, Panel } from "@/components/ui/Display";
import { getPrescription } from "@/lib/api";
import { MODEL_VERSION, disease } from "@/lib/data";
import { DEALER_SALES } from "@/lib/dealer-data";
import { useT } from "@/lib/i18n";
import type { Prescription } from "@/lib/types";

/** Show or print the prescription reference as a QR for the farmer (SRS DLR-6). */
export default function DealerSharePage() {
  const params = useParams<{ ref: string }>();
  const ref = useParamId(params?.ref);
  const { t } = useT();
  const [rx, setRx] = useState<Prescription | null | undefined>(undefined);

  useEffect(() => {
    const found = getPrescription(ref);
    if (found) return setRx(found);
    const sale = DEALER_SALES.find((s) => s.ref === ref);
    if (!sale) return setRx(null);
    setRx({
      ref: sale.ref,
      diagnosisId: "d-dealer",
      diseaseCode: sale.diseaseCode,
      crop: sale.crop,
      paidAt: sale.at,
      amount: 5,
      msisdn: "88019000" + sale.farmer.slice(-4),
      kbVersion: disease(sale.diseaseCode)?.kbVersion ?? 1,
      modelVersion: MODEL_VERSION,
      sms: sale.status === "DELIVERED" ? "DELIVERED" : "SENT",
      channel: "dealer",
      dealerShop: "Ma Krishi Bitan",
      receiptId: "REF-" + sale.ref.slice(-4),
    });
  }, [ref]);

  if (rx === undefined) return null;
  if (rx === null) return <EmptyState icon="qr" title={t("প্রেসক্রিপশন পাওয়া যায়নি", "Prescription not found")} />;

  const url = `https://kaththokra.app/p/${rx.ref}`;
  return (
    <div>
      <PageHeader back="/dealer/sales" />
      <Panel className="flex flex-col items-center px-4 py-6 text-center">
        <QrCode value={url} size={208} label={t(`প্রেসক্রিপশন ${rx.ref}-এর QR কোড`, `QR code for prescription ${rx.ref}`)} />
        <p className="mt-3 font-display text-3xl tracking-wide">{rx.ref}</p>
        <p className="mt-1 max-w-xs text-sm text-ink-2">
          {t("কৃষক ফোনের ক্যামেরায় স্ক্যান করলে প্রেসক্রিপশন খুলবে। এই কোড SMS করলেও আবার পাবেন।", "The farmer scans this with their phone camera to open the prescription, or SMS the code to get it again.")}
        </p>
        <Button variant="secondary" icon="printer" className="no-print mt-4" onClick={() => window.print()}>
          {t("প্রিন্ট করুন", "Print")}
        </Button>
      </Panel>
      <div className="mt-6">
        <PrescriptionView rx={rx} compact />
      </div>
    </div>
  );
}
