import { Metadata } from 'next';

// page.tsx is a client component, so its metadata has to live here — the same
// reason /terminal/layout.tsx exists. Without it this page inherits the
// homepage title verbatim and reads to a crawler as a duplicate of "/".
export const metadata: Metadata = {
  title: 'Zen AI | Ask Your Shop Anything — Built Into Zeneva',
  description:
    'Zen AI is the assistant inside Zeneva. Ask about stock, sales, customers and cash in plain words. It reads your live data, proposes changes as cards, and writes nothing until you approve.',
  alternates: { canonical: '/zen-ai' },
  openGraph: {
    title: 'Zen AI | Ask Your Shop Anything',
    description:
      'Stock, sales, customers and forecasts in plain words. Zen AI proposes; you approve. Nothing is written without you.',
    url: 'https://zeneva.space/zen-ai',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Zen AI | Ask Your Shop Anything',
    description:
      'Stock, sales, customers and forecasts in plain words. Zen AI proposes; you approve.',
  },
};

export default function ZenAiLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
