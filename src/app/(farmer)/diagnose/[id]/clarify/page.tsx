"use client";

import { useParams } from "next/navigation";
import { ClarifyFlow } from "@/components/diagnosis/ClarifyFlow";
import { useParamId } from "@/components/diagnosis/DiagnosisResult";

export default function ClarifyPage() {
  const params = useParams<{ id: string }>();
  return <ClarifyFlow id={useParamId(params?.id)} base="/diagnose" />;
}
