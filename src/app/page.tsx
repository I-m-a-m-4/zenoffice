import { Metadata } from 'next';
import { InteractiveGrid } from '@/components/interactive-grid';

export const metadata: Metadata = {
    alternates: {
        canonical: '/'
    }
};

import {
    ShoppingCart,
    ArrowRight,
    Bot,
    BrainCircuit,
    Check,
    Globe,
    Monitor,
    Package,
    Users,
    BarChart2,
    UserCog,
    WifiOff,
    Download,
    ShieldCheck,
    Lock,
    Shield,
    Server,
    Clock,
    InfinityIcon,
    FileText,
    ScanBarcode,
    Printer,
    Workflow,
    TrendingUp,
    Store,
    DollarSign,
    Trophy,
    Box,
    Database,
    Shirt,
    Coffee,
    BookOpen,
    Sparkles,
    Smartphone,
    Search,
    Tag,
    Wallet,
    PieChart
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import MarketingHeader from '@/components/layout/marketing-header';
import MarketingFooter from '@/components/layout/marketing-footer';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { MarqueeSection } from '@/components/marquee-section';
import { ThemeProvider } from '@/components/theme-provider';
// This page exports `metadata`, so it stays a server component. `<T>` is a
// client leaf that reads the active locale — see src/components/i18n/t.tsx.
import { T } from '@/components/i18n/t';
import WhatsappFab from '@/components/home/whatsapp-fab';

// Client Components
import { HeroInputForm } from '@/components/home/hero-input-form';
import { DashboardCarousel } from '@/components/home/dashboard-carousel';
import { ZenAIInsights } from '@/components/home/zen-ai-insights';
import { PricingPlans } from '@/components/home/pricing-plans';
import { SecurityBadges } from '@/components/home/security-badges';
import { NativeRedirectHandler } from '@/components/home/native-redirect-handler';

// `question`/`answer` stay English on purpose: they are what the FAQPage
// JSON-LD below publishes to crawlers, and the static export is prerendered in
// English. `qKey`/`aKey` are what the visitor actually reads.
const faqItems = [
    {
        qKey: "landing.faq1q",
        aKey: "landing.faq1a",
        question: "Who is Zeneva built for?",
        answer: "Zeneva is designed for serious retail businesses — mini-marts, pharmacies, boutiques, supermarkets, and online stores managing real inventory, real volume, and real money."
    },
    {
        qKey: "landing.faq2q",
        aKey: "landing.faq2a",
        question: "What makes Zeneva different from other inventory tools?",
        answer: "Most tools report the past. Zeneva predicts the future. Zen AI analyzes demand patterns and recommends exact stock decisions to maximize profit."
    },
    {
        qKey: "landing.faq3q",
        aKey: "landing.faq3a",
        question: "Does Zeneva work without internet?",
        answer: "Yes. POS works fully offline. All transactions are queued and synced automatically once connectivity returns — no sales are ever lost."
    },
    {
        qKey: "landing.faq4q",
        aKey: "landing.faq4a",
        question: "How accurate are Zen AI predictions?",
        answer: "Zen AI improves continuously using your historical sales, time-based demand, and customer behavior. Accuracy increases as your data grows."
    },
    {
        qKey: "landing.faq5q",
        aKey: "landing.faq5a",
        question: "Can I manage multiple business locations?",
        answer: "Yes. Zeneva’s Enterprise Plus plan allows you to sync stock levels, track staff movements, and view unified analytics across multiple storefronts or warehouses from one dashboard."
    },
    {
        qKey: "landing.faq6q",
        aKey: "landing.faq6a",
        question: "Does Zeneva support international payments?",
        answer: "Yes! Zeneva supports international payments via Paystack. You can accept USD and other global currencies from customers anywhere in the world on our Pro and Enterprise plans."
    },
    {
        qKey: "landing.faq7q",
        aKey: "landing.faq7a",
        question: "Can Zeneva replace my existing POS or inventory system?",
        answer: "Yes. Zeneva is a full operating system — POS, inventory, storefront, CRM, and analytics in one unified platform."
    },
    {
        qKey: "landing.faq8q",
        aKey: "landing.faq8a",
        question: "Is my data secure?",
        answer: "Yes. All data is encrypted, isolated per business, and protected using enterprise-grade cloud infrastructure."
    },
    {
        qKey: "landing.faq9q",
        aKey: "landing.faq9a",
        question: "How long does setup take?",
        answer: "Most businesses are live within hours — products can be imported, staff invited, and selling started the same day."
    }
];

// `name` is kept for the image `alt` (SEO); `nameKey`/`descKey` are displayed.
const businessTypes = [
    { name: 'Fashion & Clothing', nameKey: 'landing.biz1t', descKey: 'landing.biz1d', imageId: 'boutique-store', description: 'Manage your unique collection with style and ease.', link: '/use-cases' },
    { name: 'Jewellery Store', nameKey: 'landing.biz2t', descKey: 'landing.biz2d', imageId: 'jewelry-store', description: 'Track every precious item from display to sale.', link: '/use-cases' },
    { name: 'Furniture Store', nameKey: 'landing.biz3t', descKey: 'landing.biz3d', imageId: 'furniture-store', description: 'From sofas to side tables, keep your large inventory in order.', link: '/use-cases' },
    { name: 'Electronic Shop', nameKey: 'landing.biz4t', descKey: 'landing.biz4d', imageId: 'electronics-store', description: 'Handle serial numbers and complex inventory with ease.', link: '/use-cases' },
    { name: 'Cafe Shop', nameKey: 'landing.biz5t', descKey: 'landing.biz5d', imageId: 'cafe-shop', description: 'Serve up loyalty and track your beans with precision.', link: '/use-cases' },
    { name: 'Book Store', nameKey: 'landing.biz6t', descKey: 'landing.biz6d', imageId: 'book-store', description: 'Organize your titles, authors, and editions seamlessly.', link: '/use-cases' },
    { name: 'Skin Care', nameKey: 'landing.biz7t', descKey: 'landing.biz7d', imageId: 'skin-care', description: 'Manage batches, expiry dates, and product variations.', link: '/use-cases' },
    { name: 'Restaurant', nameKey: 'landing.biz8t', descKey: 'landing.biz8d', imageId: 'restaurant', description: 'Track ingredients, manage menus, and speed up orders.', link: '/use-cases' },
];

export default function Home() {
    const microsoftStoreUrl = "https://apps.microsoft.com/detail/9nvn0f8njwmj?hl=en-US&gl=NG&ocid=pdpshare";
    const googlePlayStoreUrl = "https://play.google.com/store/apps/details?id=com.zeneva.app&hl=en-US&ah=8ZdJB3DBf5hWEO6U2hBOws2DuyY";

    const structuredData = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Organization",
                "@id": "https://zeneva.space/#organization",
                "name": "Zeneva",
                "url": "https://zeneva.space",
                "logo": "https://zeneva.space/logo.png",
                "sameAs": [
                    "https://twitter.com/zenevahq",
                    "https://linkedin.com/company/zeneva"
                ]
            },
            {
                "@type": "SoftwareApplication",
                "@id": "https://zeneva.space/#software",
                "name": "Zeneva Retail OS",
                "applicationCategory": "BusinessApplication",
                "operatingSystem": "Windows, Web",
                "description": "The borderless retail operating system unifying inventory management, offline-capable POS, sales analytics, and multi-currency (USD/NGN) payments.",
                "publisher": {
                    "@id": "https://zeneva.space/#organization"
                },
                "featureList": [
                    "Offline-capable Point of Sale (POS)",
                    "AI-driven Inventory Management and Forecasting",
                    "Multi-location Store Management",
                    "Multi-currency Checkout (USD, NGN)",
                    "Real-time Sales Analytics",
                    "Customizable Online Storefront"
                ],
                "offers": {
                    "@type": "Offer",
                    "price": "10000",
                    "priceCurrency": "NGN",
                    "category": "Subscription"
                },
                "aggregateRating": {
                    "@type": "AggregateRating",
                    "ratingValue": "4.8",
                    "reviewCount": "220"
                }
            },
            {
                "@type": "WebPage",
                "@id": "https://zeneva.space/#webpage",
                "url": "https://zeneva.space",
                "name": "Zeneva | Advanced Retail POS & Inventory Management System",
                "about": {
                    "@id": "https://zeneva.space/#software"
                }
            },
            {
                "@type": "FAQPage",
                "@id": "https://zeneva.space/#faq",
                "mainEntity": faqItems.map(item => ({
                    "@type": "Question",
                    "name": item.question,
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": item.answer
                    }
                }))
            }
        ]
    };

    return (
        <ThemeProvider forcedTheme="light">
            <div className="h-full overflow-y-auto w-full antialiased overflow-x-hidden text-slate-900 bg-[#F9F8F6] relative">
                <div className="fixed grid-lines w-full h-full top-[var(--tauri-title-height,0)] right-0 left-0 pointer-events-none z-0 opacity-[0.15]"></div>
                <div className="relative z-10">
                    <script
                        type="application/ld+json"
                        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
                    />
                    <NativeRedirectHandler />
                    <MarketingHeader />

                    {/* Main Hero Section */}
                    <main className="bg-transparent lg:pt-48 lg:pb-48 w-full max-w-none mr-auto ml-auto pt-40 pr-6 pb-32 pl-6 relative overflow-hidden">
                        <InteractiveGrid />
                        <div className="aura-background"></div>
                        <div className="grid lg:grid-cols-2 max-w-7xl mr-auto ml-auto items-center">

                            {/* Left Column: Copy & Form */}
                            <div className="max-w-xl z-10 mx-auto lg:mx-0 text-center lg:text-start">
                                <p className="uppercase text-xs font-semibold tracking-tight font-dm-sans mb-6 text-slate-900"><T k="landing.heroEyebrow" /></p>
                                <h1 className="leading-[0.95] lg:text-6xl xl:text-7xl text-4xl md:text-5xl font-medium text-foreground tracking-tighter font-display mb-8">
                                    <T k="landing.heroLine1" /><br />
                                    <T k="landing.heroLine2" /> <span className="text-muted-foreground/80 relative inline-block"><T k="landing.heroLine2Accent" />
                                        <svg className="absolute w-full h-3 -bottom-1 start-0 text-primary -z-10" viewBox="0 0 100 10" preserveAspectRatio="none"><path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="8" fill="none" opacity="0.4"></path></svg>
                                    </span>
                                </h1>

                                <p className="leading-relaxed text-lg tracking-tight font-dm-sans max-w-lg mb-4 text-slate-900 font-medium">
                                    <T k="landing.heroLead" />
                                </p>
                                <p className="leading-relaxed text-sm tracking-tight font-dm-sans max-w-lg mb-10 text-slate-600 hidden md:block">
                                    <T k="landing.heroSub" />
                                </p>

                                <HeroInputForm />

                                <div className="mt-8 flex flex-nowrap items-center justify-center lg:justify-start gap-3 sm:gap-4">
                                    <a href={microsoftStoreUrl} target="_blank" rel="noopener noreferrer" className="inline-block transition-transform hover:scale-[1.02] active:scale-[0.98] rounded-[2px] overflow-hidden flex-shrink-0">
                                        <svg className="w-[145px] h-[44px] sm:w-[180px] sm:h-[54px] block" viewBox="0 0 180 54" fill="none" xmlns="http://www.w3.org/2000/svg">
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
                                            <text x="48" y="21" fill="#1e293b" fontFamily="system-ui, -apple-system, sans-serif" fontSize="9.5" fontWeight="400" letterSpacing="0.1"><T k="landing.downloadFrom" /></text>
                                            <text x="48" y="38" fill="#1e293b" fontFamily="system-ui, -apple-system, sans-serif" fontSize="16" fontWeight="600" letterSpacing="-0.2"><T k="landing.microsoftStore" /></text>
                                        </svg>
                                    </a>
                                    <a href={googlePlayStoreUrl} target="_blank" rel="noopener noreferrer" className="inline-block transition-transform hover:scale-[1.02] active:scale-[0.98] rounded-[2px] overflow-hidden flex-shrink-0">
                                        <svg className="w-[145px] h-[44px] sm:w-[180px] sm:h-[54px] block" viewBox="0 0 180 54" fill="none" xmlns="http://www.w3.org/2000/svg">
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
                                            <text x="48" y="21" fill="#1e293b" fontFamily="system-ui, -apple-system, sans-serif" fontSize="9.5" fontWeight="500" letterSpacing="0.05em"><T k="landing.getItOn" /></text>
                                            <text x="48" y="38" fill="#1e293b" fontFamily="system-ui, -apple-system, sans-serif" fontSize="19" fontWeight="600" letterSpacing="-0.2px"><T k="landing.googlePlay" /></text>
                                        </svg>
                                    </a>
                                </div>
                            </div>

                            {/* Right Column: UI Mockups */}
                            <div className="mt-8 sm:mt-0 relative [perspective:1000px]">
                                <Image
                                    src="/hero computer img original.png"
                                    alt="Product UI"
                                    width={1600}
                                    height={1200}
                                    className="w-full h-auto block"
                                    priority
                                    sizes="(max-width: 768px) 100vw, 50vw"
                                />
                            </div>
                        </div>
                    </main>

                    <MarqueeSection />

                    {/* Dashboard Preview Section - Carousel */}
                    <DashboardCarousel />

                    {/* Social Proof Section */}
                    <section className="bg-black">
                        <div className="max-w-7xl mr-auto ml-auto pt-12 pr-6 pb-12 pl-6">
                            <p className="uppercase text-xs font-medium tracking-tight font-dm-sans text-center mb-10 text-stone-300">
                                <T k="landing.socialTitle" />
                            </p>

                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 border-t border-s border-stone-700">
                                <div className="flex flex-col gap-2 hover:opacity-100 hover:grayscale-0 transition-all cursor-pointer opacity-60 h-28 border-e border-b pt-6 pr-6 pb-6 pl-6 grayscale items-center justify-center border-stone-700">
                                    <ShoppingCart className="w-8 h-8 text-stone-400" />
                                    <span className="tracking-tight font-dm-sans text-sm text-stone-300 text-center"><T k="landing.segOnline" /></span>
                                </div>
                                <div className="flex flex-col gap-2 hover:opacity-100 hover:grayscale-0 transition-all cursor-pointer opacity-60 h-28 border-e border-b pt-6 pr-6 pb-6 pl-6 grayscale items-center justify-center border-stone-700">
                                    <Shirt className="w-8 h-8 text-stone-400" />
                                    <span className="tracking-tight font-dm-sans text-sm text-stone-300 text-center"><T k="landing.segFashion" /></span>
                                </div>
                                <div className="flex flex-col gap-2 hover:opacity-100 hover:grayscale-0 transition-all cursor-pointer opacity-60 h-28 border-e border-b pt-6 pr-6 pb-6 pl-6 grayscale items-center justify-center border-stone-700">
                                    <Coffee className="w-8 h-8 text-stone-400" />
                                    <span className="tracking-tight font-dm-sans text-sm text-stone-300 text-center"><T k="landing.segCoffee" /></span>
                                </div>
                                <div className="flex flex-col gap-2 hover:opacity-100 hover:grayscale-0 transition-all cursor-pointer opacity-60 h-28 border-e border-b pt-6 pr-6 pb-6 pl-6 grayscale items-center justify-center border-stone-700">
                                    <Sparkles className="w-8 h-8 text-stone-400" />
                                    <span className="tracking-tight font-dm-sans text-sm text-stone-300 text-center"><T k="landing.segSkincare" /></span>
                                </div>
                                <div className="flex flex-col gap-2 hover:opacity-100 hover:grayscale-0 transition-all cursor-pointer opacity-60 h-28 border-e border-b pt-6 pr-6 pb-6 pl-6 grayscale items-center justify-center border-stone-700">
                                    <BookOpen className="w-8 h-8 text-stone-400" />
                                    <span className="tracking-tight font-dm-sans text-sm text-stone-300 text-center"><T k="landing.segBooks" /></span>
                                </div>
                                <div className="flex flex-col gap-2 hover:opacity-100 hover:grayscale-0 transition-all cursor-pointer opacity-60 h-28 border-e border-b pt-6 pr-6 pb-6 pl-6 grayscale items-center justify-center border-stone-700">
                                    <Smartphone className="w-8 h-8 text-stone-400" />
                                    <span className="tracking-tight font-dm-sans text-sm text-stone-300 text-center"><T k="landing.segElectronics" /></span>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section id="features" className="py-24 px-6 bg-white border-t-2 border-slate-100 relative overflow-hidden">
                        <div className="absolute inset-0 z-0 opacity-[0.15]" style={{ backgroundImage: 'radial-gradient(circle at 25px 25px, hsl(var(--border)) 1px, transparent 0%)', backgroundSize: '50px 50px' }}></div>
                        <div className="max-w-7xl mx-auto relative z-10">
                            <div className="text-center max-w-2xl mx-auto mb-16">
                                <h2 className="text-4xl font-light text-slate-900 tracking-tight font-bricolage mb-4">
                                    <T k="landing.featuresHeading" />
                                </h2>
                                <p className="text-lg text-slate-600 tracking-tight font-dm-sans mb-6">
                                    <T k="landing.featuresSub" />
                                </p>
                                <Button asChild variant="outline" size="sm">
                                    <Link href="/use-cases"><T k="landing.exploreUseCases" /></Link>
                                </Button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                                {[
                                    {
                                        icon: ShoppingCart,
                                        titleKey: "landing.f1t",
                                        descKey: "landing.f1d",
                                        bgColor: "bg-blue-100",
                                        iconColor: "text-blue-600",
                                        hoverBg: "bg-[#EFF6FF]" // Light Blue
                                    },
                                    {
                                        icon: Globe,
                                        titleKey: "landing.f2t",
                                        descKey: "landing.f2d",
                                        bgColor: "bg-green-100",
                                        iconColor: "text-green-600",
                                        hoverBg: "bg-[#FFF1F2]" // Light Pink
                                    },
                                    {
                                        icon: Bot,
                                        titleKey: "landing.f3t",
                                        descKey: "landing.f3d",
                                        bgColor: "bg-purple-100",
                                        iconColor: "text-purple-600",
                                        hoverBg: "bg-[#FAFAF9]" // Light Stone/White
                                    },
                                    {
                                        icon: Users,
                                        titleKey: "landing.f4t",
                                        descKey: "landing.f4d",
                                        bgColor: "bg-pink-100",
                                        iconColor: "text-pink-600",
                                        hoverBg: "bg-[#FFFBEB]" // Light Cream/Yellow
                                    },
                                    {
                                        icon: BarChart2,
                                        titleKey: "landing.f5t",
                                        descKey: "landing.f5d",
                                        bgColor: "bg-sky-100",
                                        iconColor: "text-sky-600",
                                        hoverBg: "bg-[#EFF6FF]" // Light Blue
                                    },
                                    {
                                        icon: UserCog,
                                        titleKey: "landing.f6t",
                                        descKey: "landing.f6d",
                                        bgColor: "bg-yellow-100",
                                        iconColor: "text-yellow-600",
                                        hoverBg: "bg-[#FFF1F2]" // Light Pink
                                    },
                                    {
                                        icon: WifiOff,
                                        titleKey: "landing.f7t",
                                        descKey: "landing.f7d",
                                        bgColor: "bg-gray-200",
                                        iconColor: "text-gray-700",
                                        hoverBg: "bg-[#FFFBEB]" // Light Cream/Yellow
                                    },
                                    {
                                        icon: Download,
                                        titleKey: "landing.f8t",
                                        descKey: "landing.f8d",
                                        bgColor: "bg-teal-100",
                                        iconColor: "text-teal-600",
                                        hoverBg: "bg-[#EFF6FF]" // Light Blue
                                    },
                                    {
                                        icon: Clock,
                                        titleKey: "landing.f9t",
                                        descKey: "landing.f9d",
                                        bgColor: "bg-rose-100",
                                        iconColor: "text-rose-600",
                                        hoverBg: "bg-[#FFF1F2]" // Light Rose
                                    },
                                    {
                                        icon: InfinityIcon,
                                        titleKey: "landing.f10t",
                                        descKey: "landing.f10d",
                                        bgColor: "bg-cyan-100",
                                        iconColor: "text-cyan-600",
                                        hoverBg: "bg-[#ECFEFF]" // Light Cyan
                                    },
                                    {
                                        icon: FileText,
                                        titleKey: "landing.f11t",
                                        descKey: "landing.f11d",
                                        bgColor: "bg-fuchsia-100",
                                        iconColor: "text-fuchsia-600",
                                        hoverBg: "bg-[#FDF4FF]" // Light Fuchsia
                                    },
                                    {
                                        icon: ShieldCheck,
                                        titleKey: "landing.f12t",
                                        descKey: "landing.f12d",
                                        bgColor: "bg-red-100",
                                        iconColor: "text-red-600",
                                        hoverBg: "bg-[#FAFAF9]" // Light Stone/White
                                    },
                                    {
                                        icon: Package,
                                        titleKey: "landing.f13t",
                                        descKey: "landing.f13d",
                                        bgColor: "bg-orange-100",
                                        iconColor: "text-orange-600",
                                        hoverBg: "bg-[#FFF7ED]" // Light Orange
                                    },
                                    {
                                        icon: ScanBarcode,
                                        titleKey: "landing.f14t",
                                        descKey: "landing.f14d",
                                        bgColor: "bg-indigo-100",
                                        iconColor: "text-indigo-600",
                                        hoverBg: "bg-[#EEF2FF]" // Light Indigo
                                    },
                                    {
                                        icon: Printer,
                                        titleKey: "landing.f15t",
                                        descKey: "landing.f15d",
                                        bgColor: "bg-amber-100",
                                        iconColor: "text-amber-600",
                                        hoverBg: "bg-[#FFFBEB]", // Light Amber
                                        badgeKey: "landing.badgeHighlyShared"
                                    },
                                    {
                                        icon: Tag,
                                        titleKey: "landing.f16t",
                                        descKey: "landing.f16d",
                                        bgColor: "bg-lime-100",
                                        iconColor: "text-lime-600",
                                        hoverBg: "bg-[#F7FEE7]" // Light Lime
                                    },
                                    {
                                        icon: Wallet,
                                        titleKey: "landing.f17t",
                                        descKey: "landing.f17d",
                                        bgColor: "bg-emerald-100",
                                        iconColor: "text-emerald-600",
                                        hoverBg: "bg-[#ECFDF5]" // Light Emerald
                                    },
                                    {
                                        icon: PieChart,
                                        titleKey: "landing.f18t",
                                        descKey: "landing.f18d",
                                        bgColor: "bg-violet-100",
                                        iconColor: "text-violet-600",
                                        hoverBg: "bg-[#F5F3FF]" // Light Violet
                                    }
                                ].map((feature, index) => (
                                    <div key={index} className="group relative p-8 bg-white border-2 border-dashed border-slate-200 rounded-lg overflow-hidden transition-all duration-300 isolate cursor-pointer shadow-sm">
                                        {/* Slide-in Background Animation */}
                                        <div className={`absolute inset-0 w-0 group-hover:w-full transition-all duration-500 ease-out ${feature.hoverBg} -z-10`}></div>

                                        {feature.badgeKey && (
                                            <span className="absolute top-4 end-10 bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full border border-primary/20 z-20">
                                                <T k={feature.badgeKey} />
                                            </span>
                                        )}

                                        <div className={`w-12 h-12 ${feature.bgColor} ${feature.iconColor} rounded-xl flex items-center justify-center mb-6 relative z-10 transition-colors duration-300 group-hover:bg-white/80`}>
                                            <feature.icon width="24" height="24" />
                                        </div>
                                        <h3 className="text-xl font-semibold text-slate-900 mb-2 relative z-10"><T k={feature.titleKey} /></h3>
                                        <p className="text-slate-600 text-sm leading-relaxed relative z-10 group-hover:text-slate-700 transition-colors"><T k={feature.descKey} /></p>

                                        {/* Always visible corner accents */}
                                        <div className="absolute top-4 end-4 h-3 w-3 border-t-2 border-e-2 border-slate-300 z-10"></div>
                                        <div className="absolute bottom-4 start-4 h-3 w-3 border-b-2 border-s-2 border-slate-300 z-10"></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    <section id="how-it-works" className="py-24 px-6 bg-white border-t-2 border-slate-100 relative overflow-hidden bg-noise">
                        <div className="absolute inset-0 z-0 opacity-[0.15]" style={{ backgroundImage: 'radial-gradient(circle at 25px 25px, hsl(var(--border)) 1px, transparent 0%)', backgroundSize: '50px 50px' }}></div>
                        <div className="aura-background"></div>
                        <div className="sm:px-6 lg:px-8 max-w-7xl mx-auto relative z-10">
                            <div className="text-center mb-16">
                                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[10px] text-primary ring-1 ring-primary/20 uppercase tracking-tight mb-4 font-semibold">
                                    <Workflow className="me-1 h-3 w-3" />
                                    <T k="landing.howBadge" />
                                </span>
                                <h2 className="text-4xl md:text-5xl font-light tracking-tight text-slate-900 mb-6 font-bricolage">
                                    <Link href="/about/our-mission" className="text-primary transition-colors cursor-pointer">
                                        <T k="landing.howHeading" />
                                    </Link>
                                </h2>
                                <p className="text-lg text-slate-600 font-light max-w-3xl mx-auto mb-8">
                                    <T k="landing.howBody" />
                                </p>

                                <div className="bg-white border-2 border-dashed border-slate-200 rounded-lg p-6 md:p-8 max-w-4xl mx-auto text-start relative overflow-hidden shadow-sm">
                                    <div className="absolute top-0 end-0 p-4 opacity-10">
                                        <BrainCircuit className="w-32 h-32 text-slate-900" />
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-8 relative z-10">
                                        <div>
                                            <h3 className="text-xl font-semibold mb-8 text-slate-900"><T k="landing.zenDoesTitle" /></h3>
                                            <ul className="space-y-8">
                                                <li className="flex items-start gap-4">
                                                    <div className="bg-primary/10 p-2.5 rounded-xl shrink-0 border border-primary/20 shadow-sm">
                                                        <TrendingUp className="w-6 h-6 text-primary" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-slate-900 text-base"><T k="landing.zenRevenueTitle" /></h4>
                                                        <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                                                            <T k="landing.zenRevenueBody" />
                                                        </p>
                                                    </div>
                                                </li>
                                                <li className="flex items-start gap-4">
                                                    <div className="bg-primary/10 p-2.5 rounded-xl shrink-0 border border-primary/20 shadow-sm">
                                                        <Store className="w-6 h-6 text-primary" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-slate-900 text-base"><T k="landing.zenMerchTitle" /></h4>
                                                        <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                                                            <T k="landing.zenMerchBody" />
                                                        </p>
                                                    </div>
                                                </li>
                                                <li className="flex items-start gap-4">
                                                    <div className="bg-primary/10 p-2.5 rounded-xl shrink-0 border border-primary/20 shadow-sm">
                                                        <Search className="w-6 h-6 text-primary" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-slate-900 text-base"><T k="landing.zenMarketTitle" /></h4>
                                                        <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                                                            <T k="landing.zenMarketBody" />
                                                        </p>
                                                    </div>
                                                </li>
                                            </ul>
                                            
                                            <div className="mt-8">
                                                <Link href="/zen-ai" className="inline-flex items-center gap-2 text-primary font-medium hover:text-primary/80 transition-colors">
                                                    Learn more about Zen AI <ArrowRight className="w-4 h-4" />
                                                </Link>
                                            </div>
                                        </div>

                                        <ZenAIInsights />
                                    </div>
                                </div>
                            </div>

                            <div className="relative mx-auto max-w-4xl">
                                <div className="flex items-center justify-center gap-6 sm:gap-10 relative z-10">
                                    <div className="group relative cursor-pointer">
                                        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 border border-neutral-200 shadow-lg group-hover:scale-110 group-hover:border-primary/50 group-hover:shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)] transition-all duration-300">
                                            <Monitor className="text-neutral-600 group-hover:text-primary transition-colors h-6 w-6" />
                                        </span>
                                        <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-semibold tracking-wide text-neutral-500 uppercase transition-opacity"><T k="landing.nodePos" /></span>
                                    </div>
                                    <div className="group relative cursor-pointer">
                                        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 border border-neutral-200 shadow-lg group-hover:scale-110 group-hover:border-primary/50 group-hover:shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)] transition-all duration-300">
                                            <Package className="text-neutral-600 group-hover:text-primary transition-colors h-6 w-6" />
                                        </span>
                                        <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-semibold tracking-wide text-neutral-500 uppercase transition-opacity"><T k="landing.nodeInventory" /></span>
                                    </div>
                                    <div className="group relative cursor-pointer">
                                        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 border border-neutral-200 shadow-lg group-hover:scale-110 group-hover:border-primary/50 group-hover:shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)] transition-all duration-300">
                                            <Globe className="text-neutral-600 group-hover:text-primary transition-colors h-6 w-6" />
                                        </span>
                                        <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-semibold tracking-wide text-neutral-500 uppercase transition-opacity"><T k="landing.nodeStorefront" /></span>
                                    </div>
                                    <div className="group relative cursor-pointer">
                                        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 border border-neutral-200 shadow-lg group-hover:scale-110 group-hover:border-primary/50 group-hover:shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)] transition-all duration-300">
                                            <Users className="text-neutral-600 group-hover:text-primary transition-colors h-6 w-6" />
                                        </span>
                                        <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-semibold tracking-wide text-neutral-500 uppercase transition-opacity"><T k="landing.nodeCrm" /></span>
                                    </div>
                                    <div className="group relative cursor-pointer">
                                        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 border border-neutral-200 shadow-lg group-hover:scale-110 group-hover:border-primary/50 group-hover:shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)] transition-all duration-300">
                                            <BarChart2 className="text-neutral-600 group-hover:text-primary transition-colors h-6 w-6" />
                                        </span>
                                        <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-semibold tracking-wide text-neutral-500 uppercase transition-opacity"><T k="landing.nodeAnalytics" /></span>
                                    </div>
                                </div>

                                <div className="relative mt-8 h-64 pointer-events-none">
                                    <svg viewBox="0 0 900 360" className="absolute inset-0 w-full h-full" fill="none">
                                        <defs>
                                            <linearGradient id="line-gradient-light" x1="0" y1="0" x2="1" y2="0">
                                                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0"></stop>
                                                <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.8"></stop>
                                                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0"></stop>
                                            </linearGradient>
                                        </defs>
                                        <path d="M450 300 C 450 200, 300 120, 150 30" stroke="url(#line-gradient-light)" strokeWidth="1" strokeLinecap="round" fill="none">
                                            <animate attributeName="stroke-dasharray" values="600" dur="0.1s" fill="freeze" />
                                            <animate attributeName="stroke-dashoffset" values="600;0;600" dur="4s" repeatCount="indefinite" />
                                        </path>
                                        <path d="M450 300 C 450 210, 360 130, 270 30" stroke="url(#line-gradient-light)" strokeWidth="1" strokeLinecap="round" fill="none">
                                            <animate attributeName="stroke-dasharray" values="520" dur="0.1s" fill="freeze" />
                                            <animate attributeName="stroke-dashoffset" values="520;0;520" dur="4s" begin="0.2s" repeatCount="indefinite" />
                                        </path>
                                        <path d="M450 300 C 450 210, 540 130, 630 30" stroke="url(#line-gradient-light)" strokeWidth="1" strokeLinecap="round" fill="none">
                                            <animate attributeName="stroke-dasharray" values="520" dur="0.1s" fill="freeze" />
                                            <animate attributeName="stroke-dashoffset" values="520;0;520" dur="4s" begin="0.8s" repeatCount="indefinite" />
                                        </path>
                                        <path d="M450 300 L 450 30" stroke="url(#line-gradient-light)" strokeWidth="1" strokeLinecap="round" fill="none">
                                            <animate attributeName="stroke-dasharray" values="270" dur="0.1s" fill="freeze" />
                                            <animate attributeName="stroke-dashoffset" values="270;0;270" dur="4s" begin="0.8s" repeatCount="indefinite" />
                                        </path>
                                        <path d="M450 300 C 450 200, 600 120, 750 30" stroke="url(#line-gradient-light)" strokeWidth="1" strokeLinecap="round" fill="none">
                                            <animate attributeName="stroke-dasharray" values="600" dur="0.1s" fill="freeze" />
                                            <animate attributeName="stroke-dashoffset" values="600;0;600" dur="4s" begin="1s" repeatCount="indefinite" />
                                        </path>
                                    </svg>

                                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
                                        <span className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-background/80 ring-1 ring-slate-200 backdrop-blur-lg shadow-[0_0_50px_rgba(var(--primary-rgb),0.15)] relative z-20">
                                            <svg width="40" height="40" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                                                <defs>
                                                    <linearGradient id="thickBlueGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                                        <stop offset="0%" style={{ stopColor: '#1e293b;stop-opacity:1' }} />
                                                        <stop offset="100%" style={{ stopColor: '#0f172a;stop-opacity:1' }} /> </linearGradient>

                                                    <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
                                                        <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" />
                                                        <feOffset dx="0" dy="2" result="offsetblur" />
                                                        <feComponentTransfer>
                                                            <feFuncA type="linear" slope="0.3" />
                                                        </feComponentTransfer>
                                                        <feMerge>
                                                            <feMergeNode />
                                                            <feMergeNode in="SourceGraphic" />
                                                        </feMerge>
                                                    </filter>
                                                </defs>

                                                <g filter="url(#dropShadow)">
                                                    <path d="M 100 55
                                                            A 35 35 0 1 0 100 125
                                                            A 35 35 0 1 0 100 55
                                                            Z
                                                            M 100 63
                                                            A 27 27 0 1 1 100 117
                                                            A 27 27 0 1 1 100 63
                                                            Z"
                                                        fill="url(#thickBlueGradient)"
                                                        stroke="#1e293b"
                                                        strokeWidth="0.5" />

                                                    <path d="M 60 127
                                                            Q 100 154 140 127
                                                            Q 100 142 60 127
                                                            Z"
                                                        fill="url(#thickBlueGradient)"
                                                        stroke="#1e293b"
                                                        strokeWidth="0.5" />
                                                </g>
                                            </svg>
                                            <span className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl animate-pulse"></span>
                                        </span>
                                        <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-sm font-bold tracking-wide text-slate-900 whitespace-nowrap">Zen AI</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mx-auto mt-12 max-w-4xl">
                                <div className="flex items-center justify-center gap-3 flex-wrap text-sm text-slate-600">
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-200 bg-slate-100/80 cursor-pointer">
                                        <BrainCircuit className="h-4 w-4 text-primary" />
                                        <span className="font-medium text-xs"><T k="landing.chipForecasting" /></span>
                                    </div>
                                    <div className="hidden sm:block w-16 h-px border-t border-dashed border-slate-200"></div>
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-200 bg-slate-100/80 cursor-pointer">
                                        <Bot className="h-4 w-4 text-primary" />
                                        <span className="font-medium text-xs"><T k="landing.chipInsights" /></span>
                                    </div>
                                    <div className="hidden sm:block w-16 h-px border-t border-dashed border-slate-200"></div>
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-200 bg-slate-100/80 cursor-pointer">
                                        <Database className="h-4 w-4 text-primary" />
                                        <span className="font-medium text-xs"><T k="landing.chipUnifiedData" /></span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section id="business-types" className="py-24 px-6 bg-white border-t border-slate-100">
                        <div className="max-w-7xl mx-auto">
                            <div className="text-center max-w-2xl mx-auto mb-16">
                                <h2 className="text-4xl font-light text-slate-900 tracking-tight font-bricolage mb-4">
                                    <T k="landing.bizHeading" />
                                </h2>
                                <p className="text-lg text-slate-600 tracking-tight font-dm-sans">
                                    <T k="landing.bizSub" />
                                </p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
                                {businessTypes.map((type) => {
                                    const image = PlaceHolderImages.find(p => p.id === type.imageId);
                                    if (!image) return null;
                                    return (
                                        <Link href={type.link} key={type.name} className="group relative overflow-hidden rounded-xl shadow-lg aspect-[4/5] cursor-pointer block">
                                            <Image
                                                src={image.imageUrl}
                                                alt={type.name}
                                                fill
                                                className="object-cover transition-transform duration-500 group-hover:scale-110"
                                                data-ai-hint={image.imageHint}
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent"></div>
                                            <div className="absolute bottom-0 start-0 p-4 md:p-6 text-white">
                                                <h3 className="text-2xl font-light tracking-tight font-bricolage"><T k={type.nameKey} /></h3>
                                                <p className="mt-1 text-sm text-white/90"><T k={type.descKey} /></p>
                                            </div>
                                        </Link>
                                    )
                                })}
                            </div>
                        </div>
                    </section>

                    {/* Pricing Section */}
                    <section id="pricing" className="py-24 px-6 bg-[#F9F8F6] border-t border-slate-100">
                        <div className="max-w-6xl mx-auto">
                            <div className="text-center max-w-2xl mx-auto mb-16">
                                <h2 className="text-4xl font-light text-slate-900 tracking-tight font-bricolage mb-4">
                                    <T k="landing.pricingHeading" />
                                </h2>
                                <p className="text-lg text-slate-600 tracking-tight font-dm-sans">
                                    <T k="landing.pricingSub" />
                                </p>
                            </div>

                            <PricingPlans />
                        </div>
                    </section>

                    <section id="faq" className="py-24 px-6 border-t bg-white border-slate-100">
                        <div className="max-w-3xl mr-auto ml-auto">
                            <h2 className="text-3xl tracking-tight mb-12 text-center font-bricolage font-light text-slate-900"><T k="landing.faqHeading" /></h2>
                            <Accordion type="multiple" className="w-full">
                                {faqItems.map((item, index) => (
                                    <AccordionItem key={index} value={`item-${index}`}>
                                        <AccordionTrigger className="text-lg text-start"><T k={item.qKey} /></AccordionTrigger>
                                        <AccordionContent className="text-base text-muted-foreground leading-relaxed">
                                            <T k={item.aKey} />
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                            <div className="text-center mt-12">
                                <p className="mb-4 font-dm-sans tracking-tight text-neutral-600"><T k="landing.faqStill" /></p>
                                <Button asChild>
                                    <a href="#contact"><T k="landing.faqContact" /></a>
                                </Button>
                            </div>
                        </div>
                    </section>

                    {/* Profit Dial Section */}
                    <section className="py-24 px-6 bg-[#F9F8F6] text-slate-900 relative overflow-hidden text-center">
                        {/* Grid Background */}
                        <div className="absolute inset-0 z-0 opacity-[0.03]" style={{
                            backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)',
                            backgroundSize: '32px 32px'
                        }}></div>

                        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center relative z-10 text-start">
                            <div>
                                <h2 className="text-4xl md:text-5xl font-light tracking-tight mb-6 font-bricolage text-slate-900">
                                    <T k="landing.dialHeading" /> <span className="text-primary"><T k="landing.dialHeadingAccent" /></span>
                                </h2>
                                <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                                    <T k="landing.dialBody" />
                                </p>

                                <div className="space-y-6 mb-10">
                                    <div className="flex gap-4">
                                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                            <TrendingUp className="w-6 h-6 text-primary" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold text-slate-900"><T k="landing.dial1t" /></h3>
                                            <p className="text-slate-600"><T k="landing.dial1d" /></p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                            <DollarSign className="w-6 h-6 text-primary" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold text-slate-900"><T k="landing.dial2t" /></h3>
                                            <p className="text-slate-600"><T k="landing.dial2d" /></p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                            <Box className="w-6 h-6 text-primary" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold text-slate-900"><T k="landing.dial3t" /></h3>
                                            <p className="text-slate-600"><T k="landing.dial3d" /></p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                            <Trophy className="w-6 h-6 text-primary" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold text-slate-900"><T k="landing.dial4t" /></h3>
                                            <p className="text-slate-600"><T k="landing.dial4d" /></p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 bg-white/10 backdrop-blur-xl rounded-xl border border-white/20 shadow-sm">
                                    <p className="text-lg font-medium text-slate-900 text-center">
                                        <T k="landing.dialFooter" />
                                    </p>
                                </div>
                            </div>
                            <div className="relative">
                                {/* Glow Effect */}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-orange-500/30 blur-[100px] rounded-full -z-10 mix-blend-multiply"></div>
                                <Image
                                    src="/knob-removebg.png"
                                    alt="Zeneva Profit Dial Interface"
                                    width={500}
                                    height={500}
                                    className="relative w-full max-w-xl mx-auto h-auto"
                                />
                            </div>
                        </div>
                    </section>

                    <WhatsappFab />

                    {/* Global Payments Banner */}
                    <section className="pt-20 pb-0 px-6">
                        <div className="max-w-7xl mx-auto">
                            <div className="relative overflow-hidden rounded-3xl bg-stone-950 text-white p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-12 group shadow-2xl border border-white/5">
                                {/* Abstract background pattern */}
                                <div className="absolute inset-0 z-0 opacity-[0.1]" style={{
                                    backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                                    backgroundSize: '32px 32px'
                                }}></div>
                                <div className="absolute -top-24 -left-24 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>

                                <div className="relative z-10 max-w-xl text-start">
                                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4 font-bricolage leading-tight">
                                        <T k="landing.globalLine1" /> <br /><T k="landing.globalLine2Prefix" /> <span className="text-primary"><T k="landing.globalLine2Accent" /></span> <T k="landing.globalLine2Suffix" />
                                    </h2>
                                    <p className="text-sm md:text-base text-white/70 mb-8 leading-relaxed max-w-md font-light">
                                        <T k="landing.globalBody" />
                                    </p>
                                    <Link href="/signup" className="inline-flex items-center gap-2 text-white font-semibold group/link border-b border-transparent hover:border-white transition-all py-1">
                                        <span className="text-sm"><T k="landing.globalCta" /></span>
                                        <ArrowRight className="w-4 h-4 transition-transform group-hover/link:translate-x-1 rtl:rotate-180" />
                                    </Link>
                                </div>

                                <div className="relative z-10 w-full md:w-1/2 flex justify-center md:justify-end">
                                    <div className="relative transition-all duration-700 group-hover:translate-x-2 group-hover:-translate-y-2">
                                        {/* Soft glow behind the image */}
                                        <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full -z-10 scale-125"></div>
                                        <Image
                                            src="/global-payment.png"
                                            alt="Multi-currency Payment Integration"
                                            width={600}
                                            height={400}
                                            className="w-full max-w-sm h-auto drop-shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-xl"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Architectural Connection Lines */}
                            <div className="flex justify-between px-12 md:px-32 h-28 pointer-events-none">
                                <div className="flex gap-24">
                                    <div className="w-px h-full border-l border-dashed border-stone-400/80"></div>
                                    <div className="w-px h-full border-l border-dashed border-stone-400/80"></div>
                                </div>
                                <div className="flex gap-24">
                                    <div className="w-px h-full border-l border-dashed border-stone-400/80"></div>
                                    <div className="w-px h-full border-l border-dashed border-stone-400/80"></div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <SecurityBadges />
                    <MarketingFooter />
                </div >
            </div >
        </ThemeProvider >
    );
}
