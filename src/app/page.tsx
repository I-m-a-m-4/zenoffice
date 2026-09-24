import React from 'react';
import Link from 'next/link';
import { ThemeProvider } from '@/components/theme-provider';
import { AppConfig } from '@/lib/config';

export default function Home() {
  return (
    <ThemeProvider forcedTheme="light">
      <div className="antialiased overflow-x-hidden text-slate-900 bg-[#F9F8F6]">
        {/* Navigation Bar */}
        <nav className="bg-[#F9F8F6]/95 backdrop-blur-md w-full border-b border-stone-200 sticky top-0 z-50">
          <div className="flex max-w-7xl mr-auto ml-auto pt-4 pr-6 pb-4 pl-6 items-center justify-between">
            <Link href="/" className="flex cursor-pointer gap-x-2 gap-y-2 items-center">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-orange-600 text-white shadow-sm">
                <img src={AppConfig.logoIconUrl} alt="ZenOffice" className="w-5 h-5 brightness-0 invert" />
              </div>
              <span className="text-xl font-bold text-slate-900 tracking-tight font-dm-sans">ZenOffice</span>
            </Link>

            <div className="hidden md:flex gap-8 gap-x-8 gap-y-8 items-center">
              <a href="#platform" className="transition-colors text-sm font-medium text-slate-600 tracking-tight font-dm-sans hover:text-orange-600">Platform</a>
              <a href="#product" className="transition-colors text-sm font-medium text-slate-600 tracking-tight font-dm-sans hover:text-orange-600">Features</a>
              <a href="#customers" className="transition-colors text-sm font-medium text-slate-600 tracking-tight font-dm-sans hover:text-orange-600">Security</a>
              <a href="#pricing" className="transition-colors text-sm font-medium text-slate-600 tracking-tight font-dm-sans hover:text-orange-600">Pricing</a>
              <a href="#contact" className="transition-colors text-sm font-medium text-slate-600 tracking-tight font-dm-sans hover:text-orange-600">Contact</a>
            </div>

            <div className="flex gap-3 items-center">
              <Link href="/login" className="hidden sm:block transition-colors text-sm font-medium bg-white border rounded-md px-3.5 py-2 font-dm-sans tracking-tight hover:text-slate-900 text-slate-700 border-stone-300 shadow-sm">Login</Link>
              <Link href="/signup" className="hover:bg-[#C2410C] transition-colors text-sm font-medium text-white tracking-tight font-dm-sans bg-[#EA580C] rounded-md px-4 py-2 shadow-sm">Get Started</Link>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <main className="lg:pt-24 lg:pb-28 w-full max-w-none mr-auto ml-auto pt-14 pr-6 pb-20 pl-6 relative bg-gradient-to-b from-[#F9F8F6] via-orange-50/20 to-[#F9F8F6]">
          <div className="grid lg:grid-cols-2 max-w-7xl mr-auto ml-auto items-center gap-12">
            {/* Left Column: Copy & CTA */}
            <div className="max-w-xl z-10">
              <p className="uppercase text-xs font-bold tracking-wider font-dm-sans mb-4 text-orange-600">
                AI Document &amp; PDF Productivity Workspace
              </p>
              <h1 className="sm:text-7xl text-5xl font-light text-slate-900 tracking-tight font-instrument-serif mb-6 leading-[1.05]">
                <span className="block">Read, Edit &amp; Analyze</span>
                <span className="block text-slate-700">Documents in Zen.</span>
              </h1>
              <p className="leading-relaxed text-lg tracking-tight font-dm-sans max-w-lg mb-8 text-slate-600 font-normal">
                ZenOffice brings your PDFs, Word documents, Excel spreadsheets, and AI document insights together in one private, local-first workspace. Stop juggling apps and start achieving document focus.
              </p>

              <div className="flex flex-col sm:flex-row w-full gap-3">
                <input 
                  type="email" 
                  placeholder="Enter your work email" 
                  className="placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] transition-all text-base text-slate-900 tracking-tight font-dm-sans bg-white border-slate-300 border rounded-md py-3 px-4 shadow-sm flex-1" 
                />
                <Link 
                  href="/signup" 
                  className="inline-flex items-center justify-center transition-all duration-300 hover:bg-[#C2410C] text-base font-medium text-white tracking-tight font-dm-sans bg-[#EA580C] rounded-md px-6 py-3 shadow-md whitespace-nowrap"
                >
                  Start Free
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1">
                    <path d="M7 7h10v10" />
                    <path d="M7 17 17 7" />
                  </svg>
                </Link>
              </div>
            </div>

            {/* Right Column: ZenOffice Desktop & Mobile Mockup */}
            <div className="mt-8 sm:mt-0 relative group">
              <div className="absolute -inset-4 bg-gradient-to-r from-orange-400/10 via-amber-300/10 to-orange-500/10 rounded-2xl blur-2xl -z-10"></div>
              <img 
                src="/zenoffice-hero-mockup.png" 
                alt="ZenOffice Document Workspace Mockup" 
                className="w-full h-auto block drop-shadow-2xl" 
              />
            </div>
          </div>
        </main>

        {/* Social Proof / Partner Logos */}
        <section className="bg-black" id="platform">
          <div className="max-w-7xl mr-auto ml-auto pt-12 pr-6 pb-12 pl-6">
            <p className="uppercase text-xs font-medium tracking-tight font-dm-sans text-center mb-10 text-stone-300">
              Trusted by 10,000+ professionals &amp; teams worldwide
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 border border-stone-700">
              <div className="flex hover:opacity-100 hover:grayscale-0 transition-all cursor-pointer opacity-60 h-24 border-r border-b pt-6 pr-6 pb-6 pl-6 grayscale items-center justify-center border-stone-700">
                <div className="flex items-center gap-2 font-bold text-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[20px] h-[20px] fill-black text-stone-50"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>
                  <span className="tracking-tight font-dm-sans text-stone-50">LegalCorp</span>
                </div>
              </div>
              
              <div className="flex hover:opacity-100 hover:grayscale-0 transition-all cursor-pointer opacity-60 h-24 border-r border-b pt-6 pr-6 pb-6 pl-6 grayscale items-center justify-center border-stone-700">
                <div className="flex items-center gap-2 font-bold text-lg font-mono">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[20px] h-[20px] text-stone-50"><path d="M12 19h8" /><path d="m4 17 6-6-6-6" /></svg>
                  <span className="tracking-tight font-dm-sans text-stone-50">FinDocs</span>
                </div>
              </div>
              
              <div className="flex hover:opacity-100 hover:grayscale-0 transition-all cursor-pointer opacity-60 h-24 border-r border-b pt-6 pr-6 pb-6 pl-6 grayscale items-center justify-center border-stone-700">
                <div className="flex items-center gap-1 font-semibold text-lg italic">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[20px] h-[20px] text-stone-50"><path d="M12.8 19.6A2 2 0 1 0 14 16H2" /><path d="M17.5 8a2.5 2.5 0 1 1 2 4H2" /><path d="M9.8 4.4A2 2 0 1 1 11 8H2" /></svg>
                  <span className="tracking-tight font-dm-sans text-stone-50">ZenPublish</span>
                </div>
              </div>
              
              <div className="flex hover:opacity-100 hover:grayscale-0 transition-all cursor-pointer opacity-60 h-24 border-r border-b pt-6 pr-6 pb-6 pl-6 grayscale items-center justify-center border-stone-700">
                <div className="flex items-center gap-2 font-bold text-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[20px] h-[20px] text-stone-50"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg>
                  <span className="tracking-tight font-dm-sans text-stone-50">DocVault</span>
                </div>
              </div>
              
              <div className="flex hover:opacity-100 hover:grayscale-0 transition-all cursor-pointer opacity-60 h-24 border-r border-b pt-6 pr-6 pb-6 pl-6 grayscale items-center justify-center border-stone-700">
                <div className="flex gap-2 text-lg font-bold gap-x-2 gap-y-2 items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[20px] h-[20px] text-stone-50"><path d="M6 16c5 0 7-8 12-8a4 4 0 0 1 0 8c-5 0-7-8-12-8a4 4 0 1 0 0 8" /></svg>
                  <span className="tracking-tight font-dm-sans text-stone-50">InfiniteDocs</span>
                </div>
              </div>
              
              <div className="flex hover:opacity-100 hover:grayscale-0 transition-all cursor-pointer opacity-60 h-24 border-r border-b pt-6 pr-6 pb-6 pl-6 grayscale items-center justify-center border-stone-700">
                <div className="flex items-center gap-2 font-bold text-lg serif">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[20px] h-[20px] text-stone-50"><path d="M12 6v16" /><path d="m19 13 2-1a9 9 0 0 1-18 0l2 1" /><path d="M9 11h6" /><circle cx="12" cy="4" r="2" /></svg>
                  <span className="tracking-tight font-dm-sans text-stone-50">PaperPort</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Highlights */}
        <section className="bg-[#F9F8F6] border-t pt-24 pr-6 pb-24 pl-6 border-slate-100" id="product">
          <div className="max-w-7xl mr-auto ml-auto">
            <div className="max-w-2xl mb-16">
              <h2 className="text-4xl md:text-5xl tracking-tight mb-6 font-instrument-serif font-light text-slate-900">
                Everything you need for seamless document workflows.
              </h2>
            </div>
            <div className="overflow-hidden grid grid-cols-1 lg:grid-cols-2 border rounded-lg shadow-sm bg-white border-slate-200">
              
              <div className="md:p-12 flex flex-col border-b pt-8 pr-8 pb-8 pl-8 justify-between">
                <div className="z-10 relative">
                  <h3 className="text-2xl font-light text-slate-900 tracking-tight font-instrument-serif mb-4">Unified Document Suite</h3>
                  <p className="leading-relaxed text-base text-slate-500 tracking-tight font-dm-sans max-w-sm mb-6">
                    Eliminate format friction. View, edit, annotate, and analyze PDFs, Word documents, and Excel spreadsheets in one cohesive operating workspace.
                  </p>
                  <a href="#product" className="inline-flex items-center text-sm font-medium hover:text-[#EA580C] transition-colors group font-dm-sans tracking-tight text-slate-900">
                    Explore features <svg className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </a>
                </div>
                
                <div className="flex flex-col border rounded-md pt-5 pr-6 pb-5 pl-6 shadow bg-white border-stone-200 mt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-xl sm:text-[22px] tracking-tight font-instrument-serif font-light text-slate-900">Document Processing Engine</h2>
                      <p className="text-xs text-slate-500 mt-1 font-dm-sans tracking-tight">Process PDFs, convert docs, and analyze spreadsheets in real-time.</p>
                    </div>
                    <button className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition bg-slate-900 text-white hover:bg-slate-800">
                      <span className="font-dm-sans tracking-tight">Open File</span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
                    </button>
                  </div>

                  <div className="mt-2 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-24 text-[11px] text-slate-500 font-dm-sans tracking-tight">PDF Engine</div>
                      <div className="flex-1">
                        <div className="h-2 rounded-full overflow-hidden bg-slate-100">
                          <div className="h-full w-full bg-slate-900"></div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-600">
                        <span className="font-medium font-dm-sans tracking-tight">100%</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-24 text-[11px] text-slate-500 font-dm-sans tracking-tight">Spreadsheets</div>
                      <div className="flex-1">
                        <div className="h-2 rounded-full overflow-hidden bg-slate-100">
                          <div className="h-full w-[100%] bg-slate-900"></div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-600">
                        <span className="font-medium font-dm-sans tracking-tight">100%</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-24 text-[11px] text-slate-500 font-dm-sans tracking-tight">AI Assistant</div>
                      <div className="flex-1">
                        <div className="h-2 rounded-full overflow-hidden bg-slate-100">
                          <div className="w-[100%] h-full bg-orange-600"></div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-600">
                        <span className="font-medium font-dm-sans tracking-tight">Ready</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col">
                <div className="p-8 md:p-12 border-b flex-1 flex flex-col justify-center transition-colors cursor-default border-slate-100 bg-white hover:bg-slate-50">
                  <div className="flex bg-[#EA580C]/10 w-10 h-10 border-[#EA580C]/20 border rounded-lg mb-6 items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[20px] h-[20px] text-orange-600"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                  </div>
                  <h3 className="text-2xl font-light text-slate-900 tracking-tight font-instrument-serif mb-3">Smart PDF Editing</h3>
                  <p className="leading-relaxed text-base text-slate-500 tracking-tight font-dm-sans mb-6">Annotate, merge, compress, sign, and modify PDF files with local-first privacy and instant performance.</p>
                </div>
                
                <div className="p-8 md:p-12 flex-1 flex flex-col justify-center transition-colors cursor-default bg-white hover:bg-slate-50">
                  <div className="flex bg-[#EA580C]/10 w-10 h-10 border-[#EA580C]/20 border rounded-lg mb-6 items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[20px] h-[20px] text-orange-600"><path d="M5 21v-6" /><path d="M12 21V3" /><path d="M19 21V9" /></svg>
                  </div>
                  <h3 className="text-2xl font-light text-slate-900 tracking-tight font-instrument-serif mb-3">Excel &amp; Data Insights</h3>
                  <p className="leading-relaxed text-base text-slate-500 tracking-tight font-dm-sans mb-6">Open Excel tables, parse CSV files, and generate automated financial summaries with integrated AI prompts.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* AI & Security Section */}
        <section className="z-10 relative">
          <div className="max-w-7xl mr-auto ml-auto pt-16 pb-16 px-6">
            <div className="grid gap-12 lg:grid-cols-2">
              <div className="bg-stone-50 border-stone-200 border rounded-xl p-8 shadow-sm">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                  <h3 className="text-2xl font-light text-stone-900 tracking-tight font-instrument-serif">AI Document Assistant</h3>
                  <span className="inline-flex items-center gap-2 text-xs text-neutral-300 bg-stone-950 border-white/10 border rounded-full px-3 py-1">
                    <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse"></span>
                    Local &amp; Private AI
                  </span>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="p-4 rounded-lg bg-white border border-stone-200 shadow-sm">
                    <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
                      <span className="font-semibold text-slate-800 font-dm-sans">DOCUMENT SUMMARY</span>
                      <span className="text-emerald-600 font-mono">100% SECURE</span>
                    </div>
                    <p className="text-sm text-slate-600 font-dm-sans">"The Q4 Financial Audit report highlights a 34% increase in operating efficiency with zero data compliance flags."</p>
                  </div>

                  <div className="p-4 rounded-lg bg-white border border-stone-200 shadow-sm">
                    <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
                      <span className="font-semibold text-slate-800 font-dm-sans">RECENT FILES</span>
                    </div>
                    <div className="space-y-2 text-xs text-slate-700">
                      <div className="flex justify-between border-b pb-1 border-stone-100"><span>Annual_Report_2026.pdf</span><span className="text-slate-400">PDF • 4.2 MB</span></div>
                      <div className="flex justify-between border-b pb-1 border-stone-100"><span>Financial_Forecast_Q4.xlsx</span><span className="text-slate-400">Spreadsheet</span></div>
                      <div className="flex justify-between"><span>Partnership_Agreement.docx</span><span className="text-slate-400">Word Doc</span></div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-xl font-light text-stone-900 tracking-tight font-instrument-serif">Instant Q&amp;A</h4>
                    <p className="text-sm text-stone-600 mt-1">Ask questions directly to any PDF or long agreement and receive instant citations.</p>
                  </div>
                  <div>
                    <h4 className="text-xl font-light text-stone-900 tracking-tight font-instrument-serif">Smart Formatting</h4>
                    <p className="text-sm text-stone-600 mt-1">Export cleaned summaries to PDF, Word, or Markdown effortlessly.</p>
                  </div>
                </div>
              </div>

              <div id="customers">
                <h3 className="sm:text-5xl text-4xl font-light text-slate-900 tracking-tight font-instrument-serif mb-6">
                  Local-first privacy, enterprise security.
                </h3>
                <p className="text-base text-slate-600 font-dm-sans mb-8">
                  Your documents contain your most valuable business secrets. ZenOffice processes your files locally on your hardware with military-grade AES-256 encryption.
                </p>

                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-orange-100 text-orange-600">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    </div>
                    <div>
                      <h5 className="text-lg font-medium tracking-tight font-dm-sans text-slate-900">Zero Cloud Data Retention</h5>
                      <p className="text-sm tracking-tight font-dm-sans mt-1 text-slate-600">Your documents remain on your local storage. We never store, sell, or use your files for AI model training.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-orange-100 text-orange-600">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                    </div>
                    <div>
                      <h5 className="text-lg font-medium tracking-tight font-dm-sans text-slate-900">High-Speed OCR &amp; Search</h5>
                      <p className="text-sm tracking-tight font-dm-sans mt-1 text-slate-600">Optical Character Recognition turns scanned documents and image PDFs into fully searchable text instantly.</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 mt-8 pt-6 border-t border-slate-200">
                  <div className="rounded-lg p-3 ring-1 shadow-sm bg-neutral-50 ring-neutral-200">
                    <div className="text-sm font-medium font-dm-sans text-slate-900">AES-256 Encryption</div>
                    <div className="text-xs font-dm-sans text-slate-600">Hardware-grade local storage security</div>
                  </div>
                  <div className="rounded-lg p-3 ring-1 shadow-sm bg-neutral-50 ring-neutral-200">
                    <div className="text-sm font-medium font-dm-sans text-slate-900">ISO 32000 PDF Standard</div>
                    <div className="text-xs font-dm-sans text-slate-600">Full specification compliance</div>
                  </div>
                  <div className="rounded-lg p-3 ring-1 shadow-sm bg-neutral-50 ring-neutral-200">
                    <div className="text-sm font-medium font-dm-sans text-slate-900">GDPR &amp; HIPAA Ready</div>
                    <div className="text-xs font-dm-sans text-slate-600">Privacy compliance guaranteed</div>
                  </div>
                  <div className="rounded-lg p-3 ring-1 shadow-sm bg-neutral-50 ring-neutral-200">
                    <div className="text-sm font-medium font-dm-sans text-slate-900">SOC 2 Type II</div>
                    <div className="text-xs font-dm-sans text-slate-600">Security architecture verified</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* High Velocity Workflow Section */}
        <section className="border-slate-100 border-t pt-24 pr-6 pb-24 pl-6">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-20 items-center">
            <div className="order-2 lg:order-1">
              <div className="inline-flex text-[11px] uppercase font-bold text-[#EA580C] tracking-tight font-dm-sans bg-[#EA580C]/10 border-[#EA580C]/25 border rounded-full mb-8 pt-1 pr-3 pb-1 pl-3">
                Local-First Performance
              </div>
              <h2 className="leading-[1.1] text-5xl font-light text-slate-900 tracking-tight font-instrument-serif mb-6">Engineered for high-efficiency document work.</h2>
              <p className="leading-relaxed text-base text-slate-500 tracking-tight font-dm-sans mb-8">
                Don't let slow PDF viewers or bloated office suites slow you down. ZenOffice gives you lightning-fast document reading, editing, and AI analysis without subscription lock-in.
              </p>
              
              <ul className="space-y-6">
                <li className="flex items-start gap-4">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center mt-0.5 shrink-0 bg-green-50">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-green-600"><path d="M20 6 9 17l-5-5" /></svg>
                  </div>
                  <div>
                    <span className="leading-relaxed text-base text-slate-600 tracking-tight font-dm-sans">Open PDFs, Word files, and Excel spreadsheets instantly without converting formats or losing formatting.</span>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center mt-0.5 shrink-0 bg-green-50">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-green-600"><path d="M20 6 9 17l-5-5" /></svg>
                  </div>
                  <div>
                    <span className="leading-relaxed text-base text-slate-600 tracking-tight font-dm-sans">Annotate, highlight, draw, and redact sensitive information directly in your PDF files.</span>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center mt-0.5 shrink-0 bg-green-50">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-green-600"><path d="M20 6 9 17l-5-5" /></svg>
                  </div>
                  <div>
                    <span className="leading-relaxed text-base text-slate-600 tracking-tight font-dm-sans">Use AI to summarize 100-page reports, extract key figures, and draft responses in seconds.</span>
                  </div>
                </li>
              </ul>
            </div>

            <div className="order-1 lg:order-2 relative">
              <div className="overflow-hidden aspect-[4/3] bg-white border-slate-200 border rounded-md shadow-lg p-6 flex flex-col justify-between">
                <div className="flex bg-[#FAFAFA] h-10 border-b px-4 items-center justify-between border-slate-100">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400"></div>
                  </div>
                  <div className="flex gap-2 text-[10px] font-mono text-slate-400">
                    <span className="font-dm-sans">ZEN-OFFICE v0.0.2</span>
                    <span>•</span>
                    <span className="text-emerald-600 font-semibold">LOCAL ENCRYPTED</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 bg-[#F9F8F6] h-full p-4 mt-3 rounded-md">
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase font-dm-sans">PDF Documents</span>
                    <div className="p-3 rounded-lg border bg-white border-slate-200 text-xs font-dm-sans">
                      <p className="font-bold text-slate-800">Contract_Review.pdf</p>
                      <p className="text-slate-400 text-[10px]">Signed • 12 Pages</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase font-dm-sans">Office Files</span>
                    <div className="p-3 rounded-lg border bg-white border-orange-200 text-xs font-dm-sans">
                      <p className="font-bold text-slate-800">Q4_Budget.xlsx</p>
                      <p className="text-slate-400 text-[10px]">Parsed • 3 Sheets</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase font-dm-sans">AI Summaries</span>
                    <div className="p-3 rounded-lg border bg-white border-slate-200 text-xs font-dm-sans">
                      <p className="font-bold text-slate-800">Key_Takeaways.md</p>
                      <p className="text-slate-400 text-[10px]">Generated in 0.4s</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Customer Testimonial */}
        <section className="border-y pt-24 pr-6 pb-24 pl-6 bg-stone-900 border-stone-900">
          <div className="text-center max-w-4xl mr-auto ml-auto">
            <h3 className="md:text-5xl leading-[1.2] text-3xl tracking-tight mb-12 font-instrument-serif font-light text-white">
              "ZenOffice has fundamentally changed how we handle documents and contracts. Reading, editing, and summarizing PDFs is now faster than ever."
            </h3>
            <div className="flex items-center justify-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 p-[1px]">
                <div className="w-full h-full rounded-full flex items-center justify-center overflow-hidden bg-slate-900">
                  <img src="https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/0a9490d3-0806-4139-aaa6-628fd3eee5b1_320w.png" alt="User" className="w-full h-full object-cover" />
                </div>
              </div>
              <div className="text-left">
                <div className="font-medium font-dm-sans tracking-tight text-white">François Savard</div>
                <div className="text-sm tracking-tight font-dm-sans text-slate-400">Head of Operations, DocVault</div>
              </div>
            </div>
          </div>
        </section>

        {/* Frequently Asked Questions */}
        <section className="py-24 px-6 border-t bg-white border-slate-100">
          <div className="max-w-3xl mr-auto ml-auto">
            <h2 className="text-3xl tracking-tight mb-12 text-center font-instrument-serif font-light text-slate-900">
              Frequently asked questions
            </h2>
            <div className="space-y-6">
              <div className="hover:shadow-sm transition-shadow border rounded-md pt-6 pr-6 pb-6 pl-6 border-neutral-200">
                <h3 className="text-lg font-semibold mb-3 font-dm-sans tracking-tight text-neutral-900">What is ZenOffice?</h3>
                <p className="leading-relaxed text-base tracking-tight font-dm-sans text-neutral-600">
                  ZenOffice is an all-in-one AI document workspace designed for reading, editing, converting, and analyzing PDFs, Word documents (DOCX), and Excel spreadsheets (XLSX, CSV) in a single, fast, privacy-focused application.
                </p>
              </div>

              <div className="hover:shadow-sm transition-shadow border rounded-md pt-6 pr-6 pb-6 pl-6 border-neutral-200">
                <h3 className="text-lg font-semibold mb-3 font-dm-sans tracking-tight text-neutral-900">Can I edit PDF text and annotations?</h3>
                <p className="leading-relaxed text-base tracking-tight font-dm-sans text-neutral-600">
                  Yes! ZenOffice provides full PDF editing tools—allowing you to modify text, add annotations, highlight key phrases, merge and split pages, fill out form fields, and place digital signatures.
                </p>
              </div>

              <div className="hover:shadow-sm transition-shadow border rounded-md pt-6 pr-6 pb-6 pl-6 border-neutral-200">
                <h3 className="text-lg font-semibold mb-3 font-dm-sans tracking-tight text-neutral-900">Are my documents kept private and secure?</h3>
                <p className="leading-relaxed text-base tracking-tight font-dm-sans text-neutral-600">
                  Yes, absolutely. ZenOffice is built with local-first architecture and AES-256 file encryption. Your files remain on your local device, and AI document processing never stores or trains on your confidential content.
                </p>
              </div>

              <div className="text-center mt-12">
                <p className="mb-4 font-dm-sans tracking-tight text-neutral-600">Still have questions?</p>
                <Link href="/signup" className="hover:bg-[#C2410C] transition-colors text-sm font-medium tracking-tight font-dm-sans bg-[#EA580C] rounded-md pt-2.5 pr-5 pb-2.5 pl-5 shadow-sm text-white">
                  Get Started Free
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="bg-stone-950 pt-24 pr-6 pb-24 pl-6" id="pricing">
          <div className="max-w-7xl mr-auto ml-auto">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-4xl font-light text-stone-50 tracking-tight font-instrument-serif mb-4">
                Simple, transparent pricing
              </h2>
              <p className="text-lg text-stone-200 tracking-tight font-dm-sans">Start for free, scale as your document needs grow.</p>
            </div>

            <div className="flex flex-col gap-24 max-w-7xl mx-auto px-4">
              <div className="grid lg:grid-cols-3 gap-6 items-stretch">
                
                {/* Starter Plan */}
                <div className="group min-h-[520px] flex flex-col overflow-hidden hover:shadow-[0_20px_60px_rgba(0,0,0,0.06)] transition-all duration-500 border rounded-md pt-10 pr-10 pb-10 pl-10 relative shadow-[0_2px_40px_rgba(0,0,0,0.02)] justify-end bg-white border-yellow-100">
                  <div className="relative z-10 mb-8">
                    <h3 className="text-[28px] tracking-tight mb-12 font-instrument-serif font-light text-slate-900">Starter</h3>
                    <div className="flex flex-col gap-1 mb-8">
                      <span className="text-[13px] font-mono text-slate-500 font-dm-sans tracking-tight">Starting at</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-7xl tracking-tighter font-instrument-serif font-light text-slate-900">$0</span>
                        <span className="text-lg text-slate-500 font-normal font-dm-sans tracking-tight">/month</span>
                      </div>
                    </div>
                    <p className="font-mono text-[13px] leading-relaxed max-w-[240px] font-dm-sans tracking-tight text-slate-600">
                      Essential document reading, PDF viewing, and basic text editing for individuals.
                    </p>
                  </div>
                  <Link href="/signup" className="absolute bottom-10 right-10 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-[-45deg] shadow-lg bg-black text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                  </Link>
                </div>

                {/* Pro Plan */}
                <div className="group min-h-[520px] flex flex-col overflow-hidden hover:shadow-[0_20px_60px_rgba(0,0,0,0.06)] transition-all duration-500 border rounded-md pt-10 pr-10 pb-10 pl-10 relative shadow-[0_2px_40px_rgba(0,0,0,0.02)] justify-end bg-white border-purple-100">
                  <div className="relative z-10 mb-8">
                    <div className="flex items-center gap-3 mb-12">
                      <h3 className="text-[28px] tracking-tight font-instrument-serif font-light text-slate-900">Pro</h3>
                      <span className="text-[10px] font-bold px-2 py-1 rounded-md uppercase font-dm-sans tracking-tight bg-black text-white">POPULAR</span>
                    </div>
                    <div className="flex flex-col gap-1 mb-8">
                      <span className="text-[13px] font-mono text-slate-500 font-dm-sans tracking-tight">Starting at</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-7xl tracking-tighter font-instrument-serif font-light text-slate-900">$12</span>
                        <span className="text-lg text-slate-500 font-normal font-dm-sans tracking-tight">/month</span>
                      </div>
                    </div>
                    <p className="font-mono text-[13px] leading-relaxed max-w-[260px] font-dm-sans tracking-tight text-slate-600">
                      Full PDF editor, Word &amp; Excel suite, OCR search, and unlimited AI document summaries.
                    </p>
                  </div>
                  <Link href="/signup" className="absolute bottom-10 right-10 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-[-45deg] shadow-lg bg-black text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                  </Link>
                </div>

                {/* Business Plan */}
                <div className="group min-h-[520px] flex flex-col overflow-hidden hover:shadow-[0_20px_60px_rgba(0,0,0,0.06)] transition-all duration-500 border rounded-md pt-10 pr-10 pb-10 pl-10 relative shadow-[0_2px_40px_rgba(0,0,0,0.02)] justify-end bg-white border-sky-100">
                  <div className="relative z-10 mb-8">
                    <h3 className="text-[28px] tracking-tight mb-12 font-instrument-serif font-light text-slate-900">Business</h3>
                    <div className="flex flex-col gap-1 mb-8">
                      <span className="text-[13px] font-mono text-slate-500 font-dm-sans tracking-tight">Starting at</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-7xl tracking-tighter font-instrument-serif font-light text-slate-900">$24</span>
                        <span className="text-lg text-slate-500 font-normal font-dm-sans tracking-tight">/month</span>
                      </div>
                    </div>
                    <p className="font-mono text-[13px] leading-relaxed max-w-[240px] font-dm-sans tracking-tight text-slate-600">
                      Enterprise security, custom team document permissions, and dedicated priority support.
                    </p>
                  </div>
                  <Link href="/signup" className="absolute bottom-10 right-10 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-[-45deg] shadow-lg bg-black text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-stone-950 w-full max-w-none text-stone-300" id="contact">
          <div className="overflow-hidden max-w-7xl mx-auto pt-12 pr-8 pb-8 pl-8">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 pb-12 border-b border-white/10">
              <div className="lg:col-span-4">
                <div className="flex cursor-pointer mb-6 gap-x-2 items-center">
                  <div className="flex w-8 h-8 rounded-lg items-center justify-center text-slate-50 bg-orange-600">
                    <img src={AppConfig.logoIconUrl} alt="ZenOffice" className="w-5 h-5 brightness-0 invert" />
                  </div>
                  <span className="text-xl font-semibold tracking-tight font-dm-sans text-slate-50">ZenOffice</span>
                </div>
                <p className="max-w-3xl text-white/70">
                  ZenOffice is the modern AI document workspace designed for speed, privacy, and effortless document management. Read, edit, annotate, and analyze PDFs, Word docs, and Excel sheets in one unified app.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-8 pt-12">
              <div>
                <h4 className="text-xs uppercase tracking-[0.2em] text-white/80">Product</h4>
                <ul className="mt-3 space-y-2 text-sm">
                  <li><a href="#product" className="transition text-neutral-300 hover:text-white">PDF Editor</a></li>
                  <li><a href="#product" className="transition text-neutral-300 hover:text-white">Word Reader</a></li>
                  <li><a href="#product" className="transition text-neutral-300 hover:text-white">Excel Viewer</a></li>
                  <li><a href="#product" className="transition text-neutral-300 hover:text-white">AI Document Assistant</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-xs uppercase tracking-[0.2em] text-white/80">Security</h4>
                <ul className="mt-3 space-y-2 text-sm">
                  <li><a href="#customers" className="transition text-neutral-300 hover:text-white">Local Encryption</a></li>
                  <li><Link href="/legal/privacy-policy" className="transition text-neutral-300 hover:text-white">Privacy Policy</Link></li>
                  <li><Link href="/legal/terms-of-service" className="transition text-neutral-300 hover:text-white">Terms of Service</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="text-xs uppercase tracking-[0.2em] text-white/80">Company</h4>
                <ul className="mt-3 space-y-2 text-sm">
                  <li><a href="#" className="transition text-neutral-300 hover:text-white">About ZenOffice</a></li>
                  <li><a href="#pricing" className="transition text-neutral-300 hover:text-white">Pricing</a></li>
                  <li><a href="#contact" className="transition text-neutral-300 hover:text-white">Contact</a></li>
                </ul>
              </div>
              <div>
                <h4 className="uppercase text-xs tracking-[0.2em] text-white/80">Support</h4>
                <p className="mt-3 text-xs text-neutral-400">Questions or feedback? Reach out to our support team anytime.</p>
                <div className="mt-3">
                  <a href="mailto:support@usezenoffice.app" className="text-xs text-orange-400 hover:underline font-mono">support@usezenoffice.app</a>
                </div>
              </div>
            </div>

            <div className="mt-10 pt-6 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-white/10 text-xs text-white/60">
              <p>© {new Date().getFullYear()} ZenOffice. All rights reserved.</p>
              <div className="flex items-center gap-4">
                <Link href="/legal/privacy-policy" className="transition hover:text-white">Privacy Policy</Link>
                <span>•</span>
                <Link href="/legal/terms-of-service" className="transition hover:text-white">Terms of Service</Link>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </ThemeProvider>
  );
}
