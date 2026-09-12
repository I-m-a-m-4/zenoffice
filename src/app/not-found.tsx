'use client';

import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { ArrowLeft, TriangleAlert } from 'lucide-react';
import { InteractiveGrid } from '@/components/interactive-grid';
import MarketingHeader from '@/components/layout/marketing-header';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen selection:bg-slate-900 selection:text-white bg-[#F9F8F6] relative overflow-hidden flex flex-col">
      {/* Background Patterns */}
      <div className="fixed inset-0 grid-lines w-full h-full top-[var(--tauri-title-height,0)] pointer-events-none z-0"></div>
      <div className="absolute inset-0 z-0">
        <InteractiveGrid />
        <div className="aura-background"></div>
      </div>

      <MarketingHeader />

      <main className="flex-grow flex items-center justify-center relative z-10 px-6 pt-32 pb-20">
        <div className="max-w-3xl mx-auto text-center space-y-12">
          
          {/* 404 Visual */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 bg-white mb-6 shadow-sm">
              <TriangleAlert className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-bold tracking-tight text-slate-950 uppercase">Page Not Found</span>
            </div>
            
            <h1 className="text-[12rem] md:text-[18rem] font-black leading-none tracking-tighter text-slate-950/5 select-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10">
              404
            </h1>
            
            <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-[0.95] text-slate-950 mb-6">
              This page <span className="text-slate-500">doesn&apos;t exist.</span>
            </h2>
            
            <p className="text-lg md:text-xl text-slate-600 max-w-lg mx-auto font-medium leading-relaxed">
              It looks like you found a missing link. The page you&apos;re looking for might have been moved or deleted.
            </p>
          </motion.div>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button 
              variant="outline" 
              size="lg" 
              className="h-14 px-10 rounded-2xl border-slate-200 bg-white text-slate-950 hover:bg-slate-50 hover:text-slate-950 transition-all font-bold group"
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="mr-2 h-5 w-5 transition-transform group-hover:-translate-x-1" />
              Go Back
            </Button>
          </motion.div>

          {/* Suggested Links */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="pt-8 border-t border-slate-200"
          >
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Explore Zeneva</p>
            <div className="flex flex-wrap justify-center gap-x-8 gap-y-4">
              <Link href="/" className="text-sm font-bold text-slate-950 hover:text-slate-500 transition-colors">Homepage</Link>
              <Link href="/blog" className="text-sm font-bold text-slate-950 hover:text-slate-500 transition-colors">Blog</Link>
              <Link href="/about" className="text-sm font-bold text-slate-950 hover:text-slate-500 transition-colors">About Us</Link>
              <Link href="/download" className="text-sm font-bold text-slate-950 hover:text-slate-500 transition-colors">Download App</Link>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
