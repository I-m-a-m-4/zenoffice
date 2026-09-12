import { Metadata } from 'next';

// page.tsx is a client component, so metadata has to live in a layout.
export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Zeneva collects, stores, and protects your business and customer data, including your rights over that data and how to exercise them.',
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
