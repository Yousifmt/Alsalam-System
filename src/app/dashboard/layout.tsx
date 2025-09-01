
"use client";

import type { PropsWithChildren } from "react";
import { SidebarProvider, Sidebar, SidebarInset } from "@/components/ui/sidebar";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { Header } from "@/components/dashboard/header";
import { LoadingProvider, useLoading } from "@/context/loading-context";
import { Loader2 } from "lucide-react";

function DashboardMainContent({ children }: PropsWithChildren) {
    const { isLoading } = useLoading();

    return (
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 relative">
            {isLoading && (
                <div className="absolute inset-0 z-50 flex h-full w-full items-center justify-center bg-background/80 backdrop-blur-sm">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            )}
            {children}
        </main>
    )
}
// app/dashboard/layout.tsx (أو app/layout.tsx)
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs'; // يضمن تشغيل Node بدل Edge عند الحاجة


export default function DashboardLayout({ children }: PropsWithChildren) {
  return (
    <LoadingProvider>
        <SidebarProvider>
        <Sidebar>
            <SidebarNav />
        </Sidebar>
        <SidebarInset className="flex flex-col">
            <Header />
            <DashboardMainContent>
                {children}
            </DashboardMainContent>
        </SidebarInset>
        </SidebarProvider>
    </LoadingProvider>
  );
}
