import * as React from 'react';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { cn } from '@/lib/utils';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import Loader from '@/components/ui/loader';
import { NavigationEvents } from '@/components/ui/navigation-events';
import { POSProvider } from '@/context/pos-context';
import { BranchProvider } from '@/context/branch-context';
import { I18nProvider } from '@/context/i18n-context';
import { LocaleSync } from '@/components/shared/locale-sync';
import { UserActivityTracker } from '@/components/UserActivityTracker';
import { GlobalAnnouncement } from '@/components/GlobalAnnouncement';
import { PromoToastWindow } from '@/components/marketing/promo-toast-window';
import InstallPrompt from '@/components/pwa/install-prompt';
import { TauriUpdater } from '@/components/TauriUpdater';
import { UpdatePrompt } from '@/components/update-prompt';
import { DesktopTitleBar } from '@/components/desktop/TitleBar';
import { DesktopLauncher } from '@/components/desktop/DesktopLauncher';
import { TauriLayoutWrapper } from '@/components/desktop/TauriWrapper';
import { ChunkErrorListener } from '@/components/shared/chunk-error-listener';
import { FirestoreRecovery } from '@/components/shared/firestore-recovery';
import { ClientSideInitializer } from '@/components/shared/client-initializer';
import { LaunchTelemetry } from '@/components/shared/launch-telemetry';
import { PushClickTracker } from '@/components/shared/push-click-tracker';
import { NativeNotificationListener } from '@/components/shared/native-notification-listener';
import { PWAProvider } from '@/context/pwa-context';
import { SplashScreen } from '@/components/shared/splash-screen';

import { ThemeProvider } from '@/components/theme-provider';
import { DM_Sans, Plus_Jakarta_Sans } from 'next/font/google';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

const siteUrl = 'https://zeneva.space';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  // Deliberately no `alternates` here. Next merges metadata shallowly, so a
  // canonical set on the root layout is inherited by every page that does not
  // set its own — which told Google that /legal/*, /help-center/guides and the
  // standalone blog post were all duplicates of the homepage. Each route owns
  // its canonical; `metadataBase` above lets them be relative.
  //
  // There is no hreflang either, and that is correct as things stand: the 11
  // locales in src/lib/i18n/config.ts are switched client-side from
  // localStorage and are not URL-addressable, so there is no per-language URL
  // to point an alternate at. If locale ever moves into the path or a query
  // param, add hreflang then — claiming it now would point every language at
  // the same English HTML.
  title: {
    default: 'ZenOffice - Your Complete Office Suite',
    template: '%s | ZenOffice'
  },
  description: 'ZenOffice is a powerful document management platform and office suite for viewing and editing files like Word, Excel, and PDF.',
  keywords: [
    'inventory management software', 
    'retail pos system', 
    'cloud pos nigeria', 
    'multi-currency billing', 
    'usd payment gateway for retail', 
    'pharmacy inventory software', 
    'boutique management system', 
    'business analytics dashboard', 
    'global retail OS',
    'pos for mini-marts',
    'offline capable point of sale',
    'inventory system with no subscription options',
    'zeneva vs quickbooks pos',
    'pos for open markets'
  ],
  applicationName: 'ZenOffice',
  authors: [{ name: 'ZenOffice Team' }],
  generator: 'Next.js',
  publisher: 'ZenOffice',
  referrer: 'origin-when-cross-origin',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon-pwa.png', type: 'image/png', sizes: '512x512' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ZenOffice',
  },
  openGraph: {
    title: 'ZenOffice - Your Complete Office Suite',
    description: 'Manage, edit, and organize all your documents seamlessly with ZenOffice.',
    url: siteUrl,
    siteName: 'ZenOffice',
    images: [
      {
        url: `${siteUrl}/zeneva-og-image.png?v=5`,
        width: 1200,
        height: 630,
        type: 'image/png',
        alt: 'Zeneva Retail Operating System',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ZenOffice - Your Complete Office Suite',
    description: 'Manage, edit, and organize all your documents seamlessly with ZenOffice.',
    images: [`${siteUrl}/zeneva-og-image.png?v=5`],
    creator: '@zenoffice',
  }
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      'url': siteUrl,
      'name': 'Zeneva',
      'potentialAction': {
        '@type': 'SearchAction',
        'target': `${siteUrl}/help-center?q={search_term_string}`,
        'query-input': 'required name=search_term_string'
      }
    },
    {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: 'Zeneva',
      url: siteUrl,
      logo: `${siteUrl}/zeneva-og-image.png?v=5`,
      // Machine-readable form of the CAC badge the footer already renders. The
      // badge is an image plus sr-only text; this is what actually gives the
      // registration a chance of being treated as an entity signal.
      legalName: 'Zeneva',
      identifier: {
        '@type': 'PropertyValue',
        name: 'Corporate Affairs Commission (CAC) Business Number',
        value: 'BN 9673520',
      },
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'NG',
      },
      // The product UI ships in these locales (src/lib/i18n/config.ts). Stated
      // here rather than as hreflang because the locales are switched
      // client-side and have no distinct URLs to point an alternate at.
      availableLanguage: [
        'en', 'fr', 'es', 'pt', 'de', 'it', 'ar', 'zh-Hans', 'ja', 'ko', 'hi',
      ],
      sameAs: [
        'https://x.com/zeneva_retail',
        'https://www.instagram.com/zeneva_pos/',
        'https://www.tiktok.com/@zeneva_retail',
        'https://www.youtube.com/@ZenevaPos'
      ]
    },
    {
      '@type': 'SoftwareApplication',
      name: 'Zeneva',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web, Android, iOS, Windows, macOS, Linux',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'NGN',
        description: 'Starter plan is free forever. Paid plans start at ₦10,000/month.'
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.9',
        ratingCount: '156'
      }
    },
    {
      // This was a BreadcrumbList. It is not one: a breadcrumb describes where
      // the *current* page sits in the hierarchy, and this is a fixed list of
      // seven top-level pages emitted from the root layout onto every route.
      // As a breadcrumb it was both wrong everywhere and in direct conflict
      // with the real per-page trail (e.g. the one in blog/[id]/page.tsx),
      // which is how you get breadcrumb rich results dropped sitewide.
      // SiteNavigationElement is the correct type for a global nav.
      '@type': 'SiteNavigationElement',
      '@id': `${siteUrl}/#nav`,
      'name': ['Home', 'Pricing', 'Download', 'Blog', 'Contact', 'Help Center', 'Use Cases', 'Our Mission'],
      'url': [
        siteUrl,
        `${siteUrl}/pricing`,
        `${siteUrl}/download`,
        `${siteUrl}/blog`,
        `${siteUrl}/contact`,
        `${siteUrl}/help-center`,
        `${siteUrl}/use-cases`,
        `${siteUrl}/about/our-mission`,
      ]
    }
  ]
};

