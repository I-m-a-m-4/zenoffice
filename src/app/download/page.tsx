
'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Download, 
  Monitor, 
  Smartphone, 
  Apple, 
  Zap, 
  ShieldCheck, 
  LayoutDashboard,
  CheckCircle2,
  Github,
  MonitorSmartphone,
  ChevronRight,
  ArrowRight,
  Bot,
  Command,
  ExternalLink,
  Laptop,
  Box,
  Cpu,
  HardDrive,
  Infinity,
  Sparkles,
  WifiOff,
  Globe,
  Settings,
  ShieldAlert,
  Activity,
  Layers,
  Touchpad,
  Printer,
  QrCode,
  Wifi,
  Cloud,
  Terminal,
  Server,
  Lock,
  Search,
  LineChart,
  ShoppingBag,
  Clock,
  Trash2,
  Package,
  ScanBarcode,
  Tag,
  Users,
  Play
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import CinemaHeader from '@/components/layout/cinema-header';
import MarketingFooter from '@/components/layout/marketing-footer';
import { InteractiveGrid } from '@/components/interactive-grid';
import { ThemeProvider } from '@/components/theme-provider';
import { AppConfig } from '@/lib/config';
import { cn } from "@/lib/utils";
import { useI18n } from '@/context/i18n-context';



