"use client";

import { AdminHeader, Card, Table, Td, Th } from "@/components/admin/Shell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Display";
import { Icon } from "@/components/ui/Icon";
import { TEAM } from "@/lib/admin-data";
import { useT } from "@/lib/i18n";

const ROLES = [
  { id: "admin", bn: "অ্যাডমিন", en: "Admin", can: { bn: "সব কিছু, ফেরত অনুমোদন, সেটিংস", en: "Everything, refunds, settings" } },
  { id: "agronomist", bn: "কৃষিবিদ", en: "Agronomist", can: { bn: "জ্ঞানভান্ডার অনুমোদন, রিভিউ সারি", en: "Approve the knowledge base, review queue" } },
  { id: "analyst", bn: "বিশ্লেষক", en: "Analyst", can: { bn: "ড্যাশবোর্ড, মানচিত্র, CSV (শুধু দেখা)", en: "Dashboard, map, CSV (read only)" } },
  { id: "dealer_manager", bn: "ডিলার ব্যবস্থাপক", en: "Dealer manager", can: { bn: "ডিলার, কমিশন, প্রতারণা সতর্কতা", en: "Dealers, commission, fraud flags" } },
] as const;

/** Roles: admin, agronomist, analyst, dealer-manager (SRS ADM-6). Staff use email + password + TOTP. */
export default function TeamPage() {
  const { t, date } = useT();
  return (
    <div>
      <AdminHeader
        title={t("টিম ও ভূমিকা", "Team and roles")}
        description={t("প্রতিটি সুবিধাপ্রাপ্ত কাজ অডিট লগে রেকর্ড হয়।", "Every privileged action is recorded in the audit log.")}
        actions={
          <Button size="sm" icon="plus">
            {t("সদস্য আমন্ত্রণ", "Invite member")}
          </Button>
        }
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ROLES.map((r) => (
          <div key={r.id} className="rounded-2xl border border-line bg-paper px-4 py-4">
            <p className="font-semibold">{t(r.bn, r.en)}</p>
            <p className="mt-1 text-sm text-ink-2">{t(r.can)}</p>
          </div>
        ))}
      </div>
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>{t("নাম", "Name")}</Th>
              <Th>{t("ভূমিকা", "Role")}</Th>
              <Th>TOTP</Th>
              <Th>{t("শেষ সক্রিয়", "Last active")}</Th>
            </tr>
          </thead>
          <tbody>
            {TEAM.map((m) => {
              const role = ROLES.find((r) => r.id === m.role)!;
              return (
                <tr key={m.email}>
                  <Td>
                    <span className="block font-medium">{m.name}</span>
                    <span className="text-xs text-ink-3">{m.email}</span>
                  </Td>
                  <Td>{t(role.bn, role.en)}</Td>
                  <Td>
                    {m.totp ? (
                      <Badge tone="leaf" icon="check">
                        {t("চালু", "On")}
                      </Badge>
                    ) : (
                      <Badge tone="alarm" icon="alert">
                        {t("বন্ধ", "Off")}
                      </Badge>
                    )}
                  </Td>
                  <Td className="text-ink-2">{date(m.last, true)}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-3">
        <Icon name="shield" size={14} />
        {t("TOTP ছাড়া কেউ সাইন ইন করতে পারবে না।", "Nobody can sign in without TOTP.")}
      </p>
    </div>
  );
}
