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
              <a href="#product" className="transition-colors text-sm font-medium text-slate-600 tracking-tight font-dm-sans hover:text-orange-600">Product</a>
              <a href="#customers" className="transition-colors text-sm font-medium text-slate-600 tracking-tight font-dm-sans hover:text-orange-600">Customers</a>
              <a href="#pricing" className="transition-colors text-sm font-medium text-slate-600 tracking-tight font-dm-sans hover:text-orange-600">Pricing</a>
              <a href="#contact" className="transition-colors text-sm font-medium text-slate-600 tracking-tight font-dm-sans hover:text-orange-600">Contact</a>
            </div>

            <div className="flex gap-3 items-center">
              <Link href="/login" className="hidden sm:block transition-colors text-sm font-medium bg-white border rounded-md px-3.5 py-2 font-dm-sans tracking-tight hover:text-slate-900 text-slate-700 border-stone-300 shadow-sm">Login</Link>
              <Link href="/signup" className="hover:bg-[#C2410C] transition-colors text-sm font-medium text-white tracking-tight font-dm-sans bg-[#EA580C] rounded-md px-4 py-2 shadow-sm">Get a demo</Link>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <main className="lg:pt-24 lg:pb-28 w-full max-w-none mr-auto ml-auto pt-14 pr-6 pb-20 pl-6 relative bg-gradient-to-b from-[#F9F8F6] via-orange-50/20 to-[#F9F8F6]">
          <div className="grid lg:grid-cols-2 max-w-7xl mr-auto ml-auto items-center gap-12">
            {/* Left Column: Copy & CTA */}
            <div className="max-w-xl z-10">
              <p className="uppercase text-xs font-bold tracking-wider font-dm-sans mb-4 text-orange-600">
                All-in-one document &amp; productivity suite
              </p>
              <h1 className="sm:text-7xl text-5xl font-light text-slate-900 tracking-tight font-instrument-serif mb-6 leading-[1.05]">
                <span className="block">Made for teams.</span>
                <span className="block text-slate-700">Loved by everyone.</span>
              </h1>
              <p className="leading-relaxed text-lg tracking-tight font-dm-sans max-w-lg mb-8 text-slate-600 font-normal">
                How modern teams manage documents, spreadsheets, PDFs, and seamless collaboration in one beautiful workspace. Stop juggling apps, start creating.
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
                  Get a demo
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
                alt="ZenOffice Desktop and Mobile Workspace Mockup" 
                className="w-full h-auto block drop-shadow-2xl" 
              />
            </div>
          </div>
        </main>

        {/* Social Proof / Partner Logos */}
        <section className="bg-black">
          <div className="max-w-7xl mr-auto ml-auto pt-12 pr-6 pb-12 pl-6">
            <p className="uppercase text-xs font-medium tracking-tight font-dm-sans text-center mb-10 text-stone-300">
              Trusted by 1,000+ high-growth startups</p>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 border border-stone-700">
              <div className="flex hover:opacity-100 hover:grayscale-0 transition-all cursor-pointer opacity-60 h-24 border-r border-b pt-6 pr-6 pb-6 pl-6 grayscale items-center justify-center border-stone-700">
                <div className="flex items-center gap-2 font-bold text-lg">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-lucide="hexagon" className="lucide lucide-hexagon w-[20px] h-[20px] fill-black text-stone-50" data-icon-replaced="true" style={{width: "20px", height: "20px"}}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>
          <span className="tracking-tight font-dm-sans text-stone-50">Acme</span>
        </div>
      </div>
      
      <div className="flex hover:opacity-100 hover:grayscale-0 transition-all cursor-pointer opacity-60 h-24 border-r border-b pt-6 pr-6 pb-6 pl-6 grayscale items-center justify-center border-stone-700">
        <div className="flex items-center gap-2 font-bold text-lg font-mono">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-lucide="terminal" className="lucide lucide-terminal w-[20px] h-[20px] text-stone-50" data-icon-replaced="true" style={{width: "20px", height: "20px"}}><path d="M12 19h8" /><path d="m4 17 6-6-6-6" /></svg>
          <span className="tracking-tight font-dm-sans text-stone-50">Hyper</span>
        </div>
      </div>
      
      <div className="flex hover:opacity-100 hover:grayscale-0 transition-all cursor-pointer opacity-60 h-24 border-r border-b pt-6 pr-6 pb-6 pl-6 grayscale items-center justify-center border-stone-700">
        <div className="flex items-center gap-1 font-semibold text-lg italic">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-lucide="wind" className="lucide lucide-wind w-[20px] h-[20px] text-stone-50" data-icon-replaced="true" style={{width: "20px", height: "20px"}}><path d="M12.8 19.6A2 2 0 1 0 14 16H2" /><path d="M17.5 8a2.5 2.5 0 1 1 2 4H2" /><path d="M9.8 4.4A2 2 0 1 1 11 8H2" /></svg>
          <span className="tracking-tight font-dm-sans text-stone-50">Gust</span>
        </div>
      </div>
      
      <div className="flex hover:opacity-100 hover:grayscale-0 transition-all cursor-pointer opacity-60 h-24 border-r border-b pt-6 pr-6 pb-6 pl-6 grayscale items-center justify-center border-stone-700">
        <div className="flex items-center gap-2 font-bold text-lg">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-lucide="box" className="lucide lucide-box w-[20px] h-[20px] text-stone-50" data-icon-replaced="true" style={{width: "20px", height: "20px"}}><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg>
          <span className="tracking-tight font-dm-sans text-stone-50">Pack</span>
        </div>
      </div>
      
      <div className="flex hover:opacity-100 hover:grayscale-0 transition-all cursor-pointer opacity-60 h-24 border-r border-b pt-6 pr-6 pb-6 pl-6 grayscale items-center justify-center border-stone-700">
        <div className="flex gap-2 text-lg font-bold gap-x-2 gap-y-2 items-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-lucide="infinity" className="lucide lucide-infinity w-[20px] h-[20px] text-stone-50" data-icon-replaced="true" style={{width: "20px", height: "20px"}}><path d="M6 16c5 0 7-8 12-8a4 4 0 0 1 0 8c-5 0-7-8-12-8a4 4 0 1 0 0 8" /></svg>
          <span className="tracking-tight font-dm-sans text-stone-50">Loop</span>
        </div>
      </div>
      
      <div className="flex hover:opacity-100 hover:grayscale-0 transition-all cursor-pointer opacity-60 h-24 border-r border-b pt-6 pr-6 pb-6 pl-6 grayscale items-center justify-center border-stone-700">
        <div className="flex items-center gap-2 font-bold text-lg serif">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-lucide="anchor" className="lucide lucide-anchor w-[20px] h-[20px] text-stone-50" data-icon-replaced="true" style={{width: "20px", height: "20px"}}><path d="M12 6v16" /><path d="m19 13 2-1a9 9 0 0 1-18 0l2 1" /><path d="M9 11h6" /><circle cx="12" cy="4" r="2" /></svg>
          <span className="tracking-tight font-dm-sans text-stone-50">Port</span>
        </div>
      </div>
      
      <div className="flex hover:opacity-100 hover:grayscale-0 transition-all cursor-pointer opacity-60 h-24 border-r border-b pt-6 pr-6 pb-6 pl-6 grayscale items-center justify-center border-stone-700">
        <div className="flex items-center gap-2 font-bold text-lg">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-lucide="mountain" className="lucide lucide-mountain w-[20px] h-[20px] text-stone-50" data-icon-replaced="true" style={{width: "20px", height: "20px"}}><path d="m8 3 4 8 5-5 5 15H2L8 3z" /></svg>
          <span className="tracking-tight font-dm-sans text-stone-50">Peak</span>
        </div>
      </div>
      
      <div className="flex hover:opacity-100 hover:grayscale-0 transition-all cursor-pointer opacity-60 h-24 border-r border-b pt-6 pr-6 pb-6 pl-6 grayscale items-center justify-center border-stone-700">
        <div className="flex items-center gap-2 font-bold text-lg">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-lucide="triangle" className="lucide lucide-triangle w-[20px] h-[20px] fill-black text-stone-50" data-icon-replaced="true" style={{width: "20px", height: "20px"}}><path d="M13.73 4a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /></svg>
          <span className="tracking-tight font-dm-sans text-stone-50">Delta</span>
        </div>
      </div>
      
      <div className="flex hover:opacity-100 hover:grayscale-0 transition-all cursor-pointer opacity-60 h-24 border-r border-b pt-6 pr-6 pb-6 pl-6 grayscale items-center justify-center border-stone-700">
        <div className="flex items-center gap-2 font-bold text-lg">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-lucide="droplet" className="lucide lucide-droplet w-[20px] h-[20px] text-stone-50" data-icon-replaced="true" style={{width: "20px", height: "20px"}}><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" /></svg>
          <span className="tracking-tight font-dm-sans text-stone-50">Pure</span>
        </div>
      </div>
      
      <div className="flex hover:opacity-100 hover:grayscale-0 transition-all cursor-pointer opacity-60 h-24 border-r border-b pt-6 pr-6 pb-6 pl-6 grayscale items-center justify-center border-stone-700">
        <div className="flex items-center gap-2 font-bold text-lg">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-lucide="cpu" className="lucide lucide-cpu w-[20px] h-[20px] text-stone-50" data-icon-replaced="true" style={{width: "20px", height: "20px"}}><path d="M12 20v2" /><path d="M12 2v2" /><path d="M17 20v2" /><path d="M17 2v2" /><path d="M2 12h2" /><path d="M2 17h2" /><path d="M2 7h2" /><path d="M20 12h2" /><path d="M20 17h2" /><path d="M20 7h2" /><path d="M7 20v2" /><path d="M7 2v2" /><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="8" y="8" width="8" height="8" rx="1" /></svg>
          <span className="tracking-tight font-dm-sans text-stone-50">Core</span>
        </div>
      </div>
      
      <div className="flex hover:opacity-100 hover:grayscale-0 transition-all cursor-pointer opacity-60 h-24 border-r border-b pt-6 pr-6 pb-6 pl-6 grayscale items-center justify-center border-stone-700">
        <div className="flex items-center gap-2 font-bold text-lg">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-lucide="globe" className="lucide lucide-globe w-[20px] h-[20px] text-stone-50" data-icon-replaced="true" style={{width: "20px", height: "20px"}}><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" /></svg>
          <span className="tracking-tight font-dm-sans text-stone-50">Orbit</span>
        </div>
      </div>
      
      <div className="flex hover:opacity-100 hover:grayscale-0 transition-all cursor-pointer opacity-60 h-24 border-r border-b pt-6 pr-6 pb-6 pl-6 grayscale items-center justify-center border-stone-700">
        <div className="flex items-center gap-2 font-bold text-lg">
          <img src={AppConfig.logoIconUrl} alt="ZenOffice" className="w-5 h-5" />
          <span className="tracking-tight font-dm-sans text-stone-50">Stack</span>
        </div>
      </div>
    </div>


  </div>
</section><div className="pointer-events-none z-0 opacity-10 h-32 right-0 bottom-0 left-0" style={{backgroundImage: "repeating-linear-gradient(45deg, rgb(0, 0, 0) 0px, rgb(0, 0, 0) 1px, transparent 0px, transparent 50%)", backgroundSize: "10px 10px"}}>
</div><section className="bg-[#F9F8F6] border-t pt-24 pr-6 pb-24 pl-6 border-slate-100">
    <div className="max-w-7xl mr-auto ml-auto">
        <div className="max-w-2xl mb-16" style={{}}>
            <h2 className="text-4xl md:text-5xl tracking-tight mb-6 font-instrument-serif font-light text-slate-900" style={{}}>Everything you need to ship faster.</h2>
        </div>
        <div className="overflow-hidden grid grid-cols-1 lg:grid-cols-2 border rounded-lg shadow-sm bg-white border-slate-200">
            
            <div className="md:p-12 lg:borderh-[500px] flex flex-col border-b pt-8 pr-8 pb-8 pl-8 justify-between">
    <div className="z-10 relative">
        <h3 className="text-2xl font-light text-slate-900 tracking-tight font-instrument-serif mb-4">Unified Workflow</h3>
        <p className="leading-relaxed text-base text-slate-500 tracking-tight font-dm-sans max-w-sm mb-6" style={{}}>Eliminate context switching.
            Connect your roadmaps, issues, and documentation in one cohesive operating system.</p>
        <a href="#" className="inline-flex items-center text-sm font-medium hover:text-[#EA580C] transition-colors group font-dm-sans tracking-tight text-slate-900" style={{}}>
            See how it works <svg className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
        </a>
    </div>
    
    <div className="flex flex-col border rounded-md pt-5 pr-6 pb-5 pl-6 shadow bg-white border-stone-200">
    <div className="flex items-center justify-between mb-4">
        <div className="">
            <h2 className="text-xl sm:text-[22px] tracking-tight font-instrument-serif font-light text-slate-900" style={{}}>Project roadmap</h2>
            <p className="text-xs text-slate-500 mt-1 font-dm-sans tracking-tight" style={{}}>Track each phase of your learning launch.</p>
        </div>
        <button className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition bg-slate-900 text-white hover:bg-slate-800">
        <span className="font-dm-sans tracking-tight" style={{}}>New task</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-lucide="plus" className="lucide lucide-plus w-3.5 h-3.5"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
      </button>
    </div>

    <div className="mt-2 space-y-3">
        
        <div className="flex items-center gap-3">
            <div className="w-16 text-[11px] text-slate-500 font-dm-sans tracking-tight" style={{}}>Intro</div>
            <div className="flex-1">
                <div className="h-2 rounded-full overflow-hidden bg-slate-100">
                    <div className="h-full w-full bg-slate-900"></div>
                </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-600">
                <span className="font-medium font-dm-sans tracking-tight" style={{}}>100%</span>
                <div className="flex -space-x-2">
                    <img src="https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&amp;fit=crop&amp;w=120&amp;h=120&amp;q=80" className="w-5 h-5 rounded-full border border-white" alt="Member" />
                    <img src="https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&amp;fit=crop&amp;w=120&amp;h=120&amp;q=80" className="w-5 h-5 rounded-full border border-white" alt="Member" />
                </div>
            </div>
        </div>

        
        <div className="flex items-center gap-3">
            <div className="w-16 text-[11px] text-slate-500 font-dm-sans tracking-tight" style={{}}>Audit</div>
            <div className="flex-1">
                <div className="h-2 rounded-full overflow-hidden bg-slate-100">
                    <div className="h-full w-[59%] bg-slate-900"></div>
                </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-600">
                <span className="font-medium font-dm-sans tracking-tight" style={{}}>59%</span>
                <div className="flex -space-x-2">
                    <img src="https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/4734259a-bad7-422f-981e-ce01e79184f2_1600w.jpg" className="w-5 h-5 rounded-full border border-white" alt="Member" />
                </div>
            </div>
        </div>

        
        <div className="flex items-center gap-3">
            <div className="w-16 text-[11px] text-slate-500 font-dm-sans tracking-tight" style={{}}>Research</div>
            <div className="flex-1">
                <div className="h-2 rounded-full overflow-hidden bg-slate-100">
                    <div className="w-[75%] h-full bg-orange-600"></div>
                </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-600">
                <span className="font-medium font-dm-sans tracking-tight" style={{}}>75%</span>
                <div className="flex -space-x-2">
                    <img src="https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&amp;fit=crop&amp;w=120&amp;h=120&amp;q=80" className="w-5 h-5 rounded-full border border-white" alt="Member" />
                    <img src="https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/917d6f93-fb36-439a-8c48-884b67b35381_1600w.jpg" className="w-5 h-5 rounded-full border border-white" alt="Member" />
                </div>
            </div>
        </div>
    </div>

    <div className="mt-4 border-t pt-3 border-slate-100">
        <div className="flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center gap-4">
                <span className="font-dm-sans tracking-tight" style={{}}>Mon 12</span>
                <span className="font-dm-sans tracking-tight" style={{}}>Tue 13</span>
                <span className="font-dm-sans tracking-tight" style={{}}>Wed 14</span>
                <span className="font-medium font-dm-sans tracking-tight text-slate-900" style={{}}>Thu 15</span>
                <span className="font-dm-sans tracking-tight" style={{}}>Fri 16</span>
            </div>
            <div className="inline-flex items-center gap-1 rounded-full px-2 py-1 bg-slate-900/5">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-600"></span>
                <span className="text-[10px] font-dm-sans tracking-tight text-slate-800" style={{}}>Current day</span>
            </div>
        </div>
    </div>
