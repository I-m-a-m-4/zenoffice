
import { Metadata } from 'next';
import { allBlogPosts } from '@/lib/blog-data';
import BlogPostClient from './blog-post-client';

// Next 15 hands params in as a Promise. The code already awaited it; the type
// said otherwise, which is why the generated PageProps check failed.
type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

const siteUrl = 'https://zeneva.space';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const id = resolvedParams.id;

  // Try to find in static blog posts first for immediate SEO
  const staticPost = allBlogPosts.find(p => p.slug === id);

  if (staticPost) {
    return {
      title: `${staticPost.title} | Zeneva Blog`,
      description: staticPost.excerpt,
      alternates: {
        canonical: `/blog/${id}`
      },
      openGraph: {
        title: staticPost.title,
        description: staticPost.excerpt,
        images: [staticPost.imageUrl],
        type: 'article',
      },
      twitter: {
        card: 'summary_large_image',
        title: staticPost.title,
        description: staticPost.excerpt,
        images: [staticPost.imageUrl],
      },
    };
  }

  // Fallback for posts that live only in Firestore. Left noindex on purpose:
  // this branch renders a generic title and description, and an indexed page
  // whose <title> is literally "Blog Post" is the thin content that got the
  // blog penalised. A Firestore post that deserves indexing should be promoted
  // into blog-data.ts, or this branch taught to read Firestore at build time.
  return {
    title: 'Blog Post | Zeneva',
    description: 'Read the latest from Zeneva on retail operations, AI, and business growth.',
    alternates: {
      canonical: `/blog/${id}`
    },
    robots: {
      index: false,
      follow: true,
    },
  };
}

export async function generateStaticParams() {
  return allBlogPosts.map((post) => ({
    id: post.slug,
  }));
}

export default async function Page({ params }: Props) {
  const resolvedParams = await params;
  const id = resolvedParams.id;
  const staticPost = allBlogPosts.find(p => p.slug === id);

  // Structured data is emitted from the server component so it is in the HTML
  // Google receives, rather than injected after hydration. FAQPage is only
  // claimed when the post actually renders those questions — marking up
  // content a visitor cannot see is a structured-data violation.
  const jsonLd = staticPost
    ? {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'BlogPosting',
            '@id': `${siteUrl}/blog/${staticPost.slug}#article`,
            headline: staticPost.title,
            description: staticPost.excerpt,
            image: staticPost.imageUrl,
            articleSection: staticPost.category,
            inLanguage: 'en',
            mainEntityOfPage: {
              '@type': 'WebPage',
              '@id': `${siteUrl}/blog/${staticPost.slug}`,
            },
            author: { '@type': 'Organization', name: 'Zeneva', url: siteUrl },
            publisher: { '@id': `${siteUrl}/#organization` },
          },
          ...(staticPost.faq?.length
            ? [
                {
                  '@type': 'FAQPage',
                  '@id': `${siteUrl}/blog/${staticPost.slug}#faq`,
                  mainEntity: staticPost.faq.map(item => ({
                    '@type': 'Question',
                    name: item.question,
                    acceptedAnswer: { '@type': 'Answer', text: item.answer },
                  })),
                },
              ]
            : []),
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
              { '@type': 'ListItem', position: 2, name: 'Blog', item: `${siteUrl}/blog` },
              {
                '@type': 'ListItem',
                position: 3,
                name: staticPost.title,
                item: `${siteUrl}/blog/${staticPost.slug}`,
              },
            ],
          },
        ],
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <BlogPostClient initialPostData={staticPost} />
    </>
  );
}