export default function DownloadPage() {
  const { t } = useI18n();
  const [version, setVersion] = useState(AppConfig.version || "2.9.2");

  useEffect(() => {
    fetch('https://api.github.com/repos/I-m-a-m-4/zeneva-releases/releases/latest')
      .then(res => res.json())
      .then(data => {
        if (data.tag_name) {
          setVersion(data.tag_name.replace(/^v/, ''));
        }
      })
      .catch(err => console.error("Failed to fetch latest version in UI:", err));
  }, []);

  const [mounted, setMounted] = useState(false);
  const androidMockups = [
    { src: "/zeneva_android_dashboard_mockup.png", label: "Dashboard" },
    { src: "/zeneva_android_inventory_mockup.png", label: "Inventory" },
    { src: "/zeneva_android_pos_mockup.png", label: "Checkout" },
    { src: "/zeneva_android_report_mockup.png", label: "Analytics" },
    { src: "/zeneva_android_storefront_mockup.png", label: "Storefront" },
    { src: "/zeneva_android_toubleshoot_mockup.png", label: "Support" }
  ];
  const [activeMockup, setActiveMockup] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveMockup((prev) => (prev + 1) % androidMockups.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const [placeholder, setPlaceholder] = useState('');
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [charIndex, setCharIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const phrases = ["Enter your work email", "Start free, stay free", "Unlock Zen AI insights", "Join 30+ smart retailers"];

  useEffect(() => {
    setMounted(true);
    const handleResize = () => {
        setIsMobile(window.innerWidth < 1024);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const timeout = setTimeout(() => {
      const currentPhrase = phrases[phraseIndex];
      if (!isDeleting && charIndex < currentPhrase.length) {
        setPlaceholder(currentPhrase.substring(0, charIndex + 1));
        setCharIndex(prev => prev + 1);
      } else if (isDeleting && charIndex > 0) {
        setPlaceholder(currentPhrase.substring(0, charIndex - 1));
        setCharIndex(prev => prev - 1);
      } else if (!isDeleting && charIndex === currentPhrase.length) {
        setTimeout(() => setIsDeleting(true), 2000);
      } else {
        setIsDeleting(false);
        setPhraseIndex((prev) => (prev + 1) % phrases.length);
        setCharIndex(0);
      }
    }, isDeleting ? 40 : 80);
    return () => clearTimeout(timeout);
  }, [charIndex, isDeleting, phraseIndex, mounted]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlay = () => {
    if (videoRef.current) {
        if (isPlaying) {
            videoRef.current.pause();
        } else {
            const playPromise = videoRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.error("Video play interrupted:", error);
                });
            }
        }
    }
  };

  const latestReleaseUrl = "https://github.com/I-m-a-m-4/zeneva-releases/releases";
  const windowsDownloadUrl = `/api/download/windows`;
  const microsoftStoreUrl = "https://apps.microsoft.com/detail/9nvn0f8njwmj?hl=en-US&gl=NG&ocid=pdpshare";
  const googlePlayStoreUrl = "https://play.google.com/store/apps/details?id=com.zeneva.app";
  const macDownloadUrlIntel = `/api/download/macos-intel`;
  const macDownloadUrlSilicon = `/api/download/macos-silicon`;
  const androidDownloadUrl = `/api/download/android`;

  const scrollToDownloads = () => {
    document.getElementById('downloads')?.scrollIntoView({ behavior: 'smooth' });
  };

  // No `if (!mounted) return null` here. It used to gate the whole page, so the
  // server sent an empty body and /download — a sitemap priority 0.9 route —
  // had no crawlable content, no h1 and no store links in the HTML. Nothing in
  // the JSX below reads client-only state, so the gate was protecting nothing.
  // If you add something that touches `window` during render, guard that one
  // subtree instead of returning null for the entire page.

  return (
    <ThemeProvider forcedTheme="light">
      <div className="min-h-screen selection:bg-slate-900 selection:text-white bg-[#fff] relative font-dm-sans">
        {/* Background Grid System */}
        <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.03]" 
             style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #000 1px, transparent 0)', backgroundSize: '32px 32px' }}>
        </div>
        
        <div className="relative z-10 w-full overflow-x-hidden">
          <CinemaHeader threshold={100} />

          <main className="min-h-screen">
            
            {/* Cinema Hero Section with Video Background */}
            <section className="relative h-screen min-h-[700px] w-full overflow-hidden flex flex-col justify-end pb-20 px-6 sm:px-12 border-b-4 border-slate-950">
                {/* Video Background Layer */}
                <div className="absolute inset-0 z-0 bg-slate-950 overflow-hidden">
                    <div className="absolute inset-0 z-10 bg-black/40" />
                    
                    {/* Desktop Video */}
                    <div className="hidden lg:block absolute inset-0">
                        <video
                            autoPlay
                            muted
                            loop
                            playsInline
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 min-w-full min-h-full w-auto h-auto object-cover opacity-50"
                        >
                            <source src="https://res.cloudinary.com/dd1czj85j/video/upload/v1777235447/cursorful-video-1773347449904_gifkam.mp4" type="video/mp4" />
                        </video>
                    </div>

                    {/* Mobile Video (Vertical Short) */}
                    <div className="block lg:hidden absolute inset-0">
                        <video
                            autoPlay
                            muted
                            loop
                            playsInline
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 min-w-full min-h-full w-auto h-auto object-cover opacity-60"
                        >
                            <source src="https://res.cloudinary.com/dd1czj85j/video/upload/v1777236783/WA_1777236748604_mp72a5.mp4" type="video/mp4" />
                        </video>
                    </div>
                </div>

                <div className="max-w-[1400px] mx-auto w-full relative z-20 flex flex-col items-center lg:flex-row lg:items-end justify-between gap-12 sm:gap-16">
                    {/* Primary Institutional Brand Mark (Bottom Left) */}
                    <div className="max-w-3xl transform lg:-translate-y-4 text-center lg:text-left w-full">
                        <motion.h1 
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                            className="text-4xl md:text-6xl lg:text-5xl font-medium tracking-tighter text-white leading-[1.1] font-display"
                        >
                            Never Lose Sale,<br />
                            Never Waste Stock
                        </motion.h1>
                    </div>

                    {/* Tactical Tactical Intelligence Card (Bottom Right) */}
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.6 }}
                            onClick={scrollToDownloads}
                            className="flex items-center bg-white p-2 rounded-[24px] overflow-hidden w-full max-w-md lg:max-w-xl group cursor-pointer border border-slate-100 shadow-2xl lg:shadow-none"
                        >
                            <div className="w-32 sm:w-48 h-24 sm:h-32 relative overflow-hidden rounded-[18px] bg-slate-100 flex-shrink-0">
                                <Image 
                                    src="/zeneva_android_pos_mockup.png" 
                                    alt="Zeneva Hardware Preview" 
                                    fill
                                    className="object-cover group-hover:scale-110 transition-transform duration-500"
                                />
                            </div>
                            <div className="px-5 sm:px-6 flex flex-col justify-center flex-grow py-1">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="text-3xl font-bold mb-1">v{version}</div>
                                        <span className="text-[8px] font-bold tracking-[0.2em] text-orange-600 uppercase">Hardware Preview</span>
                                    </div>
                                    <h4 className="text-slate-950 font-medium text-lg sm:text-xl tracking-tighter font-display leading-none">Cross-Platform Sync</h4>
                                    <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium leading-tight max-w-[180px]">Windows, Mac, and Android with instant cloud synchronization.</p>
                                </div>
                                <div className="flex items-center justify-end mt-1">
                                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-black text-white rounded-full flex items-center justify-center group-hover:bg-orange-600 transition-all duration-300">
                                        <ArrowRight className="w-4 h-4" />
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                </div>

                {/* Corner Decorative Element */}
                <div className="absolute top-0 right-0 p-12 hidden md:block">
                    <div className="w-px h-24 bg-white/20 absolute top-0 right-12" />
                    <div className="w-24 h-px bg-white/20 absolute top-12 right-0" />
                </div>
            </section>
            
            {/* INSTITUTIONAL MISSION & CORE VALUES (Emulating the provided design) */}
            <section className="py-24 px-0 md:px-6 bg-[#fcfaf9] relative overflow-hidden">
                {/* Vertical design grid line (dashed) on the far left - Thicker */}
                <div className="absolute left-[8%] top-0 bottom-0 w-[2px] border-l-2 border-dashed border-slate-300 z-0 opacity-100"></div>
                
                <div className="max-w-[1400px] mx-auto relative z-10">
                    <div className="px-6 md:px-0 lg:pl-[12%]">
                        <div className="max-w-4xl">
                            <span className="block text-[10px] font-bold text-slate-400 tracking-[0.4em] mb-6 font-display">Desktop Experience</span>
                            <h2 className="text-3xl md:text-5xl font-medium tracking-tight text-slate-950 leading-[1.1] mb-16 font-display">
                                Zeneva for PC. A definitive retail engine built for precision and massive scale.
                            </h2>
                        </div>
                    </div>

                    {/* Video Showcase Container */}
                    <div className="relative group max-w-7xl lg:pl-[12%] mx-auto lg:mx-0">
                            {/* Decorative Corner Accents - Hidden on mobile for full width */}
                            <div className="absolute -top-3 -left-3 w-8 h-8 border-t border-l border-slate-300 hidden md:block"></div>
                            <div className="absolute -bottom-3 -right-3 w-8 h-8 border-b border-r border-slate-300 hidden md:block"></div>
                            
                            <div className="relative rounded-none md:rounded-sm overflow-hidden shadow-2xl border-y md:border border-slate-200 bg-slate-900 group-hover:shadow-[0_0_50px_rgba(0,0,0,0.1)] transition-all duration-700">
                                {/* Video Surface */}
                                <div className={cn(
                                    "w-full aspect-video md:aspect-auto md:h-[600px] bg-slate-900 relative overflow-hidden",
                                    !isPlaying && "grayscale-[0.4] group-hover:grayscale-0 transition-all duration-1000"
                                )}>
                                    <video
                                        autoPlay
                                        muted
                                        loop
                                        playsInline
                                        className="absolute inset-0 w-full h-full object-cover"
                                    >
                                        <source src="https://res.cloudinary.com/dd1czj85j/video/upload/v1777235447/cursorful-video-1773347449904_gifkam.mp4" type="video/mp4" />
                                    </video>
                                </div>
                                
                                {/* Aesthetic Yellowish Overlay */}
                                <div className={cn(
                                    "absolute inset-0 transition-opacity duration-700 pointer-events-none",
                                    isPlaying ? "opacity-0" : "bg-[#f5e6d3]/40"
                                )} />

                                {/* Interactive Play Overlay (Minimalist) */}
                                {!isPlaying && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <button 
                                            onClick={togglePlay}
                                            className="bg-black text-white px-6 py-2.5 rounded-full flex items-center gap-3 hover:scale-105 active:scale-95 transition-all duration-300 shadow-2xl backdrop-blur-sm border border-white/10 text-[9px] tracking-[0.2em] font-medium font-display"
                                        >
                                            <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center">
                                                <Play className="w-3 h-3 text-black fill-current translate-x-0.5" />
                                            </div>
                                            Watch The Showcase
                                        </button>
                                    </div>
                                )}

                                {/* Floating Control (Hidden unless playing) */}
                                {isPlaying && (
                                    <button 
                                        onClick={togglePlay}
                                        className="absolute bottom-6 right-6 w-12 h-12 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/60 transition-all opacity-0 group-hover:opacity-100"
                                    >
                                        <div className="flex gap-1">
                                            <div className="w-1.5 h-4 bg-white rounded-full"></div>
                                            <div className="w-1.5 h-4 bg-white rounded-full"></div>
                                        </div>
                                    </button>
                                )}

                                {/* HUD Element Overlay */}
                                <div className="absolute bottom-6 left-6 flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                                    <div className="flex flex-col">
                                        <span className="text-[8px] font-bold text-white/40 tracking-[0.2em]">Operational Status</span>
                                        <span className="text-[10px] font-bold text-white tracking-widest">Active // Real-Time</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>



            {/* TECHNICAL SPECIFICATION SECTION (Core Retail Engine) */}
            <section className="bg-white border-y border-slate-200 overflow-hidden w-full">
                <div className="w-full border-x-[2.5px] border-dashed border-slate-200">
                    {/* Upper Header Bar */}
                    <div className="flex items-center px-12 h-16 border-b-[2.5px] border-dashed border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 tracking-[0.3em] font-display">Core Retail Engine // Zeneva v{version}</span>
                    </div>

                    <div className="grid lg:grid-cols-2">
                        {/* Left Column: Data & Narrative */}
                        <div className="order-last lg:order-none p-12 lg:p-24 border-r-[0px] lg:border-r-[2.5px] border-dashed border-slate-200 space-y-12">
                            <div className="space-y-6">
                                <div className="w-12 h-12 bg-slate-50 border border-slate-200 flex items-center justify-center rounded-lg shadow-sm">
                                    <Package className="w-6 h-6 text-slate-950" />
                                </div>
                                <div className="space-y-4">
                                    <h2 className="text-2xl md:text-6xl font-medium tracking-tight text-slate-950 font-display">Zeneva Desktop</h2>
                                    <p className="text-slate-500 font-medium text-sm md:text-lg leading-relaxed max-w-2xl">
                                        Zeneva is a multi-store retail platform built for high-volume transactions at busy retail locations such as supermarkets, shopping malls, and large-scale boutique outlets.
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-4">
                                    <a href={microsoftStoreUrl} target="_blank" rel="noopener noreferrer" className="inline-block transition-transform hover:scale-[1.02] active:scale-[0.98] rounded-[2px] overflow-hidden">
                                        <svg className="w-[180px] h-[54px] block" viewBox="0 0 180 54" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            {/* Background */}
                                            <rect width="180" height="54" rx="2" fill="#f1dfd1" />
                                            
                                            {/* Shopping Bag Icon */}
                                            <g transform="translate(14, 11)">
                                                {/* Handle */}
                                                <path d="M12 8C12 5.23858 14.2386 3 17 3C19.7614 3 22 5.23858 22 8" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" />
                                                {/* Bag Body */}
                                                <rect x="8" y="7" width="18" height="19" rx="3" fill="#F2F2F2" />
                                                
                                                {/* Microsoft 4-color grid */}
                                                <g transform="translate(12, 12)">
                                                    {/* Top Left: Red */}
                                                    <rect x="1" y="1" width="4.2" height="4.2" fill="#F25022" />
                                                    {/* Top Right: Green */}
                                                    <rect x="5.8" y="1" width="4.2" height="4.2" fill="#7FBA00" />
                                                    {/* Bottom Left: Blue */}
                                                    <rect x="1" y="5.8" width="4.2" height="4.2" fill="#00A4EF" />
                                                    {/* Bottom Right: Yellow */}
                                                    <rect x="5.8" y="5.8" width="4.2" height="4.2" fill="#FFB900" />
                                                </g>
                                            </g>
                                            
                                            {/* Text */}
                                            <text x="48" y="21" fill="#1e293b" fontFamily="system-ui, -apple-system, sans-serif" fontSize="9.5" fontWeight="400" letterSpacing="0.1">{t('landing.downloadFrom')}</text>
                                            <text x="48" y="38" fill="#1e293b" fontFamily="system-ui, -apple-system, sans-serif" fontSize="16" fontWeight="600" letterSpacing="-0.2">{t('landing.microsoftStore')}</text>
                                        </svg>
                                    </a>
                                </div>
                            </div>

                            {/* Spec Table - Aligned with Image Reference */}
                            <div className="space-y-0 border-t-[2.5px] border-dashed border-slate-200 pt-8 mt-12">
                                {[
                                    { k: "Software Framework", v: "Native Performance" },
                                    { k: "Offline Data Storage", v: "Secure Local Database" },
                                    { k: "Checkout Speed", v: "< 10ms Transaction" },
                                    { k: "Processor Optimization", v: "High-Speed Execution" },
                                    { k: "Binary Size (Win)", v: "113 MB" },
                                    { k: "Data Encryption", v: "Enterprise Grade" },
                                    { k: "Inventory Sync Rate", v: "Instant Updates" }
                                ].map((spec, i) => (
                                    <div key={i} className="flex justify-between items-center py-4 border-b border-dashed border-slate-200">
                                        <span className="text-[12px] font-bold text-slate-950 tracking-tight font-display">{spec.k}:</span>
                                        <span className="text-[12px] font-medium text-slate-500 tracking-tight font-dm-sans text-right pl-4">{spec.v}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right Column: Visual Mockup (Desktop Cream Station) */}
                        <div className="order-first lg:order-none bg-[#fdfbf6] flex items-center justify-center p-12 lg:p-24 relative overflow-hidden border-b-[2.5px] lg:border-b-0 border-dashed border-slate-200">
                            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #d4a373 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
                            
                            <div className="relative w-full max-w-2xl group">
                                <div className="relative z-10 transition-transform duration-500 group-hover:-translate-y-2">
                                    {/* Screen Layer - Cream Frame */}
                                    <div className="relative bg-slate-900 rounded-xl p-3 border-[8px] border-[#e9dcc9] shadow-2xl">
                                        <div className="aspect-video bg-slate-900 rounded-sm overflow-hidden relative">
                                            <video
                                                autoPlay
                                                muted
                                                loop
                                                playsInline
                                                className="absolute inset-0 w-full h-full object-cover"
                                            >
                                                <source src="https://res.cloudinary.com/dd1czj85j/video/upload/v1777235447/cursorful-video-1773347449904_gifkam.mp4" type="video/mp4" />
                                            </video>
                                        </div>
                                    </div>
                                    {/* Desktop Stand Layer */}
                                    <div className="w-full flex flex-col items-center">
                                        <div className="w-32 h-16 bg-[#dec9af] transform perspective-1000 rotateX-30 rounded-t-lg origin-top"></div>
                                        <div className="w-48 h-3 bg-[#c9b398] rounded-full -mt-2"></div>
                                    </div>
                                </div>
                                {/* Shadow/Glow */}
                                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-[80%] h-12 bg-[#d4a373]/10 blur-3xl rounded-full"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>



            {/* macOS TECHNICAL SECTION */}
            <section className="bg-white border-b border-slate-200 overflow-hidden w-full">
                <div className="w-full border-x-[2.5px] border-dashed border-slate-200">
                    {/* Upper Header Bar */}
                    <div className="flex items-center px-12 h-16 border-b-[2.5px] border-dashed border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 tracking-[0.3em] font-display">Precision Workstation // Apple Silicon</span>
                    </div>

                    <div className="grid lg:grid-cols-2">
                        {/* Left Column: Data & Narrative */}
                        <div className="order-last lg:order-none p-12 lg:p-24 border-r-[0px] lg:border-r-[2.5px] border-dashed border-slate-200 space-y-12">
                            <div className="space-y-6">
                                <div className="w-12 h-12 bg-slate-50 border border-slate-200 flex items-center justify-center rounded-lg shadow-sm">
                                    <Apple className="w-6 h-6 text-slate-950" />
                                </div>
                                <div className="space-y-4">
                                    <h2 className="text-2xl md:text-6xl font-medium tracking-tight text-slate-950 font-display">Zeneva macOS</h2>
                                    <p className="text-slate-500 font-medium text-sm md:text-lg leading-relaxed max-w-2xl">
                                        Native M-series optimization for the most demanding administrative and analytics tasks. Tack-sharp UI for high-resolution Studio Displays and efficient unified memory management.
                                    </p>
                                </div>
                                <div className="text-slate-500 text-sm font-medium italic mt-2">
                                    Available on the Mac App Store soon.
                                </div>
                            </div>

                            {/* Spec Table */}
                            <div className="space-y-0 border-t-[2.5px] border-dashed border-slate-200 pt-8 mt-12">
                                {[
                                    { k: "Binary Architecture", v: "Universal / Silicon" },
                                    { k: "Memory Model", v: "Unified Optimization" },
                                    { k: "Interface Quality", v: "Retina Display P3" },
                                    { k: "Graphics Core", v: "Metal Accelerated" },
                                    { k: "Build Integrity", v: "Apple Notarized" },
                                    { k: "Binary Size (macOS)", v: "116 MB" },
                                    { k: "System Security", v: "Sandboxed Enclave" }
                                ].map((spec, i) => (
                                    <div key={i} className="flex justify-between items-center py-4 border-b border-dashed border-slate-200">
                                        <span className="text-[12px] font-bold text-slate-950 tracking-tight font-display">{spec.k}:</span>
                                        <span className="text-[12px] font-medium text-slate-500 tracking-tight font-dm-sans text-right pl-4">{spec.v}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right Column: Visual Mockup (Desktop Cream Station) */}
                        <div className="order-first lg:order-none bg-[#fdfbf6] flex items-center justify-center p-12 lg:p-24 relative overflow-hidden border-b-[2.5px] lg:border-b-0 border-dashed border-slate-200">
                            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #d4a373 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
                            
                            <div className="relative w-full max-w-2xl group">
                                <div className="relative z-10 transition-transform duration-500 group-hover:-translate-y-2">
                                    {/* Screen Layer - Cream Frame */}
                                    <div className="relative bg-slate-900 rounded-xl p-3 border-[8px] border-[#e9dcc9] shadow-2xl">
                                        <div className="aspect-video bg-slate-900 rounded-sm overflow-hidden relative">
                                            <video
                                                autoPlay
                                                muted
                                                loop
                                                playsInline
                                                className="absolute inset-0 w-full h-full object-cover"
                                            >
                                                <source src="https://res.cloudinary.com/dd1czj85j/video/upload/v1777235447/cursorful-video-1773347449904_gifkam.mp4" type="video/mp4" />
                                            </video>
                                        </div>
                                    </div>
                                    {/* Desktop Stand Layer */}
                                    <div className="w-full flex flex-col items-center">
                                        <div className="w-32 h-16 bg-[#dec9af] transform perspective-1000 rotateX-30 rounded-t-lg origin-top"></div>
                                        <div className="w-48 h-3 bg-[#c9b398] rounded-full -mt-2"></div>
                                    </div>
                                </div>
                                {/* Shadow/Glow */}
                                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-[80%] h-12 bg-[#d4a373]/10 blur-3xl rounded-full"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>



            {/* Android TECHNICAL SECTION */}
            <section className="bg-white border-b border-slate-200 overflow-hidden w-full">
                <div className="w-full border-x-[2.5px] border-dashed border-slate-200">
                    {/* Upper Header Bar */}
                    <div className="flex items-center px-12 h-16 border-b-[2.5px] border-dashed border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 tracking-[0.3em] font-display">Mobile Command // Android OS</span>
                    </div>

                    <div className="grid lg:grid-cols-2">
                        {/* Left Column: Data & Narrative */}
                        <div className="order-last lg:order-none p-12 lg:p-24 border-r-[0px] lg:border-r-[2.5px] border-dashed border-slate-200 space-y-12">
                            <div className="space-y-6">
                                <div className="w-12 h-12 bg-orange-50 border border-orange-100 flex items-center justify-center rounded-lg shadow-sm">
                                    <Smartphone className="w-6 h-6 text-orange-600" />
                                </div>
                                <div className="space-y-4">
                                    <h2 className="text-2xl md:text-6xl font-medium tracking-tight text-slate-950 font-display">Zeneva Android</h2>
                                    <p className="text-slate-500 font-medium text-sm md:text-lg leading-relaxed max-w-2xl">
                                        Tactical mobile kit. Direct APK installation for smartphones and portable POS terminals. Zeneva on Android isn't just a companion app—it's the full engine in your pocket.
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-4">
                                    <a href={googlePlayStoreUrl} target="_blank" rel="noopener noreferrer" className="inline-block transition-transform hover:scale-[1.02] active:scale-[0.98] rounded-[2px] overflow-hidden">
                                        <svg className="w-[180px] h-[54px] block" viewBox="0 0 180 54" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            {/* Background */}
                                            <rect x="0.5" y="0.5" width="179" height="53" rx="2" fill="#f1dfd1" stroke="#d8c5b7" strokeWidth="1" />
                                            
                                            {/* Google Play Logo */}
                                            <g transform="translate(14, 11)">
                                                <path d="M2.5 1.76c-.35.37-.55.94-.55 1.66v25.16c0 .72.2 1.29.55 1.66l.08.08 13.98-13.98v-.32L3.08 1.68l-.58.08z" fill="#3bccff" />
                                                <path d="M20.61 14.18l-3.52-2.01-3.52 3.52 3.52 3.52 3.52-2.01c1.01-.58 1.01-1.52 0-2.1z" fill="#ffd300" />
                                                <path d="M13.57 15.69l3.52-3.52L3.08 1.68c-.69-.39-1.56-.31-2.12.25l12.61 12.61v1.15z" fill="#55ea47" />
                                                <path d="M13.57 16.31l-12.61 12.61c.56.56 1.43.64 2.12.25l13.98-8.01-3.52-3.52-3.52 3.52v-4.85z" fill="#ff3349" />
                                            </g>
                                            
                                            {/* Text */}
                                            <text x="48" y="21" fill="#1e293b" fontFamily="system-ui, -apple-system, sans-serif" fontSize="9.5" fontWeight="500" letterSpacing="0.05em">GET IT ON</text>
                                            <text x="48" y="38" fill="#1e293b" fontFamily="system-ui, -apple-system, sans-serif" fontSize="19" fontWeight="600" letterSpacing="-0.2px">Google Play</text>
                                        </svg>
                                    </a>
                                </div>
                            </div>

                            {/* Spec Table */}
                            <div className="space-y-0 border-t-[2.5px] border-dashed border-slate-200 pt-8 mt-12">
                                {[
                                    { k: "Binary Architecture", v: "ARM64 / v7a" },
                                    { k: "Minimum OS", v: "Android 8.0+" },
                                    { k: "Sync Protocol", v: "Hub WebSocket" },
                                    { k: "Offline Storage", v: "SQLite Encryption" },
                                    { k: "Scanning SDK", v: "Multi-Barcode AI" },
                                    { k: "Update Channel", v: "Direct OTA" },
                                    { k: "Binary Size (Android)", v: "132 MB" }
                                ].map((spec, i) => (
                                    <div key={i} className="flex justify-between items-center py-4 border-b border-dashed border-slate-200">
                                        <span className="text-[12px] font-bold text-slate-950 tracking-tight font-display">{spec.k}:</span>
                                        <span className="text-[12px] font-medium text-slate-500 tracking-tight font-dm-sans text-right pl-4">{spec.v}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right Column: Visual Mockup (Advanced Slider) */}
                        <div className="order-first lg:order-none bg-orange-50/30 flex items-center justify-center p-12 lg:p-24 relative overflow-hidden border-b-[2.5px] lg:border-b-0 border-dashed border-slate-200 min-h-[600px]">
                            <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #ea580c 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
                            
                            <div className="relative w-full max-w-[320px] group">
                                <AnimatePresence mode="wait">
                                    <motion.div 
                                        key={activeMockup}
                                        initial={{ x: 40, opacity: 0, scale: 0.9 }}
                                        animate={{ x: 0, opacity: 1, scale: 1 }}
                                        exit={{ x: -40, opacity: 0, scale: 0.9 }}
                                        transition={{ duration: 0.6, ease: "easeOut" }}
                                        className="relative z-10 transition-transform duration-500 group-hover:-translate-y-4"
                                    >
                                        <Image 
                                            src={androidMockups[activeMockup].src} 
                                            alt={androidMockups[activeMockup].label} 
                                            width={400} 
                                            height={800} 
                                            className="w-full h-auto drop-shadow-2xl"
                                            priority
                                        />
                                    </motion.div>
                                </AnimatePresence>
                                
                                {/* Badge for active module */}
                                <motion.div 
                                    key={`badge-${activeMockup}`}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white border border-orange-100 px-4 py-2 rounded-full shadow-lg flex items-center gap-2 whitespace-nowrap z-30"
                                >
                                    <div className="w-2 h-2 rounded-full bg-orange-600 animate-pulse" />
                                    <span className="text-[10px] font-bold tracking-widest text-slate-950 uppercase">
                                        {androidMockups[activeMockup].label} Module
                                    </span>
                                </motion.div>

                                {/* Shadow/Glow */}
                                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-[80%] h-12 bg-orange-600/10 blur-3xl rounded-full"></div>
                                
                                {/* Slider Navigation Dots */}
                                <div className="flex justify-center gap-2 mt-12">
                                    {androidMockups.map((_, i) => (
                                        <button 
                                            key={i}
                                            onClick={() => setActiveMockup(i)}
                                            className={cn(
                                                "w-1.5 h-1.5 rounded-full transition-all duration-300",
                                                activeMockup === i ? "w-6 bg-orange-600" : "bg-orange-200 hover:bg-orange-300"
                                            )}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>



            {/* NEW SHOWCASE 2: Hardware Protocol */}
            <section className="py-24 px-6 bg-white border-y border-slate-100">
                <div className="max-w-7xl mx-auto">
                    <div className="grid lg:grid-cols-2 gap-20 items-center">
                        <div className="space-y-10">
                            <div className="inline-flex items-center gap-3">
                                <div className="w-3 h-3 bg-slate-950"></div>
                                <span className="font-semibold tracking-widest text-xs font-dm-sans">Peripheral Force</span>
                            </div>
                            <h2 className="text-4xl md:text-7xl font-medium tracking-tighter leading-[0.9] font-display">
                                Wired for <br />
                                <span className="text-slate-400">Retail Reality.</span>
                            </h2>
                            <p className="text-slate-600 font-medium text-lg leading-relaxed max-w-xl">
                                Retail isn't just software. It's hardware. Zeneva talks directly to your printers and scanners without mid-layer drivers that break during updates.
                            </p>
                            <div className="space-y-6 pt-4">
                                {[
                                    { icon: Printer, t: "Direct Thermal Printing", d: "High-speed printing for 58mm and 80mm rolls via USB or Network." },
                                    { icon: ScanBarcode, t: "Universal Scanning", d: "Wired and Bluetooth laser scanners supported with zero configuration." },
                                    { icon: Command, t: "Cash Drawer Relay", d: "Automatic drawer opening triggered by successful POS finalization." }
                                ].map((item, i) => (
                                    <div key={i} className="flex gap-4 p-6 border-2 border-dashed border-slate-200 group hover:bg-slate-50 transition-colors">
                                        <item.icon className="w-6 h-6 text-slate-900 mt-1" />
                                        <div>
                                            <h5 className="font-medium text-sm tracking-widest mb-1 font-display transition-colors group-hover:text-orange-600">{item.t}</h5>
                                            <p className="text-xs text-slate-500 font-medium">{item.d}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="relative">
                            <div className="p-3 bg-white rounded-2xl shadow-xl border-2 border-dashed border-slate-200 overflow-hidden relative group">
                                <div className="absolute top-6 right-6 h-4 w-4 border-t-2 border-r-2 border-slate-300 z-10 opacity-50"></div>
                                <div className="absolute bottom-6 left-6 h-4 w-4 border-b-2 border-l-2 border-slate-300 z-10 opacity-50"></div>
                                <Image 
                                    src="/zeneva_hardware_protocol_showcase.png" 
                                    alt="Hardware Integration Showcase" 
                                    width={800} 
                                    height={600} 
                                    className="w-full h-auto rounded-xl transition-transform duration-700 group-hover:scale-105"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </section>











            {/* STORE BADGES - DOWNLOAD FROM YOUR STORE */}
            <section id="downloads" className="py-24 px-6 bg-slate-950 relative overflow-hidden">
                {/* Background texture */}
                <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
                     style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '32px 32px' }} />
                <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-orange-600/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 pointer-events-none" />

                <div className="max-w-5xl mx-auto relative z-10 text-center">
                    <span className="block text-[10px] font-bold text-slate-400 tracking-[0.4em] mb-6 font-display uppercase">Available On All Platforms</span>
                    <h2 className="text-4xl md:text-6xl font-medium tracking-tighter text-white leading-tight mb-6 font-display">
                        Download Zeneva Today
                    </h2>
                    <p className="text-slate-400 text-lg font-medium max-w-2xl mx-auto mb-16 leading-relaxed">
                        Available on the Microsoft Store for Windows desktops and Google Play Store for Android devices. Start free instantly — no trial, no credit card required.
                    </p>

                    {/* Store Badges */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6">

                        {/* Microsoft Store Badge */}
                        <a
                            href="https://apps.microsoft.com/store/detail/9NVN0F8NJWMJ?cid=DevShareMCLPCS"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-center gap-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 px-8 py-5 rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] min-w-[260px]"
                        >
                            {/* Microsoft Logo */}
                            <div className="flex-shrink-0">
                                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <rect x="0" y="0" width="15" height="15" fill="#F25022" />
                                    <rect x="17" y="0" width="15" height="15" fill="#7FBA00" />
                                    <rect x="0" y="17" width="15" height="15" fill="#00A4EF" />
                                    <rect x="17" y="17" width="15" height="15" fill="#FFB900" />
                                </svg>
                            </div>
                            <div className="text-left">
                                <div className="text-[10px] font-medium text-slate-400 tracking-widest uppercase mb-0.5">{t('landing.downloadFrom')}</div>
                                <div className="text-white font-semibold text-lg leading-tight tracking-tight">{t('landing.microsoftStore')}</div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-white group-hover:translate-x-1 transition-all ml-auto" />
                        </a>

                        {/* Google Play Store Badge */}
                        <a
                            href="https://play.google.com/store/apps/details?id=com.zeneva.app"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-center gap-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 px-8 py-5 rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] min-w-[260px]"
                        >
                            {/* Google Play Logo */}
                            <div className="flex-shrink-0">
                                <svg width="28" height="32" viewBox="0 0 28 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M1.5 0.5C0.7 0.9 0 1.8 0 3V29C0 30.2 0.7 31.1 1.5 31.5L15.5 17.5L1.5 0.5Z" fill="#EA4335"/>
                                    <path d="M24 12L20 9.8L15.5 14L20 18.2L24 16C25.5 15.2 25.5 12.8 24 12Z" fill="#FBBC04"/>
                                    <path d="M1.5 31.5C2.4 31.9 3.5 31.7 4.5 31.1L20 18.2L15.5 13.7L1.5 31.5Z" fill="#34A853"/>
                                    <path d="M4.5 0.9C3.5 0.3 2.4 0.1 1.5 0.5L15.5 16.3L20 11.8L4.5 0.9Z" fill="#4285F4"/>
                                </svg>
                            </div>
                            <div className="text-left">
                                <div className="text-[10px] font-medium text-slate-400 tracking-widest uppercase mb-0.5">{t('landing.getItOn')}</div>
                                <div className="text-white font-semibold text-lg leading-tight tracking-tight">{t('landing.googlePlay')}</div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-white group-hover:translate-x-1 transition-all ml-auto" />
                        </a>

                        {/* Direct Windows Download */}
                        <a
                            href="/api/download/windows"
                            className="group flex items-center gap-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 px-8 py-5 rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] min-w-[260px]"
                        >
                            <div className="flex-shrink-0 w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                                <Monitor className="w-4 h-4 text-white" />
                            </div>
                            <div className="text-left">
                                <div className="text-[10px] font-medium text-slate-400 tracking-widest uppercase mb-0.5">Direct Installer</div>
                                <div className="text-white font-semibold text-lg leading-tight tracking-tight">Windows .exe</div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-white group-hover:translate-x-1 transition-all ml-auto" />
                        </a>
                    </div>

                    {/* Trust Indicators */}
                    <div className="mt-16 pt-12 border-t border-white/10 flex flex-wrap items-center justify-center gap-8 text-slate-500">
                        {[
                            { icon: ShieldCheck, label: "Verified Publisher" },
                            { icon: Zap, label: "Instant Activation" },
                            { icon: Globe, label: "Works Offline" },
                            { icon: Cloud, label: "Auto Updates" },
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <item.icon className="w-4 h-4" />
                                <span className="text-xs font-medium tracking-widest uppercase">{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <MarketingFooter />
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}