</div>
</div>
            
            
            <div className="flex flex-col">
                
                <div className="p-8 md:p-12 border-b flex-1 flex flex-col justify-center transition-colors cursor-default border-slate-100 bg-white hover:bg-slate-50">
                    <div className="flex bg-[#EA580C]/10 w-10 h-10 border-[#EA580C]/20 border rounded-lg mb-6 items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-lucide="map" className="lucide lucide-map w-[20px] h-[20px]" data-icon-replaced="true" style={{width: "20px", height: "20px", color: "rgb(0, 75, 176)"}}><path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z" /><path d="M15 5.764v15" /><path d="M9 3.236v15" /></svg>
                    </div>
                    <h3 className="text-2xl font-light text-slate-900 tracking-tight font-instrument-serif mb-3">Strategic Roadmaps</h3>
                    <p className="leading-relaxed text-base text-slate-500 tracking-tight font-dm-sans mb-6">Visualize your product strategy on a timeline. Keep stakeholders aligned without the endless status meetings.</p>
                    <a href="#" className="inline-flex items-center text-sm font-medium transition-colors group font-dm-sans tracking-tight text-slate-900 hover:text-orange-600" style={{}}>
                        Start planning <svg className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                    </a>
                </div>
                
                <div className="p-8 md:p-12 flex-1 flex flex-col justify-center transition-colors cursor-default bg-white hover:bg-slate-50">
                    <div className="flex bg-[#EA580C]/10 w-10 h-10 border-[#EA580C]/20 border rounded-lg mb-6 items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-lucide="bar-chart-2" className="lucide lucide-bar-chart-2 w-[20px] h-[20px]" data-icon-replaced="true" style={{width: "20px", height: "20px", color: "rgb(0, 75, 176)"}}><path d="M5 21v-6" /><path d="M12 21V3" /><path d="M19 21V9" /></svg>
                    </div>
                    <h3 className="text-2xl font-light text-slate-900 tracking-tight font-instrument-serif mb-3">Capacity Planning</h3>
                    <p className="leading-relaxed text-base text-slate-500 tracking-tight font-dm-sans mb-6" style={{}}>Balance your team's workload with real-time insights. Prevent burnout and ship predictably.</p>
                    <a href="#" className="inline-flex items-center text-sm font-medium transition-colors group font-dm-sans tracking-tight text-slate-900 hover:text-amber-600" style={{}}>
                        View analytics <svg className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                    </a>
                </div>
            </div>
        </div>
    </div>
</section><section className="z-10 animate-[fadeInUp_1s_ease-out_1.2s_forwards] relative" style={{transform: "translateY(0px)"}}>
  <div className="max-w-7xl mr-auto ml-auto pt-16 pb-16">
    <div className="grid gap-12 lg:grid-cols-2 gap-x-12 gap-y-12">
      
      <div className="bg-center bg-stone-200 bg-[url(https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/f7302105-bf99-4736-914e-d8fbdb904af5_1600w.png)] bg-cover border-stone-200 border rounded-md pt-5 pr-5 pb-5 pl-5 relative">
        <article className="group overflow-hidden transition-shadow hover:shadow-md bg-[#EA580C]/20 border-stone-300 border rounded relative shadow-xl backdrop-blur-xl">
  <div className="sm:p-10 bg-stone-50 rounded pt-6 pr-6 pb-6 pl-6">
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
      <h3 className="text-2xl font-light text-stone-900 tracking-tight font-instrument-serif">Real‑Time Collaboration
      </h3>
      <span className="inline-flex items-center gap-2 text-[10px] sm:text-xs text-neutral-300 bg-stone-950 border-white/10 border rounded-full px-2.5 py-1">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-400">
          <path d="M16 7h6v6" className="" />
          <path d="m22 7-8.5 8.5-5-5L2 17" className="" />
        </svg>
        Live streaming
      </span>
    </div>

    
    <div className="relative h-56 sm:h-64 rounded-2xl bg-gradient-to-b ring-1 ring-inset mb-8 from-neutral-900 to-neutral-800 ring-white/5">
      
      <div className="absolute right-3 sm:right-6 top-4 sm:top-6 w-[78%] h-[68%] rounded-2xl backdrop-blur border shadow-sm bg-neutral-900/90 border-neutral-800">
        <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800/70">
          <span className="text-[10px] sm:text-xs tracking-widest text-neutral-400" style={{}}>DOC</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-green-400" style={{}}>+2.34%</span>
            <span className="h-2 w-12 rounded bg-green-500/20"></span>
          </div>
        </div>
        <div className="p-2">
          <svg viewBox="0 0 300 90" className="w-full h-20 sm:h-24 text-neutral-700">
            <defs className="" />
              <pattern id="dots1" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse" className="" />
                <circle cx="1" cy="1" r="0.5" fill="currentColor" opacity="0.3" className="" />
              
            
            <rect width="100%" height="100%" fill="url(#dots1)" className="" />
            
            <rect x="20" y="45" width="3" height="20" fill="#EF4444" className="" />
            <rect x="40" y="35" width="3" height="25" fill="#10B981" className="" />
            <rect x="60" y="50" width="3" height="15" fill="#EF4444" className="" />
            <rect x="80" y="30" width="3" height="30" fill="#10B981" className="" />
            <rect x="100" y="40" width="3" height="20" fill="#10B981" className="" />
            <rect x="120" y="25" width="3" height="35" fill="#10B981" className="" />
            <rect x="140" y="45" width="3" height="18" fill="#EF4444" className="" />
            <rect x="160" y="20" width="3" height="40" fill="#10B981" className="" />
            <rect x="180" y="35" width="3" height="25" fill="#10B981" className="" />
            <rect x="200" y="15" width="3" height="45" fill="#10B981" className="" />
            <polyline points="22,55 42,47 62,57 82,45 102,50 122,42 142,54 162,40 182,47 202,37" fill="none" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" className="" />
          </svg>
        </div>
      </div>

      
      <div className="absolute left-6 sm:left-12 bottom-10 sm:bottom-12 w-[62%] h-[52%] rounded-2xl backdrop-blur border shadow-sm bg-neutral-900/90 border-neutral-800">
        <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800/70">
          <span className="text-[10px] sm:text-xs tracking-widest text-neutral-400" style={{}}>RECENT FILES</span>
        </div>
        <div className="p-2 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-300" style={{}}>PDF</span>
            <span className="text-green-400" style={{}}>+1.2%</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-300" style={{}}>XLSX</span>
            <span className="text-red-400" style={{}}>-0.5%</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-300" style={{}}>PPTX</span>
            <span className="text-green-400" style={{}}>+0.8%</span>
          </div>
        </div>
      </div>

      
      <div className="absolute left-3 sm:left-6 bottom-3 sm:bottom-4 w-[38%] h-[44%] rounded-2xl backdrop-blur border shadow-sm bg-neutral-900/90 border-neutral-800">
        <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800/70">
          <span className="text-[10px] sm:text-xs tracking-widest text-neutral-400" style={{}}>CLOUD</span>
        </div>
        <div className="p-2">
          <svg viewBox="0 0 180 70" className="w-full h-14 sm:h-16 text-neutral-700">
            <rect x="10" y="35" width="2" height="12" fill="#10B981" className="" />
            <rect x="25" y="30" width="2" height="17" fill="#10B981" className="" />
            <rect x="40" y="40" width="2" height="10" fill="#EF4444" className="" />
            <rect x="55" y="25" width="2" height="22" fill="#10B981" className="" />
            <rect x="70" y="20" width="2" height="27" fill="#10B981" className="" />
            <rect x="85" y="35" width="2" height="12" fill="#EF4444" className="" />
            <rect x="100" y="15" width="2" height="32" fill="#10B981" className="" />
            <rect x="115" y="28" width="2" height="19" fill="#10B981" className="" />
            <rect x="130" y="12" width="2" height="35" fill="#10B981" className="" />
            <polyline points="11,41 26,38 41,45 56,36 71,33 86,41 101,31 116,36 131,29" fill="none" stroke="#10B981" strokeWidth="1" strokeLinecap="round" className="" />
          </svg>
        </div>
      </div>
    </div>

    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      <div className="">
        <h4 className="text-2xl font-light text-stone-900 tracking-tight font-instrument-serif">Advanced Editing</h4>
        <p className="text-sm text-stone-700 mt-2">Professional-grade technical analysis tools with real-time
          candlestick patterns.</p>
      </div>
      <div className="">
        <h4 className="text-2xl font-light text-stone-900 tracking-tight font-instrument-serif">Smart Folders</h4>
        <p className="mt-2 text-sm text-stone-600">Curated stock tracking with instant performance updates and
          alerts.</p>
      </div>

    </div>

    
    <div className="">
      <a href="#" className="inline-flex items-center gap-2 text-xs font-medium text-slate-900 hover:text-orange-600 font-semibold" style={{}}>
        Start collaborating
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <path d="M5 12h14" className="" />
          <path d="m12 5 7 7-7 7" className="" />
        </svg>
      </a>
    </div>
  </div>
</article>
      </div>

      
      <div className="">


        <div className="tech-content" id="technology">
          <h3 className="sm:text-5xl transition-colors duration-500 text-4xl font-light text-slate-900 tracking-tight font-instrument-serif">
    Industry‑leading security, professionally certified</h3>


          
          <div className="mt-8">
            <div className="pt-6">

  <div className="space-y-4">
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 bg-orange-100">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-orange-600">
          <circle cx="12" cy="12" r="10" className="" />
          <path d="M12 6v6l4 2" className="" />
        </svg>
      </div>
      <div className="">
        <h5 className="text-base font-medium tracking-tight font-dm-sans text-slate-900" style={{}}>Real-time Syncing</h5>
        <p className="text-base tracking-tight font-dm-sans mt-1 text-slate-600" style={{}}>Sub-second color analysis with continuous
          calibration and
          temperature compensation for consistent results.</p>
      </div>
    </div>
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 bg-orange-100">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-orange-600">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" className="" />
          <polyline points="3.27,6.96 12,12.01 20.73,6.96" className="" />
          <line x1="12" y1="22.08" x2="12" y2="12" className=""></line>
        </svg>
      </div>
      <div className="">
        <h5 className="text-base font-medium tracking-tight font-dm-sans text-slate-900" style={{}}>Advanced AI Search</h5>
        <p className="text-base tracking-tight font-dm-sans mt-1 text-slate-600" style={{}}>Machine learning-enhanced color matching
          with proprietary
          spectral analysis for superior accuracy.</p>
      </div>
    </div>

  </div>
