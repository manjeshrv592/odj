import type { Metadata } from "next";
import { Poppins, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

// Poppins is the ODJ brand typeface (web + mobile). It is not a variable font,
// so weights are listed explicitly. Exposed as `--font-sans` → Tailwind's
// `font-sans` (set on <html> in globals.css), so all text inherits it.
const poppins = Poppins({
  variable: "--font-sans",
  subsets: ["latin"],
  // 300 = light body text; 400/500 UI; 600 headings; 700 reserved.
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ODJ — Web",
  description: "ODJ hiring platform — admin & web client.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // suppressHydrationWarning is required by next-themes (it sets the theme
  // class on <html> before React hydrates).
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${poppins.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
