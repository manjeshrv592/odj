import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getServerSessionUser, isAdmin } from "@/lib/auth-server";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Onboarding shell + authoritative guard. Mirror of the dashboard guard so an
 * incomplete admin can't slip past it: non-admins go to /login; admins who have
 * already completed onboarding are sent to the dashboard. The two guards are
 * mutually exclusive, so there's no redirect loop.
 */
export default async function OnboardingLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getServerSessionUser();
  if (!isAdmin(user)) redirect("/login");
  if (user!.onboardingCompleted) redirect("/");

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 items-center justify-between gap-2 border-b px-4">
        <span className="text-lg font-semibold tracking-widest text-primary">
          ODJ
        </span>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center p-6">
        {children}
      </main>
    </div>
  );
}
