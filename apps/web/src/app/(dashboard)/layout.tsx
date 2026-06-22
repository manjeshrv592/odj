import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getServerSessionUser, isAdmin } from "@/lib/auth-server";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

/**
 * Protected admin shell. Authoritative auth check (proxy.ts only redirects
 * optimistically): non-admins are bounced to /login. Renders the collapsible
 * sidebar + a header with the sidebar trigger and theme toggle.
 */
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getServerSessionUser();
  if (!isAdmin(user)) redirect("/login");
  // Admins must finish the profile wizard before reaching the dashboard.
  if (!user!.onboardingCompleted) redirect("/onboarding");

  return (
    <SidebarProvider>
      <AppSidebar email={user!.email} />
      <SidebarInset>
        <header className="flex h-14 items-center justify-between gap-2 border-b px-4">
          <SidebarTrigger />
          <ThemeToggle />
        </header>
        <div className="flex flex-1 flex-col gap-4 p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