</div>
          </div>
        </div>

        <div className="tech-content hidden" id="specs">
          <h3 className="text-4xl tracking-tight sm:text-5xl font-instrument-serif font-light text-slate-900" style={{}}>Technical
            Specifications</h3>
          <p className="mt-4 font-instrument-serif text-slate-700" style={{}}>Precision engineered with cutting-edge hardware and software
            integration for professional color analysis workflows.</p>

          <div className="mt-8 border-t pt-6 border-neutral-200">
            <h4 className="text-lg font-semibold mb-4 text-slate-900" style={{}}>Software Capabilities</h4>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-neutral-200">
                <span className="text-sm font-instrument-serif text-slate-600" style={{}}>Storage Limit</span>
                <span className="text-sm font-instrument-serif text-slate-900" style={{}}>Unlimited (Enterprise)</span>
              </div>
              <div className="flex justify-between py-2 border-b border-neutral-200">
                <span className="text-sm font-instrument-serif text-slate-600" style={{}}>Uptime</span>
                <span className="text-sm font-instrument-serif text-slate-900" style={{}}>99.99% SLA</span>
              </div>
              <div className="flex justify-between py-2 border-b border-neutral-200">
                <span className="text-sm font-instrument-serif text-slate-600" style={{}}>Search Speed</span>
                <span className="text-sm font-instrument-serif text-slate-900" style={{}}>&lt; 50ms</span>
              </div>
              <div className="flex justify-between py-2 border-b border-neutral-200">
                <span className="text-sm font-instrument-serif text-slate-600" style={{}}>Encryption</span>
                <span className="text-sm font-instrument-serif text-slate-900" style={{}}>AES-256 at rest and in transit</span>
              </div>
              <div className="flex justify-between py-2 border-b border-neutral-200">
                <span className="text-sm font-instrument-serif text-slate-600" style={{}}>Max File Size</span>
                <span className="text-sm font-instrument-serif text-slate-900" style={{}}>5GB per file</span>
              </div>
              <div className="flex justify-between py-2 border-b border-neutral-200">
                <span className="text-sm font-instrument-serif text-slate-600" style={{}}>Version History</span>
                <span className="text-sm font-instrument-serif text-slate-900" style={{}}>Unlimited Revisions</span>
              </div>
            </div>
          </div>

          <div className="mt-8 border-t pt-6 border-neutral-200">
            <h4 className="text-lg font-semibold mb-4 text-slate-900" style={{}}>Integrations &amp; Security</h4>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-neutral-200">
                <span className="text-sm font-instrument-serif text-slate-600" style={{}}>API Support</span>
                <span className="text-sm font-instrument-serif text-slate-900" style={{}}>REST, GraphQL, Webhooks</span>
              </div>
              <div className="flex justify-between py-2 border-b border-neutral-200">
                <span className="text-sm font-instrument-serif text-slate-600" style={{}}>SSO Integrations</span>
                <span className="text-sm font-instrument-serif text-slate-900" style={{}}>Okta, Google, Microsoft</span>
              </div>
              <div className="flex justify-between py-2 border-b border-neutral-200">
                <span className="text-sm font-instrument-serif text-slate-600" style={{}}>Data Centers</span>
                <span className="text-sm font-instrument-serif text-slate-900" style={{}}>US, EU, AP (SOC2 Type II)</span>
              </div>
              <div className="flex justify-between py-2 border-b border-neutral-200">
                <span className="text-sm font-instrument-serif text-slate-600" style={{}}>Supported Formats</span>
                <span className="text-sm font-instrument-serif text-slate-900" style={{}}>PDF, DOCX, XLSX, PPTX, MD</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-sm font-instrument-serif text-slate-600" style={{}}>Max Users</span>
                <span className="text-sm font-instrument-serif text-slate-900" style={{}}>Unlimited</span>
              </div>
            </div>
          </div>
        </div>

        <div className="tech-content hidden" id="certifications">
          <h3 className="text-4xl tracking-tight sm:text-5xl font-instrument-serif font-light text-slate-900" style={{}}>Certifications &amp;
            Standards</h3>
          <p className="mt-4 font-instrument-serif text-slate-700" style={{}}>Meets and exceeds international standards for color measurement and
            professional certification requirements.</p>

          <div className="mt-8 border-t pt-6 border-neutral-200">
            <h4 className="text-lg font-semibold mb-4 text-slate-900" style={{}}>International Standards</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg p-3 ring-1 shadow-sm bg-neutral-50 ring-neutral-200">
                <div className="text-sm font-medium font-instrument-serif text-slate-900" style={{}}>SOC 2 Type II</div>
                <div className="text-xs font-instrument-serif text-slate-600" style={{}}>Security & Privacy</div>
              </div>
              <div className="rounded-lg p-3 ring-1 shadow-sm bg-neutral-50 ring-neutral-200">
                <div className="text-sm font-medium font-instrument-serif text-slate-900" style={{}}>ISO 27001</div>
                <div className="text-xs font-instrument-serif text-slate-600" style={{}}>Information Security Management</div>
              </div>
              <div className="rounded-lg p-3 ring-1 shadow-sm bg-neutral-50 ring-neutral-200">
                <div className="text-sm font-medium font-instrument-serif text-slate-900" style={{}}>GDPR Ready</div>
                <div className="text-xs font-instrument-serif text-slate-600" style={{}}>EU Data Protection Compliant</div>
              </div>
              <div className="rounded-lg p-3 ring-1 shadow-sm bg-neutral-50 ring-neutral-200">
                <div className="text-sm font-medium font-instrument-serif text-slate-900" style={{}}>HIPAA Compliant</div>
                <div className="text-xs font-instrument-serif text-slate-600" style={{}}>Health Insurance Portability and Accountability Act</div>
              </div>
            </div>
          </div>

          <div className="mt-8 border-t pt-6 border-neutral-200">
            <h4 className="text-lg font-semibold mb-4 text-slate-900" style={{}}>Industry Certifications</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg p-3 ring-1 shadow-sm bg-neutral-50 ring-neutral-200">
                <div className="flex items-center gap-2 mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
                    <path d="m9 12 2 2 4-4" className="" />
                    <path d="m21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3" className="" />
                    <path d="m3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3" className="" />
                  </svg>
                  <div className="text-sm font-medium font-instrument-serif text-slate-900" style={{}}>Enterprise Ready</div>
                </div>
                <div className="text-xs font-instrument-serif text-slate-600" style={{}}>Role-based access control with audit logging</div>
              </div>
              <div className="rounded-lg p-3 ring-1 shadow-sm bg-neutral-50 ring-neutral-200">
                <div className="flex items-center gap-2 mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-orange-600">
                    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" className="" />
                    <path d="m9 12 2 2 4-4" className="" />
                  </svg>
                  <div className="text-sm font-medium font-instrument-serif text-slate-900" style={{}}>CE Marking</div>
                </div>
                <div className="text-xs font-instrument-serif text-slate-600" style={{}}>European conformity for commercial distribution</div>
              </div>
              <div className="rounded-lg p-3 ring-1 shadow-sm bg-neutral-50 ring-neutral-200">
                <div className="flex items-center gap-2 mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600">
                    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" className="" />
                    <path d="M3 6h18" className="" />
                    <path d="M16 10a4 4 0 0 1-8 0" className="" />
                  </svg>
                  <div className="text-sm font-medium font-instrument-serif text-slate-900" style={{}}>NIST Traceable</div>
                </div>
                <div className="text-xs font-instrument-serif text-slate-600" style={{}}>Calibration standards traceable to national institute
                </div>
              </div>
              <div className="rounded-lg p-3 ring-1 shadow-sm bg-neutral-50 ring-neutral-200">
                <div className="flex items-center gap-2 mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-orange-600">
                    <path d="M12 2v20" className="" />
                    <path d="M8 5H4a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h4" className="" />
                    <path d="M16 5h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4" className="" />
                  </svg>
                  <div className="text-sm font-medium font-instrument-serif text-slate-900" style={{}}>RoHS Compliant</div>
                </div>
                <div className="text-xs font-instrument-serif text-slate-600" style={{}}>Restriction of hazardous substances directive</div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t mt-8 pt-6 border-neutral-200">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="flex gap-3 hover:scale-105 transition-transform duration-200 cursor-pointer items-center">

              <div className="">
                <div className="flex items-baseline gap-2">
                  <span className="rating-number text-2xl tracking-tight font-instrument-serif font-light text-slate-900" data-target="4.8" style={{}}>4.8</span>
                  <span className="text-sm font-instrument-serif text-slate-600" style={{}}>/5</span>
                </div>
                <p className="text-base tracking-tight text-slate-600" style={{}}>22k+ professional reviews</p>
              </div>
            </div>

            <div className="flex items-center gap-3 hover:scale-105 transition-transform duration-200 cursor-pointer">

              <div className="">
                <div className="flex items-baseline gap-2">
                  <span className="rating-number text-2xl tracking-tight font-instrument-serif font-light text-slate-900" data-target="94" style={{}}>94%</span>
                </div>
                <p className="text-base tracking-tight font-dm-sans text-slate-600" style={{}}>Users recommend to colleagues</p>
              </div>
            </div>
          </div>
        </div>

        
      <div className="cta-buttons-container flex flex-col sm:flex-row rounded-md mt-8 gap-x-4 gap-y-4 items-center justify-start">
  
  <div className="inline-block rounded-md">
  <a href="#" className="codepen-button rounded-md">
    <div style={{position: "absolute", inset: "0", width: "400%", height: "100%", background: "linear-gradient(115deg,#8b5cf6,#4c1d95,#a855f7)", backgroundSize: "25% 100%", animation: "border-shift .75s linear infinite"}} className="">
    </div>
    <span className="inline-flex items-center transition-all duration-300 group text-base font-light tracking-tight font-dm-sans border rounded pt-3 pr-6 pb-3 pl-6 hover:text-white hover:bg-white/10 hover:border-white/30 text-white bg-[#EA580C] hover:bg-[#C2410C] border-transparent shadow-sm" style={{}}>
        Get a demo
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="">
          <path d="M7 7h10v10" />
          <path d="M7 17 17 7" />
        </svg>
      </span>
  </a>
</div>

</div></div>
    </div>
  </div>
</section><section className="z-10 animate-[fadeInUp_1s_ease-out_1.2s_forwards] relative" style={{transform: "translateY(0px)"}}>
  <div className="max-w-7xl mr-auto ml-auto pt-16 pb-16">
    <div className="grid gap-12 lg:grid-cols-2 gap-x-12 gap-y-12">
      
      <div className="">


        <div className="tech-content" id="technology">
          <h3 className="sm:text-5xl transition-colors duration-500 text-4xl font-light text-slate-900 tracking-tight font-instrument-serif">
    Industry‑leading precision, professionally certified</h3>


          
          <div className="mt-8">
            <div className="pt-6">

  <div className="space-y-4">
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 bg-orange-100">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-orange-600">
          <circle cx="12" cy="12" r="10" className="" />
          <path d="M12 6v6l4 2" className="" />
        </svg>
      </div>
      <div className="">
        <h5 className="text-base font-medium tracking-tight font-dm-sans text-slate-900" style={{}}>Real-time Processing</h5>
        <p className="text-base tracking-tight font-dm-sans mt-1 text-slate-600" style={{}}>Sub-second color analysis with continuous
          calibration and
          temperature compensation for consistent results.</p>
      </div>
    </div>
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 bg-orange-100">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-orange-600">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" className="" />
          <polyline points="3.27,6.96 12,12.01 20.73,6.96" className="" />
          <line x1="12" y1="22.08" x2="12" y2="12" className=""></line>
        </svg>
      </div>
      <div className="">
        <h5 className="text-base font-medium tracking-tight font-dm-sans text-slate-900" style={{}}>Advanced Algorithms</h5>
        <p className="text-base tracking-tight font-dm-sans mt-1 text-slate-600" style={{}}>Machine learning-enhanced color matching
          with proprietary
          spectral analysis for superior accuracy.</p>
      </div>
    </div>

  </div>
</div>
          </div>
        </div>

        <div className="tech-content hidden" id="specs">
          <h3 className="text-4xl tracking-tight sm:text-5xl font-instrument-serif font-light text-slate-900" style={{}}>Technical
            Specifications</h3>
          <p className="mt-4 font-instrument-serif text-slate-700" style={{}}>Precision engineered with cutting-edge hardware and software
            integration for professional color analysis workflows.</p>

          <div className="mt-8 border-t pt-6 border-neutral-200">
            <h4 className="text-lg font-semibold mb-4 text-slate-900" style={{}}>Hardware Specifications</h4>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-neutral-200">
                <span className="text-sm font-instrument-serif text-slate-600" style={{}}>Spectral Range</span>
                <span className="text-sm font-instrument-serif text-slate-900" style={{}}>380-780 nm</span>
              </div>
              <div className="flex justify-between py-2 border-b border-neutral-200">
                <span className="text-sm font-instrument-serif text-slate-600" style={{}}>Accuracy</span>
                <span className="text-sm font-instrument-serif text-slate-900" style={{}}>±0.03 ΔE*ab</span>
              </div>
              <div className="flex justify-between py-2 border-b border-neutral-200">
                <span className="text-sm font-instrument-serif text-slate-600" style={{}}>Measurement Time</span>
                <span className="text-sm font-instrument-serif text-slate-900" style={{}}>0.5 seconds</span>
              </div>
              <div className="flex justify-between py-2 border-b border-neutral-200">
                <span className="text-sm font-instrument-serif text-slate-600" style={{}}>Illumination</span>
                <span className="text-sm font-instrument-serif text-slate-900" style={{}}>LED D65/A/C/D50/D55/F2/F7/F11</span>
              </div>
              <div className="flex justify-between py-2 border-b border-neutral-200">
                <span className="text-sm font-instrument-serif text-slate-600" style={{}}>Observer Angle</span>
                <span className="text-sm font-instrument-serif text-slate-900" style={{}}>2°/10° standard observer</span>
              </div>
              <div className="flex justify-between py-2 border-b border-neutral-200">
                <span className="text-sm font-instrument-serif text-slate-600" style={{}}>Repeatability</span>
                <span className="text-sm font-instrument-serif text-slate-900" style={{}}>ΔE*ab ≤ 0.04 (σ)</span>
              </div>
            </div>
          </div>

          <div className="mt-8 border-t pt-6 border-neutral-200">
            <h4 className="text-lg font-semibold mb-4 text-slate-900" style={{}}>Connectivity &amp; Power</h4>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-neutral-200">
                <span className="text-sm font-instrument-serif text-slate-600" style={{}}>Interface</span>
                <span className="text-sm font-instrument-serif text-slate-900" style={{}}>USB-C 3.0, Bluetooth 5.2, Wi-Fi 6</span>
              </div>
              <div className="flex justify-between py-2 border-b border-neutral-200">
                <span className="text-sm font-instrument-serif text-slate-600" style={{}}>Battery Life</span>
                <span className="text-sm font-instrument-serif text-slate-900" style={{}}>8 hours continuous use</span>
              </div>
              <div className="flex justify-between py-2 border-b border-neutral-200">
                <span className="text-sm font-instrument-serif text-slate-600" style={{}}>Operating Temperature</span>
                <span className="text-sm font-instrument-serif text-slate-900" style={{}}>0°C to 40°C (32°F to 104°F)</span>
              </div>
              <div className="flex justify-between py-2 border-b border-neutral-200">
                <span className="text-sm font-instrument-serif text-slate-600" style={{}}>Dimensions</span>
                <span className="text-sm font-instrument-serif text-slate-900" style={{}}>95 × 65 × 28 mm</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-sm font-instrument-serif text-slate-600" style={{}}>Weight</span>
                <span className="text-sm font-instrument-serif text-slate-900" style={{}}>280g (9.9 oz)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="tech-content hidden" id="certifications">
          <h3 className="text-4xl tracking-tight sm:text-5xl font-instrument-serif font-light text-slate-900" style={{}}>Certifications &amp;
            Standards</h3>
          <p className="mt-4 font-instrument-serif text-slate-700" style={{}}>Meets and exceeds international standards for color measurement and
            professional certification requirements.</p>

          <div className="mt-8 border-t pt-6 border-neutral-200">
            <h4 className="text-lg font-semibold mb-4 text-slate-900" style={{}}>International Standards</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg p-3 ring-1 shadow-sm bg-neutral-50 ring-neutral-200">
                <div className="text-sm font-medium font-instrument-serif text-slate-900" style={{}}>ISO 11664</div>
                <div className="text-xs font-instrument-serif text-slate-600" style={{}}>Colorimetry Standards</div>
              </div>
              <div className="rounded-lg p-3 ring-1 shadow-sm bg-neutral-50 ring-neutral-200">
                <div className="text-sm font-medium font-instrument-serif text-slate-900" style={{}}>CIE Standard</div>
                <div className="text-xs font-instrument-serif text-slate-600" style={{}}>Illuminant D65</div>
              </div>
              <div className="rounded-lg p-3 ring-1 shadow-sm bg-neutral-50 ring-neutral-200">
                <div className="text-sm font-medium font-instrument-serif text-slate-900" style={{}}>ASTM E308</div>
                <div className="text-xs font-instrument-serif text-slate-600" style={{}}>Standard Practice for Computing Colors</div>
              </div>
              <div className="rounded-lg p-3 ring-1 shadow-sm bg-neutral-50 ring-neutral-200">
                <div className="text-sm font-medium font-instrument-serif text-slate-900" style={{}}>DIN 5033</div>
                <div className="text-xs font-instrument-serif text-slate-600" style={{}}>Colorimetry Guidelines</div>
              </div>
            </div>
          </div>

          <div className="mt-8 border-t pt-6 border-neutral-200">
            <h4 className="text-lg font-semibold mb-4 text-slate-900" style={{}}>Industry Certifications</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg p-3 ring-1 shadow-sm bg-neutral-50 ring-neutral-200">
                <div className="flex items-center gap-2 mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
                    <path d="m9 12 2 2 4-4" className="" />
                    <path d="m21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3" className="" />
                    <path d="m3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3" className="" />
                  </svg>
                  <div className="text-sm font-medium font-instrument-serif text-slate-900" style={{}}>FDA Approved</div>
                </div>
                <div className="text-xs font-instrument-serif text-slate-600" style={{}}>Medical device classification for clinical use</div>
              </div>
              <div className="rounded-lg p-3 ring-1 shadow-sm bg-neutral-50 ring-neutral-200">
                <div className="flex items-center gap-2 mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-orange-600">
                    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" className="" />
                    <path d="m9 12 2 2 4-4" className="" />
                  </svg>
                  <div className="text-sm font-medium font-instrument-serif text-slate-900" style={{}}>CE Marking</div>
                </div>
                <div className="text-xs font-instrument-serif text-slate-600" style={{}}>European conformity for commercial distribution</div>
              </div>
              <div className="rounded-lg p-3 ring-1 shadow-sm bg-neutral-50 ring-neutral-200">
                <div className="flex items-center gap-2 mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600">
                    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" className="" />
                    <path d="M3 6h18" className="" />
                    <path d="M16 10a4 4 0 0 1-8 0" className="" />
                  </svg>
                  <div className="text-sm font-medium font-instrument-serif text-slate-900" style={{}}>NIST Traceable</div>
                </div>
                <div className="text-xs font-instrument-serif text-slate-600" style={{}}>Calibration standards traceable to national institute
                </div>
              </div>
              <div className="rounded-lg p-3 ring-1 shadow-sm bg-neutral-50 ring-neutral-200">
                <div className="flex items-center gap-2 mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-orange-600">
                    <path d="M12 2v20" className="" />
                    <path d="M8 5H4a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h4" className="" />
                    <path d="M16 5h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4" className="" />
                  </svg>
                  <div className="text-sm font-medium font-instrument-serif text-slate-900" style={{}}>RoHS Compliant</div>
                </div>
                <div className="text-xs font-instrument-serif text-slate-600" style={{}}>Restriction of hazardous substances directive</div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t mt-8 pt-6 border-neutral-200">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="flex gap-3 hover:scale-105 transition-transform duration-200 cursor-pointer items-center">

              <div className="">
                <div className="flex items-baseline gap-2">
                  <span className="rating-number text-2xl tracking-tight font-instrument-serif font-light text-slate-900" data-target="4.8" style={{}}>4.8</span>
                  <span className="text-sm font-instrument-serif text-slate-600" style={{}}>/5</span>
                </div>
                <p className="text-base tracking-tight text-slate-600" style={{}}>22k+ professional reviews</p>
              </div>
            </div>

            <div className="flex items-center gap-3 hover:scale-105 transition-transform duration-200 cursor-pointer">

              <div className="">
                <div className="flex items-baseline gap-2">
                  <span className="rating-number text-2xl tracking-tight font-instrument-serif font-light text-slate-900" data-target="94" style={{}}>94%</span>
                </div>
                <p className="text-base tracking-tight font-dm-sans text-slate-600" style={{}}>Users recommend to colleagues</p>
              </div>
            </div>
          </div>
        </div>

        
      <div className="cta-buttons-container flex flex-col sm:flex-row rounded-md mt-8 gap-x-4 gap-y-4 items-center justify-start">
  
  <div className="inline-block rounded-md">
  <a href="#" className="codepen-button rounded-md">
    <div style={{position: "absolute", inset: "0", width: "400%", height: "100%", background: "linear-gradient(115deg,#8b5cf6,#4c1d95,#a855f7)", backgroundSize: "25% 100%", animation: "border-shift .75s linear infinite"}} className="">
    </div>
    <span className="inline-flex items-center transition-all duration-300 group text-base font-light tracking-tight font-dm-sans border rounded pt-3 pr-6 pb-3 pl-6 hover:text-white hover:bg-white/10 hover:border-white/30 text-white bg-[#EA580C] hover:bg-[#C2410C] border-transparent shadow-sm" style={{}}>
        Get a demo
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="">
          <path d="M7 7h10v10" />
          <path d="M7 17 17 7" />
        </svg>
      </span>
  </a>
