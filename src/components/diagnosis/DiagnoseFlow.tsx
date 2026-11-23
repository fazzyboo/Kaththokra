"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { CropGlyph } from "@/components/CropGlyph";
import { Button } from "@/components/ui/Button";
import { Notice, Steps } from "@/components/ui/Display";
import { Checkbox } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";
import type { IconName } from "@/components/ui/Icon";
import { diagnose } from "@/lib/api";
import { cn } from "@/lib/cn";
import { CROPS } from "@/lib/data";
import { useT } from "@/lib/i18n";
import { SAMPLE_LEAF, prepareImage } from "@/lib/image";
import { useSession } from "@/lib/session";
import type { CropId } from "@/lib/types";

type Stage = "crop" | "photo" | "analyzing";

/**
 * Crop → photo → analysing. Shared by the farmer app and dealer mode (SRS DX-1, DX-2, DLR-1).
 * Open-to-result in ≤ 4 taps: crop tile, camera, confirm (WEB-3).
 */
export function DiagnoseFlow({ resultBase, dealer }: { resultBase: string; dealer?: boolean }) {
  const { t, n } = useT();
  const router = useRouter();
  const params = useSearchParams();
  const { scenario } = useSession();
  const preset = params?.get("crop") as CropId | null;

  const [stage, setStage] = useState<Stage>(preset && CROPS.some((c) => c.id === preset) ? "photo" : "crop");
  const [crop, setCrop] = useState<CropId | null>(preset && CROPS.some((c) => c.id === preset) ? preset : null);
  const [photo, setPhoto] = useState<{ url: string; bytes?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (photo?.url.startsWith("blob:")) URL.revokeObjectURL(photo.url);
    };
  }, [photo]);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    const res = await prepareImage(file);
    if (res === "type") setError(t("শুধু JPG, PNG বা WebP ছবি দিন।", "Use a JPG, PNG or WebP photo."));
    else if (res === "size") setError(t("ছবিটি ৫ MB-এর বেশি। ছোট ছবি দিন।", "The photo is over 5 MB. Use a smaller one."));
    else if (res === "decode") setError(t("ছবিটি খোলা যায়নি। আবার তুলুন।", "Couldn't open the photo. Take it again."));
    else setPhoto({ url: res.url, bytes: res.bytes });
  };

  const run = async () => {
    if (!crop) return;
    setStage("analyzing");
    const d = await diagnose(crop, scenario.diagnosis, { dealer });
    router.replace(`${resultBase}/${d.id}`);
  };

  const stepLabels = [t("ফসল", "Crop"), t("ছবি", "Photo"), t("ফলাফল", "Result")];
  const stepIndex = stage === "crop" ? 0 : stage === "photo" ? 1 : 2;

  return (
    <div>
      <Steps steps={stepLabels} current={stepIndex} />

      {stage === "crop" ? (
        <section className="mt-6">
          <h2 className="font-display text-[1.6rem] leading-tight">{t("কোন ফসলের রোগ?", "Which crop is sick?")}</h2>
          <div className="mt-5 grid gap-3">
            {CROPS.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setCrop(c.id);
                  setStage("photo");
                }}
                className={cn(
                  "flex items-center gap-4 rounded-2xl border px-4 py-3.5 text-left transition-colors hover:border-leaf-400",
                  crop === c.id ? "border-leaf-600 bg-leaf-50" : "border-line",
                )}
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-mist">
                  <CropGlyph crop={c.id} size={40} />
                </span>
                <span className="flex-1">
                  <span className="block text-lg font-semibold">{t(c.name)}</span>
                  <span className="block text-sm text-ink-3">{t(c.season)}</span>
                </span>
                <Icon name="chevronRight" className="text-ink-3" />
              </button>
            ))}
          </div>
          <p className="mt-4 text-sm text-ink-3">
            {t("অন্য ফসলের জন্য ১৬১২৩-এ কল করুন।", "For other crops, call 16123.")}
          </p>
        </section>
      ) : null}

      {stage === "photo" && crop ? (
        <section className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-[1.6rem] leading-tight">{t("আক্রান্ত পাতার ছবি", "Photo of the sick leaf")}</h2>
            <button onClick={() => setStage("crop")} className="flex items-center gap-1.5 rounded-full bg-mist py-1 pl-1.5 pr-3 text-sm text-ink-2">
              <CropGlyph crop={crop} size={22} />
              {t(CROPS.find((c) => c.id === crop)!.name)}
            </button>
          </div>

          {!photo ? (
            <>
              <ul className="mt-5 grid grid-cols-3 gap-2" aria-label={t("ছবি তোলার নিয়ম", "Photo tips")}>
                {(
                  [
                    { icon: "leaf", bn: "একটি পাতা", en: "One leaf" },
                    { icon: "sun", bn: "দিনের আলোয়", en: "In daylight" },
                    { icon: "focus", bn: "ফ্রেম ভরে", en: "Fill the frame" },
                  ] as { icon: IconName; bn: string; en: string }[]
                ).map((tip) => (
                  <li key={tip.en} className="flex flex-col items-center gap-1.5 rounded-xl bg-mist px-2 py-3 text-center text-sm text-ink-2">
                    <Icon name={tip.icon} size={24} className="text-leaf-700" />
                    {t(tip.bn, tip.en)}
                  </li>
                ))}
              </ul>

              <div className="mt-5 grid gap-3">
                <Button size="lg" icon="camera" block onClick={() => cameraRef.current?.click()}>
                  {t("ছবি তুলুন", "Take photo")}
                </Button>
                <Button size="lg" variant="secondary" icon="image" block onClick={() => galleryRef.current?.click()}>
                  {t("গ্যালারি থেকে নিন", "Choose from gallery")}
                </Button>
                <button onClick={() => setPhoto({ url: SAMPLE_LEAF })} className="py-2 text-sm text-ink-3 underline underline-offset-2">
                  {t("ক্যামেরা নেই? নমুনা ছবি দিয়ে দেখুন", "No camera? Try a sample photo")}
                </button>
              </div>
              <input ref={cameraRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={onFile} />
              <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile} />
            </>
          ) : (
            <>
              <div className="relative mt-5 overflow-hidden rounded-2xl bg-mist">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={t("আপনার তোলা পাতার ছবি", "Your leaf photo")} className="aspect-[4/3] w-full object-cover" />
                <button
                  onClick={() => setPhoto(null)}
                  className="absolute right-3 top-3 flex h-9 items-center gap-1.5 rounded-full bg-paper/95 px-3 text-sm font-medium text-ink"
                >
                  <Icon name="refresh" size={16} />
                  {t("আবার তুলুন", "Retake")}
                </button>
              </div>
              {photo.bytes ? (
                <p className="mt-2 text-xs text-ink-3">
                  {t(`ছোট করা হয়েছে: ${n(Math.round(photo.bytes / 1024))} KB, অবস্থানের তথ্য মুছে ফেলা হয়েছে`, `Resized to ${Math.round(photo.bytes / 1024)} KB, location data removed`)}
                </p>
              ) : null}
              <div className="mt-5">
                <Checkbox id="consent" checked={consent} onChange={setConsent}>
                  {t(
                    "ছবিটি ১৮০ দিন রাখা যাবে, যাতে কাঠঠোকরা আরও ভালো শিখতে পারে। (ঐচ্ছিক)",
                    "Keep this photo for 180 days to help Kaththokra learn. (Optional)",
                  )}
                </Checkbox>
              </div>
              <Button size="lg" block className="mt-5" icon="search" onClick={run}>
                {t("রোগ খুঁজুন", "Find the disease")}
              </Button>
              <p className="mt-2 text-center text-sm text-ink-3">{t("রোগের নাম জানা বিনামূল্যে", "Finding the disease name is free")}</p>
            </>
          )}

          {error ? (
            <Notice tone="alarm" className="mt-4">
              {error}
            </Notice>
          ) : null}
        </section>
      ) : null}

      {stage === "analyzing" ? (
        <section className="mt-16 flex flex-col items-center text-center" aria-live="polite">
          <div className="relative h-36 w-36">
            <span className="absolute inset-0 animate-ping rounded-full bg-leaf-100 [animation-duration:1.6s]" />
            <span className="absolute inset-3 rounded-full bg-leaf-50" />
            <span className="absolute inset-0 flex items-center justify-center text-leaf-700">
              <Icon name="leaf" size={52} strokeWidth={1.5} />
            </span>
          </div>
          <p className="mt-6 font-display text-2xl">{t("পাতা পরীক্ষা করা হচ্ছে…", "Checking the leaf…")}</p>
          <p className="mt-2 max-w-xs text-ink-2">{t("সাধারণত ৫ সেকেন্ডের কম লাগে।", "Usually takes under 5 seconds.")}</p>
        </section>
      ) : null}
    </div>
  );
}
