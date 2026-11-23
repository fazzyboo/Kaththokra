"use client";

import { PageHeader } from "@/components/farmer/Shell";
import { useT } from "@/lib/i18n";

export default function PrivacyPage() {
  const { t } = useT();
  const sections = [
    {
      h: t("আপনার নম্বর", "Your number"),
      p: t(
        "আপনার মোবাইল নম্বর সাংকেতিক (হ্যাশ) আকারে রাখা হয়। আসল নম্বর এনক্রিপ্ট করে রাখা হয় শুধু SMS পাঠানো ও বিলের জন্য। আমাদের কর্মীরা পুরো নম্বর দেখতে পান না।",
        "Your mobile number is stored as a hash. The real number is kept encrypted only for sending SMS and billing. Our staff never see the full number.",
      ),
    },
    {
      h: t("পাতার ছবি", "Leaf photos"),
      p: t(
        "ছবি শুধু আপনার অনুমতি থাকলে রাখা হয়, সর্বোচ্চ ১৮০ দিন, কাঠঠোকরাকে আরও ভালো শেখাতে। ছবি থেকে অবস্থান ও ফোনের তথ্য (EXIF) মুছে ফেলা হয়।",
        "Photos are kept only with your permission, for up to 180 days, to help Kaththokra learn. Location and device data (EXIF) are removed.",
      ),
    },
    {
      h: t("পেমেন্ট", "Payments"),
      p: t(
        "টাকা কাটে বাংলালিংক, আপনার দেওয়া কোডের পরে। আমরা কখনো আপনার ব্যালেন্স দেখি না।",
        "Banglalink charges you, only after you enter your code. We never see your balance.",
      ),
    },
    {
      h: t("এলাকাভিত্তিক তথ্য", "Area data"),
      p: t(
        "রোগ কোথায় ছড়াচ্ছে বোঝার জন্য আমরা শুধু উপজেলাভিত্তিক মোট সংখ্যা দেখি। ৫টির কম ঘটনা থাকলে সেই এলাকা দেখানো হয় না।",
        "To see where disease spreads we only look at upazila totals. Areas with fewer than 5 cases are hidden.",
      ),
    },
    {
      h: t("আপনার অধিকার", "Your rights"),
      p: t("আপনার তথ্য মুছে ফেলতে চাইলে ১৬১২৩-এ কল করুন বা PD HELP লিখে SMS করুন।", "To delete your data, call 16123 or SMS PD HELP."),
    },
  ];
  return (
    <div>
      <PageHeader back="/settings" title={t("গোপনীয়তা নীতি", "Privacy policy")} subtitle={t("সর্বশেষ হালনাগাদ: ২৩ নভেম্বর ২০২৬", "Last updated: 23 November 2026")} />
      <div className="space-y-6">
        {sections.map((s) => (
          <section key={s.h}>
            <h2 className="mb-1.5 font-semibold">{s.h}</h2>
            <p className="leading-relaxed text-ink-2">{s.p}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
