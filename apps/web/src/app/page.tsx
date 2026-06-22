import { ThemeToggle } from "@/components/theme-toggle";
import { HealthStatus } from "@/components/health-status";

export default function Home() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center gap-8 p-8">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          ODJ web app
        </h1>
        <p className="mt-2 text-muted-foreground">
          Hiring platform — web &amp; admin client
        </p>
      </div>

      <HealthStatus />
    </main>
  );
}