</div>

</div></div><div className="bg-center bg-stone-200 bg-[url(https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/f7302105-bf99-4736-914e-d8fbdb904af5_1600w.png)] bg-cover border-stone-200 border rounded-md pt-5 pr-5 pb-5 pl-5 relative">
        <article className="group overflow-hidden transition-shadow hover:shadow-md bg-[#EA580C]/20 border-stone-300 border rounded relative shadow-xl backdrop-blur-xl">
  <div className="sm:p-10 bg-stone-50 rounded pt-6 pr-6 pb-6 pl-6">
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
      <h3 className="text-2xl font-light text-stone-900 tracking-tight font-instrument-serif">Real‑Time Market Data
      </h3>
      <span className="inline-flex items-center gap-2 text-[10px] sm:text-xs text-neutral-300 bg-stone-950 border-white/10 border rounded-full px-2.5 py-1">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-400">
          <path d="M16 7h6v6" className="" />
          <path d="m22 7-8.5 8.5-5-5L2 17" className="" />
        </svg>
        Live streaming
      </span>
    </div>

    
    <div className="relative h-56 sm:h-64 rounded-2xl bg-gradient-to-b ring-1 ring-inset mb-8 from-neutral-900 to-neutral-800 ring-white/5">
      
      <div className="absolute right-3 sm:right-6 top-4 sm:top-6 w-[78%] h-[68%] rounded-2xl backdrop-blur border shadow-sm bg-neutral-900/90 border-neutral-800">
        <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800/70">
          <span className="text-[10px] sm:text-xs tracking-widest text-neutral-400" style={{}}>AAPL</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-green-400" style={{}}>+2.34%</span>
            <span className="h-2 w-12 rounded bg-green-500/20"></span>
          </div>
        </div>
        <div className="p-2">
          <svg viewBox="0 0 300 90" className="w-full h-20 sm:h-24 text-neutral-700">
            <defs className="" />
              <pattern id="dots1" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse" className="" />
                <circle cx="1" cy="1" r="0.5" fill="currentColor" opacity="0.3" className="" />
              
            
            <rect width="100%" height="100%" fill="url(#dots1)" className="" />
            
            <rect x="20" y="45" width="3" height="20" fill="#EF4444" className="" />
            <rect x="40" y="35" width="3" height="25" fill="#10B981" className="" />
            <rect x="60" y="50" width="3" height="15" fill="#EF4444" className="" />
            <rect x="80" y="30" width="3" height="30" fill="#10B981" className="" />
            <rect x="100" y="40" width="3" height="20" fill="#10B981" className="" />
            <rect x="120" y="25" width="3" height="35" fill="#10B981" className="" />
            <rect x="140" y="45" width="3" height="18" fill="#EF4444" className="" />
            <rect x="160" y="20" width="3" height="40" fill="#10B981" className="" />
            <rect x="180" y="35" width="3" height="25" fill="#10B981" className="" />
            <rect x="200" y="15" width="3" height="45" fill="#10B981" className="" />
            <polyline points="22,55 42,47 62,57 82,45 102,50 122,42 142,54 162,40 182,47 202,37" fill="none" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" className="" />
          </svg>
        </div>
      </div>

      
      <div className="absolute left-6 sm:left-12 bottom-10 sm:bottom-12 w-[62%] h-[52%] rounded-2xl backdrop-blur border shadow-sm bg-neutral-900/90 border-neutral-800">
        <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800/70">
          <span className="text-[10px] sm:text-xs tracking-widest text-neutral-400" style={{}}>WATCHLIST</span>
        </div>
        <div className="p-2 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-300" style={{}}>TSLA</span>
            <span className="text-green-400" style={{}}>+1.2%</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-300" style={{}}>MSFT</span>
            <span className="text-red-400" style={{}}>-0.5%</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-300" style={{}}>GOOGL</span>
            <span className="text-green-400" style={{}}>+0.8%</span>
          </div>
        </div>
      </div>

      
      <div className="absolute left-3 sm:left-6 bottom-3 sm:bottom-4 w-[38%] h-[44%] rounded-2xl backdrop-blur border shadow-sm bg-neutral-900/90 border-neutral-800">
        <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800/70">
          <span className="text-[10px] sm:text-xs tracking-widest text-neutral-400" style={{}}>MOBILE</span>
        </div>
        <div className="p-2">
          <svg viewBox="0 0 180 70" className="w-full h-14 sm:h-16 text-neutral-700">
            <rect x="10" y="35" width="2" height="12" fill="#10B981" className="" />
            <rect x="25" y="30" width="2" height="17" fill="#10B981" className="" />
            <rect x="40" y="40" width="2" height="10" fill="#EF4444" className="" />
            <rect x="55" y="25" width="2" height="22" fill="#10B981" className="" />
            <rect x="70" y="20" width="2" height="27" fill="#10B981" className="" />
            <rect x="85" y="35" width="2" height="12" fill="#EF4444" className="" />
            <rect x="100" y="15" width="2" height="32" fill="#10B981" className="" />
            <rect x="115" y="28" width="2" height="19" fill="#10B981" className="" />
            <rect x="130" y="12" width="2" height="35" fill="#10B981" className="" />
            <polyline points="11,41 26,38 41,45 56,36 71,33 86,41 101,31 116,36 131,29" fill="none" stroke="#10B981" strokeWidth="1" strokeLinecap="round" className="" />
          </svg>
        </div>
      </div>
    </div>

    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      <div className="">
        <h4 className="text-2xl font-light text-stone-900 tracking-tight font-instrument-serif">Advanced Charting</h4>
        <p className="text-sm text-stone-700 mt-2">Professional-grade technical analysis tools with real-time
          candlestick patterns.</p>
      </div>
      <div className="">
        <h4 className="text-2xl font-light text-stone-900 tracking-tight font-instrument-serif">Smart Watchlists</h4>
        <p className="mt-2 text-sm text-stone-600">Curated stock tracking with instant performance updates and
          alerts.</p>
      </div>

    </div>

    
    <div className="">
      <a href="#" className="inline-flex items-center gap-2 text-xs font-medium text-slate-900 hover:text-orange-600 font-semibold" style={{}}>
        Start trading
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <path d="M5 12h14" className="" />
          <path d="m12 5 7 7-7 7" className="" />
        </svg>
      </a>
    </div>
  </div>
</article>
      </div>

      
      
    </div>
  </div>
</section><section className="border-slate-100 border-t pt-24 pr-6 pb-24 pl-6">
    <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-20 items-center">
        
        <div className="order-2 lg:order-1 gap-x-2 gap-y-2">
            <div className="inline-flex text-[11px] uppercase font-bold text-[#EA580C] tracking-tight font-dm-sans bg-[#EA580C]/10 border-[#EA580C]/25 border rounded-full mb-8 pt-1 pr-3 pb-1 pl-3 gap-x-2 gap-y-2 items-center">

  Real-time Sync
</div>
            <h2 className="leading-[1.1] text-5xl font-light text-slate-900 tracking-tight font-instrument-serif mb-6">Engineered for high-velocity product teams.</h2>
            <p className="leading-relaxed text-base text-slate-500 tracking-tight font-dm-sans mb-8" style={{}}>Don't let process slow you down. Ship provides the guardrails you need to move fast without breaking things.</p>
            
            <ul className="space-y-6">
                <li className="flex items-start gap-4">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center mt-0.5 shrink-0 bg-green-50">
                         <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" data-lucide="check" className="lucide lucide-check w-3.5 h-3.5 text-green-600"><path d="M20 6 9 17l-5-5" /></svg>
                    </div>
                    <div className="">
                         
                        <span className="leading-relaxed text-base text-slate-500 tracking-tight font-dm-sans" style={{}}>Sprints start and end automatically. Unfinished tasks roll over to the next cycle without manual triage.</span>
                    </div>
                </li>
                <li className="flex items-start gap-4">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center mt-0.5 shrink-0 bg-green-50">
                         <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" data-lucide="check" className="lucide lucide-check w-3.5 h-3.5 text-green-600"><path d="M20 6 9 17l-5-5" /></svg>
                    </div>
                    <div className="">
                         
                        <span className="leading-relaxed text-base text-slate-500 tracking-tight font-dm-sans" style={{}}>Fly through your backlog. Create, assign, and update tasks without ever touching your mouse.</span>
                    </div>
                </li>
                <li className="flex items-start gap-4">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center mt-0.5 shrink-0 bg-green-50">
                         <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" data-lucide="check" className="lucide lucide-check w-3.5 h-3.5 text-green-600"><path d="M20 6 9 17l-5-5" /></svg>
                    </div>
                    <div className="">
                         
                        <span className="leading-relaxed text-base text-slate-500 tracking-tight font-dm-sans" style={{}}>Update status directly from your terminal or pull request. Keep code and tasks in perfect sync.</span>
                    </div>
                </li>
            </ul>
        </div>

        
        <div className="order-1 lg:order-2 relative perspective-1000">
            
            <div className="absolute -inset-6 bg-gradient-to-tr rounded-3xl opacity-60 blur-2xl -z-10 from-purple-100/50 to-blue-50/50"></div>
            
            
            <div className="overflow-hidden aspect-[4/3] transform transition-transform hover:rotate-0 duration-500 ease-out bg-white border-slate-200/80 border rounded-md relative shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] rotate-x-[5deg] rotate-y-[-5deg]">
                
                <div className="flex bg-[#FAFAFA] h-10 border-b pr-4 pl-4 items-center justify-between border-slate-100">
                    <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full border bg-slate-200 border-slate-300"></div>
                        <div className="w-2.5 h-2.5 rounded-full border bg-slate-200 border-slate-300"></div>
                        <div className="w-2.5 h-2.5 rounded-full border bg-slate-200 border-slate-300"></div>
                    </div>
                    <div className="flex gap-2 text-[10px] font-medium font-mono text-slate-400">
                        <span className="font-dm-sans tracking-tight" style={{}}>SPRINT-24</span>
                        <span className="font-dm-sans tracking-tight" style={{}}>•</span>
                        <span className="font-dm-sans tracking-tight" style={{}}>ACTIVE</span>
                    </div>
                </div>

                
                <div className="grid grid-cols-3 gap-4 overflow-hidden bg-[#F9F8F6] h-full pt-5 pr-5 pb-5 pl-5" style={{}}>
    
    <div className="flex flex-col gap-3 gap-x-3 gap-y-3">
        <div className="flex justify-between items-center mb-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase font-dm-sans tracking-tight" style={{}}>Backlog</span>
            <span className="text-[10px] px-1.5 rounded font-mono font-dm-sans tracking-tight bg-slate-200 text-slate-600" style={{}}>4</span>
        </div>
        
        <div className="p-3 rounded-lg border shadow-sm flex flex-col gap-2 bg-white border-slate-200">
            <div className="w-8 h-1 rounded-full bg-purple-200"></div>
            <div className="h-2 w-full rounded-sm bg-slate-100"></div>
            <div className="h-2 w-2/3 rounded-sm bg-slate-100"></div>
            <div className="flex justify-between items-center mt-1">
                <div className="w-4 h-4 rounded-full border bg-slate-100 border-slate-200"></div>
                <div className="w-8 h-3 rounded border bg-slate-50 border-slate-100"></div>
            </div>
        </div>
        
        <div className="p-3 rounded-lg border shadow-sm flex flex-col gap-2 bg-white border-slate-200">
            <div className="w-8 h-1 rounded-full bg-orange-200"></div>
            <div className="h-2 w-3/4 rounded-sm bg-slate-100"></div>
        </div>
    </div>

    
    <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center mb-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase font-dm-sans tracking-tight" style={{}}>In Progress</span>
            <span className="text-[10px] px-1.5 rounded font-mono font-dm-sans tracking-tight bg-slate-200 text-slate-600" style={{}}>2</span>
        </div>
        
        <div className="p-3 rounded-lg border shadow-[0_4px_12px_-2px_rgba(107,33,168,0.1)] flex flex-col gap-2 relative bg-white border-purple-200">
            <div className="absolute -left-[1px] top-3 bottom-3 w-[3px] bg-[#EA580C] rounded-r-full"></div>
            <div className="w-12 h-1 rounded-full bg-blue-200"></div>
            <div className="h-2 w-5/6 rounded-sm opacity-10 bg-slate-800"></div>
            <div className="h-2 w-full rounded-sm opacity-5 bg-slate-800"></div>
            <div className="h-2 w-1/2 rounded-sm opacity-5 bg-slate-800"></div>
            <div className="flex justify-between items-center mt-2">
                <div className="flex -space-x-1">
                    <div className="w-5 h-5 rounded-full border z-10 bg-indigo-100 border-white"></div>
                    <div className="w-5 h-5 rounded-full border bg-pink-100 border-white"></div>
                </div>
                <div className="text-[9px] font-mono px-1.5 py-0.5 rounded border font-dm-sans tracking-tight text-purple-700 bg-purple-50 border-purple-100" style={{}}>
                    DEV-128</div>
            </div>
        </div>
    </div>

    
    <div className="flex flex-col gap-3 opacity-60">
        <div className="flex justify-between items-center mb-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase font-dm-sans tracking-tight" style={{}}>Done</span>
            <span className="text-[10px] px-1.5 rounded font-mono font-dm-sans tracking-tight bg-slate-200 text-slate-600" style={{}}>18</span>
        </div>
        
        <div className="p-3 rounded-lg border flex flex-col gap-2 bg-slate-50/50 border-slate-100">
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border flex items-center justify-center border-slate-300">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-lucide="check" className="lucide lucide-check w-2 h-2 text-slate-400"><path d="M20 6 9 17l-5-5" /></svg>
                </div>
                <div className="h-2 w-3/4 rounded-sm bg-slate-200"></div>
            </div>
        </div>
        
        <div className="p-3 rounded-lg border flex flex-col gap-2 bg-slate-50/50 border-slate-100">
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border flex items-center justify-center border-slate-300">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-lucide="check" className="lucide lucide-check w-2 h-2 text-slate-400"><path d="M20 6 9 17l-5-5" /></svg>
                </div>
                <div className="h-2 w-1/2 rounded-sm bg-slate-200"></div>
            </div>
        </div>
        
        <div className="p-3 rounded-lg border flex flex-col gap-2 bg-slate-50/50 border-slate-100">
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border flex items-center justify-center border-slate-300">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-lucide="check" className="lucide lucide-check w-2 h-2 text-slate-400"><path d="M20 6 9 17l-5-5" /></svg>
                </div>
                <div className="h-2 w-2/3 rounded-sm bg-slate-200"></div>
            </div>
        </div>
    </div>
