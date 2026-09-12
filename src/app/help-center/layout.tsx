import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Support & Help Center | Zeneva Retail OS',
  description: 'Get the support you need to run your retail business efficiently. Access documentation, tutorials, and common FAQ for the Zeneva platform.',
  alternates: {
    canonical: '/help-center'
  },
  openGraph: {
    title: 'Zeneva Help Center - Resources for Retail Success',
    description: 'Need help with Zeneva? Our support team and documentation are here to guide you through inventory management, POS setup, and more.',
  }
};

export default function HelpCenterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
