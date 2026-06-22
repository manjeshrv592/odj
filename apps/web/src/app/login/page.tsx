import { Suspense } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LoginForm } from "./login-form";

/** Public admin-portal login page. Auth gating is handled by `proxy.ts`. */
export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center gap-8 p-6">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">ODJ</h1>
        <p className="text-sm text-muted-foreground">Admin portal</p>
      </div>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
