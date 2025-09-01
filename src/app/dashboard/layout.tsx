// src/app/dashboard/layout.tsx  (Server Component)
import type { ReactNode } from "react";
import DashboardClient from "./_client";

// إعدادات الراوت يجب أن تكون هنا (سيرفر فقط)
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export default function Layout({ children }: { children: ReactNode }) {
  return <DashboardClient>{children}</DashboardClient>;
}
