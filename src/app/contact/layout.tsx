import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Us | Partner with Zeneva Retail OS',
  description: 'Connect with our global support and sales team. Whether you need technical assistance or want to scale your retail operations, Zeneva is here to help.',
  alternates: {
    canonical: '/contact'
  },
  openGraph: {
    title: 'Contact Zeneva - Global Retail Support',
    description: 'Get in touch with the Zeneva team for sales inquiries, technical support, and partnership opportunities.',
  }
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
