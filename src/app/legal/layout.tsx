
'use client';

import MarketingFooter from "@/components/layout/marketing-footer";
import MarketingHeader from "@/components/layout/marketing-header";
import { ThemeProvider } from "@/components/theme-provider";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider forcedTheme="light">
      <MarketingHeader />
      <main className="bg-white text-foreground min-h-screen">
        {children}
      </main>
      <MarketingFooter />
    </ThemeProvider>
  );
}
