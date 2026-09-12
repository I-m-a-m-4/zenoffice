import { Metadata } from 'next';

// page.tsx is a client component, so metadata has to live in a layout.
export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms governing your use of Zeneva, covering subscriptions, acceptable use, data ownership, service availability, and account termination.',
  alternates: {
    canonical: '/legal/terms-of-service'
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function TermsOfServiceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
