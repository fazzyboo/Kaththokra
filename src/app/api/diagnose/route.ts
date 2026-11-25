import { z } from "zod";
import { UPAZILAS } from "@/lib/data";
import { dealerActor, optionalFarmer } from "@/server/auth/session";
import { badRequest } from "@/server/http/errors";
import { clientIp, wrap } from "@/server/http/handler";
import { getScenario } from "@/server/lib/scenario";
import { createDiagnosis } from "@/server/services/diagnosis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const UPAZILA_CODES = UPAZILAS.map((u) => u.code) as [string, ...string[]];

const Fields = z.object({
  crop: z.enum(["rice", "potato", "tomato"]),
  consent: z
    .enum(["true", "false", "1", "0", "on", "off"])
    .optional()
    .transform((v) => v === "true" || v === "1" || v === "on"),
  upazila: z.enum(UPAZILA_CODES).optional(),
});

/** POST /api/diagnose — multipart: crop, image, consent, upazila? → Diagnosis */
export const POST = wrap(async (req) => {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw badRequest("Send multipart/form-data with crop and image");
  }
  const str = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" && v !== "" ? v : undefined;
  };
  const fields = Fields.parse({ crop: str("crop"), consent: str("consent"), upazila: str("upazila") });
  const image = form.get("image");
  if (!(image instanceof File)) throw badRequest("image file is required");

  const [farmer, dealer] = await Promise.all([optionalFarmer(), dealerActor()]);
  return createDiagnosis({
    crop: fields.crop,
    imageBytes: Buffer.from(await image.arrayBuffer()),
    mime: image.type,
    consent: fields.consent,
    upazila: fields.upazila,
    userId: farmer?.user._id,
    dealerId: dealer?.dealer._id,
    channel: dealer ? "dealer" : "web",
    scenario: getScenario(req),
    ip: clientIp(req),
  });
});
