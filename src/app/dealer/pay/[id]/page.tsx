"use client";

import { useParams } from "next/navigation";
import { useParamId } from "@/components/diagnosis/DiagnosisResult";
import { PaymentFlow } from "@/components/payment/PaymentFlow";

export default function DealerPayPage() {
  const params = useParams<{ id: string }>();
  return <PaymentFlow diagnosisId={useParamId(params?.id)} resultBase="/dealer/diagnose" dealer />;
}
