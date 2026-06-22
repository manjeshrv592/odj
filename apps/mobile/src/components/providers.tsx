import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "nativewind";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { storage } from "@/lib/storage";

/**
 * App-wide providers for the mobile app:
 * - TanStack Query for server state.
 * - A ThemeContext over NativeWind's colorScheme (dark/light/system) with the
 *   preference persisted in expo-secure-store. React Context is the UI-state
 *   tool per the project's state strategy — no Redux/Zustand.
 */

export type ThemePref = "light" | "dark" | "system";
const STORAGE_KEY = "odj.theme";

type ThemeContextValue = {
  preference: ThemePref;
  colorScheme: "light" | "dark";
  setTheme: (p: ThemePref) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <Providers>");
  return ctx;
}

function ThemeProvider({ children }: { children: ReactNode }) {
  const { colorScheme, setColorScheme } = useColorScheme();
  const [preference, setPreference] = useState<ThemePref>("system");

  // Restore the saved preference on first mount.
  useEffect(() => {
    void storage.getItemAsync(STORAGE_KEY).then((stored) => {
      if (stored === "light" || stored === "dark" || stored === "system") {
        setPreference(stored);
        setColorScheme(stored);
      }
    });
  }, [setColorScheme]);

  const setTheme = (p: ThemePref) => {
    setPreference(p);
    setColorScheme(p);
    void storage.setItemAsync(STORAGE_KEY, p);
  };

  const toggle = () => setTheme(colorScheme === "dark" ? "light" : "dark");

  return (
    <ThemeContext.Provider
      value={{
        preference,
        colorScheme: colorScheme ?? "light",
        setTheme,
        toggle,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>{children}</ThemeProvider>
    </QueryClientProvider>
  );
}
