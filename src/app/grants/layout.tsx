import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Business Grants Directory | Equity-Free Funding',
  description: 'Explore verified, equity-free business grants and funding opportunities tailored for Nigerian retail entrepreneurs, pharmacies, supermarkets, and MSMEs.',
  alternates: {
    canonical: '/grants'
  },
  openGraph: {
    title: 'Zeneva Grants Directory - Funding for Retail Growth',
    description: 'Find government, foundation, and international grants to expand your retail business capital risk-free.',
  }
};

export default function GrantsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