</div>
            </div>
        </div>
    </div>
</section><div className="pointer-events-none z-0 opacity-10 h-32 right-0 bottom-0 left-0" style={{backgroundImage: "repeating-linear-gradient(45deg, rgb(0, 0, 0) 0px, rgb(0, 0, 0) 1px, transparent 0px, transparent 50%)", backgroundSize: "10px 10px"}}>
</div><section className="border-y pt-24 pr-6 pb-24 pl-6 bg-stone-900 border-stone-900">
    <div className="text-center max-w-4xl mr-auto ml-auto">
        <div className="flex justify-center mb-10">
            <div className="p-3 rounded-xl border bg-slate-800/50 border-slate-700/50">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-lucide="quote" className="lucide lucide-quote fill-current w-[24px] h-[24px]" data-icon-replaced="true" style={{width: "24px", height: "24px", color: "rgb(0, 75, 176)"}}><path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z" /><path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z" /></svg>
            </div>
        </div>
        <h3 className="md:text-5xl leading-[1.2] text-3xl tracking-tight mb-12 font-instrument-serif font-light text-white" style={{}}>"ZenOffice has fundamentally changed how we build product. The visibility into our roadmap and the speed of execution is unmatched."</h3>
        <div className="flex items-center justify-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 p-[1px]">
                <div className="w-full h-full rounded-full flex items-center justify-center overflow-hidden bg-slate-900">
                    <img src="https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/0a9490d3-0806-4139-aaa6-628fd3eee5b1_320w.png" alt="User" className="w-full h-full object-cover" />
                </div>
            </div>
            <div className="text-left">
                <div className="font-medium font-dm-sans tracking-tight text-white" style={{}}>François Savard</div>
                <div className="text-sm tracking-tight font-dm-sans text-slate-400" style={{}}>a fellow customer</div>
            </div>
        </div>
    </div>
