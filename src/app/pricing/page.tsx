
import { Metadata } from 'next';
import PricingContent from './pricing-content';

export const metadata: Metadata = {
  title: 'Pricing Plans | ZenOffice - Offline-First Document & PDF Workspace',
  description: 'Choose the perfect plan for your document workspace. Start free forever with our Starter plan, or scale with Pro and Max for advanced AI, OCR, and team collaboration.',
  openGraph: {
    title: 'ZenOffice Pricing - Offline-First Document Workspace',
    description: 'Powerful, offline-first Word, Excel, and PDF editing with AI assistance and secure local storage.',
    url: 'https://zeneva.space/pricing',
    siteName: 'ZenOffice',
    images: [
      {
        url: 'https://zeneva.space/herolytics.svg',
        width: 1200,
        height: 630,
        alt: 'ZenOffice Pricing Plans',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ZenOffice Pricing - Document Workspace',
    description: 'Start for free and create, edit, and convert documents with AI.',
    images: ['https://zeneva.space/herolytics.svg'],
  },
};

export default function Page() {
  return <PricingContent />;
}
