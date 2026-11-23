import type { ReactNode } from "react";
import { BottomNav, TopBar } from "@/components/farmer/Shell";

export default function FarmerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper">
      <TopBar />
      <main className="mx-auto max-w-xl px-4 pb-32">{children}</main>
      <BottomNav />
    </div>
  );
}