</section><section className="pt-24 pr-6 pb-24 pl-6 bg-stone-900">
    <div className="max-w-7xl mr-auto ml-auto">
        <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-4xl tracking-tight mb-4 font-instrument-serif font-light text-stone-50" style={{}}>Deep dive into your workflow</h2>
            <p className="text-base tracking-tight font-dm-sans text-stone-200" style={{}}>Every layer of your product development, optimized for clarity and control.</p>
        </div>
        
        
        <div className="flex mb-10 justify-center">
            <div className="inline-flex rounded-xl px-1.5 py-1.5 text-stone-900 bg-stone-700/50">
                <button className="transition-all text-sm font-semibold rounded-lg pt-2 pr-6 pb-2 pl-6 shadow-sm font-dm-sans tracking-tight text-slate-900 bg-white" style={{}}>Calendar</button>
                <button className="transition-all text-sm font-medium pt-2 pr-6 pb-2 pl-6 font-dm-sans tracking-tight hover:text-slate-400 text-stone-50" style={{}}>Roadmap View</button>
                <button className="transition-all text-sm font-medium pt-2 pr-6 pb-2 pl-6 font-dm-sans tracking-tight hover:text-slate-400 text-stone-50" style={{}}>Team Velocity</button>
            </div>
        </div>

        
        <div className="sm:px-6 pr-4 pl-4">
  <div className="bg-[#000000]/80 border ring-1 rounded-md relative shadow-2xl backdrop-blur border-white/10 ring-white/10">
    
    <div className="pointer-events-none absolute -top-6 left-1/2 h-16 w-[80%] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(168,85,247,0.4),rgba(0,0,0,0))] blur-2xl">
    </div>

    
    <div className="flex sm:px-6 border-b pt-3 pr-4 pb-3 pl-4 items-center justify-between border-white/10">
      <div className="flex items-center gap-2">
        <div className="hidden sm:block">
          <p className="text-sm font-medium font-dm-sans tracking-tight text-white" style={{}}>ZenOffice Planner</p>
          <p className="text-[11px] font-dm-sans tracking-tight text-slate-400" style={{}}>January 2026</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        
        <div className="hidden md:flex gap-2 h-10 border rounded pr-3 pl-3 gap-x-2 gap-y-2 items-center bg-white/5 border-white/10">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-slate-300">
            <path d="m21 21-4.34-4.34" className="" />
            <circle cx="11" cy="11" r="8" className="" />
          </svg>
          <input type="text" placeholder="Search your schedule…" className="h-full bg-transparent text-sm placeholder:text-slate-400 focus:outline-none w-56 text-slate-200" />
        </div>

        
        <button className="inline-flex gap-2 text-sm h-10 border rounded pr-3 pl-3 gap-x-2 gap-y-2 items-center text-slate-200 bg-white/5 border-white/10">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="m15 18-6-6 6-6" className="" /></svg>
            <span className="hidden sm:block font-dm-sans tracking-tight" style={{}}>Prev</span>
          </button>

        
        <button className="inline-flex gap-2 text-sm h-10 border rounded pr-3 pl-3 gap-x-2 gap-y-2 items-center text-slate-200 bg-white/5 border-white/10">
            <span className="hidden sm:block font-dm-sans tracking-tight" style={{}}>Next</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="m9 18 6-6-6-6" className="" /></svg>
          </button>

        
        <div className="hidden sm:flex items-center gap-2">
          <button className="inline-flex text-sm tracking-tight font-dm-sans h-10 border rounded pr-3 pl-3 gap-x-2 gap-y-2 items-center text-slate-200 bg-white/5 border-white/10" style={{}}>François's Workspace</button>
        </div>

        
        <img src="https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/0a9490d3-0806-4139-aaa6-628fd3eee5b1_320w.png" alt="User Avatar" className="hidden sm:block w-8 h-8 object-cover rounded-full ring-1 ml-2 ring-white/10" />
      </div>
    </div>

    
    <div className="flex">
      
      <aside className="hidden lg:block w-72 border-r pt-4 pr-4 pb-4 pl-4 border-white/10">
        
        <div className="border rounded pt-3 pr-3 pb-3 pl-3 bg-white/5 border-white/10">
          <div className="flex items-center justify-between">
            <button className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/5">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-slate-300"><path d="m15 18-6-6 6-6" className="" /></svg>
              </button>
            <div className="text-sm font-medium font-dm-sans tracking-tight text-white" style={{}}>November 2025</div>
            <button className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/5">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-slate-300"><path d="m9 18 6-6-6-6" className="" /></svg>
              </button>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] text-slate-400">
            <span className="font-dm-sans tracking-tight" style={{}}>Su</span><span className="font-dm-sans tracking-tight" style={{}}>Mo</span><span className="font-dm-sans tracking-tight" style={{}}>Tu</span><span className="font-dm-sans tracking-tight" style={{}}>We</span><span className="font-dm-sans tracking-tight" style={{}}>Th</span><span className="font-dm-sans tracking-tight" style={{}}>Fr</span><span className="font-dm-sans tracking-tight" style={{}}>Sa</span>
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1 text-center">
            <span className="py-1 text-[12px] text-slate-500 font-dm-sans tracking-tight" style={{}}>26</span>
            <span className="py-1 text-[12px] text-slate-500 font-dm-sans tracking-tight" style={{}}>27</span>
            <span className="py-1 text-[12px] text-slate-500 font-dm-sans tracking-tight" style={{}}>28</span>
            <span className="py-1 text-[12px] text-slate-500 font-dm-sans tracking-tight" style={{}}>29</span>
            <span className="py-1 text-[12px] text-slate-500 font-dm-sans tracking-tight" style={{}}>30</span>
            <span className="py-1 text-[12px] font-dm-sans tracking-tight text-slate-300" style={{}}>1</span>
            <span className="py-1 text-[12px] font-dm-sans tracking-tight text-slate-300" style={{}}>2</span>
            <span className="py-1 text-[12px] font-dm-sans tracking-tight text-slate-300" style={{}}>3</span>
            <span className="py-1 text-[12px] font-dm-sans tracking-tight text-slate-300" style={{}}>4</span>
            <span className="py-1 text-[12px] font-dm-sans tracking-tight text-slate-300" style={{}}>5</span>
            <span className="py-1 text-[12px] font-dm-sans tracking-tight text-slate-300" style={{}}>6</span>
            <span className="py-1 text-[12px] font-dm-sans tracking-tight text-slate-300" style={{}}>7</span>
            <span className="py-1 text-[12px] font-dm-sans tracking-tight text-slate-300" style={{}}>8</span>
            <span className="py-1 text-[12px] font-dm-sans tracking-tight text-slate-300" style={{}}>9</span>
            <span className="py-1 text-[12px] font-dm-sans tracking-tight text-slate-300" style={{}}>10</span>
            <span className="py-1 text-[12px] font-dm-sans tracking-tight text-slate-300" style={{}}>11</span>
            <span className="py-1 text-[12px] font-dm-sans tracking-tight text-slate-300" style={{}}>12</span>
            <span className="py-1 text-[12px] font-dm-sans tracking-tight text-slate-300" style={{}}>13</span>
            <span className="py-1 text-[12px] font-dm-sans tracking-tight text-slate-300" style={{}}>14</span>
            <span className="py-1 text-[12px] font-dm-sans tracking-tight text-slate-300" style={{}}>15</span>
            <span className="py-1 text-[12px] font-dm-sans tracking-tight text-slate-300" style={{}}>16</span>
            <span className="py-1 text-[12px] font-dm-sans tracking-tight text-slate-300" style={{}}>17</span>
            <span className="py-1 text-[12px] font-dm-sans tracking-tight text-slate-300" style={{}}>18</span>
            <span className="py-1 text-[12px] font-dm-sans tracking-tight text-slate-300" style={{}}>19</span>
            <span className="py-1 text-[12px] font-dm-sans tracking-tight text-slate-300" style={{}}>20</span>
            <span className="py-1 text-[12px] font-dm-sans tracking-tight text-slate-300" style={{}}>21</span>
            <span className="py-1 text-[12px] font-dm-sans tracking-tight text-slate-300" style={{}}>22</span>
            <span className="py-1 text-[12px] font-dm-sans tracking-tight text-slate-300" style={{}}>23</span>
            <span className="py-1 text-[12px] font-dm-sans tracking-tight text-slate-300" style={{}}>24</span>
            <span className="py-1 text-[12px] font-dm-sans tracking-tight text-slate-300" style={{}}>25</span>
            <span className="py-1 text-[12px] rounded-md bg-gradient-to-r from-violet-500/40 ring-1 font-dm-sans tracking-tight text-white to-fuchsia-600/40 ring-white/10" style={{}}>26</span>
            <span className="py-1 text-[12px] font-dm-sans tracking-tight text-slate-300" style={{}}>27</span>
            <span className="py-1 text-[12px] font-dm-sans tracking-tight text-slate-300" style={{}}>28</span>
            <span className="py-1 text-[12px] font-dm-sans tracking-tight text-slate-300" style={{}}>29</span>
            <span className="py-1 text-[12px] font-dm-sans tracking-tight text-slate-300" style={{}}>30</span>
          </div>
        </div>

        
        <div className="mt-5">
          <p className="mb-2 text-sm font-medium font-dm-sans tracking-tight text-white" style={{}}>Linked Calendars</p>
          <div className="space-y-2">
            <div className="flex border rounded pt-2 pr-3 pb-2 pl-3 items-center justify-between bg-white/5 border-white/10">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                <span className="text-sm font-dm-sans tracking-tight text-slate-200" style={{}}>Work</span>
              </div>
              <button className="relative h-5 w-9 rounded-full ring-1 transition aria-checked:bg-emerald-500/60 bg-white/10 ring-white/10" aria-checked="true">
                  <span className="absolute left-4 top-0.5 h-4 w-4 rounded-full shadow transition aria-checked:left-[18px] bg-white"></span>
                </button>
            </div>
            <div className="flex border rounded pt-2 pr-3 pb-2 pl-3 items-center justify-between bg-white/5 border-white/10">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-sky-400"></span>
                <span className="text-sm font-dm-sans tracking-tight text-slate-200" style={{}}>Personal</span>
              </div>
              <button className="relative h-5 w-9 rounded-full ring-1 transition aria-checked:bg-sky-500/60 bg-white/10 ring-white/10" aria-checked="true">
                  <span className="absolute left-4 top-0.5 h-4 w-4 rounded-full shadow transition aria-checked:left-[18px] bg-white"></span>
                </button>
            </div>
            <div className="flex border rounded pt-2 pr-3 pb-2 pl-3 items-center justify-between bg-white/5 border-white/10">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-fuchsia-400"></span>
                <span className="text-sm font-dm-sans tracking-tight text-slate-200" style={{}}>Team</span>
              </div>
              <button className="relative h-5 w-9 rounded-full ring-1 transition aria-checked:bg-fuchsia-500/60 bg-white/10 ring-white/10" aria-checked="false">
                  <span className="absolute left-1 top-0.5 h-4 w-4 rounded-full shadow transition aria-checked:left-[18px] bg-white"></span>
                </button>
            </div>
          </div>
        </div>

        
        <div className="mt-6">
          <p className="mb-2 text-sm font-medium font-dm-sans tracking-tight text-white" style={{}}>Next Up</p>
          <div className="space-y-2">
            <div className="flex gap-2 border rounded pt-3 pr-3 pb-3 pl-3 gap-x-2 gap-y-2 items-start bg-white/5 border-white/10">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-violet-500" />
              <div className="">
                <p className="text-sm font-dm-sans tracking-tight text-slate-200" style={{}}>Reuse this amazing template</p>
                <p className="text-xs font-dm-sans tracking-tight text-slate-400" style={{}}>Today • 2:00 PM</p>
              </div>
            </div>

          </div>
        </div>
      </aside>

      
      <div className="min-w-0 flex-1 sm:p-4 pt-3 pr-3 pb-3 pl-3">
        <div className="overflow-x-auto">
          <div className="w-full">
            
            <div className="grid gap-2 mb-3" style={{gridTemplateColumns: "72px repeat(5,1fr)"}}>
              <div className="text-xs text-slate-400"></div>
              <div className="text-xs font-medium text-center font-dm-sans tracking-tight text-slate-200" style={{}}>Mon 24</div>
              <div className="text-xs font-medium text-center font-dm-sans tracking-tight text-slate-200" style={{}}>Tue 25</div>
              <div className="text-xs font-medium text-center font-dm-sans tracking-tight text-slate-200" style={{}}>Wed 26</div>
              <div className="text-xs font-medium text-center font-dm-sans tracking-tight text-slate-200" style={{}}>Thu 27</div>
              <div className="text-xs font-medium text-center font-dm-sans tracking-tight text-slate-200" style={{}}>Fri 28</div>
            </div>

            
            <div className="grid" style={{gridTemplateColumns: "72px repeat(5,1fr)", gridAutoRows: "64px", gap: "0"}}>
              
              <div className="flex items-center pr-2 text-[11px] text-slate-500 font-dm-sans tracking-tight" style={{gridRow: "1"}}>07:00</div>
              <div className="border-t border-l relative bg-white/5 border-white/10" style={{gridRow: "1"}}></div>
              <div className="border-l border-t relative border-white/10 bg-white/5" style={{gridRow: "1"}}></div>
              <div className="border-l border-t relative border-white/10 bg-white/5" style={{gridRow: "1"}}></div>
              <div className="border-l border-t relative border-white/10 bg-white/5" style={{gridRow: "1"}}></div>
              <div className="border-t border-r border-l relative bg-white/5 border-white/10" style={{gridRow: "1"}}></div>

              
              <div className="flex items-center pr-2 text-[11px] text-slate-500 font-dm-sans tracking-tight" style={{gridRow: "2"}}>08:00</div>

              
              <div className="border-l border-t relative border-white/10 bg-white/5" style={{gridRow: "2"}}>
                <div className="evt evt-at-30 evt-h-30 ring-1 bg-gradient-to-r from-emerald-500/20 ring-emerald-400/30 to-emerald-400/10">
                  <p className="text-[11px] leading-tight font-dm-sans tracking-tight text-emerald-300" style={{}}>Daily Kickoff</p>
                  <p className="text-[10px] font-dm-sans tracking-tight text-slate-400" style={{}}>08:30 - 09:00</p>
                </div>
              </div>

              
              <div className="border-l border-t relative border-white/10 bg-white/5" style={{gridRow: "2"}}>
                <div className="evt evt-at-30 evt-h-30 ring-1 bg-gradient-to-r from-emerald-500/20 ring-emerald-400/30 to-emerald-400/10">
                  <p className="text-[11px] leading-tight font-dm-sans tracking-tight text-emerald-300" style={{}}>Daily Kickoff</p>
                  <p className="text-[10px] font-dm-sans tracking-tight text-slate-400" style={{}}>08:30 - 09:00</p>
                </div>
              </div>

              
              <div className="border-l border-t relative border-white/10 bg-white/5" style={{gridRow: "2"}}>
                <div className="evt evt-at-30 evt-h-30 ring-1 bg-gradient-to-r from-emerald-500/20 ring-emerald-400/30 to-emerald-400/10">
                  <p className="text-[11px] leading-tight font-dm-sans tracking-tight text-emerald-300" style={{}}>Daily Kickoff</p>
                  <p className="text-[10px] font-dm-sans tracking-tight text-slate-400" style={{}}>08:30 - 09:00</p>
                </div>
              </div>

              
              <div className="border-l border-t relative border-white/10 bg-white/5" style={{gridRow: "2"}}>
                <div className="evt evt-at-30 evt-h-30 ring-1 bg-gradient-to-r from-emerald-500/20 ring-emerald-400/30 to-emerald-400/10">
                  <p className="text-[11px] leading-tight font-dm-sans tracking-tight text-emerald-300" style={{}}>Daily Kickoff</p>
                  <p className="text-[10px] font-dm-sans tracking-tight text-slate-400" style={{}}>08:30 - 09:00</p>
                </div>
              </div>

              
              <div className="border-l border-r border-t relative border-white/10 bg-white/5" style={{gridRow: "2"}}>
                <div className="evt evt-at-30 evt-h-30 ring-1 bg-gradient-to-r from-emerald-500/20 ring-emerald-400/30 to-emerald-400/10">
                  <p className="text-[11px] leading-tight font-dm-sans tracking-tight text-emerald-300" style={{}}>Fake meeting to look busy</p>
                  <p className="text-[10px] font-dm-sans tracking-tight text-slate-400" style={{}}>08:30 - 09:00</p>
                </div>
              </div>

              
              <div className="flex items-center pr-2 text-[11px] text-slate-500 font-dm-sans tracking-tight" style={{gridRow: "3"}}>09:00</div>

              
              <div className="border-l border-t relative border-white/10 bg-white/5" style={{gridRow: "3 / 5"}}>
                <div className="evt ring-1 bg-gradient-to-r from-fuchsia-500/20 to-violet-500/10 ring-fuchsia-400/30" style={{top: "calc(50%)", bottom: "var(--evt-pad)"}}>
                  <p className="text-[11px] leading-tight font-dm-sans tracking-tight text-fuchsia-300" style={{}}>UX Jam Session</p>
                  <p className="text-[10px] font-dm-sans tracking-tight text-slate-400" style={{}}>09:30 - 11:00</p>
                </div>
              </div>

              
              <div className="border-l border-t relative border-white/10 bg-white/5" style={{gridRow: "3 / 4"}}>
                <div className="evt ring-1 bg-gradient-to-r from-violet-500/20 to-fuchsia-500/10 ring-violet-400/30" style={{top: "50%", height: "64px"}}>
                  <p className="text-[11px] leading-tight font-dm-sans tracking-tight text-violet-300" style={{}}>Quarterly Planning (nap time)</p>
                  <p className="text-[10px] font-dm-sans tracking-tight text-slate-400" style={{}}>09:30 - 10:30</p>
                </div>
              </div>

              
              <div className="border-l border-t relative border-white/10 bg-white/5" style={{gridRow: "3 / 5"}}>
                <div className="evt ring-1 bg-gradient-to-r from-rose-500/20 to-fuchsia-500/10 ring-rose-400/30" style={{top: "calc(64px * 0.75)", bottom: "var(--evt-pad)"}}>
                  <p className="text-[11px] leading-tight font-dm-sans tracking-tight text-rose-300" style={{}}>Maximise shareholders value</p>
                  <p className="text-[10px] font-dm-sans tracking-tight text-slate-400" style={{}}>09:45 - 11:30</p>
                </div>
              </div>

              
              <div className="border-l border-t relative border-white/10 bg-white/5" style={{gridRow: "3 / 4"}}>
                <div className="evt ring-1 bg-gradient-to-r from-amber-500/20 to-orange-500/10 ring-amber-400/30" style={{top: "50%", height: "64px"}}>
                  <p className="text-[11px] leading-tight font-dm-sans tracking-tight text-amber-300" style={{}}>Dept All-Hands</p>
                  <p className="text-[10px] font-dm-sans tracking-tight text-slate-400" style={{}}>09:30 - 10:30</p>
                </div>
              </div>

              <div className="border-l border-r border-t relative border-white/10 bg-white/5" style={{gridRow: "3"}}></div>

              
              <div className="flex items-center pr-2 text-[11px] text-slate-500 font-dm-sans tracking-tight" style={{gridRow: "4"}}>10:00</div>

              
              <div className="border-l border-t relative border-white/10 bg-white/5" style={{gridRow: "4 / 6"}}>
                <div className="evt ring-1 bg-gradient-to-r from-cyan-500/20 to-sky-500/10 ring-cyan-400/30" style={{top: "calc(64px * 0.75)", bottom: "calc(64px + var(--evt-pad))"}}>
                  <p className="text-[11px] leading-tight font-dm-sans tracking-tight text-cyan-300" style={{}}>Build Sprint</p>
                  <p className="text-[10px] font-dm-sans tracking-tight text-slate-400" style={{}}>10:45 - 12:00</p>
                </div>
              </div>

              <div className="border-l border-t relative border-white/10 bg-white/5" style={{gridRow: "4"}}></div>
              <div className="border-l border-t relative border-white/10 bg-white/5" style={{gridRow: "4"}}></div>

              
              <div className="border-l border-r border-t relative border-white/10 bg-white/5" style={{gridRow: "4 / 5"}}>

              </div>

              
              <div className="flex items-center pr-2 text-[11px] text-slate-500 font-dm-sans tracking-tight" style={{gridRow: "5"}}>11:00</div>

              
              <div className="border-l border-t relative border-white/10 bg-white/5" style={{gridRow: "5"}}>
                <div className="evt evt-at-00 evt-h-30 ring-1 bg-gradient-to-r from-sky-500/20 to-cyan-500/10 ring-sky-400/30">
                  <p className="text-[11px] leading-tight font-dm-sans tracking-tight text-sky-300" style={{}}>Client Demo</p>
                  <p className="text-[10px] font-dm-sans tracking-tight text-slate-400" style={{}}>11:00 - 11:30</p>
                </div>
              </div>

              <div className="border-t border-l relative bg-white/5 border-white/10" style={{gridRow: "5"}}></div>
              <div className="border-l border-t relative border-white/10 bg-white/5" style={{gridRow: "5"}}></div>
              <div className="border-l border-t relative border-white/10 bg-white/5" style={{gridRow: "5"}}></div>
              <div className="border-l border-r border-t relative border-white/10 bg-white/5" style={{gridRow: "5"}}></div>

              
              <div className="flex items-center pr-2 text-[11px] text-slate-500 font-dm-sans tracking-tight" style={{gridRow: "6"}}>12:00</div>

              
              <div className="border-l border-t relative border-white/10 bg-white/5" style={{gridRow: "6"}}>
                <div className="evt evt-h-60 evt-at-00 ring-1 bg-gradient-to-r from-purple-500/20 to-pink-500/10 ring-purple-400/30">
                  <p className="text-[11px] leading-tight font-dm-sans tracking-tight text-purple-300" style={{}}>Lunch</p>
                  <p className="text-[10px] font-dm-sans tracking-tight text-slate-400" style={{}}>12:00 - 13:00</p>
                </div>
              </div>
              <div className="border-l border-t relative border-white/10 bg-white/5" style={{gridRow: "6"}}>
                <div className="evt evt-h-60 evt-at-00 ring-1 bg-gradient-to-r from-purple-500/20 to-pink-500/10 ring-purple-400/30">
                  <p className="text-[11px] leading-tight font-dm-sans tracking-tight text-purple-300" style={{}}>Lunch</p>
                  <p className="text-[10px] font-dm-sans tracking-tight text-slate-400" style={{}}>12:00 - 13:00</p>
                </div>
              </div>
              <div className="border-l border-t relative border-white/10 bg-white/5" style={{gridRow: "6"}}>
                <div className="evt evt-h-60 evt-at-00 ring-1 bg-gradient-to-r from-purple-500/20 to-pink-500/10 ring-purple-400/30">
                  <p className="text-[11px] leading-tight font-dm-sans tracking-tight text-purple-300" style={{}}>Lunch</p>
                  <p className="text-[10px] font-dm-sans tracking-tight text-slate-400" style={{}}>12:00 - 13:00</p>
                </div>
              </div>
              <div className="border-l border-t relative border-white/10 bg-white/5" style={{gridRow: "6"}}>
                <div className="evt evt-h-60 evt-at-00 ring-1 bg-gradient-to-r from-purple-500/20 to-pink-500/10 ring-purple-400/30">
                  <p className="text-[11px] leading-tight font-dm-sans tracking-tight text-purple-300" style={{}}>Lunch</p>
                  <p className="text-[10px] font-dm-sans tracking-tight text-slate-400" style={{}}>12:00 - 13:00</p>
                </div>
              </div>
              <div className="border-l border-r border-t relative border-white/10 bg-white/5" style={{gridRow: "6"}}>
                <div className="evt evt-h-60 evt-at-00 ring-1 bg-gradient-to-r from-purple-500/20 to-pink-500/10 ring-purple-400/30">
                  <p className="text-[11px] leading-tight font-dm-sans tracking-tight text-purple-300" style={{}}>Lunch</p>
                  <p className="text-[10px] font-dm-sans tracking-tight text-slate-400" style={{}}>12:00 - 13:00</p>
                </div>
              </div>

              
              <div className="flex items-center pr-2 text-[11px] text-slate-500 font-dm-sans tracking-tight" style={{gridRow: "7"}}>13:00</div>

              
              <div className="border-t border-l relative bg-white/5 border-white/10" style={{gridRow: "7"}}>
                <div className="evt ring-1 border border-dashed bg-transparent ring-violet-400/30 border-violet-400/30" style={{top: "var(--evt-pad)", height: "56px"}}>
                  <p className="text-[11px] leading-tight font-dm-sans tracking-tight text-violet-300" style={{}}>Make templates on Aura</p>
                  <p className="text-[10px] font-dm-sans tracking-tight text-slate-400" style={{}}>Suggested slot</p>
                </div>
              </div>

              
              <div className="border-l border-t relative border-white/10 bg-white/5" style={{gridRow: "7"}}>
                <div className="evt evt-at-30 evt-h-30 ring-1 border border-dashed bg-transparent ring-violet-400/30 border-violet-400/30">
                  <p className="text-[11px] leading-tight font-dm-sans tracking-tight text-violet-300" style={{}}>Make more templates on Aura</p>
                  <p className="text-[10px] font-dm-sans tracking-tight text-slate-400" style={{}}>1:30 PM - 2:00 PM</p>
                </div>
              </div>

              <div className="border-l border-t border-b relative border-white/10 bg-white/5" style={{gridRow: "7"}}></div>
              <div className="border-l border-t border-b relative border-white/10 bg-white/5" style={{gridRow: "7"}}></div>
              <div className="border-l border-r border-t border-b relative border-white/10 bg-white/5" style={{gridRow: "7"}}>
              </div>
            </div>

            
            <div className="flex border rounded mt-4 pt-3 pr-3 pb-3 pl-3 items-center justify-between bg-white/5 border-white/10">
              <div className="flex text-xs gap-x-2 gap-y-2 items-center font-dm-sans tracking-tight text-slate-300" style={{}}>ZenOffice AI Scheduling is on</div>
              <div className="flex items-center gap-2">
                <button className="inline-flex text-xs tracking-tight font-dm-sans border rounded-sm pt-2 pr-3 pb-2 pl-3 gap-x-2 gap-y-2 items-center text-slate-200 bg-white/5 border-white/10" style={{}}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-lucide="share-2" className="lucide lucide-share-2 w-[16px] h-[16px]" data-icon-set="lucide" data-icon-replaced="true" style={{color: "rgb(226, 232, 240)", width: "16px", height: "16px"}}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"></line><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"></line></svg>
            Share
          </button>
                <button className="inline-flex text-xs tracking-tight font-dm-sans border rounded-sm pt-2 pr-3 pb-2 pl-3 gap-x-2 gap-y-2 items-center text-slate-200 bg-white/5 border-white/10" style={{}}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-lucide="download" className="lucide lucide-download" data-icon-set="lucide" data-icon-replaced="true" style={{color: "rgb(226, 232, 240)"}}><path d="M12 15V3" /><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /></svg>
            Export
          </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
    </div>
