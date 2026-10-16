import { Metadata } from 'next';

// page.tsx is a client component, so metadata has to live in a layout.
export const metadata: Metadata = {
  title: 'Privacy Policy | ZenOffice - AI Document & PDF Editor',
  description: 'How ZenOffice collects, protects, and handles your documents and data with local-first security and complete privacy.',
  alternates: {
    canonical: '/legal/privacy-policy'
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function PrivacyPolicyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
