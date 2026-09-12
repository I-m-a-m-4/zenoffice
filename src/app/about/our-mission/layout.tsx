import { Metadata } from 'next';
import { Lora } from 'next/font/google';

/**
 * Lora carries every heading on this page — the serif/sans split is the whole
 * point of the design language, so it is not optional decoration.
 *
 * Loaded through `next/font` rather than a `<link>` to a font CDN: next/font
 * self-hosts the file at build time, which keeps it working inside the Tauri
 * shells (they have no network guarantee) and scopes the preload to this route
 * instead of every page on the site.
 */
const lora = Lora({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-lora',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Our Mission | Empowering Retailers Worldwide',
  description: 'Learn why we built Zeneva. Our mission is to provide retailers with the intelligence they need to thrive, minimize waste, and maximize profit with cutting-edge technology.',
  alternates: {
    canonical: '/about/our-mission'
  },
  openGraph: {
    title: 'The Zeneva Mission - Beyond Just Software',
    description: 'We are on a journey to transform inventory management into an active profit engine for every business.',
  }
};

export default function MissionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // A real element, not a fragment — the font variable has to land on a node
  // for the page below to inherit it.
  return <div className={lora.variable}>{children}</div>;
}