import Script from 'next/script';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr" prefix="og: http://ogp.me/ns#" className={cn(dmSans.variable, jakarta.variable)} suppressHydrationWarning>
      <head>
        <meta name="google-site-verification" content="QGYrHkSlC71065ymk6dZc6DFesm14JeSPw-myjzZVso" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
        <link rel="dns-prefetch" href="https://code.iconify.design" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&family=Bricolage+Grotesque:opsz,wght@12..96,200..800&display=swap"
        />
        {/* Dark status bar on Android Chrome and desktop browsers */}
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0f0f0f" media="(prefers-color-scheme: dark)" />
        <Script src="https://code.iconify.design/iconify-icon/2.1.0/iconify-icon.min.js" strategy="afterInteractive" />
        
        {/* Google Analytics */}
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}');
              `}
            </Script>
          </>
        )}

        {/* Smartsupp Chat */}
        {process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_SMARTSUPP_KEY && (
          <Script id="smartsupp-chat" strategy="lazyOnload">
            {`
              var _smartsupp = _smartsupp || {};
              _smartsupp.key = '${process.env.NEXT_PUBLIC_SMARTSUPP_KEY}';
              window.smartsupp||(function(d){
              var s=d.getElementsByTagName('script')[0],c=d.createElement('script');
              c.type='text/javascript';c.charset='utf-8';c.async=true;
              c.src='https://www.smartsuppchat.com/loader.js?';s.parentNode.insertBefore(c,s);
              })(document);
            `}
          </Script>
        )}

        {/* Meta Pixel */}
        {process.env.NODE_ENV === 'production' && (
          <Script id="meta-pixel" strategy="afterInteractive">
            {`
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '1777044610581'); // Reference ID
              fbq('track', 'PageView');
            `}
          </Script>
        )}

        {/* Tiktok Pixel */}
        {process.env.NODE_ENV === 'production' && (
          <Script id="tiktok-pixel" strategy="afterInteractive">
            {`
               !function (w, d, t) {
                 w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","detach","updateConfig"],ttq.setAndLog=function(t,e){return function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq[ttq.methods[i]]=ttq.setAndLog(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)e[ttq.methods[n]]=ttq.setAndLog(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=d.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
                ttq.load('D2GLT5BC77U9B02LVDL0');
                ttq.page();
              }(window, document, 'ttq');
            `}
          </Script>
        )}

        {/* Twitter Pixel */}
        {process.env.NODE_ENV === 'production' && (
          <Script id="twitter-pixel" strategy="afterInteractive">
            {`
              !function(e,t,n,s,u,a){e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):s.queue.push(arguments);
              },s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,u.src='https://static.ads-twitter.com/uwt.js',
              a=t.getElementsByTagName(n)[0],a.parentNode.insertBefore(u,a))}(window,document,'script');
              twq('config','ohv59');
            `}
          </Script>
        )}
      </head>
      <body className={cn('font-body antialiased bg-background text-foreground')} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <I18nProvider>
          <SplashScreen />
          <ClientSideInitializer />
          {/* Outside FirebaseClientProvider on purpose — it measures people who
              never sign in, and it has to keep reporting on a build where the
              Firebase config itself is the fault. */}
          <LaunchTelemetry />
          <ChunkErrorListener />
          <FirestoreRecovery />
          <FirebaseClientProvider>
            <PWAProvider>
              <UserActivityTracker />
              {/* Inside the Firebase provider on purpose: attributing a tapped
                  push needs the signed-in uid, and it has to cover every route
                  because a notification can deep-link anywhere. */}
              <PushClickTracker />
              <NativeNotificationListener />
              <GlobalAnnouncement />
              <PromoToastWindow />
              <Loader />
              <InstallPrompt />
              <TauriUpdater />
              <UpdatePrompt />
              <BranchProvider>
                <POSProvider>
                  <LocaleSync />
                  <TauriLayoutWrapper>
                     <DesktopTitleBar />
                     <DesktopLauncher />
                     <Suspense>
                       <NavigationEvents />
                     </Suspense>
                     {children}
                  </TauriLayoutWrapper>
                </POSProvider>
              </BranchProvider>
            </PWAProvider>
          </FirebaseClientProvider>
          </I18nProvider>
        </ThemeProvider>
        <Toaster />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}
