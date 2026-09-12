import { Metadata } from 'next';

const siteUrl = 'https://zeneva.space';

export const metadata: Metadata = {
  title: 'Official Digital Invoice | Zeneva Retail OS',
  description: 'View and download your official digital invoice powered by Zeneva Retail OS.',
  openGraph: {
    title: 'Official Digital Invoice | Zeneva Retail OS',
    description: 'Verified digital invoice powered by Zeneva Retail OS. View line items, payment terms, and download PDF.',
    url: `${siteUrl}/invoice/details`,
    siteName: 'Zeneva Retail OS',
    images: [
      {
        url: `${siteUrl}/zeneva-og-image.png?v=5`,
        width: 1200,
        height: 630,
        type: 'image/png',
        alt: 'Zeneva Official Digital Invoice',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Official Digital Invoice | Zeneva Retail OS',
    description: 'Verified digital invoice powered by Zeneva Retail OS.',
    images: [`${siteUrl}/zeneva-og-image.png?v=5`],
  },
};

export default function InvoiceDetailsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
