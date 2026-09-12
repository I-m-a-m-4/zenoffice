import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Industry Use Cases | Offline-First POS for Retail & Wholesale',
  description: 'Ten retail trades, one offline-first register. See which parts of Zeneva were built for supermarkets, pharmacies, boutiques, electronics shops, wholesale, multi-branch chains and mini-marts.',
  alternates: {
    canonical: '/use-cases'
  },
  openGraph: {
    title: 'Zeneva Use Cases - Built for Shops That Cannot Stop Selling',
    description: 'The bottleneck first, then the features that deal with it — across grocery, pharmacy, fashion, electronics, wholesale and multi-branch retail.',
  }
};

export default function UseCasesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