</section><div className="pointer-events-none z-0 opacity-10 h-32 right-0 bottom-0 left-0" style={{backgroundImage: "repeating-linear-gradient(45deg, rgb(0, 0, 0) 0px, rgb(0, 0, 0) 1px, transparent 0px, transparent 50%)", backgroundSize: "10px 10px"}}>
</div><section className="py-24 px-6 border-t bg-white border-slate-100">
    <div className="max-w-3xl mr-auto ml-auto">
    <h2 className="text-3xl tracking-tight mb-12 text-center font-instrument-serif font-light text-slate-900" style={{}}>Frequently asked
        questions</h2>
    <div className="space-y-6">
      <div className="hover:shadow-sm transition-shadow border rounded-md pt-6 pr-6 pb-6 pl-6 border-neutral-200">
        <h3 className="text-lg font-semibold mb-3 font-dm-sans tracking-tight text-neutral-900" style={{}}>How does the subscription model work?</h3>
        <p className="leading-relaxed text-base tracking-tight font-dm-sans text-neutral-600" style={{}}>Our subscription model gives you access to our full design
          and development team for a flat monthly rate. You can request unlimited projects, pause or cancel anytime, and
          get consistent quality without the overhead of hiring in-house talent.</p>
      </div>

      <div className="hover:shadow-sm transition-shadow border rounded-md pt-6 pr-6 pb-6 pl-6 border-neutral-200">
        <h3 className="text-lg font-semibold mb-3 font-dm-sans tracking-tight text-neutral-900" style={{}}>What's included in each plan?</h3>
        <p className="leading-relaxed text-base tracking-tight font-dm-sans text-neutral-600" style={{}}>Each plan includes different levels of service intensity.
          Starter focuses on core design work, Pro adds development and systems thinking, while Scale provides dedicated
          team resources and growth optimization. All plans include project management, regular communication, and our
          proven process.</p>
      </div>

      <div className="hover:shadow-sm transition-shadow border rounded-md pt-6 pr-6 pb-6 pl-6 border-neutral-200">
        <h3 className="text-lg font-semibold mb-3 font-dm-sans tracking-tight text-neutral-900" style={{}}>How quickly will I receive my designs?</h3>
        <p className="leading-relaxed text-base tracking-tight font-dm-sans text-neutral-600" style={{}}>Most requests are completed within 2-3 business days on
          average. Complex requests may take longer, but we'll always communicate timelines upfront. Our response times
          vary by plan, from 48 hours (Starter) to 12 hours (Scale) for initial feedback and updates.</p>
      </div>

      <div className="text-center mt-12">
        <p className="mb-4 font-dm-sans tracking-tight text-neutral-600" style={{}}>Still have questions?</p>
        
      <a href="#" className="hover:bg-[#4C1D95] transition-colors text-sm font-medium tracking-tight font-dm-sans bg-[#2E1065] rounded-md pt-2.5 pr-5 pb-2.5 pl-5 shadow-sm text-white" style={{}}>Get
  a demo</a></div>
    </div>
</div>
</section><div className="pointer-events-none z-0 opacity-10 h-32 right-0 bottom-0 left-0" style={{backgroundImage: "repeating-linear-gradient(45deg, rgb(0, 0, 0) 0px, rgb(0, 0, 0) 1px, transparent 0px, transparent 50%)", backgroundSize: "10px 10px"}}>
</div><div className="z-0 pointer-events-none bg-stone-950 opacity-100 h-32 right-0 bottom-0 left-0" style={{backgroundImage: "repeating-linear-gradient(45deg, rgb(50, 50, 50) 0px, rgb(50, 50, 50) 1px, transparent 0px, transparent 50%)", backgroundSize: "10px 10px"}}>
</div><section className="bg-stone-950 pt-24 pr-6 pb-24 pl-6">
    <div className="max-w-7xl mr-auto ml-auto">
        <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-4xl font-light text-stone-50 tracking-tight font-instrument-serif mb-4">Simple, transparent
                pricing</h2>
            <p className="text-lg text-stone-200 tracking-tight font-dm-sans">Start for free, scale as you grow.</p>
        </div>

        <div className="flex flex-col gap-24 max-w-7xl mx-auto px-4">
            
            <div className="grid lg:grid-cols-3 gap-6 items-stretch">

                
                <div className="group min-h-[520px] flex flex-col overflow-hidden hover:shadow-[0_20px_60px_rgba(0,0,0,0.06)] transition-all duration-500 border rounded-md pt-10 pr-10 pb-10 pl-10 relative shadow-[0_2px_40px_rgba(0,0,0,0.02)] justify-end bg-white border-yellow-100">
                    
                    <div className="absolute -top-[20%] -right-[20%] w-[120%] h-[120%] bg-[conic-gradient(at_top_right,_var(--tw-gradient-stops))] to-transparent blur-[80px] opacity-60 mix-blend-multiply pointer-events-none from-yellow-200 via-orange-100">
                    </div>
                    <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-gradient-to-br to-transparent blur-[60px] opacity-50 pointer-events-none from-yellow-300/40">
                    </div>

                    
                    <div className="relative z-10 mb-8">
                        <h3 className="text-[28px] tracking-tight mb-12 font-instrument-serif font-light text-slate-900" style={{}}>Starter</h3>

                        <div className="flex flex-col gap-1 mb-8">
                            <span className="text-[13px] font-mono text-slate-500 font-dm-sans tracking-tight" style={{}}>Starting at</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-7xl tracking-tighter font-instrument-serif font-light text-slate-900" style={{}}>$0</span>
                                <span className="text-lg text-slate-500 font-normal font-dm-sans tracking-tight" style={{}}>/month</span>
                            </div>
                        </div>

                        <p className="font-mono text-[13px] leading-relaxed max-w-[240px] font-dm-sans tracking-tight text-slate-600" style={{}}>
                            Essential task management for individuals and side projects.
                        </p>
                    </div>

                    
                    <button className="absolute bottom-10 right-10 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-[-45deg] shadow-lg bg-black text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-right w-6 h-6"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
            </button>
                </div>

                
                <div className="group min-h-[520px] flex flex-col overflow-hidden hover:shadow-[0_20px_60px_rgba(0,0,0,0.06)] transition-all duration-500 border rounded-md pt-10 pr-10 pb-10 pl-10 relative shadow-[0_2px_40px_rgba(0,0,0,0.02)] justify-end bg-white border-purple-100">
                    
                    <div className="absolute -top-[20%] -right-[20%] w-[120%] h-[120%] bg-[conic-gradient(at_top_right,_var(--tw-gradient-stops))] to-transparent blur-[80px] opacity-60 mix-blend-multiply pointer-events-none from-indigo-300 via-purple-200">
                    </div>
                    <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-gradient-to-br to-transparent blur-[60px] opacity-50 pointer-events-none from-purple-400/30">
                    </div>

                    
                    <div className="relative z-10 mb-8">
                        <div className="flex items-center gap-3 mb-12">
                            <h3 className="text-[28px] tracking-tight font-instrument-serif font-light text-slate-900" style={{}}>Pro</h3>
                            <span className="text-[10px] font-bold px-2 py-1 rounded-md uppercase font-dm-sans tracking-tight bg-black text-white" style={{}}>PRO</span>
                        </div>

                        <div className="flex flex-col gap-1 mb-8">
                            <span className="text-[13px] font-mono text-slate-500 font-dm-sans tracking-tight" style={{}}>Starting at</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-7xl tracking-tighter font-instrument-serif font-light text-slate-900" style={{}}>$12</span>
                                <span className="text-lg text-slate-500 font-normal font-dm-sans tracking-tight" style={{}}>/month</span>
                            </div>
                        </div>

                        <p className="font-mono text-[13px] leading-relaxed max-w-[260px] font-dm-sans tracking-tight text-slate-600" style={{}}>
                            Advanced workflows and automation for growing startup teams.
                        </p>
                    </div>

                    
                    <button className="absolute bottom-10 right-10 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-[-45deg] shadow-lg bg-black text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-right w-6 h-6"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
            </button>
                </div>

                
                <div className="group min-h-[520px] flex flex-col overflow-hidden hover:shadow-[0_20px_60px_rgba(0,0,0,0.06)] transition-all duration-500 border rounded-md pt-10 pr-10 pb-10 pl-10 relative shadow-[0_2px_40px_rgba(0,0,0,0.02)] justify-end bg-white border-sky-100">
                    
                    <div className="absolute -top-[20%] -right-[20%] w-[120%] h-[120%] bg-[conic-gradient(at_top_right,_var(--tw-gradient-stops))] to-transparent blur-[80px] opacity-50 mix-blend-multiply pointer-events-none from-blue-400 via-indigo-300">
                    </div>
                    <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-gradient-to-br from-blue-500/30 to-transparent blur-[60px] opacity-50 pointer-events-none">
                    </div>

                    
                    <div className="relative z-10 mb-8">
                        <h3 className="text-[28px] tracking-tight mb-12 font-instrument-serif font-light text-slate-900" style={{}}>Business</h3>

                        <div className="flex flex-col gap-1 mb-8">
                            <span className="text-[13px] font-mono text-slate-500 font-dm-sans tracking-tight" style={{}}>Starting at</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-7xl tracking-tighter font-instrument-serif font-light text-slate-900" style={{}}>$24</span>
                                <span className="text-lg text-slate-500 font-normal font-dm-sans tracking-tight" style={{}}>/month</span>
                            </div>
                        </div>

                        <p className="font-mono text-[13px] leading-relaxed max-w-[240px] font-dm-sans tracking-tight text-slate-600" style={{}}>
                            Enterprise-grade security and control for scaling organizations.
                        </p>
                    </div>

                    
                    <button className="absolute bottom-10 right-10 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-[-45deg] shadow-lg bg-black text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-right w-6 h-6"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
            </button>
                </div>
            </div>

            
            <div className="w-full max-w-5xl mx-auto">
                <div className="mb-10 text-center">
                    <h4 className="text-3xl font-light text-stone-50 tracking-tight font-instrument-serif">Feature
                        Comparison</h4>
                </div>

                <div className="overflow-hidden bg-stone-900 border-stone-700 border rounded-md shadow-sm" style={{}}>
                    <div className="overflow-x-auto bg-stone-900" style={{}}>
                        <table className="text-left bg-stone-900 w-full border-0">
                            <thead className="" style={{}}>
                                <tr className="bg-stone-900 border-stone-700 border-b" style={{}}>
                                    <th className="text-sm font-semibold text-stone-50 tracking-tight font-dm-sans bg-stone-900 w-[40%] pt-5 pr-6 pb-5 pl-6" style={{}}>Features</th>
                                    <th className="text-sm font-semibold text-stone-50 tracking-tight font-dm-sans text-center bg-stone-900 w-[20%] pt-5 pr-6 pb-5 pl-6">
                                        Starter</th>
                                    <th className="text-sm font-semibold text-stone-50 tracking-tight font-dm-sans text-center bg-stone-900 w-[20%] px-6 py-5">
                                        Pro</th>
                                    <th className="text-sm font-semibold text-stone-50 tracking-tight font-dm-sans text-center bg-stone-900 w-[20%] pt-5 pr-6 pb-5 pl-6">
                                        Business</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-700 border-stone-800" style={{}}>
                                
                                <tr className="bg-slate-50/30 border-stone-700">
                                    <td className="uppercase text-xs font-bold text-stone-50 tracking-tight font-dm-sans bg-stone-800 pt-3 pr-6 pb-3 pl-6" colSpan={4}>Usage Limits</td>
                                </tr>
                                <tr className="border-stone-700 ring-stone-700">
                                    <td className="text-sm font-medium text-stone-50 tracking-tight font-dm-sans pt-4 pr-6 pb-4 pl-6">
                                        Team
                                        Members</td>
                                    <td className="text-sm text-stone-50 tracking-tight font-mono text-center pt-4 pr-6 pb-4 pl-6">
                                        Up to 5</td>
                                    <td className="text-sm text-stone-50 tracking-tight font-mono text-center px-6 py-4">
                                        Unlimited</td>
                                    <td className="text-sm text-stone-50 tracking-tight font-mono text-center px-6 py-4">
                                        Unlimited</td>
                                </tr>
                                <tr className="">
                                    <td className="text-sm font-medium text-stone-50 tracking-tight font-dm-sans px-6 py-4">
                                        Active Projects</td>
                                    <td className="text-sm text-stone-50 tracking-tight font-mono text-center px-6 py-4">3
                                    </td>
                                    <td className="text-sm text-stone-50 tracking-tight font-mono text-center px-6 py-4">
                                        Unlimited</td>
                                    <td className="text-sm text-stone-50 tracking-tight font-mono text-center px-6 py-4">
                                        Unlimited</td>
                                </tr>
                                <tr className="">
                                    <td className="text-sm font-medium text-stone-50 tracking-tight font-dm-sans px-6 py-4">
                                        File Storage</td>
                                    <td className="text-sm text-stone-50 tracking-tight font-mono text-center pt-4 pr-6 pb-4 pl-6">
                                        100 MB</td>
                                    <td className="text-sm text-stone-50 tracking-tight font-mono text-center px-6 py-4">10
                                        GB</td>
                                    <td className="text-sm text-stone-50 tracking-tight font-mono text-center pt-4 pr-6 pb-4 pl-6">
                                        1 TB</td>
                                </tr>

                                
                                <tr className="bg-slate-50/30">
                                    <td className="uppercase text-xs font-bold text-stone-50 tracking-tight font-dm-sans bg-stone-800 px-6 py-3" colSpan={4}>Productivity</td>
                                </tr>
                                <tr className="">
                                    <td className="text-sm font-medium text-stone-50 tracking-tight font-dm-sans px-6 py-4">
                                        Kanban Boards</td>
                                    <td className="text-center pt-4 pr-6 pb-4 pl-6"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check mr-auto ml-auto w-[16px] h-[16px] text-stone-50" data-icon-replaced="true" style={{width: "16px", height: "16px"}}>
                                            <path d="M20 6 9 17l-5-5" className="" />
                                        </svg></td>
                                    <td className="py-4 px-6 text-center"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check mr-auto ml-auto w-[16px] h-[16px] text-stone-50" data-icon-replaced="true" style={{width: "16px", height: "16px"}}>
                                            <path d="M20 6 9 17l-5-5" />
                                        </svg></td>
                                    <td className="py-4 px-6 text-center"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check mr-auto ml-auto w-[16px] h-[16px] text-stone-50" data-icon-replaced="true" style={{width: "16px", height: "16px"}}>
                                            <path d="M20 6 9 17l-5-5" />
                                        </svg></td>
                                </tr>
                                <tr className="">
                                    <td className="text-sm font-medium text-stone-50 tracking-tight font-dm-sans px-6 py-4">
                                        Sprint Planning</td>
                                    <td className="py-4 px-6 text-center">
                                        <div className="w-4 h-0.5 mx-auto bg-slate-200"></div>
                                    </td>
                                    <td className="text-center pt-4 pr-6 pb-4 pl-6"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check mr-auto ml-auto w-[16px] h-[16px] text-stone-50" data-icon-replaced="true" style={{width: "16px", height: "16px"}}>
                                            <path d="M20 6 9 17l-5-5" />
                                        </svg></td>
                                    <td className="py-4 px-6 text-center"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check mr-auto ml-auto w-[16px] h-[16px] text-stone-50" data-icon-replaced="true" style={{width: "16px", height: "16px"}}>
                                            <path d="M20 6 9 17l-5-5" className="" />
                                        </svg></td>
                                </tr>
                                <tr className="">
                                    <td className="text-sm font-medium text-stone-50 tracking-tight font-dm-sans px-6 py-4">
                                        Custom Workflows
                                    </td>
                                    <td className="py-4 px-6 text-center">
                                        <div className="w-4 h-0.5 mx-auto bg-slate-200"></div>
                                    </td>
                                    <td className="py-4 px-6 text-center"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check text-stone-50 w-[16px] h-[16px] mr-auto ml-auto" data-icon-replaced="true" style={{width: "16px", height: "16px"}}>
                                            <path d="M20 6 9 17l-5-5" />
                                        </svg></td>
                                    <td className="py-4 px-6 text-center"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check mr-auto ml-auto w-[16px] h-[16px] text-stone-50" data-icon-replaced="true" style={{width: "16px", height: "16px"}}>
                                            <path d="M20 6 9 17l-5-5" />
                                        </svg></td>
                                </tr>
                                <tr className="">
                                    <td className="text-sm font-medium text-stone-50 tracking-tight font-dm-sans px-6 py-4">
                                        GitHub Integration
                                    </td>
                                    <td className="py-4 px-6 text-center">
                                        <div className="w-4 h-0.5 mx-auto bg-slate-200"></div>
                                    </td>
                                    <td className="py-4 px-6 text-center">
                                        <span className="text-xs text-stone-50 tracking-tight font-mono">Read-only</span>
                                    </td>
                                    <td className="text-center pt-4 pr-6 pb-4 pl-6">
                                        <span className="text-xs text-stone-50 tracking-tight font-mono">Full Sync</span>
                                    </td>
                                </tr>

                                
                                <tr className="bg-slate-50/30">
                                    <td className="uppercase text-xs font-bold text-stone-50 tracking-tight font-dm-sans bg-stone-800 px-6 py-3" colSpan={4}>Security &amp; Support</td>
                                </tr>
                                <tr className="">
                                    <td className="text-sm font-medium text-stone-50 tracking-tight font-dm-sans px-6 py-4">
                                        SAML SSO</td>
                                    <td className="py-4 px-6 text-center">
                                        <div className="w-4 h-0.5 mx-auto bg-slate-200"></div>
                                    </td>
                                    <td className="py-4 px-6 text-center">
                                        <div className="w-4 h-0.5 mx-auto bg-slate-200"></div>
                                    </td>
                                    <td className="py-4 px-6 text-center"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check w-4 h-4 mx-auto text-slate-900">
                                            <path d="M20 6 9 17l-5-5" />
                                        </svg></td>
                                </tr>
                                <tr className="">
                                    <td className="text-sm font-medium text-stone-50 tracking-tight font-dm-sans px-6 py-4">
                                        Audit Logs</td>
                                    <td className="py-4 px-6 text-center">
                                        <div className="w-4 h-0.5 mx-auto bg-slate-200"></div>
                                    </td>
                                    <td className="py-4 px-6 text-center">
                                        <div className="w-4 h-0.5 mx-auto bg-slate-200"></div>
                                    </td>
                                    <td className="py-4 px-6 text-center"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check w-4 h-4 mx-auto text-slate-900">
                                            <path d="M20 6 9 17l-5-5" />
                                        </svg></td>
                                </tr>
                                <tr className="">
                                    <td className="text-sm font-medium text-stone-50 tracking-tight font-dm-sans pt-4 pr-6 pb-4 pl-6">
                                        Support
                                        SLA</td>
                                    <td className="text-center pt-4 pr-6 pb-4 pl-6">
                                        <span className="text-xs text-stone-50 tracking-tight font-mono">Community</span>
                                    </td>
                                    <td className="py-4 px-6 text-center">
                                        <span className="text-xs text-stone-50 tracking-tight font-mono">Standard</span>
                                    </td>
                                    <td className="text-stone-50 text-center px-6 py-4">
                                        <span className="text-xs text-stone-50 tracking-tight font-mono">Priority (24h)</span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>
