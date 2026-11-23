"use client";

import { Suspense } from "react";
import { DiagnoseFlow } from "@/components/diagnosis/DiagnoseFlow";
import { Notice } from "@/components/ui/Display";
import { useT } from "@/lib/i18n";

export default function DealerDiagnosePage() {
  const { t } = useT();
  return (
    <div className="pt-6">
      <Notice tone="leaf" icon="store" className="mb-5">
        {t("ডিলার মোড: নির্ণয় ও বিক্রি আপনার দোকানের নামে রেকর্ড হবে।", "Dealer mode: this diagnosis and sale are recorded to your shop.")}
      </Notice>
      <Suspense fallback={null}>
        <DiagnoseFlow resultBase="/dealer/diagnose" dealer />
      </Suspense>
    </div>
  );
}
