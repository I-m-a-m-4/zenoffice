
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Cpu, 
  Activity, 
  Users, 
  CheckCircle2, 
  AlertCircle,
  Zap,
  Barcode,
  TrendingDown,
  Bell,
  Workflow,
  HelpCircle,
  ShieldCheck,
  Layout,
  Settings
} from 'lucide-react';
import MarketingHeader from '@/components/layout/marketing-header';
import MarketingFooter from '@/components/layout/marketing-footer';

export default function HelpGuidesPage() {
  const [activeTab, setActiveTab] = useState('offline-sync');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check for hash in URL to jump to section
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.replace('#', '');
      setActiveTab(hash);
    }
  }, []);

  const guides = [
    {
      id: 'offline-sync',
      title: "How to sync your inventory offline",
      description: "Learn how Zeneva maintains 100% uptime even without internet.",
      icon: <Activity className="w-5 h-5" />,
      content: (
        <div className="space-y-8">
          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 mb-8">
            <h3 className="text-xl font-bold mb-4">The Local-First Architecture</h3>
            <p className="text-slate-600 mb-4">
              Zeneva&apos;s POS environment is built on a &quot;Local-First&quot; architecture. This means your data doesn&apos;t just &quot;live in the cloud&quot;—it lives directly on your device&apos;s hardware, specialized for high-turnover retail environments in Nigeria where internet stability can be unpredictable.
            </p>
          </div>

          <section className="space-y-4">
            <h4 className="text-lg font-bold flex items-center gap-2">
              <Workflow className="w-5 h-5 text-primary" />
              How Offline Sync Works
            </h4>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-5 border border-slate-100 rounded-xl bg-white shadow-sm">
                <div className="font-bold mb-2 text-slate-900">Step 1: IndexedDB Storage</div>
                <p className="text-sm text-slate-600">Every sale, stock update, or customer addition is instantly committed to a local, encrypted database (IndexedDB) within your browser or app terminal.</p>
              </div>
              <div className="p-5 border border-slate-100 rounded-xl bg-white shadow-sm">
                <div className="font-bold mb-2 text-slate-900">Step 2: Delta Tracking</div>
                <p className="text-sm text-slate-600">Zeneva tracks &quot;Deltas&quot;—only the changes made—rather than re-uploading the entire inventory state, saving data and time.</p>
              </div>
              <div className="p-5 border border-slate-100 rounded-xl bg-white shadow-sm">
                <div className="font-bold mb-2 text-slate-900">Step 3: Background Listener</div>
                <p className="text-sm text-slate-600">A service worker continuously monitors your connection throughput. Once a stable &gt;15kbps link is detected, the &quot;Sync Handshake&quot; begins.</p>
              </div>
              <div className="p-5 border border-slate-100 rounded-xl bg-white shadow-sm">
                <div className="font-bold mb-2 text-slate-900">Step 4: Vector Clock Resolution</div>
                <p className="text-sm text-slate-600">If two cashiers update the same stock item while offline, our Vector Clock algorithm resolves the conflict based on causality and timestamps.</p>
              </div>
            </div>
          </section>

          <div className="flex items-start gap-4 p-5 bg-orange-50 border border-orange-100 rounded-xl">
            <AlertCircle className="w-6 h-6 text-orange-500 shrink-0" />
            <div>
              <div className="font-bold text-orange-900">Pro-Tip for Stability</div>
              <p className="text-sm text-orange-800">Do not clear your browser cache or perform a &quot;Factory Reset&quot; on your POS terminal until the sync icon in the top right corner turns green.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'staff-permissions',
      title: "Setting up staff permissions and roles",
      description: "Manage access levels and protect sensitive business data.",
      icon: <Users className="w-5 h-5" />,
      content: (
        <div className="space-y-8">
          <p className="text-slate-600 text-lg">
            Protect your business by granting the right access to the right people. Zeneva&apos;s RBAC (Role-Based Access Control) is designed for multi-staff retail operations.
          </p>

          <section className="space-y-6">
            <h3 className="text-xl font-bold">Standard Role Definitions</h3>
            <div className="space-y-4">
              {[
                { name: 'Administrator', access: 'Unrestricted access to financials, settings, and team management.' },
                { name: 'Store Manager', access: 'Full access to inventory, sales records, and returns, but restricted from sensitive business settings.' },
                { name: 'Cashier', access: 'Access restricted to the POS terminal, processing sales, and adding customers only.' },
                { name: 'Stock Clerk', access: 'Restricted to inventory updates, barcode scanning, and low-stock reports.' }
              ].map((role) => (
                <div key={role.name} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <div className="font-bold text-slate-900">{role.name}</div>
                    <div className="text-sm text-slate-600">{role.access}</div>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-xl font-bold">Configuring Granular Overrides</h3>
            <p className="text-slate-600">You can toggle individual technical permissions for any user, regardless of their role:</p>
            <ul className="grid md:grid-cols-2 gap-3">
              {[
                'Allow Price Overrides at Checkout',
                'Allow Processing Refunds/Returns',
                'View Profit Margins on Inventory',
                'Access Historical Multi-Store Reports',
                'Modify Tax & VAT Configurations',
                'Delete Customer Records'
              ].map((perm) => (
                <li key={perm} className="flex items-center gap-2 text-sm text-slate-700 bg-white p-3 rounded-lg border border-slate-100">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  {perm}
                </li>
              ))}
            </ul>
          </section>

          <div className="p-6 bg-slate-900 text-white rounded-2xl relative overflow-hidden">
            <Zap className="absolute -bottom-4 -right-4 w-32 h-32 text-white/5" />
            <h4 className="text-lg font-bold mb-2">Fast-Switch Security</h4>
            <p className="text-slate-300 text-sm">Use 4-digit Quick PINs to switch between staff on a single terminal. Zeneva logs every single transaction to a specific staff ID, ensuring 100% accountability for the cash drawer.</p>
          </div>
        </div>
      )
    },
    {
      id: 'ai-waste',
      title: "AI waste tracking algorithm",
      description: "Understand how our AI identifies and reduces inventory shrinkage.",
      icon: <Cpu className="w-5 h-5" />,
      content: (
        <div className="space-y-8">
          <div className="p-8 bg-black rounded-3xl text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-3xl rounded-full"></div>
            <h3 className="text-2xl font-bold mb-4">Forecasting Bias Tracking</h3>
            <p className="text-slate-400">
              Unlike traditional POS systems that just subtract sales from stock, Zeneva&apos;s AI analyzes &quot;Shrinkage causality.&quot; It identifies exactly where your money is leaking—whether it&apos;s spoilage, theft, or administrative error.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">1</div>
              <h4 className="font-bold">Historical Baseline</h4>
              <p className="text-[13px] text-slate-600 leading-relaxed">The algorithm establishes a 30-day &quot;Normal Turnover Threshold&quot; for every SKU in your store.</p>
            </div>
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold">2</div>
              <h4 className="font-bold">FIFO-Aware Decay</h4>
              <p className="text-[13px] text-slate-600 leading-relaxed">For perishables, it uses a First-In-First-Out model to alert you when items are nearing their expected &quot;Turnover Failure&quot; date.</p>
            </div>
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold">3</div>
              <h4 className="font-bold">Bias Detection</h4>
              <p className="text-[13px] text-slate-600 leading-relaxed">If stock levels drop without a matched sale or manual waste log, the AI flags it as &quot;Anomalous Shrinkage&quot; for manager review.</p>
            </div>
          </div>

          <section className="p-6 border border-slate-200 rounded-2xl">
            <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-500" />
              Reducing Waste by 22%
            </h4>
            <p className="text-slate-600 mb-4">
              Retailers using Zeneva&apos;s waste algorithm typically see a 22% reduction in spoilage within the first 60 days. The AI provides an &quot;Optimal Stock Calculation&quot;—telling you exactly how much to buy to avoid both stockouts and overstock waste.
            </p>
          </section>
        </div>
      )
    },
    {
      id: 'barcode-setup',
      title: "Connecting barcode scanners",
      description: "Quick setup guide for USB and Bluetooth scanning hardware.",
      icon: <Barcode className="w-5 h-5" />,
      content: (
        <div className="space-y-8">
          <p className="text-slate-600 text-lg">
            Accelerate your checkout speed by 300% with hardware-accelerated barcode scanning. Zeneva supports almost any standard scanner via USB or Bluetooth.
          </p>

          <div className="space-y-6">
            <div className="flex gap-4 p-5 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <div className="font-mono text-primary font-bold">USB</div>
              <div>
                <div className="font-bold text-slate-900">Plug & Play (HID Mode)</div>
                <p className="text-sm text-slate-500">Most scanners work out of the box. Zeneva listens for &quot;Rapid Fire&quot; keyboard events and instantly maps them to your SKU database.</p>
              </div>
            </div>
            <div className="flex gap-4 p-5 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <div className="font-mono text-primary font-bold">BT</div>
              <div>
                <div className="font-bold text-slate-900">Bluetooth HID Profile</div>
                <p className="text-sm text-slate-500">Pair your wireless scanner with your tablet or phone. Make sure it&apos;s set to &quot;HID Mode&quot; rather than &quot;SPP&quot; for maximum compatibility with the web POS.</p>
              </div>
            </div>
          </div>

          <section className="space-y-4">
            <h3 className="text-xl font-bold">Advanced Scanner Configuration</h3>
            <ul className="space-y-3">
              <li className="flex items-center gap-3 text-sm text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                <span>**Suffix/Prefix Stripping**: Zeneva automatically removes common scanner suffixes like &apos;Enter&apos; or &apos;Tab&apos;.</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                <span>**Scan-to-Quantity**: Double-scanning an item automatically increments its quantity in the cart.</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                <span>**Global Catalog Sync**: Scan any manufacturer barcode to automatically pull product details from our global database.</span>
              </li>
            </ul>
          </section>
        </div>
      )
    },
    {
      id: 'low-stock-alerts',
      title: "Automatic low stock alerts",
      description: "Set up reorder points and automated push notifications.",
      icon: <Bell className="w-5 h-5" />,
      content: (
        <div className="space-y-8">
          <p className="text-slate-600 text-lg">
            Never lose a sale to an empty shelf again. Zeneva&apos;s proactive alert system monitors your inventory 24/7.
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <h4 className="font-bold text-slate-900 uppercase text-xs tracking-widest">How to Enable</h4>
              <ol className="space-y-4">
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-900 shrink-0">1</span>
                  <span className="text-sm text-slate-600">Navigate to **Inventory &gt; Manage Items**.</span>
                </li>
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-900 shrink-0">2</span>
                  <span className="text-sm text-slate-600">Set the **&quot;Reorder Point&quot;** (the minimum stock level).</span>
                </li>
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-900 shrink-0">3</span>
                  <span className="text-sm text-slate-600">Enable **&quot;Push Notifications&quot;** for Mobile or Email.</span>
                </li>
              </ol>
            </div>

            <div className="bg-primary/5 rounded-2xl p-6 border border-primary/10">
              <h4 className="font-bold mb-4 text-slate-900">Smart Reordering</h4>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">
                Zeneva doesn&apos;t just tell you it&apos;s low—it can generate a **Draft Purchase Order** automatically. 
              </p>
              <div className="p-4 bg-white rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-400 mb-1 uppercase font-bold">Suggested Action</div>
                <div className="font-semibold text-slate-900">Restock 50 units</div>
                <div className="text-xs text-slate-500">Based on 7-day average sales velocity</div>
              </div>
            </div>
          </div>

          <div className="p-6 bg-slate-50 border border-slate-100 rounded-2xl">
            <h4 className="font-bold mb-2 text-slate-900">Category-Wide Thresholds</h4>
            <p className="text-slate-600 text-sm">
              Instead of setting alerts for every single item, you can set a category-wide threshold (e.g., &quot;Alert me when any item in &apos;Cold Drinks&apos; drops below 12 units&quot;). 
            </p>
          </div>
        </div>
      )
    }
  ];

  const currentGuide = guides.find(g => g.id === activeTab) || guides[0];

  return (
    <main className="min-h-screen bg-white">
      <MarketingHeader />
      
      {/* Header Section */}
      <div className="w-full flex flex-col items-center text-center gap-4 bg-primary pt-32 pb-20 px-6">
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 bg-white/20 rounded-full animate-bounce">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight">Zeneva Operations Manual</h1>
        </div>
        <p className="text-white/80 text-lg max-w-2xl mx-auto">
          Comprehensive guides and documentation for mastering the Zeneva Ecosystem.
        </p>
        <p className="text-white/60 text-sm">Last Updated: April 2026</p>
      </div>

      {/* Main Content Area */}
      <div className="w-full flex justify-center py-12">
        <div className="grid grid-cols-1 md:grid-cols-[30%_68%] gap-8 w-[92%] md:w-[85%] max-w-7xl">
          
          {/* Sticky Sidebar */}
          <aside className="md:sticky md:top-24 flex flex-col h-fit max-h-[85vh] overflow-y-auto gap-1 w-full bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
            <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Guide Collection</div>
            {guides.map((guide) => (
              <button
                key={guide.id}
                onClick={() => setActiveTab(guide.id)}
                className={`flex py-3 px-4 rounded-xl items-center gap-3 cursor-pointer transition-all duration-200 group ${
                  activeTab === guide.id 
                  ? 'bg-primary text-white shadow-md' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-primary'
                }`}
              >
                <div className={`p-2 rounded-lg transition-colors ${
                  activeTab === guide.id ? 'bg-white/20' : 'bg-slate-100'
                }`}>
                  {guide.icon}
                </div>
                <div className="flex flex-col items-start translate-y-[1px]">
                  <span className="text-sm font-bold leading-tight">{guide.title}</span>
                </div>
              </button>
            ))}

            <div className="mt-8 p-6 bg-slate-900 rounded-2xl text-white relative overflow-hidden group">
               <Zap className="absolute -bottom-4 -right-4 w-24 h-24 text-white/5 transition-transform group-hover:scale-110" />
               <div className="relative z-10">
                 <div className="text-[10px] font-bold text-primary mb-1 uppercase tracking-widest">Support</div>
                 <h4 className="font-bold text-sm mb-3">Need direct help?</h4>
                 <Link href="/contact" className="text-xs font-bold py-2 px-4 bg-white text-slate-900 rounded-lg inline-block hover:bg-primary hover:text-white transition-colors">
                   Chat Support
                 </Link>
               </div>
            </div>
          </aside>

          {/* Doc Content */}
          <div className="flex flex-col gap-6 bg-white border border-slate-100 rounded-2xl p-8 md:p-12 shadow-sm min-h-[600px]">
            <section className="space-y-6">
               <div className="flex items-center gap-4 text-slate-400 text-sm mb-2">
                 <Link href="/help-center" className="hover:text-primary transition-colors flex items-center gap-1">
                   <HelpCircle className="w-4 h-4" /> Help Center
                 </Link>
                 <span>/</span>
                 <span className="text-slate-900 font-medium">Operations Manual</span>
               </div>
               
               <h1 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
                 {currentGuide.title}
               </h1>
               
               <div className="h-px w-full bg-slate-100" />
               
               <div className="prose prose-slate max-w-none prose-headings:text-slate-900 prose-p:text-slate-600 prose-strong:text-slate-900">
                 {currentGuide.content}
               </div>

               <div className="mt-20 pt-10 border-t border-slate-100">
                 <div className="bg-slate-50 p-8 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
                    <div>
                      <h4 className="font-bold text-slate-900 mb-1">Still have questions?</h4>
                      <p className="text-sm text-slate-500">Our team is available 24/7 to help you with your Zeneva terminal.</p>
                    </div>
                    <Link href="/contact" className="px-8 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-105 transition-transform text-sm">
                      Get Expert Help
                    </Link>
                 </div>
               </div>
            </section>
          </div>

        </div>
      </div>

      <MarketingFooter />
    </main>
  );
}
