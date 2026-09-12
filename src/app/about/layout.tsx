'use client';

import MarketingFooter from "@/components/layout/marketing-footer";
import MarketingHeader from "@/components/layout/marketing-header";
import { ThemeProvider } from "@/components/theme-provider";

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider forcedTheme="light">
      <div className="h-full overflow-y-auto w-full">
        <MarketingHeader />
        <main>{children}</main>
        <MarketingFooter />
      </div>
    </ThemeProvider>
  );
}
