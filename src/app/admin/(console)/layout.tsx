import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/Shell";

export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
