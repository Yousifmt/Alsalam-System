
"use client";
import Image from "next/image";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenCheck, LayoutDashboard, FileText, ClipboardList, Sparkles, LogOut, Users, Moon, Sun } from "lucide-react";
import {
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useAuth } from "@/context/auth-context";
import { useTheme } from "next-themes";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useLoading } from "@/context/loading-context";
import { useEffect, useState } from "react";

const baseStudentItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/quizzes", label: "Quizzes", icon: ClipboardList },
  { href: "/dashboard/files", label: "Files", icon: FileText },
];

const baseAdminItems = [
   { href: "/dashboard", label: "Dashboard", icon: Users },
   { href: "/dashboard/quizzes", label: "Manage Quizzes", icon: ClipboardList },
   { href: "/dashboard/files", label: "Manage Files", icon: FileText },
]

const adminMenuItems = [
  { href: "/dashboard/ai-quiz-generator", label: "AI Quiz Generator", icon: Sparkles },
];

function ThemeToggle() {
    const { setTheme, theme } = useTheme();
    const [mounted, setMounted] = useState(false);
    
    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return null;
    }

    const isDark = theme === 'dark';

    return (
       <div className="flex items-center justify-between rounded-lg p-2 hover:bg-sidebar-accent group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8">
            <div className="flex items-center gap-2 text-sidebar-foreground group-data-[collapsible=icon]:hidden">
                <Sun className={`h-5 w-5 transition-colors ${!isDark ? 'text-sidebar-primary' : ''}`} />
                <Label htmlFor="dark-mode-switch" className="flex-grow text-sm font-normal text-sidebar-foreground">
                    Theme
                </Label>
                 <Moon className={`h-5 w-5 transition-colors ${isDark ? 'text-sidebar-primary' : ''}`} />
            </div>
             <Switch 
                id="dark-mode-switch"
                checked={isDark}
                onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                className="group-data-[collapsible=icon]:hidden"
            />
            <div className="hidden group-data-[collapsible=icon]:flex items-center justify-center">
                 <SidebarMenuButton onClick={() => setTheme(isDark ? 'light' : 'dark')} tooltip={{ children: `Switch to ${isDark ? 'light' : 'dark'} mode` }}>
                    <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    <span className="sr-only">Toggle theme</span>
                </SidebarMenuButton>
            </div>
       </div>
    )
}

export function SidebarNav() {
  const pathname = usePathname();
  const { role, logout } = useAuth();
  const { setIsLoading } = useLoading();

  const menuItems = role === "admin" ? [...baseAdminItems, ...adminMenuItems] : baseStudentItems;

  const handleLinkClick = (href: string) => {
    if (pathname !== href) {
      setIsLoading(true);
    }
  }

  return (
    <>
      <SidebarHeader className="p-4">
  <Link
    href="/dashboard"
    className="flex items-center gap-2"
    onClick={() => handleLinkClick("/dashboard")}
  >
    {/* Round, full-view logo */}
    <div className="relative h-14 w-14 rounded-full overflow-hidden shrink-0">
      <Image
        src="/images/logo.png"            // public/images/logo.png
        alt="Al-Salam Training Center logo"
        fill
        className="object-contain"        // shows entire circle without cropping
        sizes="40px"
        priority
      />
    </div>

    <div className="font-headline text-lg font-bold group-data-[collapsible=icon]:hidden">
      <span className="text-sidebar-primary">Al-Salam</span>{" "}
      <span className="text-white">Training Center</span>
    </div>
  </Link>
</SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith(item.href) && (item.href !== "/dashboard" || pathname === "/dashboard")}
                tooltip={{ children: item.label }}
                onClick={() => handleLinkClick(item.href)}
              >
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
            <SidebarMenuItem>
                <ThemeToggle />
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton onClick={logout} tooltip={{ children: "Logout" }}>
                    <LogOut />
                    <span>Logout</span>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
