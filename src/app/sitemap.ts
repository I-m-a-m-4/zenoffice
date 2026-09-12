import { MetadataRoute } from 'next';
import { adminFirestore } from '@/firebase/admin';
import { allBlogPosts } from '@/lib/blog-data';

const baseUrl = 'https://zeneva.space';

// Only routes that render real content to an anonymous visitor belong here.
// Auth-gated app routes and the /store/* rewrite target are excluded — see
// robots.ts, which disallows the same set.
const CORE_ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
  { path: '', priority: 1.0, changeFrequency: 'daily' },
  { path: '/pricing', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/download', priority: 0.9, changeFrequency: 'weekly' },
  // Public product page for Terminal. robots.ts used to disallow '/terminal',
  // which prefix-matched this page as well as the signed-in /terminal-alerts.
  { path: '/terminal', priority: 0.85, changeFrequency: 'monthly' },
  // Public product page for Zen AI. Deliberately '/zen-ai' and not anything
  // under '/ai-insights' — robots.ts disallows that prefix because the
  // signed-in chat lives there, and a marketing page beneath it would be
  // excluded from the index by the same rule.
  { path: '/zen-ai', priority: 0.85, changeFrequency: 'monthly' },
  { path: '/blog', priority: 0.85, changeFrequency: 'daily' },
  { path: '/use-cases', priority: 0.85, changeFrequency: 'monthly' },
  { path: '/help-center', priority: 0.85, changeFrequency: 'weekly' },
  { path: '/help-center/guides', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/signup', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/login', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/grants', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/careers', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/about/our-mission', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/legal/privacy-policy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/legal/terms-of-service', priority: 0.3, changeFrequency: 'yearly' },
];

// Hand-built post that lives at its own route rather than in blog-data.ts, so
// the allBlogPosts loop below does not pick it up.
const STANDALONE_POSTS = ['/blog/mastering-retail-operations-with-zeneva'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const routes: MetadataRoute.Sitemap = CORE_ROUTES.map(({ path, priority, changeFrequency }) => ({
    url: `${baseUrl}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));

  // Track slugs so a post that exists both in blog-data.ts and in Firestore is
  // listed once. Two <url> entries for one page is a self-inflicted duplicate.
  const seenSlugs = new Set<string>();

  const staticBlogRoutes: MetadataRoute.Sitemap = allBlogPosts.map(post => {
    seenSlugs.add(post.slug);
    return {
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    };
  });

  const standaloneRoutes: MetadataRoute.Sitemap = STANDALONE_POSTS.map(path => ({
    url: `${baseUrl}${path}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  let dynamicBlogRoutes: MetadataRoute.Sitemap = [];
  try {
    if (adminFirestore) {
      const blogSnapshot = await adminFirestore
        .collection('blogPosts')
        .where('published', '==', true)
        .get();

      dynamicBlogRoutes = blogSnapshot.docs.reduce((acc: MetadataRoute.Sitemap, doc: any) => {
        const data = doc.data();
        const slug = data.slug || doc.id;

        if (!seenSlugs.has(slug)) {
          seenSlugs.add(slug);
          acc.push({
            url: `${baseUrl}/blog/${slug}`,
            lastModified: data.updatedAt?.toDate() || now,
            changeFrequency: 'monthly' as const,
            priority: 0.6,
          });
        }
        return acc;
      }, []);
    }
  } catch (error) {
    // A sitemap that throws is worse than one missing the Firestore posts:
    // Next would serve a 500 and the whole file would disappear from Search
    // Console. Degrade to the static routes instead.
    console.warn('[sitemap] dynamic fetch failed, serving static routes only:', error);
  }

  return [...routes, ...standaloneRoutes, ...staticBlogRoutes, ...dynamicBlogRoutes];
}
