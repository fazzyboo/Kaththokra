import type { Metadata, Viewport } from "next";
import { Noto_Sans_Bengali, Tiro_Bangla } from "next/font/google";
import type { ReactNode } from "react";
import { LangProvider } from "@/lib/i18n";
import { SessionProvider } from "@/lib/session";
import { ServiceWorker } from "@/components/ServiceWorker";
import "./globals.css";

const noto = Noto_Sans_Bengali({
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto",
  display: "swap",
});

const tiro = Tiro_Bangla({
  subsets: ["bengali", "latin"],
  weight: "400",
  variable: "--font-tiro",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "কাঠঠোকরা — ফসলের রোগ নির্ণয়", template: "%s · কাঠঠোকরা" },
  description: "পাতার ছবি তুলে ধান, আলু ও টমেটোর রোগ জানুন। বাংলালিংক ব্যালেন্স থেকে ৳৫-এ প্রেসক্রিপশন।",
  applicationName: "কাঠঠোকরা",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#10261c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="bn" className={`${noto.variable} ${tiro.variable}`}>
      <body>
        <LangProvider>
          <SessionProvider>{children}</SessionProvider>
        </LangProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