<div className="z-0 pointer-events-none bg-stone-950 opacity-100 h-32 right-0 bottom-0 left-0" style={{backgroundImage: "repeating-linear-gradient(45deg, rgb(50, 50, 50) 0px, rgb(50, 50, 50) 1px, transparent 0px, transparent 50%)", backgroundSize: "10px 10px"}}>
</div><footer className="bg-stone-950 w-full max-w-none gap-x-4 gap-y-4">
  <div className="overflow-hidden max-w-7xl mx-auto relative gap-x-4 gap-y-4 bg-stone-200">
    <div className="z-10 sm:p-12 md:p-16 bg-stone-950 pt-12 pr-8 pb-8 pl-8 relative">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 pb-12 border-b border-white/10">
        <div className="lg:col-span-4 gap-x-2 gap-y-2">
          <div className="flex cursor-pointer mb-8 gap-x-2 gap-y-2 items-center">
                <div className="flex w-8 h-8 rounded-lg items-center justify-center text-slate-50 bg-slate-50">
                    <img src={AppConfig.logoIconUrl} alt="ZenOffice" className="w-5 h-5" />
                </div>
                <span className="text-xl font-semibold tracking-tight font-dm-sans text-slate-50" style={{}}>ZenOffice</span>
            </div>
          <p className="max-w-3xl text-white/70" style={{}}>We build ambitious products with small, senior teams. Tell us a bit about
            your project and we’ll get back within one business day.</p>

          <div className="sm:p-6 md:p-8 border rounded-md mt-6 pt-5 pr-5 pb-5 pl-5 bg-white/5 border-white/10" id="contact">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="space-y-4">
                <div className="inline-flex gap-2 text-xs ring-1 rounded-full pt-1 pr-2.5 pb-1 pl-2.5 gap-x-2 gap-y-2 items-center text-emerald-300 bg-emerald-400/10 ring-emerald-300/20" style={{}}>
  <span className="h-1.5 w-1.5 rounded-full animate-pulse bg-emerald-400"></span>
  Time slots available
</div>
                <h4 className="font-semibold tracking-tight text-white" style={{}}>Get a demo of ZenOffice and start building your next success project.</h4>
                <ul className="space-y-2 text-sm text-neutral-300">
                  <li className="flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-lucide="check" className="lucide lucide-check w-4 h-4 mt-0.5 text-emerald-400"><path d="M20 6 9 17l-5-5" /></svg>
                    <span className="" style={{}}>Senior engineers and designers only — no handoffs, no fluff.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-lucide="check" className="lucide lucide-check w-4 h-4 mt-0.5 text-emerald-400"><path d="M20 6 9 17l-5-5" /></svg>
                    <span className="" style={{}}>Transparent weekly demos, metrics, and delivery plans.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-lucide="check" className="lucide lucide-check w-4 h-4 mt-0.5 text-emerald-400"><path d="M20 6 9 17l-5-5" /></svg>
                    <span className="" style={{}}>Security, accessibility, and performance baked-in.</span>
                  </li>
                </ul>
                <div className="flex items-center gap-3 pt-2 text-sm">
                  <a href="mailto:hello@relay.dev" className="inline-flex items-center gap-2 transition hover:text-amber-300 text-white" style={{}}>hi@ZenOffice.io</a>
                  <span className="text-white/20" style={{}}>•</span>
                  <a href="tel:+14155551234" className="inline-flex items-center gap-2 transition text-white hover:text-amber-300" style={{}}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-lucide="phone" className="lucide lucide-phone w-4 h-4"><path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" /></svg>
                    +1 (415) 555‑1234
                  </a>
                </div>
              </div>

              <form className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 gap-x-4 gap-y-4" id="contact-form">
                <div className="sm:col-span-1">
                  <label htmlFor="name" className="block text-xs font-medium mb-1 text-white/80" style={{}}>Your name</label>
                  <input id="name" name="name" type="text" required placeholder="Jane Doe" className="placeholder-white/40 outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-amber-300 transition text-sm w-full border rounded pt-2.5 pr-3 pb-2.5 pl-3 text-white bg-white/10 border-white/10" />
                </div>
                <div className="sm:col-span-1">
                  <label htmlFor="email" className="block text-xs font-medium mb-1 text-white/80" style={{}}>Email</label>
                  <input name="email" type="email" required placeholder="jane@company.com" className="placeholder-white/40 outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-amber-300 transition text-sm w-full border rounded pt-2.5 pr-3 pb-2.5 pl-3 text-white bg-white/10 border-white/10" id="email" />
                </div>
                <div className="sm:col-span-1">
                  <label htmlFor="company" className="block text-xs font-medium mb-1 text-white/80" style={{}}>Company</label>
                  <input id="company" name="company" type="text" placeholder="Acme Inc." className="placeholder-white/40 outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-amber-300 transition text-sm w-full border rounded pt-2.5 pr-3 pb-2.5 pl-3 text-white bg-white/10 border-white/10" />
                </div>
                <div className="sm:col-span-1">
                  <label htmlFor="project-type" className="block text-xs font-medium mb-1 text-white/80" style={{}}>Project type</label>
                  <select id="project-type" name="projectType" className="appearance-none outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-amber-300 transition text-sm w-full border rounded pt-2.5 pr-3 pb-2.5 pl-3 text-white bg-white/10 border-white/10">
                          <option className="bg-neutral-900" value="product" style={{}}>New product build</option>
                          <option className="bg-neutral-900" value="feature" style={{}}>Feature delivery</option>
                          <option className="bg-neutral-900" value="advisory" style={{}}>Advisory / audit</option>
                          <option className="bg-neutral-900" value="ai" style={{}}>AI integration</option>
                        </select>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="message" className="block text-xs font-medium mb-1 text-white/80" style={{}}>What are you building?</label>
                  <textarea name="message" rows={4} placeholder="A few sentences about your goals, timeline, and success metrics." className="placeholder-white/40 outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-amber-300 transition text-sm w-full border rounded pt-2.5 pr-3 pb-2.5 pl-3 text-white bg-white/10 border-white/10" id="message"></textarea>
                </div>
                <div className="sm:col-span-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex gap-2 text-xs items-center text-white/70">
                    <input id="nda" name="nda" type="checkbox" className="h-4 w-4 rounded focus:ring-amber-400/60 bg-white/10 border-white/20 text-amber-400" />
                    <label htmlFor="nda" className="" style={{}}>Please send an NDA</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="submit" className="inline-flex transition text-sm font-medium ring-1 rounded pt-2.5 pr-4 pb-2.5 pl-4 shadow gap-x-2 gap-y-2 items-center hover:bg-amber-300 text-neutral-900 bg-stone-50" style={{}}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-lucide="send" className="lucide lucide-send w-4 h-4"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" /><path d="m21.854 2.147-10.94 10.939" /></svg>
                            Send request
                          </button>

                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-8 pt-12">
        <div className="">
          <h4 className="text-xs uppercase tracking-[0.2em] text-white/80" style={{}}>Services</h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li className=""><a href="#work" className="transition inline-flex items-center gap-2 text-neutral-300 hover:text-white" style={{}}> Product
                Development</a></li>
            <li className=""><a href="#work" className="transition inline-flex items-center gap-2 text-neutral-300 hover:text-white" style={{}}> Frontend
                Systems</a></li>
            <li className=""><a href="#work" className="transition inline-flex items-center gap-2 text-neutral-300 hover:text-white" style={{}}> AI &amp; Agents</a>
            </li>

          </ul>
        </div>
        <div className="">
          <h4 className="text-xs uppercase tracking-[0.2em] text-white/80" style={{}}>Resources</h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li className=""><a href="#work" className="transition text-neutral-300 hover:text-white" style={{}}>Case Studies</a></li>
            <li className=""><a href="#" className="transition text-neutral-300 hover:text-white" style={{}}>Playgrounds</a></li>
            <li><a href="#" className="transition text-neutral-300 hover:text-white" style={{}}>Open Source</a></li>

          </ul>
        </div>
        <div className="">
          <h4 className="text-xs uppercase tracking-[0.2em] text-white/80" style={{}}>Company</h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li className=""><a href="#" className="transition text-neutral-300 hover:text-white" style={{}}>About</a></li>
            <li><a href="#" className="transition text-neutral-300 hover:text-white" style={{}}>Principles</a></li>
            <li><a href="#contact" className="transition text-neutral-300 hover:text-white" style={{}}>Contact</a></li>

          </ul>
        </div>
        <div className="">
          <h4 className="uppercase text-xs tracking-[0.2em] text-white/80" style={{}}>Stay in touch</h4>
          <form id="subscribe" className="mt-3 flex items-center gap-2">
            <div className="relative flex-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-lucide="mail" className="lucide lucide-mail w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/40"><path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" /><rect x="2" y="4" width="20" height="16" rx="2" /></svg>
              <input type="email" name="subscribeEmail" required placeholder="you@example.com" className="placeholder-white/40 outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-amber-300 transition text-xs w-full border rounded pt-2.5 pr-3 pb-2.5 pl-9 text-white bg-white/10 border-white/10" />
            </div>
            <button type="submit" className="inline-flex gap-2 transition text-xs font-medium ring-1 rounded pt-2.5 pr-3.5 pb-2.5 pl-3.5 gap-x-2 gap-y-2 items-center hover:bg-amber-300 hover:ring-amber-200 text-neutral-900 bg-white ring-white/80" style={{}}>

                  Join
                </button>
          </form>
          <div className="mt-4 flex items-center gap-3">
            <a href="#" aria-label="GitHub" className="inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 transition bg-white/5 ring-white/10 text-white/80 hover:text-white hover:bg-white/10">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-lucide="github" className="lucide lucide-github w-[16px] h-[16px]" data-icon-replaced="true" style={{width: "16px", height: "16px", color: "rgb(255, 255, 255)"}}><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" /><path d="M9 18c-4.51 2-5-2-7-2" /></svg>
            </a>
            <a href="#" aria-label="X" className="inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 transition bg-white/5 ring-white/10 text-white/80 hover:text-white hover:bg-white/10">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-lucide="twitter" className="lucide lucide-twitter w-[16px] h-[16px]" data-icon-replaced="true" style={{width: "16px", height: "16px", color: "rgb(255, 255, 255)"}}><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" /></svg>
            </a>
            <a href="#" aria-label="LinkedIn" className="inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 transition bg-white/5 ring-white/10 text-white/80 hover:text-white hover:bg-white/10">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-lucide="linkedin" className="lucide lucide-linkedin w-[16px] h-[16px]" data-icon-replaced="true" style={{width: "16px", height: "16px", color: "rgb(255, 255, 255)"}}><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect width="4" height="12" x="2" y="9" /><circle cx="4" cy="4" r="2" /></svg>
            </a>
          </div>
        </div>
      </div>

      <div className="mt-10 pt-6 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-white/10">
        <p className="text-sm text-white/60" style={{}}>© <span id="year" style={{}}>2025</span> Vibe coded by François Savard from END Agency</p>
        <div className="flex items-center gap-4 text-sm text-white/60">
          <a href="#" className="transition hover:text-white" style={{}}>Privacy</a>
          <span className="hidden sm:block text-white/20" style={{}}>•</span>
          <a href="#" className="transition hover:text-white" style={{}}>Terms</a>
          <span className="hidden sm:block text-white/20" style={{}}>•</span>
          <a href="#" className="transition inline-flex items-center gap-1 hover:text-white" style={{}}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-lucide="arrow-up" className="lucide lucide-arrow-up w-4 h-4"><path d="m5 12 7-7 7 7" /><path d="M12 19V5" /></svg> Back to top
          </a>
        </div>
      </div>
    </div>

    
    <div aria-hidden="true" className="pointer-events-none absolute -top-16 -right-10 h-72 w-72 rounded-full blur-3xl bg-amber-400/10"></div>
    <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -left-10 h-80 w-80 rounded-full blur-3xl bg-indigo-400/10"></div>
  </div>
</footer>

    
    

    


      </div>
    </ThemeProvider>
  );
}
