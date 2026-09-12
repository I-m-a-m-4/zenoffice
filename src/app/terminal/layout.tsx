import { Metadata } from 'next';

// page.tsx is a client component, so its metadata has to live here. Without
// this the page inherited the homepage title and description verbatim, which
// made a product landing page look like a duplicate of "/" to a crawler.
export const metadata: Metadata = {
  title: 'Zeneva Terminal | Shared Bank Alerts for Retail Staff',
  description:
    'Let multiple staff receive bank transfer alerts and confirm customer payments instantly — without sharing your account balance. Zeneva Terminal cuts queue time at the counter.',
  alternates: { canonical: '/terminal' },
  openGraph: {
    title: 'Zeneva Terminal | Shared Bank Alerts for Retail Staff',
    description:
      'Staff confirm bank transfers at the counter without calling you or seeing your balance.',
    url: 'https://zeneva.space/terminal',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Zeneva Terminal | Shared Bank Alerts for Retail Staff',
    description:
      'Staff confirm bank transfers at the counter without calling you or seeing your balance.',
  },
};

export default function TerminalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
