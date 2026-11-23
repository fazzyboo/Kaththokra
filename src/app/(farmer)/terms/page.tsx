"use client";

import { PageHeader } from "@/components/farmer/Shell";
import { PRICE_RX, PRICE_SUB_MONTHLY } from "@/lib/data";
import { useT } from "@/lib/i18n";

export default function TermsPage() {
  const { t, tk } = useT();
  const items = [
    t(
      "কাঠঠোকরার ফলাফল পরামর্শ, নিশ্চয়তা নয়। বড় সিদ্ধান্তের আগে উপসহকারী কৃষি কর্মকর্তার সাথে কথা বলুন।",
      "Kaththokra's results are advice, not a guarantee. Talk to your agriculture officer before big decisions.",
    ),
    t(
      `রোগের নাম বিনামূল্যে। প্রেসক্রিপশন ${tk(PRICE_RX)}, সতর্কবার্তা ${tk(PRICE_SUB_MONTHLY)}/মাস। টাকা কাটার আগে মূল্য দেখানো হয় এবং যা দেখানো হয় ঠিক ততটাই কাটা হয়।`,
      `Disease names are free. A prescription costs ${tk(PRICE_RX)}, alerts ${tk(PRICE_SUB_MONTHLY)}/month. The price is shown before any charge and exactly that amount is charged.`,
    ),
    t("অনিশ্চিত ফলাফলে কখনো টাকা কাটা হয় না।", "Uncertain results are never charged."),
    t(
      "একটি পেমেন্টে একবারই টাকা কাটা হয়। ভুল হলে ১৬১২৩-এ জানান; যাচাই করে টাকা ফেরত দেওয়া হয়।",
      "Each payment is charged once. If something went wrong, tell 16123; refunds are reviewed and returned.",
    ),
    t("ওষুধ ব্যবহারের আগে লেবেল পড়ুন এবং নিরাপত্তা সরঞ্জাম পরুন।", "Read the label and wear protective gear before spraying."),
    t("সেবাটি শুধু বাংলালিংক গ্রাহকদের জন্য।", "The service is for Banglalink subscribers only."),
  ];
  return (
    <div>
      <PageHeader back="/settings" title={t("ব্যবহারের শর্ত", "Terms of use")} />
      <ol className="list-decimal space-y-3 pl-5 leading-relaxed text-ink-2 marker:text-ink-3">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ol>
    </div>
  );
}
