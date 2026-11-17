import type { Metadata, Viewport } from "next";

import { TooltipProvider } from "@/components/ui/tooltip";
import { APP_NAME, APP_NAME_ZH } from "@/config/nav";

import "./globals.css";

export const metadata: Metadata = {
  title: `${APP_NAME} · CIT`,
  description: `${APP_NAME} / ${APP_NAME_ZH} — local-first commodity market terminal.`,
};

export const viewport: Viewport = {
  themeColor: "#05081c",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-terminal text-ink antialiased">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
