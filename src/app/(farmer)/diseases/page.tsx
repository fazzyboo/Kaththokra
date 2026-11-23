"use client";

import Link from "next/link";
import { CropGlyph } from "@/components/CropGlyph";
import { PageHeader } from "@/components/farmer/Shell";
import { Panel } from "@/components/ui/Display";
import { Icon } from "@/components/ui/Icon";
import { CROPS, DISEASES } from "@/lib/data";
import { useT } from "@/lib/i18n";

export default function DiseasesPage() {
  const { t } = useT();
  return (
    <div>
      <PageHeader
        back="/"
        title={t("রোগ পরিচিতি", "Disease guide")}
        subtitle={t("কাঠঠোকরা যে রোগগুলো চেনে, তাদের লক্ষণ।", "The diseases Kaththokra recognises, and their signs.")}
      />
      <div className="space-y-7">
        {CROPS.map((c) => (
          <section key={c.id}>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <CropGlyph crop={c.id} size={26} />
              {t(c.name)}
            </h2>
            <Panel className="divide-y divide-line overflow-hidden">
              {DISEASES.filter((d) => d.crop === c.id && !d.healthy).map((d) => (
                <Link key={d.code} href={`/diseases/${d.code.toLowerCase()}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-mist/70">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{t(d.name)}</span>
                    <span className="block truncate text-sm text-ink-3">{t(d.symptoms[0])}</span>
                  </span>
                  <Icon name="chevronRight" size={18} className="text-ink-3" />
                </Link>
              ))}
            </Panel>
          </section>
        ))}
      </div>
    </div>
  );
}
