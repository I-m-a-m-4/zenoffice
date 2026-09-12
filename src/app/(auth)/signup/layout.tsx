import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign Up | Start Free with Zeneva',
  description: 'Join thousands of businesses using Zeneva. Create your account and start managing your inventory and sales with our forever-free Starter plan.',
  // /signup takes an ?invite= / ?ref= query string in several flows. Without an
  // explicit canonical every one of those variants is a separate URL to Google,
  // splitting the signals of the highest-intent page on the site.
  alternates: { canonical: '/signup' },
};

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
