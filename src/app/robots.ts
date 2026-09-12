import { MetadataRoute } from 'next';

// Do not rename this to robots.ts.bak. It sat disabled for a long time, which
// meant zeneva.space served no robots.txt at all and the sitemap was never
// advertised to any crawler.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/admin-imamshaffy/',
          // Signed-in surfaces. These are auth-gated, so a crawler only ever
          // sees a redirect or an empty shell — indexing them yields soft-404s.
          '/dashboard',
          '/inventory',
          '/sales',
          '/customers',
          '/receipts',
          '/settings',
          '/billing',
          '/audit-log',
          '/notifications',
          '/ai-insights',
          // '/terminal-alerts', not '/terminal'. These are prefix matches, so
          // the shorter form also blocked /terminal — which is a public
          // marketing page for the Terminal product, not a signed-in surface.
          '/terminal-alerts',
          '/invoice/details',
          '/receipts/details',
          '/auth/login-session',
          // Tenant storefronts are served off subdomains via middleware; the
          // /store/* rewrite target is an implementation detail.
          '/store/',
        ],
      },
    ],
    sitemap: 'https://zeneva.space/sitemap.xml',
    host: 'https://zeneva.space',
  };
}
