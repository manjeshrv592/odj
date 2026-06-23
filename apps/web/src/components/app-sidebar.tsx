"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  CircleUser,
  Boxes,
  BadgeCheck,
  LogOut,
} from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { apiFetch } from "@/lib/api";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export const VERIFICATIONS_COUNT_KEY = ["verifications-count"] as const;

const NAV = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Catalog", href: "/catalog", icon: Boxes },
  { title: "Verifications", href: "/verifications", icon: BadgeCheck },
  { title: "Portal users", href: "/portal-users", icon: Users },
  { title: "Profile", href: "/profile", icon: CircleUser },
] as const;

/** Left navigation for the admin portal: nav links + sign-out. */
export function AppSidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();

  // Pending-verification count for the nav badge; polled so admins don't miss new
  // submissions (no websockets).
  const { data: pending } = useQuery({
    queryKey: VERIFICATIONS_COUNT_KEY,
    queryFn: () =>
      apiFetch<{ pending: number }>("/api/portal/verifications/count").then(
        (r) => r.pending,
      ),
    refetchInterval: 30_000,
  });

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span className="text-lg font-semibold tracking-widest text-primary">
            ODJ
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={active}
                      tooltip={item.title}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                    {item.href === "/verifications" && pending ? (
                      <SidebarMenuBadge>{pending}</SidebarMenuBadge>
                    ) : null}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <span className="truncate px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
              {email}
            </span>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleSignOut} tooltip="Sign out">
              <LogOut />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
