import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing Plans | Zeneva Retail OS',
  description: 'Explore transparent pricing for Zeneva. From our Starter plan to Enterprise-grade infrastructure, find the perfect retail operating system to scale your business globally.',
  alternates: {
    canonical: '/pricing'
  },
  openGraph: {
    title: 'Zeneva Pricing - Flexible Plans for Growth-Minded Retailers',
    description: 'Start for free or scale globally with our Pro and Enterprise tiers. No hidden fees, just high-performance retail software for inventory and POS management.',
  }
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
