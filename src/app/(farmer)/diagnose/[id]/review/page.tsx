"use client";

import { useParams } from "next/navigation";
import { useParamId } from "@/components/diagnosis/DiagnosisResult";
import { ReviewRequest } from "@/components/diagnosis/ReviewRequest";

export default function ReviewPage() {
  const params = useParams<{ id: string }>();
  return <ReviewRequest id={useParamId(params?.id)} base="/diagnose" />;
}
