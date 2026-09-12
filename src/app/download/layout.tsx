import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Download Zeneva | Desktop & Mobile Apps',
  description: 'Experience Zeneva on any device. Download our desktop app for Windows, macOS, and Linux, or get the mobile app for Android to manage your business on the go.',
  alternates: {
    canonical: '/download'
  },
  openGraph: {
    title: 'Download Zeneva POS - Cross-Platform Selling',
    description: 'Track inventory and sales from anywhere. Available for Desktop and Mobile.',
  }
};

export default function DownloadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
