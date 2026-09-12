
import { Metadata } from 'next';
import ContactContent from './contact-content';

export const metadata: Metadata = {
  title: 'Contact Us | Zeneva Operational Support',
  description: 'Need help scaling your retail business? Get in touch with our tactical support team for inquiries about our POS, inventory management, or enterprise solutions.',
  openGraph: {
    title: 'Contact Zeneva - Tactical Support for Retailers',
    description: 'Reach out to the Zeneva team for support, pricing inquiries, or partnership opportunities.',
    url: 'https://zeneva.space/contact',
    images: [
      {
        url: 'https://zeneva.space/herolytics.svg',
        width: 1200,
        height: 630,
        alt: 'Contact Zeneva Support',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contact Zeneva Operational Support',
    description: 'We are here to assist with your retail mission.',
    images: ['https://zeneva.space/herolytics.svg'],
  },
};

export default function Page() {
  return <ContactContent />;
}
