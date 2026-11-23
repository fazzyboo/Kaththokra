"use client";

import { useParams } from "next/navigation";
import { DiagnosisResult, useParamId } from "@/components/diagnosis/DiagnosisResult";

export default function DealerResultPage() {
  const params = useParams<{ id: string }>();
  return <DiagnosisResult id={useParamId(params?.id)} base="/dealer/diagnose" payBase="/dealer/pay" />;
}
