import { Metadata } from 'next';

const siteUrl = 'https://zeneva.space';

export const metadata: Metadata = {
  title: 'Official Digital Receipt | Zeneva Retail OS',
  description: 'View and download your official digital transaction receipt powered by Zeneva Retail OS.',
  openGraph: {
    title: 'Official Digital Receipt | Zeneva Retail OS',
    description: 'Verified digital receipt powered by Zeneva Retail OS. View line items, payment summary, and download PDF.',
    url: `${siteUrl}/receipts/details`,
    siteName: 'Zeneva Retail OS',
    images: [
      {
        url: `${siteUrl}/zeneva-og-image.png?v=5`,
        width: 1200,
        height: 630,
        type: 'image/png',
        alt: 'Zeneva Official Digital Receipt',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Official Digital Receipt | Zeneva Retail OS',
    description: 'Verified digital receipt powered by Zeneva Retail OS.',
    images: [`${siteUrl}/zeneva-og-image.png?v=5`],
  },
};

export default function ReceiptDetailsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
