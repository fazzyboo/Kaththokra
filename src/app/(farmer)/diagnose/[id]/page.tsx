"use client";

import { useParams } from "next/navigation";
import { DiagnosisResult, useParamId } from "@/components/diagnosis/DiagnosisResult";

export default function DiagnosisResultPage() {
  const params = useParams<{ id: string }>();
  const id = useParamId(params?.id);
  return <DiagnosisResult id={id} base="/diagnose" payBase="/pay" />;
}
