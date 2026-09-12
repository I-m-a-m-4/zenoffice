
'use client';

import * as React from 'react';
import { format } from 'date-fns';
import MarketingHeader from '@/components/layout/marketing-header';
import MarketingFooter from '@/components/layout/marketing-footer';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  ChevronRight,
  Clock,
  Briefcase,
  Share2,
  Twitter,
  ChevronLeft,
  Zap,
  Shield,
  BarChart3,
  Users,
  Instagram,
  ArrowRight
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import Link from 'next/link';
import { ThemeProvider } from '@/components/theme-provider';
import { useToast } from '@/hooks/use-toast';

export default function MasteringZenevaClient() {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = React.useState<string>('');

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({ title: 'Link Copied', description: 'Article link added to clipboard.' });
  };

  // Intersection Observer for Scroll Highlighting
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

    const sections = ['inventory', 'synchronization', 'audit', 'performance', 'growth', 'psychology', 'legacy', 'local', 'volatility', 'invisible'];
    sections.forEach((id) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <ThemeProvider forcedTheme="light">
      <div className="min-h-screen bg-white selection:bg-slate-900 selection:text-white">
        <MarketingHeader />
        
        <main className="min-h-screen">
          <div className="mx-auto max-w-6xl px-6 pb-16 pt-48 sm:px-6 sm:pb-24 lg:grid lg:grid-cols-[minmax(0,1fr)_220px] lg:gap-12 lg:pb-24 xl:gap-16">
            <article className="min-w-0">
               {/* Breadcrumbs */}
              <nav className="mb-10 text-[11px] font-medium text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
                <Link href="/blog" className="hover:text-slate-900 transition-colors">Blog</Link>
                <span className="text-slate-300">/</span>
                <span className="truncate">Mastering Retail Operations with Zeneva</span>
              </nav>

              <header className="mb-12">
                <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 mb-8 leading-[1.2]">
                   Mastering Retail Operations: The Zeneva Framework for Success
                </h1>
                
                <div className="flex flex-wrap items-center gap-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                   <div className="flex items-center gap-1.5">
                      <Briefcase className="h-3.5 w-3.5" />
                      <span>Retail Mastery</span>
                   </div>
                   <span className="text-slate-200">•</span>
                   <time dateTime="2026-04-19">April 19, 2026</time>
                   <span className="text-slate-200">•</span>
                   <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      <span>12 MIN READ</span>
                   </div>
                </div>
              </header>

              {/* Content Area */}
              <div className="prose prose-slate max-w-none 
                prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-slate-900
                prose-p:text-slate-600 prose-p:text-lg prose-p:leading-relaxed prose-p:mb-8
                prose-strong:text-slate-900 prose-strong:font-bold
                prose-a:text-orange-600 prose-a:no-underline hover:prose-a:underline prose-a:transition-all
                prose-blockquote:border-l-2 prose-blockquote:border-slate-200 prose-blockquote:pl-6 prose-blockquote:italic prose-blockquote:text-slate-500
                prose-img:rounded-3xl prose-img:shadow-sm
                prose-hr:border-slate-100 prose-hr:my-16
                prose-table:border-collapse prose-th:text-left prose-th:font-bold prose-th:text-slate-900 prose-th:pb-4 prose-td:py-4 prose-td:border-t prose-td:border-slate-100
              ">
                <p>Scaling a retail business in modern Nigeria requires more than just high-quality products. It requires a command over data, a shield against inventory loss, and the ability to manage multiple locations as if they were one. This is the core mission of Zeneva: providing you with the ultimate dashboard for clear, mission-critical decisions.</p>
                <p>In this guide, we break down the five pillars of operational excellence using the Zeneva framework. Whether you are managing a single boutique or a nationwide chain of pharmacies, these tactics will transform how you lead.</p>

                <hr />

                <h2 id="inventory" className="scroll-mt-32">Tactical Inventory Management</h2>
                <p>Inventory is your business&apos;s lifeblood, but it is also where most capital is trapped. Zeneva&apos;s inventory system doesn&apos;t just track numbers; it tracks velocity.</p>
                <ul>
                  <li><strong>Automated Reorder Points:</strong> Set thresholds so you are notified before stockouts happen, ensuring zero sales downtime.</li>
                  <li><strong>Expiry Tracking:</strong> Crucial for pharmacy and FMCG businesses, Zeneva alerts you months in advance of batch expiration.</li>
                  <li><strong>Variations & Categorization:</strong> Manage thousands of SKUs categorized by size, color, or batch with high-fidelity accuracy.</li>
                </ul>

                <h2 id="synchronization" className="scroll-mt-32">Multi-Outlet Synchronization</h2>
                <p>The biggest challenge of growth is fragmentation. Zeneva&apos;s cloud-native architecture ensures that every sale made in Lagos is immediately visible to the owner in Abuja.</p>
                <blockquote>
                  &quot;Growth without synchronization is just organized chaos. Zeneva brings every shop into a single, cohesive view.&quot;
                </blockquote>
                <p>With real-time sync, you can move stock between branches with a simple click, preventing overstocking in one location while another starves for product.</p>

                <h2 id="audit" className="scroll-mt-32">Real-Time Audit Integrity</h2>
                <p>Internal shrinkage is the silent killer of retail. Zeneva&apos;s audit logs record every single action taken on the system — from price adjustments to stock removals.</p>
                <div className="overflow-x-auto">
                  <table>
                    <thead>
                      <tr>
                        <th>Feature</th>
                        <th>Impact</th>
                        <th>Strategic Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>Void Records</strong></td>
                        <td>Prevent Fraud</td>
                        <td>High Integrity</td>
                      </tr>
                      <tr>
                        <td><strong>Price Logs</strong></td>
                        <td>Trace Changes</td>
                        <td>Margin Security</td>
                      </tr>
                      <tr>
                        <td><strong>User Permissions</strong></td>
                        <td>Role Security</td>
                        <td>Accountability</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <h2 id="psychology" className="scroll-mt-32">The Psychology of the Sale</h2>
                <p>Retail is as much about psychology as it is about logistics. In 2026, the Nigerian consumer is more informed and more selective than ever. Zeneva helps you understand customer behavior patterns by linking every sale to a profile. Are your customers buying out of necessity or habit? When you have this data, you stop running &quot;sales&quot; and start running &quot;campaigns.&quot;</p>

                <h2 id="legacy" className="scroll-mt-32">Legacy vs. High-Fidelity Operations</h2>
                <p>The transition from legacy systems—or worse, paper ledgers—to a high-fidelity digital OS like Zeneva is the single most important hardware-software upgrade a boutique or supermarket can make. Legacy systems are silos; Zeneva is an ecosystem. While legacy tools struggle to export a simple CSV, Zeneva provides real-time API-driven insights that can be shared with stakeholders or used for deeper internal audits.</p>

                <h2 id="local" className="scroll-mt-32">The Local Advantage (Hyper-Contextual Retail)</h2>
                <p>Global solutions often fail in the local Nigerian context. They don&apos;t account for intermittent connectivity or the specific credit-base logic of local vendor relations. Zeneva was built with these challenges at the core. Our &quot;Offline-First&quot; architecture means your business never stops, even when the network does. This is how you out-compete larger, less agile rivals: by being hyper-local and hyper-available.</p>

                <h2 id="volatility" className="scroll-mt-32">Mitigating Macro-Volatility</h2>
                <p>Exchange rate fluctuations and fuel price shifts mean your margins are under constant attack. You cannot afford to wait until the end of the month to know if you&apos;ve been profitable. Zeneva&apos;s real-time P&L tracking allows you to adjust prices on the fly across all outlets simultaneously. When the market moves, you move faster.</p>

                <h2 id="invisible" className="scroll-mt-32">Scaling the Invisible</h2>
                <p>The most dangerous part of growing from 1 store to 5 is the &quot;Invisible Loss&quot;—the details that slip through your fingers because you can&apos;t be everywhere at once. Zeneva acts as your remote eyes. Through detailed staff performance analytics and automated stock alerts, you scale your presence without having to scale your time.</p>

                <h2 id="sovereignty" className="scroll-mt-32">Data Sovereignty in the Cloud Age</h2>
                <p>As your business grows, your data becomes its most valuable asset. Who owns that data? In legacy systems, your data is often locked in proprietary formats that are difficult to extract or analyze. Zeneva ensures your digital sovereignty. All your transaction histories, customer profiles, and audit logs are yours to command. We provide the high-performance infrastructure to store it, but the intelligence belongs to you.</p>

                <h2 id="hesitation" className="scroll-mt-32">The Cost of Hesitation (Opportunity Loss)</h2>
                <p>Retail markets move fast; the Nigerian market moves in real-time. The cost of not knowing your stock-out rate is not just a missed sale—it&apos;s a lost customer. When a customer finds their favorite item missing once, they might wait. If it happens twice, they find a new store. Zeneva eliminates this hesitation by automating your reorder points.</p>

                <h2 id="divide" className="scroll-mt-32">Bridging the Digital Divide (Staff Training)</h2>
                <p>A common concern for Nigerian business owners is the technical barrier for staff. We built Zeneva to be &quot;Zero-Training Ready.&quot; The interface is as intuitive as a smartphone app, reducing the onboarding time for new cashiers from days to hours. But more importantly, the system acts as a silent mentor, enforcing best practices—like proper stock logging and customer profile creation—without constant manual supervision.</p>

                <h2 id="liquidity" className="scroll-mt-32">The Liquidity Trap (Cash-in-Stock)</h2>
                <p>Many retailers feel &quot;broke&quot; despite having full shelves. This is the liquidity trap. You have millions of Naira tied up in products that aren&apos;t moving. Zeneva&apos;s velocity tracking identifies your &quot;dead weight&quot; instantly. By marking down slow-moving items and doubling down on high-velocity SKUs, you unlock the cash trapped on your shelves.</p>

                <h2 id="generational" className="scroll-mt-32">Building a Generational Enterprise</h2>
                <p>Zeneva is not just about managing today&apos;s sales; it&apos;s about building a business that lasts. By creating structured, repeatable, and data-driven processes, you turn your shop into a system. A system can be scaled, it can be passed down, and it can be audited by investors. Whether your goal is a family legacy or a multi-billion Naira exit, Zeneva provides the operational rigor required of a world-class enterprise.</p>

                {/* FAQ Section */}
                <div className="mt-24 pt-16 border-t border-slate-100">
                  <h3 className="text-2xl font-black text-slate-950 mb-8 tracking-tight font-bricolage">Operational FAQ</h3>
                  <Accordion type="multiple" className="w-full">
                    {[
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
                    ].map((item, index) => (
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

              {/* Next Steps CTA */}
              <div className="mt-24 rounded-[2.5rem] bg-gradient-to-l from-[#f1dfd1] to-white text-slate-900 p-8 md:p-16 relative overflow-hidden group border border-dashed border-[#f1dfd1]">
                <div className="absolute inset-0 grid-lines opacity-10 pointer-events-none"></div>
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
                  <div className="max-w-md">
                    <h3 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4 leading-tight text-slate-950">Ready to transform your retail operations?</h3>
                    <p className="text-slate-600 font-medium text-lg">Join the thousands of retailers using Zeneva to automate profit and scale without limits.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                    <Link href="/pricing" className="hover:bg-[#0f172a] transition-colors text-sm font-medium text-white tracking-tight font-dm-sans bg-[#1e293b] rounded-md pt-2.5 pr-8 pb-2.5 pl-8 shadow-sm text-center">View Pricing</Link>
                    <Link href="/about/our-mission" className="transition-colors text-sm font-medium bg-[#ffffff] border rounded-md px-8 py-2.5 font-dm-sans tracking-tight hover:text-slate-600 text-slate-900 border-stone-200 shadow-sm text-center">Our Mission</Link>
                  </div>
                </div>
              </div>
            </article>

            {/* Sidebar / On this page */}
            <aside className="hidden lg:block">
              <div className="sticky top-40 space-y-12">
                 <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-6 font-mono">On this page</p>
                    <div className="space-y-6">
                       <p className="text-sm font-medium text-slate-500 leading-relaxed border-l-2 border-slate-100 pl-4 mb-4">
                         Everything you need to know about scaling inventory across multiple Nigerian retail outlets.
                       </p>
                       <nav className="flex flex-col gap-4">
                         {[
                           { id: 'psychology', label: 'The Psychology of the Sale' },
                           { id: 'legacy', label: 'Legacy vs. High-Fidelity OS' },
                           { id: 'local', label: 'The Zeneva Local Advantage' },
                           { id: 'volatility', label: 'Mitigating Macro-Volatility' },
                           { id: 'invisible', label: 'Scaling the Invisible Losses' },
                           { id: 'sovereignty', label: 'Data Sovereignty in the Cloud' },
                           { id: 'hesitation', label: 'The High Cost of Hesitation' },
                           { id: 'divide', label: 'Bridging the Digital Divide' },
                           { id: 'liquidity', label: 'The Liquidity Trap (Cash-in-Stock)' },
                           { id: 'generational', label: 'Building a Generational Enterprise' }
                         ].map((item) => (
                           <button 
                             key={item.id}
                             onClick={() => {
                               const el = document.getElementById(item.id);
                               if (el) el.scrollIntoView({ behavior: 'smooth' });
                             }}
                             className={cn(
                               "text-left text-xs font-bold transition-all duration-300",
                               activeSection === item.id ? "text-orange-600 pl-2" : "text-slate-500 hover:text-slate-900"
                             )}
                           >
                             {item.label}
                           </button>
                         ))}
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
                       <Link href="/blog" className="group block">
                          <h4 className="text-sm font-bold leading-snug text-slate-600 group-hover:text-slate-900 transition-colors mb-2">
                             17 Free Retail Tools You Need Right Now
                          </h4>
                          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                             <span>Recently</span>
                             <span>·</span>
                             <span className="flex items-center gap-1">Read <ChevronRight className="h-2 w-2" /></span>
                          </div>
                       </Link>
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
