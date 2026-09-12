
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { 
  getDoc, 
  doc, 
  collection, 
  query, 
  where, 
  limit,
  getDocs
} from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import type { BlogPost } from '@/types';
import MarketingHeader from '@/components/layout/marketing-header';
import MarketingFooter from '@/components/layout/marketing-footer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  ArrowLeft, 
  Calendar, 
  User, 
  Share2, 
  Twitter, 
  Linkedin, 
  Link as LinkIcon,
  BookOpen,
  ChevronRight,
  TrendingUp,
  MessageCircle,
  Clock,
  Briefcase,
  ExternalLink,
  ChevronLeft,
  Instagram,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useToast } from '@/hooks/use-toast';
import { ThemeProvider } from '@/components/theme-provider';
import { allBlogPosts, getRelatedPosts } from '@/lib/blog-data';

// Plan promo shown at the end of every article.
//
// The numbers are copied from two places and must be changed with them, not
// guessed at here: the limits come from `PRODUCT_LIMITS` / `STAFF_LIMITS` /
// `AI_DAILY_LIMITS` in `src/lib/plan.ts`, the prices from the constants at the
// top of `src/app/pricing/pricing-content.tsx`. Both currencies are printed
// because this page has no locale detection — the pricing page picks one by
// timezone, a static article cannot.
//
// Deliberately absent: any "join thousands of retailers" line. The block this
// replaced claimed a customer count nothing in the codebase can support, which
// is the kind of copy that costs more trust than it wins.
const PLAN_PROMO = [
  {
    name: 'Starter',
    price: 'Free forever',
    detail: '50 products, 1 user, 20 Zen AI questions a day. No trial clock, no card.',
  },
  {
    name: 'Pro',
    price: '₦10,000 / $10 a month',
    detail: '1,500 products, 5 staff accounts, 100 Zen AI questions a day.',
    highlight: true,
  },
  {
    name: 'Business',
    price: '₦30,000 / $30 a month',
    detail: 'Unlimited products, unlimited staff, 500 Zen AI questions a day.',
  },
];

// Rough reading time, on the same ~1000-characters-a-minute rule the rest of
// the page already used. Static posts carry `content` as optional, so a post
// still awaiting a body reads as 1 min rather than crashing on `.length`.
function readingMinutes(content?: string): number {
  return Math.ceil((content?.length || 0) / 1000) + 1;
}

