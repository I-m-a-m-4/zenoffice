
import { Metadata } from 'next';
import PricingContent from './pricing-content';

export const metadata: Metadata = {
  title: 'Pricing Plans | Zeneva POS & Inventory Management',
  description: 'Choose the perfect plan for your retail business. Start free forever with our Starter plan — no trial, no credit card — or scale with Pro and Business features.',
  openGraph: {
    title: 'Zeneva Pricing - Scale Your Retail Business',
    description: 'Affordable, high-fidelity inventory management and POS software tailored for Nigerian retailers.',
    url: 'https://zeneva.space/pricing',
    siteName: 'Zeneva',
    images: [
      {
        url: 'https://zeneva.space/herolytics.svg',
        width: 1200,
        height: 630,
        alt: 'Zeneva Pricing Plans',
      },
    ],
    locale: 'en_NG',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Zeneva Pricing - Scale Your Retail Business',
    description: 'Start for free and automate your retail operations today.',
    images: ['https://zeneva.space/herolytics.svg'],
  },
};

export default function Page() {
  return <PricingContent />;
}
