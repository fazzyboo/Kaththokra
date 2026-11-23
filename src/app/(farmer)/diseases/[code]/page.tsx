"use client";

import { useParams } from "next/navigation";
import { CropGlyph } from "@/components/CropGlyph";
import { useParamId } from "@/components/diagnosis/DiagnosisResult";
import { Disclaimer, PageHeader } from "@/components/farmer/Shell";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState, Panel } from "@/components/ui/Display";
import { DISEASES, PRICE_RX, cropName } from "@/lib/data";
import { useT } from "@/lib/i18n";

export default function DiseaseDetailPage() {
  const params = useParams<{ code: string }>();
  const code = useParamId(params?.code).toUpperCase();
  const { t, tk } = useT();
  const dis = DISEASES.find((d) => d.code === code);

  if (!dis)
    return (
      <EmptyState
        icon="book"
        title={t("রোগটি পাওয়া যায়নি", "Disease not found")}
        action={<LinkButton href="/diseases">{t("সব রোগ", "All diseases")}</LinkButton>}
      />
    );

  return (
    <div>
      <PageHeader back="/diseases" />
      <span className="inline-flex items-center gap-1.5 rounded-full bg-mist py-1 pl-1.5 pr-3 text-sm text-ink-2">
        <CropGlyph crop={dis.crop} size={20} />
        {t(cropName(dis.crop))}
      </span>
      <h1 className="mt-3 font-display text-[2rem] leading-tight">{t(dis.name)}</h1>
      <p className="text-ink-3">{t(dis.name.en, dis.name.bn)}</p>

      <section className="mt-6">
        <h2 className="mb-2 font-semibold">{t("লক্ষণ", "Signs")}</h2>
        <ul className="space-y-2">
          {dis.symptoms.map((s) => (
            <li key={s.en} className="flex gap-2.5 text-ink-2">
              <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-leaf-500" />
              {t(s)}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 font-semibold">{t("কারণ", "Cause")}</h2>
        <p className="text-ink-2">{t(dis.cause)}</p>
      </section>

      {dis.care.length ? (
        <section className="mt-6">
          <h2 className="mb-2 font-semibold">{t("প্রতিরোধে যা করবেন", "Prevention")}</h2>
          <ul className="space-y-1.5 text-ink-2">
            {dis.care.map((c) => (
              <li key={c.en}>{t(c)}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <Panel className="mt-7 px-4 py-4">
        <p className="font-medium">{t("আপনার গাছে কি এই রোগ?", "Does your crop have this?")}</p>
        <p className="mt-1 text-sm text-ink-2">
          {t(`পাতার ছবি দিন। রোগ নিশ্চিত হলে ${tk(PRICE_RX)}-এ ওষুধ ও মাত্রা পাবেন।`, `Send a leaf photo. If confirmed, get the spray and dose for ${tk(PRICE_RX)}.`)}
        </p>
        <LinkButton href={`/diagnose?crop=${dis.crop}`} icon="camera" block className="mt-4">
          {t("রোগ নির্ণয় করুন", "Diagnose a leaf")}
        </LinkButton>
      </Panel>
      <div className="mt-5">
        <Disclaimer />
      </div>
    </div>
  );
}