export default function BlogPostClient({ initialPostData }: { initialPostData?: any }) {
  const params = useParams();
  const id = params?.id as string || (initialPostData ? initialPostData.slug : '');
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const getInitialPost = () => {
    if (!initialPostData) return null;
    return {
      id: initialPostData.slug,
      title: initialPostData.title,
      slug: initialPostData.slug,
      content: initialPostData.content || `## ${initialPostData.title}\n\n${initialPostData.excerpt}\n\n${initialPostData.directAnswer || ''}`,
      excerpt: initialPostData.excerpt,
      imageUrl: initialPostData.imageUrl,
      authorId: 'admin',
      authorName: 'Zeneva Editorial',
      published: true,
      category: initialPostData.category,
      faq: initialPostData.faq,
      tableData: initialPostData.tableData,
      createdAt: { toDate: () => new Date('2026-04-19') },
      updatedAt: { toDate: () => new Date('2026-04-19') }
    } as any;
  };

  const [post, setPost] = React.useState<BlogPost | null>(getInitialPost());
  const [isLoading, setIsLoading] = React.useState(!initialPostData);
  const [activeSection, setActiveSection] = React.useState<string>('');

  const headings = React.useMemo(() => {
    if (!post?.content) return [];
    const h2s = post.content.match(/^## (.*$)/gm);
    if (!h2s) return [];
    return h2s.map(h => h.replace('## ', '').trim());
  }, [post?.content]);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-20% 0% -35% 0%' }
    );

    headings.forEach((heading) => {
      const id = heading.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, '-');
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [post, headings]);

  // Related posts come from the static catalogue, not Firestore.
  //
  // This used to subscribe to `blogPosts` where published == true. Every one of
  // the 26 articles lives in `blog-data.ts`, and that collection is empty, so
  // the subscription returned nothing and both the sidebar "Related" list and
  // any end-of-article link rendered blank on every post — a dead end for the
  // reader and a missing internal link for crawlers. `getRelatedPosts` reads
  // the same catalogue the page itself was built from, prefers the current
  // post's category, backfills across categories so the strip is never short,
  // and is seeded off the slug so server and client agree (no hydration
  // mismatch) and a crawl sees a stable link graph.
  //
  // It also drops a live collection listener from a public marketing page,
  // which was billing reads on every visit for results nobody could see.
  const relatedPosts = React.useMemo(() => getRelatedPosts(id, 3), [id]);

  React.useEffect(() => {
    if (!firestore || !id) return;
    if (initialPostData && initialPostData.slug === id) return;

    const fetchPost = async () => {
      setIsLoading(true);
      try {
        const docRef = doc(firestore, 'blogPosts', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists() && docSnap.data().published) {
          setPost({ id: docSnap.id, ...docSnap.data() } as BlogPost);
        } else {
          // Slug lookup
          const slugQuery = query(
            collection(firestore, 'blogPosts'), 
            where('slug', '==', id),
            where('published', '==', true),
            limit(1)
          );
          const slugSnap = await getDocs(slugQuery);
          if (!slugSnap.empty) {
            const d = slugSnap.docs[0];
            setPost({ id: d.id, ...d.data() } as BlogPost);
          } else {
            // Static Fallback
            const staticPost = allBlogPosts.find(p => p.slug === id);
            if (staticPost) {
              setPost({
                id: staticPost.slug,
                title: staticPost.title,
                slug: staticPost.slug,
                content: staticPost.content || `## ${staticPost.title}\n\n${staticPost.excerpt}\n\n${staticPost.directAnswer || ''}`,
                excerpt: staticPost.excerpt,
                imageUrl: staticPost.imageUrl,
                authorId: 'admin',
                authorName: 'Zeneva Editorial',
                published: true,
                category: staticPost.category,
                // @ts-ignore
                faq: staticPost.faq,
                // @ts-ignore
                tableData: staticPost.tableData,
                createdAt: { toDate: () => new Date('2026-04-19') },
                updatedAt: { toDate: () => new Date('2026-04-19') }
              } as any);
            } else {
              router.push('/blog');
            }
          }
        }
      } catch (error) {
        console.error("Error fetching blog post:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPost();
  }, [firestore, id, router]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({ title: 'Link Copied', description: 'Article link added to clipboard.' });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <MarketingHeader />
        <main className="pt-40 container mx-auto px-6">
          <div className="max-w-4xl mx-auto space-y-8">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="aspect-video w-full rounded-[2.5rem]" />
          </div>
        </main>
      </div>
    );
  }

  if (!post) return null;

  return (
    <ThemeProvider forcedTheme="light">
      <div className="min-h-screen bg-white selection:bg-slate-900 selection:text-white">
        <MarketingHeader />
        
        <main className="min-h-screen">
          {/* New Hero Section */}
          <section className="relative w-full pt-56 pb-32 md:pt-72 md:pb-48 min-h-[55vh] overflow-hidden flex flex-col justify-end lg:justify-center items-center">
            {/* Background Image with Dark Overlay */}
            <div 
              className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url('/zeneva blog hero  image.png')` }}
            />
            <div className="absolute inset-0 z-0 bg-black/80" /> {/* Dark overlay */}

            <div className="relative z-10 w-full max-w-4xl mx-auto px-6 text-center text-white">
              {/* Breadcrumbs */}
              <nav className="mb-6 text-[11px] font-medium text-white/60 flex flex-wrap items-center justify-center gap-2 tracking-widest">
                <Link href="/blog" className="hover:text-white transition-colors uppercase">Blog</Link>
                <span className="text-white/40">/</span>
                <span className="text-white max-w-full truncate">{post.title}</span>
              </nav>

              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-medium tracking-tight mb-6 leading-tight text-white">
                 {post.title}
              </h1>
              
              <div className="flex flex-wrap items-center justify-center gap-4 text-[12px] font-normal text-white/70 tracking-wide">
                 <div className="flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5 text-white/50" />
                    <span className="text-white">{post.category || 'Operational Mastery'}</span>
                 </div>
                 <span className="text-white/30">•</span>
                 <time dateTime={post.createdAt ? post.createdAt.toDate().toISOString() : ''} className="text-white">
                   {post.createdAt ? format(post.createdAt.toDate(), 'MMMM d, yyyy') : 'Recently'}
                 </time>
                 <span className="text-white/30">•</span>
                 <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-white/50" />
                    <span className="text-white">{Math.ceil(post.content.length / 1000) + 3} min read</span>
                 </div>
              </div>
            </div>
          </section>

          <div className="mx-auto max-w-6xl px-6 pb-16 pt-16 sm:px-6 sm:pb-24 lg:grid lg:grid-cols-[minmax(0,1fr)_220px] lg:gap-12 lg:pb-24 xl:gap-16">
            <article className="min-w-0">
              {/* Main Content Area */}
              <div className="max-w-none 
                [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_h4]:font-semibold 
                [&_h1]:tracking-tight [&_h2]:tracking-tight [&_h3]:tracking-tight [&_h4]:tracking-tight 
                [&_h1]:text-slate-900 [&_h2]:text-slate-900 [&_h3]:text-slate-900 [&_h4]:text-slate-900 
                [&_h2]:text-2xl [&_h2]:sm:text-3xl [&_h3]:text-xl [&_h3]:sm:text-2xl [&_h4]:text-lg [&_h4]:sm:text-xl
                [&_h1]:mt-12 [&_h2]:mt-12 [&_h3]:mt-12 [&_h4]:mt-12 
                [&_h1]:mb-6 [&_h2]:mb-6 [&_h3]:mb-6 [&_h4]:mb-6
                [&_p]:text-slate-600 [&_p]:text-base [&_p]:leading-loose [&_p]:mb-8
                [&_strong]:text-slate-900 [&_strong]:font-semibold
                [&_a]:text-orange-600 [&_a]:no-underline hover:[&_a]:underline [&_a]:transition-all
                [&_blockquote]:border-l-2 [&_blockquote]:border-slate-200 [&_blockquote]:pl-6 [&_blockquote]:italic [&_blockquote]:text-slate-500
                [&_img]:rounded-3xl [&_img]:shadow-sm
                [&_hr]:border-slate-100 [&_hr]:my-16
                [&_table]:border-collapse [&_th]:text-left [&_th]:font-semibold [&_th]:text-slate-900 [&_th]:pb-4 [&_td]:py-4 [&_td]:border-t [&_td]:border-slate-100
              ">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({node, ...props}) => null, // Strip H1 from markdown to prevent duplicates
                    h2: ({node, children, ...props}) => {
                      const id = String(children).toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, '-');
                      return <h2 id={id} {...props}>{children}</h2>
                    }
                  }}
                >
                  {post.content}
                </ReactMarkdown>

                {/* Optional Table Data Rendering */}
                {(post as any).tableData && (
                  <div className="mt-16 overflow-hidden rounded-3xl border border-slate-100 bg-slate-50/50 p-1">
                    <div className="bg-white rounded-[1.4rem] overflow-hidden border border-slate-100">
                      <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                        <h4 className="font-black text-slate-900 tracking-tight">{(post as any).tableData.title}</h4>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-slate-50/50 text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                            <tr>
                              {(post as any).tableData.headers.map((h: string, i: number) => (
                                <th key={i} className="px-6 py-4">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(post as any).tableData.rows.map((row: string[], i: number) => (
                              <tr key={i} className="hover:bg-slate-50/30 transition-colors">
                                {row.map((cell: string, j: number) => (
                                  <td key={j} className="px-6 py-4 font-medium text-slate-600">
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* FAQ Section */}
                <div className="mt-24 pt-16 border-t border-slate-100">
                  <h3 className="text-2xl font-black text-slate-950 mb-8 tracking-tight font-bricolage">Operational FAQ</h3>
                  <Accordion type="multiple" className="w-full">
                    {((post as any).faq || [
                      {
                        question: "How does Zeneva track profit automatically?",
                        answer: "Zeneva links every transaction to your product cost and sales price in real-time. Our system calculates your gross and net margins instantly across all outlets, so you always know exactly how much profit you've made today."
                      },
                      {
                        question: "What makes Zeneva different from other inventory tools?",
                        answer: "Most tools report the past. Zeneva predicts the future. Zen AI analyzes demand patterns and recommends exact stock decisions to maximize profit and reduce wastage."
                      },
                      {
                        question: "Does Zeneva work without internet?",
                        answer: "Yes. The Zeneva POS works fully offline. All transactions are queued and synced automatically once connectivity returns—ensuring no sales are ever lost even in low-signal areas."
                      },
                      {
                        question: "Can I manage multiple shops from one account?",
                        answer: "Absolutely. Zeneva was built for enterprise scale. You can monitor stock levels, sales, and staff across 50+ locations from a single high-fidelity dashboard."
                      },
                      {
                        question: "How accurate are the Zen AI predictions?",
                        answer: "Zen AI improves continuously using your historical sales, time-based demand, and customer behavior. Accuracy typically reaches over 94% after just 30 days of consistent data."
                      }
                    ]).map((item: any, index: number) => (
                      <AccordionItem key={index} value={`item-${index}`} className="border-slate-100">
                        <AccordionTrigger className="text-left font-bold text-slate-900 hover:text-orange-600 transition-all py-4 text-base">
                          {item.question}
                        </AccordionTrigger>
                        <AccordionContent className="text-slate-500 text-base leading-relaxed pb-4">
                          {item.answer}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              </div>

              {/* Continue reading.
                  The sidebar version of this is hidden below `lg`, so on a
                  phone — where most of this traffic lands — the article used to
                  end with a pricing pitch and no next article at all. */}
              {relatedPosts.length > 0 && (
                <div className="mt-24 pt-10 border-t border-slate-100">
                  <div className="flex items-baseline justify-between mb-8">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Continue reading</p>
                    <Link href="/blog" className="text-[11px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors">
                      All articles
                    </Link>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    {relatedPosts.map((p) => (
                      <Link
                        key={p.slug}
                        href={`/blog/${p.slug}`}
                        className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 hover:border-slate-300 hover:shadow-sm transition-all"
                      >
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                          {p.category}
                        </span>
                        <h3 className="text-base font-bold leading-snug text-slate-900 mb-3">
                          {p.title}
                        </h3>
                        <p className="text-sm text-slate-500 leading-relaxed line-clamp-3 mb-6">
                          {p.excerpt}
                        </p>
                        <div className="mt-auto flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-900 group-hover:gap-2.5 transition-all">
                          Read · {readingMinutes(p.content)} min
                          <ArrowRight className="h-3 w-3" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Plans */}
              <div className="mt-24 rounded-[2.5rem] bg-slate-100 text-slate-900 p-8 md:p-16 relative overflow-hidden border border-dashed border-slate-200">
                <div className="absolute inset-0 grid-lines opacity-10 pointer-events-none"></div>
                <div className="relative z-10">
                  <div className="max-w-2xl mb-10">
                    <h3 className="text-3xl md:text-4xl font-black tracking-tight mb-4 leading-tight text-slate-950">
                      Run this on Zeneva
                    </h3>
                    <p className="text-slate-600 font-medium text-lg">
                      Stock, sales, staff and receipts in one place — on the shop PC, on your phone, and offline when the network drops. Start free and move up only when the shop outgrows the caps.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3 mb-10">
                    {PLAN_PROMO.map((plan) => (
                      <div
                        key={plan.name}
                        className={cn(
                          'rounded-2xl p-6 border bg-white',
                          plan.highlight ? 'border-slate-900 shadow-sm' : 'border-slate-200'
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-950">{plan.name}</p>
                          {plan.highlight && (
                            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                              Most picked
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-bold text-slate-900 mb-3">{plan.price}</p>
                        <p className="text-xs text-slate-500 leading-relaxed">{plan.detail}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                    <Link href="/signup" className="hover:bg-[#0f172a] transition-colors text-sm font-medium text-white tracking-tight font-dm-sans bg-[#1e293b] rounded-md pt-2.5 pr-8 pb-2.5 pl-8 shadow-sm text-center">Start free</Link>
                    <Link href="/pricing" className="transition-colors text-sm font-medium bg-[#ffffff] border rounded-md px-8 py-2.5 font-dm-sans tracking-tight hover:text-slate-600 text-slate-900 border-stone-200 shadow-sm text-center">Compare plans</Link>
                    <p className="text-xs text-slate-500 font-medium sm:ml-2">No card needed for Starter.</p>
                  </div>
                </div>
              </div>

              {/* Share */}
              <div className="mt-24 pt-10 border-t border-slate-100 flex items-center justify-between">
                 <div className="flex items-center gap-6">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Share</span>
                    <div className="flex gap-4">
                      <button onClick={copyLink} className="text-slate-400 hover:text-slate-900 transition-colors">
                        <Share2 className="h-4 w-4" />
                      </button>
                      <button className="text-slate-400 hover:text-slate-900 transition-colors">
                        <Twitter className="h-4 w-4" />
                      </button>
                    </div>
                 </div>
                 
                 <Button asChild variant="link" className="text-slate-400 hover:text-slate-900 p-0 h-auto text-[11px] font-bold uppercase tracking-widest no-underline">
                    <Link href="/blog" className="flex items-center gap-2">
                      <ChevronLeft className="h-3 w-3" />
                      All articles
                    </Link>
                 </Button>
              </div>
            </article>

            {/* Sidebar / On this page */}
            <aside className="hidden lg:block">
              <div className="sticky top-40 space-y-12">
                 <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-6">On this page</p>
                    <div className="space-y-6">
                       <p className="text-sm font-medium text-slate-500 leading-relaxed border-l-2 border-slate-100 pl-4 mb-4">
                         {post.excerpt || "Strategic breakdown of mission-critical retail operations."}
                       </p>
                       <nav className="flex flex-col gap-4">
                         {headings.map((heading) => {
                           const id = heading.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, '-');
                           return (
                             <button 
                               key={id}
                               onClick={() => {
                                 const el = document.getElementById(id);
                                 if (el) el.scrollIntoView({ behavior: 'smooth' });
                               }}
                               className={cn(
                                 "text-left text-xs font-bold transition-all duration-300",
                                 activeSection === id ? "text-orange-600 pl-2" : "text-slate-500 hover:text-slate-900"
                               )}
                             >
                               {heading}
                             </button>
                           );
                         })}
                       </nav>
                    </div>
                 </div>

                  <div className="pt-10 border-t border-slate-100">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-6 font-mono">Follow Mission</p>
                    <Link 
                      href="https://instagram.com/zeneva_pos" 
                      target="_blank"
                      className="group flex flex-col gap-4 p-5 rounded-2xl bg-slate-50 hover:bg-white border border-transparent hover:border-slate-200 transition-all duration-300 shadow-sm hover:shadow-md"
                    >
                      <div className="flex items-center gap-3">
                         <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-purple-600 to-orange-500 p-[2px]">
                            <div className="h-full w-full rounded-[10px] bg-white flex items-center justify-center">
                               <Instagram className="h-5 w-5 text-slate-900" />
                            </div>
                         </div>
                         <div>
                            <p className="text-xs font-black text-slate-950 uppercase tracking-tighter">@zeneva_pos</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Follow Tactical Feed</p>
                         </div>
                      </div>
                      <p className="text-[10px] leading-relaxed text-slate-500 font-medium">Join 2.5k+ retailers getting daily growth tactics and operational insights on the gram.</p>
                      <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-950 uppercase tracking-widest group-hover:gap-2 transition-all">
                        Follow Now <ArrowRight className="h-3 w-3" />
                      </div>
                    </Link>
                  </div>

                  <div className="pt-10 border-t border-slate-100">
                     <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-6 font-mono">Related</p>
                    <div className="flex flex-col gap-8">
                       {relatedPosts.map(p => (
                         <Link key={p.slug} href={`/blog/${p.slug}`} className="group block">
                            <h4 className="text-sm font-bold leading-snug text-slate-600 group-hover:text-slate-900 transition-colors mb-2">
                               {p.title}
                            </h4>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                               <span>{p.category}</span>
                               <span>·</span>
                               <span>{readingMinutes(p.content)} MIN</span>
                            </div>
                         </Link>
                       ))}
                    </div>
                 </div>
              </div>
            </aside>
          </div>
        </main>
        
        <MarketingFooter />
      </div>
    </ThemeProvider>
  );
}
