'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import MarketingHeader from "@/components/layout/marketing-header";
import MarketingFooter from "@/components/layout/marketing-footer";
import { Button } from "@/components/ui/button";
import { InteractiveGrid } from '@/components/interactive-grid';
import { Badge } from "@/components/ui/badge";
import { 
  Trophy, 
  ChevronRight,
  TrendingUp,
  Zap,
  CheckCircle2,
  MapPin,
  ArrowRight,
  Loader2,
  Sparkles,
  Building2,
  DollarSign,
  AlertTriangle,
  FileText
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { useFirestore } from '@/firebase';

const fallbackOpportunities = [
  {
    id: "accelerate-africa-2026",
    title: "Accelerate Africa Startup Programme",
    funder: "Accelerate Africa",
    amount: "$250,000 - $500,000",
    description: "Investment opportunities accelerating bold and visionary founders in the earliest stages of building global businesses. Deadline: July 25, 2026.",
    eligibility: "Africa-based, early-stage, 2+ co-founders with MVP & traction",
    applicationUrl: "https://coach.acceler8.africa"
  },
  {
    id: "moonshot-awards-2026",
    title: "Moonshot Awards Global",
    funder: "FoundersBeta",
    amount: "$10,000",
    description: "Global grant funding opportunity for young innovators and founders pushing the boundaries of what is possible.",
    eligibility: "Young innovators and founders globally",
    applicationUrl: "http://foundersbeta.com/community/startup-funding/moonshot-awards-global/"
  },
  {
    id: "abh-2026",
    title: "Africa's Business Heroes (ABH) Cash Grant",
    funder: "Africa's Business Heroes",
    amount: "Up to $1,500,000",
    description: "Open to founders from all 54 African countries operating registered, profitable, or mission-driven businesses that have been active for at least 3 years.",
    eligibility: "African founders, active for 3+ years",
    applicationUrl: "https://africabusinessheroes.org/en/"
  },
  {
    id: "heconnects-2026",
    title: "heConnects Digital Accelerator Program",
    funder: "heConnects",
    amount: "$500,000 - $1,000,000",
    description: "Focused entirely on scaling proven, high-impact tech solutions that empower and enable women across the continent. Deadline: July 8, 2026.",
    eligibility: "Tech solutions empowering women",
    applicationUrl: "https://drive.google.com/file/d/145ONFA4tCQACoGhuOMRuoNRMCIaB_GHY/view"
  },
  {
    id: "global-citizen-2026",
    title: "Global Citizen Small Business Program",
    funder: "Global Citizen",
    amount: "Variable",
    description: "Support and resources for small businesses operating globally to make a positive impact.",
    eligibility: "Small business owners globally",
    applicationUrl: "https://www.globalcitizen.org/en/programs/small-business/"
  },
  {
    id: "tef-2026",
    title: "Tony Elumelu Foundation Entrepreneurship Programme",
    funder: "Tony Elumelu Foundation (TEF)",
    amount: "₦2,500,000 ($5,000 Equity-free)",
    description: "Annual entrepreneurship programme providing mentoring, business training, and non-refundable seed capital to African startups.",
    eligibility: "African startups less than 5 years old",
    applicationUrl: "https://tefconnect.com/"
  },
  {
    id: "boi-msme-2026",
    title: "FGN/BOI MSME Intervention Funding",
    funder: "Bank of Industry (BOI)",
    amount: "Up to ₦10,000,000",
    description: "Federal government development funding and low-interest matching grants targeting micro, small, and medium enterprises across Nigeria.",
    eligibility: "Registered Nigerian MSMEs with CAC certificate",
    applicationUrl: "https://fgnboimsmeinterventionloan.boi.ng"
  },
  {
    id: "lsetf-2026",
    title: "LSETF Enterprise Loan & Grant Schemes",
    funder: "LSETF",
    amount: "₦50,000 - ₦5,000,000",
    description: "Financial grants, soft loans, and recovery funding targeting micro, small, and medium enterprises based in Lagos State.",
    eligibility: "Lagos-based registered businesses with LASSRA",
    applicationUrl: "https://lsetf.ng/"
  },
  {
    id: "smedan-portal-2026",
    title: "SMEDAN Conditional Grant Scheme",
    funder: "SMEDAN",
    amount: "₦50,000 Micro-grants",
    description: "Government intervention scheme delivering capacity building, registration assistance, and micro-grants to small business operators.",
    eligibility: "Nigerian micro-business owners",
    applicationUrl: "https://smedan.gov.ng/"
  }
];

export default function GrantsPage() {
  // Seeded with the static fallback rather than [] so the listings are in the
  // server HTML. Starting empty behind a spinner meant a crawler saw ~230 words
  // of page chrome and no grant content at all, and a visitor saw a spinner for
  // a list that was already in the bundle. The Firestore fetch below still runs
  // and takes priority; it just merges into real content instead of replacing a
  // blank.
  const [grants, setGrants] = useState<any[]>(fallbackOpportunities);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedGrant, setSelectedGrant] = useState<any | null>(null);
  const firestore = useFirestore();

  useEffect(() => {
    const fetchGrants = async () => {
      try {
        const querySnapshot = await getDocs(query(collection(firestore, 'grants'), orderBy('createdAt', 'desc')));
        const fetchedGrants = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
        
        // Merge fallback with Firestore (Firestore takes priority, avoid duplicate urls)
        const combined = [...fetchedGrants];
        const existingUrls = new Set(combined.map(g => g.applicationUrl));
        fallbackOpportunities.forEach(fb => {
          if (!existingUrls.has(fb.applicationUrl)) {
            combined.push(fb);
          }
        });
        setGrants(combined);
      } catch (error) {
        console.error("Error fetching grants:", error);
        setGrants(fallbackOpportunities);
      } finally {
        setIsLoading(false);
      }
    };
    fetchGrants();
  }, [firestore]);

  return (
    <div className="min-h-screen bg-white">
      <MarketingHeader />

      <main className="relative">
        <div className="fixed inset-0 grid-lines w-full h-full pointer-events-none z-0 opacity-[0.15]"></div>
        
        {/* Hero Section */}
        <section className="relative flex items-center justify-center px-6 pt-48 pb-20 md:py-48 overflow-hidden bg-transparent">
          <div className="absolute inset-0 z-0">
            <InteractiveGrid />
            <div className="aura-background"></div>
          </div>
          
          <div className="max-w-4xl mx-auto text-center space-y-8 relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 bg-white shadow-sm hover:shadow-md">
              <Trophy className="h-4 w-4 text-amber-500 fill-amber-500" />
              <span className="text-sm font-semibold tracking-tight text-slate-900 uppercase">Grants Directory</span>
            </div>
            
            <h1 className="text-5xl md:text-8xl font-black tracking-tight leading-[0.95] text-slate-950 font-dm-sans">
              Fuel your growth <br />
              <span className="text-slate-500">with verified grants.</span>
            </h1>
            
            <p className="text-lg md:text-2xl text-slate-600 max-w-2xl mx-auto font-medium leading-relaxed font-dm-sans">
              Zeneva aggregates and reviews legitimate business grant opportunities for Nigerian entrepreneurs. Zero scam links, zero fees.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <Button asChild size="lg" className="bg-[#1e293b] hover:bg-[#0f172a] text-white rounded-md px-8 py-4 h-auto text-base font-medium tracking-tight shadow-sm">
                <Link href="#opportunities" className="font-dm-sans">View Opportunities</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Opportunities List */}
        <section id="opportunities" className="py-24 px-6 bg-slate-50 border-t border-slate-100">
          <div className="max-w-5xl mx-auto rounded-[2rem] p-8 md:p-16">
            <div className="mb-10 text-left flex justify-between items-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-slate-900 font-dm-sans tracking-tight">Verified Grant Openings</h2>
                <p className="text-slate-500 text-sm mt-1">Direct applications for verified enterprise schemes.</p>
              </div>
            </div>
            
            {isLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-6">
                {grants.map((grant) => (
                  <div 
                    key={grant.id} 
                    className="bg-white rounded-2xl p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-8 shadow-sm border-2 border-dashed border-slate-200 hover:border-primary/30 transition-all"
                  >
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full uppercase">
                          {grant.funder}
                        </span>
                      </div>
                      <h3 className="text-xl md:text-2xl font-bold text-slate-900 font-dm-sans">
                        {grant.title}
                      </h3>
                      <p className="text-slate-600 text-[15px] leading-snug font-dm-sans max-w-2xl">
                        {grant.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-slate-400 font-dm-sans pt-1">
                        <span className="text-slate-900 font-bold">Funding: {grant.amount}</span>
                        <span>•</span>
                        <span>Target: {grant.eligibility}</span>
                      </div>
                    </div>
                    
                    <div className="shrink-0 w-full md:w-auto">
                      <Button 
                        onClick={() => setSelectedGrant(grant)}
                        className="bg-primary hover:bg-primary/90 text-white rounded-lg px-8 h-12 text-sm font-bold w-full md:w-auto"
                      >
                        Apply Directly
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

      </main>

      {/* Warning/Confirmation Dialog */}
      <Dialog open={!!selectedGrant} onOpenChange={(open) => !open && setSelectedGrant(null)}>
        <DialogContent className="sm:max-w-[450px] rounded-xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-amber-950 p-6 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <AlertTriangle className="w-16 h-16 text-amber-500" />
            </div>
            <DialogHeader className="relative z-10 text-left">
              <DialogTitle className="text-xl font-bold font-dm-sans text-white tracking-tight flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
                Leaving Zeneva
              </DialogTitle>
              <DialogDescription className="text-white/70 text-xs font-medium font-dm-sans mt-1">
                You are about to visit the official application portal for <strong className="font-bold text-white">{selectedGrant?.title}</strong>.
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="p-6 space-y-4 bg-white font-dm-sans">
            <p className="text-sm text-slate-600 leading-relaxed">
              Zeneva has verified this link as the official page of <strong className="font-bold text-slate-900">{selectedGrant?.funder}</strong>.
            </p>
            
            <div className="p-4 rounded-lg bg-red-50 border border-red-100 text-xs text-red-800 space-y-1">
              <p className="font-bold">Security Checklist:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Never pay any fee to apply for this grant.</li>
                <li>Ensure the URL in your browser matches the official domain.</li>
                <li>Do not share passwords or sensitive banking PINs.</li>
              </ul>
            </div>

            <div className="flex gap-3 pt-2">
              <Button 
                variant="outline" 
                onClick={() => setSelectedGrant(null)}
                className="flex-1 h-11 border-slate-200 text-slate-800 rounded-lg text-sm font-bold"
              >
                Cancel
              </Button>
              <Button 
                asChild
                className="flex-1 h-11 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-bold shadow-lg"
              >
                <a 
                  href={selectedGrant?.applicationUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  onClick={() => {
                    setTimeout(() => {
                      setSelectedGrant(null);
                    }, 150);
                  }}
                >
                  Proceed to Apply
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <MarketingFooter />
    </div>
  );
}
