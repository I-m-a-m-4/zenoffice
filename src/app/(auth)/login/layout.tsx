import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login | Access Your Zeneva Workspace',
  description: 'Sign in to your Zeneva account to manage your inventory, process sales, and view real-time business analytics.',
  // Indexable on purpose: "zeneva login" is a real branded query and this page
  // should own it rather than leave it to a third party. It is listed in
  // sitemap.ts, so noindex here would trip the "submitted URL marked noindex"
  // warning in Search Console — the two have to agree.
  alternates: { canonical: '/login' },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
