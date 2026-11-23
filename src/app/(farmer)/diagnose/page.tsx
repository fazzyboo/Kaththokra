"use client";

import { Suspense } from "react";
import { DiagnoseFlow } from "@/components/diagnosis/DiagnoseFlow";

export default function DiagnosePage() {
  return (
    <div className="pt-6">
      <Suspense fallback={null}>
        <DiagnoseFlow resultBase="/diagnose" />
      </Suspense>
    </div>
  );
}
