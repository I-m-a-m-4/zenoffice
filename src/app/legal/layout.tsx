
'use client';

import ZenOfficeHeader from "@/components/layout/zenoffice-header";
import ZenOfficeFooter from "@/components/layout/zenoffice-footer";
import { ThemeProvider } from "@/components/theme-provider";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider forcedTheme="light">
      <ZenOfficeHeader />
      <main className="bg-white text-foreground min-h-screen">
        {children}
      </main>
      <ZenOfficeFooter />
    </ThemeProvider>
  );
}
