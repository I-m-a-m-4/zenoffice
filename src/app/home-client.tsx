
'use client';

import { InteractiveGrid } from '@/components/interactive-grid';

import {
    ArrowRight,
    Blocks,
    Bot,
    BrainCircuit,
    Check,
    Code,
    Cpu,
    Database,
    Download,
    Droplet,
    Globe,
    Hexagon,
    InfinityIcon,
    Instagram,
    Layers,
    Mail,
    Map,
    Mountain,
    Package,
    Phone,
    Plus,
    Quote,
    Search,
    Send,
    Server,
    Share2,
    Sparkles,
    Terminal,
    Twitter,
    Wind,
    Github,
    Linkedin,
    ArrowUp,
    Box,
    Anchor,
    BarChart2,
    Loader,
    ShoppingCart,
    Figma,
    Gitlab,
    GitCommit,
    Workflow,
    ShieldCheck,
    Zap,
    Shirt,
    Coffee,
    BookOpen,
    Smartphone,
    Loader2,
    Users,
    UserCog,
    WifiOff,
    Printer,
    ScanBarcode,
    Monitor,
    BarChart3,
    TrendingUp,
    Store,
    DollarSign,
    Trophy,
    History,
    FileText,
    Clock,
    Lock,
    Shield,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import BackToTopButton from '@/components/back-to-top-button';
import MarketingHeader from '@/components/layout/marketing-header';
import Head from 'next/head';
import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import MarketingFooter from '@/components/layout/marketing-footer';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { sendContactFormEmail } from '@/lib/email';
import { AppConfig } from '@/lib/config';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { MarqueeSection } from '@/components/marquee-section';

import { ThemeProvider } from '@/components/theme-provider';
import { auth } from '@/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';


const faqItems = [
    {
        question: "Who is Zeneva built for?",
        answer: "Zeneva is designed for serious retail businesses — mini-marts, pharmacies, boutiques, supermarkets, and online stores managing real inventory, real volume, and real money."
    },
    {
        question: "What makes Zeneva different from other inventory tools?",
        answer: "Most tools report the past. Zeneva predicts the future. Zen AI analyzes demand patterns and recommends exact stock decisions to maximize profit."
    },
    {
        question: "Does Zeneva work without internet?",
        answer: "Yes. POS works fully offline. All transactions are queued and synced automatically once connectivity returns — no sales are ever lost."
    },
    {
        question: "How accurate are Zen AI predictions?",
        answer: "Zen AI improves continuously using your historical sales, time-based demand, and customer behavior. Accuracy increases as your data grows."
    },
    {
        question: "Can I manage multiple business locations?",
        answer: "Yes. Zeneva’s Enterprise Plus plan allows you to sync stock levels, track staff movements, and view unified analytics across multiple storefronts or warehouses from one dashboard."
    },
    {
        question: "Does Zeneva support international payments?",
        answer: "Yes! Zeneva now supports international payments via Paystack. You can accept USD and other global currencies from customers anywhere in the world on our Pro and Enterprise plans."
    },
    {
        question: "Can Zeneva replace my existing POS or inventory system?",
        answer: "Yes. Zeneva is a full operating system — POS, inventory, storefront, CRM, and analytics in one unified platform."
    },
    {
        question: "Is my data secure?",
        answer: "Yes. All data is encrypted, isolated per business, and protected using enterprise-grade cloud infrastructure."
    },
    {
        question: "How long does setup take?",
        answer: "Most businesses are live within hours — products can be imported, staff invited, and selling started the same day."
    }
];

const features = [
    {
        icon: ShoppingCart,
        title: "Blazing-Fast POS",
        description: "A modern Point of Sale system that's intuitive, fast, and works seamlessly even when you're offline. Every sale automatically updates your inventory in real-time.",
        bgColor: "bg-blue-100",
        iconColor: "text-blue-600"
    },
    {
        icon: Globe,
        title: "E-Commerce Storefront",
        description: "Launch a beautiful, customizable online store in minutes. Your products sync automatically, and you can accept payments online with Paystack integration.",
        bgColor: "bg-green-100",
        iconColor: "text-green-600"
    },
    {
        icon: Bot,
        title: "AI-Powered Insights",
        description: "Go beyond simple reports. Zen AI acts as a sentinel for your business, identifying your most valuable products, customers, and at-risk stock.",
        bgColor: "bg-purple-100",
        iconColor: "text-purple-600"
    },
    {
        icon: Users,
        title: "Integrated CRM",
        description: "Build lasting relationships. Every sale is linked to a customer profile, building a rich purchase history to power your loyalty programs and personalized marketing.",
        bgColor: "bg-pink-100",
        iconColor: "text-pink-600"
    },
    {
        icon: BarChart3,
        title: "Advanced Reporting",
        description: "Deep-dive into your business performance with detailed reports on sales, profit & loss, top products, and customer behavior, all filterable by date.",
        bgColor: "bg-sky-100",
        iconColor: "text-sky-600"
    },
    {
        title: "Granular User Permissions",
        description: "Control exactly what your staff can see or do. Assign roles like 'Admin', 'Manager', or 'Vendor Operator', then customize granular permissions for inventory, reports, and sales.",
        bgColor: "bg-yellow-100",
        iconColor: "text-yellow-600"
    },
    {
        icon: WifiOff,
        title: "Robust Offline Mode",
        description: "Never miss a sale. The Zeneva POS is built to work perfectly offline, saving all transactions locally and syncing them automatically when you reconnect.",
        bgColor: "bg-gray-200",
        iconColor: "text-gray-700"
    },
    {
        icon: Download,
        title: "Bulk Data Tools",
        description: "Migrate your existing inventory effortlessly with our smart CSV importer. Export your product, sales, or customer data at any time for external analysis.",
        bgColor: "bg-teal-100",
        iconColor: "text-teal-600"
    },
    {
        icon: ShieldCheck,
        title: "Security & Audit Log",
        description: "Enhance security with a detailed, chronological record of all critical events, complete with automated issue scanning.",
        bgColor: "bg-red-100",
        iconColor: "text-red-600"
    },
    {
        icon: Layers,
        title: "Product Variants Support",
        description: "Easily manage products with multiple options like sizes, colors, or materials. Zeneva tracks stock and pricing perfectly for each variant.",
        bgColor: "bg-orange-100",
        iconColor: "text-orange-600"
    }
];


export default function Home() {
    const [email, setEmail] = useState('');
    const { toast } = useToast();
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
    const form = useRef<HTMLFormElement>(null);
    const [isSending, setIsSending] = useState(false);
    const router = useRouter();
    const zenAIRef = useRef<HTMLElement>(null);
    const [hasTriggeredZenAI, setHasTriggeredZenAI] = useState(false);
    const [placeholder, setPlaceholder] = useState('');
    const [phraseIndex, setPhraseIndex] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);
    const [charIndex, setCharIndex] = useState(0);

    const phrases = ["Enter your work email", "Start free, stay free", "Unlock Zen AI insights", "Join 30+ smart retailers"];

    useEffect(() => {
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
    }, [charIndex, isDeleting, phraseIndex]);



    // Insight Data
    const foodInsights = [
        "This snack sells most on Wednesdays between 4–7 PM. Prepare 28 units. Producing more wastes cash.",
        "Fresh bread moves fast on rainy mornings. Bake 15 extra loaves to meet demand.",
        "Milk expires in 2 days. Mark down by 20% now to clear stock before loss.",
        "Lunch rush incoming. Pre-pack 50 sandwiches to reduce wait times.",
        "Vegetable waste is up 10%. Reduce order quantity for next shipment."
    ];

    const fashionInsights = [
        "Blue denim sales spike 40% on pay-day weekends. Stock 15 extra units to capture demand.",
        "Summer dresses are trending. Move to front window display to increase foot traffic.",
        "Red sneakers are low in stock. Reorder now to avoid missing weekend sales.",
        "Customer X buys formal wear every 3 months. Send personalized offer now.",
        "Winter coats are moving slow. Bundle with scarves to clear inventory."
    ];

    const [foodIndex, setFoodIndex] = useState(0);
    const [fashionIndex, setFashionIndex] = useState(0);
    const [isFoodPulsing, setIsFoodPulsing] = useState(false);
    const [isFashionPulsing, setIsFashionPulsing] = useState(false);

    // Carousel State
    const [activeSlide, setActiveSlide] = useState(0);
    const slides = [
        { src: "/herolytics.svg", alt: "Zeneva Dashboard View", label: "Dashboard" },
        { src: "/poslytics.svg", alt: "Zeneva POS View", label: "POS Page" },
        { src: "/inventory.svg", alt: "Zeneva Inventory View", label: "Inventory Page" },
        { src: "/loglytics.svg", alt: "Audit Log", label: "Audit Log " },
        { src: "/storelytics.svg", alt: "Storefront Page", label: "Storefront" },
        { src: "/reportlytics.svg", alt: "Reports Page", label: "Advanced Report " }
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setFoodIndex((prev) => (prev + 1) % foodInsights.length);
        }, 6000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            setFashionIndex((prev) => (prev + 1) % fashionInsights.length);
        }, 8000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !hasTriggeredZenAI) {
                    handleFoodClick();
                    handleFashionClick();
                    setHasTriggeredZenAI(true);
                }
            },
            { threshold: 0.1 }
        );

        if (zenAIRef.current) {
            observer.observe(zenAIRef.current);
        }

        return () => observer.disconnect();
    }, [hasTriggeredZenAI]);

    const handleFoodClick = () => {
        setIsFoodPulsing(true);
        setTimeout(() => setIsFoodPulsing(false), 3000);
    };

    const handleFashionClick = () => {
        setIsFashionPulsing(true);
        setTimeout(() => setIsFashionPulsing(false), 3000);
    };





    const handleContactSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!form.current) return;
        setIsSending(true);

        sendContactFormEmail(form.current)
            .then((result) => {
                toast({ variant: 'success', title: 'Message Sent!', description: 'We will get back to you shortly.' });
                form.current?.reset();
            }, (error) => {
                toast({ variant: 'destructive', title: 'Send Failed', description: error.message || 'Could not send message. Please try again later.' });
            })
            .finally(() => {
                setIsSending(false);
            });
    };

    const structuredData = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "SoftwareApplication",
                "name": "Zeneva",
                "applicationCategory": "BusinessApplication",
                "operatingSystem": "Web",
                "description": "The all-in-one platform for inventory management, point of sale, sales analytics, and customer relationships for Nigerian businesses.",
                "offers": {
                    "@type": "Offer",
                    "price": "10000",
                    "priceCurrency": "NGN"
                },
                "aggregateRating": {
                    "@type": "AggregateRating",
                    "ratingValue": "4.8",
                    "reviewCount": "22000"
                }
            },
            {
                "@type": "WebPage",
                "@id": "https://zeneva.space"
            },
            {
                "@type": "FAQPage",
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

    const referralLink = typeof window !== 'undefined' ? `${window.location.origin}/signup` : '/signup';
    const handleCopyLink = () => {
        if (referralLink) {
            navigator.clipboard.writeText(referralLink)
                .then(() => {
                    toast({ variant: 'success', title: 'Copied!', description: 'Signup link copied to clipboard.' });
                })
                .catch(() => {
                    toast({ variant: 'destructive', title: 'Failed to Copy' });
                });
        }
    };

    const handleShareLink = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Join me on Zeneva!',
                    text: `Sign up for Zeneva using my referral link and get started with the best inventory management platform.`,
                    url: referralLink,
                });
            } catch (error) {
                // Silently fail is user cancels share sheet
            }
        } else {
            handleCopyLink();
            toast({ title: 'Share not supported', description: 'Referral link copied to clipboard instead.' });
        }
    };

    const businessTypes = [
        { name: 'Fashion & Clothing', imageId: 'boutique-store', description: 'Manage your unique collection with style and ease.', link: '/use-cases' },
        { name: 'Jewellery Store', imageId: 'jewelry-store', description: 'Track every precious item from display to sale.', link: '/use-cases' },
        { name: 'Furniture Store', imageId: 'furniture-store', description: 'From sofas to side tables, keep your large inventory in order.', link: '/use-cases' },
        { name: 'Electronic Shop', imageId: 'electronics-store', description: 'Handle serial numbers and complex inventory with ease.', link: '/use-cases' },
        { name: 'Cafe Shop', imageId: 'cafe-shop', description: 'Serve up loyalty and track your beans with precision.', link: '/use-cases' },
        { name: 'Book Store', imageId: 'book-store', description: 'Organize your titles, authors, and editions seamlessly.', link: '/use-cases' },
        { name: 'Skin Care', imageId: 'skin-care', description: 'Manage batches, expiry dates, and product variations.', link: '/use-cases' },
        { name: 'Restaurant', imageId: 'restaurant', description: 'Track ingredients, manage menus, and speed up orders.', link: '/use-cases' },
    ];

    return (
        <ThemeProvider forcedTheme="light">
            <div className="h-full overflow-y-auto w-full antialiased overflow-x-hidden text-slate-900 bg-[#F9F8F6] relative">
                <div className="fixed grid-lines w-full h-full top-[var(--tauri-title-height,0)] right-0 left-0 pointer-events-none z-0"></div>
                <div className="relative z-10">
                    <Head>
                        <script
                            type="application/ld+json"
                            dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
                        />
                    </Head>
                    <MarketingHeader />



                    {/* Main Hero Section */}
                    <main className="bg-transparent lg:pt-48 lg:pb-48 w-full max-w-none mr-auto ml-auto pt-40 pr-6 pb-32 pl-6 relative overflow-hidden">
                        <InteractiveGrid />
                        <div className="aura-background"></div>
                        <div className="grid lg:grid-cols-2 max-w-7xl mr-auto ml-auto items-center">

                            {/* Left Column: Copy & Form */}
                            <div className="max-w-xl z-10 mx-auto lg:mx-0 text-center lg:text-left">
                                <p className="uppercase text-xs font-semibold tracking-tight font-dm-sans mb-6 text-slate-900">The Operating System For Your Business</p>
                                <h1 className="leading-[0.95] lg:text-6xl xl:text-7xl text-4xl md:text-5xl font-medium text-foreground tracking-tighter font-display mb-8">
                                    Never Lose a Sale.<br />
                                    Never Waste <span className="text-muted-foreground/80 relative inline-block">Stock.
                                        <svg className="absolute w-full h-3 -bottom-1 left-0 text-primary -z-10" viewBox="0 0 100 10" preserveAspectRatio="none"><path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="8" fill="none" opacity="0.4"></path></svg>
                                    </span>
                                </h1>

                                <p className="leading-relaxed text-lg tracking-tight font-dm-sans max-w-lg mb-4 text-slate-900 font-medium">
                                    Zeneva is the operating system for serious retail—combining POS, inventory, storefront, CRM, and AI to predict demand and maximize profit.
                                </p>
                                <p className="leading-relaxed text-sm tracking-tight font-dm-sans max-w-lg mb-10 text-slate-500 hidden md:block">
                                    Built for modern retail. Works offline. Scales online. Powered by Zen AI.
                                </p>

                                <div className="flex flex-row w-full gap-2 items-stretch">
                                    <Input
                                        type="email"
                                        placeholder={placeholder || "Enter your work email"}
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="
            !h-auto
            !min-h-[4rem]
            !py-3
            !leading-tight
            placeholder-slate-400
            focus:outline-none
            focus:ring-2 focus:ring-primary/20
            focus:border-primary
            transition-all
            text-base
            text-slate-900
            tracking-tight
            font-dm-sans
            bg-white
            border border-slate-200
            rounded-md
            px-4
            shadow-sm
            flex-1
            w-auto
          "
                                    />

                                    <div className="cta-buttons-container flex gap-4 rounded-md items-center justify-center shrink-0">
                                        <div className="inline-block rounded-md h-full">
                                            <div className="codepen-button rounded-md h-full">

                                                <Link href={email ? `/signup?email=${encodeURIComponent(email)}` : '/signup'} className="h-full block">
                                                    <span className="flex items-center justify-center w-full text-center bg-[#1e293b] text-primary-foreground hover:bg-[#0f172a] transition-colors text-[6px] font-light tracking-wide font-dm-sans rounded-md py-2 px-3 shadow-sm whitespace-normal h-full min-h-[4rem] leading-tight max-w-[90px]">
                                                        Get Started
                                                    </span>
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="mt-8 flex items-center justify-center lg:justify-start gap-4">
                                    <Link href="/download" className="group flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-primary transition-colors">
                                        <Monitor className="h-4 w-4" />
                                        Download Desktop App
                                        <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-all -translate-x-1 group-hover:translate-x-0" />
                                    </Link>
                                </div>
                            </div>

                            {/* Right Column: UI Mockups */}
                            <div className="mt-8 sm:mt-0 relative [perspective:1000px]">
                                <Image src="/hero computer img original.png" alt="Product UI" width={1600} height={1200} className="w-full h-auto block" priority />
                            </div>
                        </div>
                    </main>


                    <MarqueeSection />



                    {/* Dashboard Preview Section - Carousel */}
                    <section className="relative w-full max-w-7xl mx-auto px-6 pb-24 mt-12 z-20">
                        <div className="flex flex-col items-center">
                            <div className="relative w-full rounded-xl overflow-hidden  ">
                                <div className="relative aspect-[16/10] w-full bg-slate-50">
                                    {slides.map((slide, index) => {
                                        const isActive = index === activeSlide;
                                        if (!isActive && index !== 0) return null;
                                        return (
                                            <div
                                                key={index}
                                                className={`absolute inset-0 transition-opacity duration-500 ease-in-out ${isActive ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
                                            >
                                                <Image
                                                    src={slide.src}
                                                    alt={slide.alt}
                                                    width={1400}
                                                    height={900}
                                                    className="w-full h-full object-contain"
                                                    priority={index === 0}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8 mt-8">
                                {slides.map((slide, index) => (
                                    <button
                                        key={index}
                                        onClick={() => setActiveSlide(index)}
                                        className={`pb-2 text-sm font-medium transition-all duration-300 relative group ${index === activeSlide
                                            ? 'text-primary'
                                            : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                    >
                                        {slide.label}
                                        <span className={`absolute bottom-0 left-0 w-full h-0.5 bg-primary transition-transform duration-300 origin-left ${index === activeSlide ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                                            }`} />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* Social Proof Section */}
                    <section className="bg-black">
                        <div className="max-w-7xl mr-auto ml-auto pt-12 pr-6 pb-12 pl-6">
                            <p className="uppercase text-xs font-medium tracking-tight font-dm-sans text-center mb-10 text-stone-300">
                                Powering various high-growth businesses
                            </p>

                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 border-t border-l border-stone-700">
                                <div className="flex flex-col gap-2 hover:opacity-100 hover:grayscale-0 transition-all cursor-pointer opacity-60 h-28 border-r border-b pt-6 pr-6 pb-6 pl-6 grayscale items-center justify-center border-stone-700">
                                    <ShoppingCart className="w-8 h-8 text-stone-400" />
                                    <span className="tracking-tight font-dm-sans text-sm text-stone-300 text-center">Online Retailers</span>
                                </div>
                                <div className="flex flex-col gap-2 hover:opacity-100 hover:grayscale-0 transition-all cursor-pointer opacity-60 h-28 border-r border-b pt-6 pr-6 pb-6 pl-6 grayscale items-center justify-center border-stone-700">
                                    <Shirt className="w-8 h-8 text-stone-400" />
                                    <span className="tracking-tight font-dm-sans text-sm text-stone-300 text-center">Fashion Boutiques</span>
                                </div>
                                <div className="flex flex-col gap-2 hover:opacity-100 hover:grayscale-0 transition-all cursor-pointer opacity-60 h-28 border-r border-b pt-6 pr-6 pb-6 pl-6 grayscale items-center justify-center border-stone-700">
                                    <Coffee className="w-8 h-8 text-stone-400" />
                                    <span className="tracking-tight font-dm-sans text-sm text-stone-300 text-center">Coffee Shops</span>
                                </div>
                                <div className="flex flex-col gap-2 hover:opacity-100 hover:grayscale-0 transition-all cursor-pointer opacity-60 h-28 border-r border-b pt-6 pr-6 pb-6 pl-6 grayscale items-center justify-center border-stone-700">
                                    <Sparkles className="w-8 h-8 text-stone-400" />
                                    <span className="tracking-tight font-dm-sans text-sm text-stone-300 text-center">Skincare Brands</span>
                                </div>
                                <div className="flex flex-col gap-2 hover:opacity-100 hover:grayscale-0 transition-all cursor-pointer opacity-60 h-28 border-r border-b pt-6 pr-6 pb-6 pl-6 grayscale items-center justify-center border-stone-700">
                                    <BookOpen className="w-8 h-8 text-stone-400" />
                                    <span className="tracking-tight font-dm-sans text-sm text-stone-300 text-center">Book Stores</span>
                                </div>
                                <div className="flex flex-col gap-2 hover:opacity-100 hover:grayscale-0 transition-all cursor-pointer opacity-60 h-28 border-r border-b pt-6 pr-6 pb-6 pl-6 grayscale items-center justify-center border-stone-700">
                                    <Smartphone className="w-8 h-8 text-stone-400" />
                                    <span className="tracking-tight font-dm-sans text-sm text-stone-300 text-center">Electronics Shops</span>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section id="features" className="py-24 px-6 bg-white border-t-2 border-slate-100 relative overflow-hidden">
                        <div className="absolute inset-0 z-0 opacity-50" style={{ backgroundImage: 'radial-gradient(circle at 25px 25px, hsl(var(--border)) 1px, transparent 0%)', backgroundSize: '50px 50px' }}></div>
                        <div className="max-w-7xl mx-auto relative z-10">
                            <div className="text-center max-w-2xl mx-auto mb-16">
                                <h2 className="text-4xl font-light text-slate-900 tracking-tight font-bricolage mb-4">
                                    Everything You Need to Grow
                                </h2>
                                <p className="text-lg text-slate-500 tracking-tight font-dm-sans mb-6">
                                    Zeneva is an all-in-one platform. From point-of-sale to a public storefront, we provide the tools to run your business efficiently.
                                </p>
                                <Button asChild variant="outline" size="sm">
                                    <Link href="/use-cases">Explore Use Cases</Link>
                                </Button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                                {[
                                    {
                                        icon: ShoppingCart,
                                        title: "Blazing-Fast POS",
                                        description: "A modern Point of Sale system that's intuitive, fast, and works seamlessly even when you're offline.",
                                        bgColor: "bg-blue-100",
                                        iconColor: "text-blue-600",
                                        hoverBg: "bg-[#EFF6FF]" // Light Blue
                                    },
                                    {
                                        icon: Globe,
                                        title: "E-Commerce Storefront",
                                        description: "Launch a beautiful, customizable online store in minutes. Your products sync automatically.",
                                        bgColor: "bg-green-100",
                                        iconColor: "text-green-600",
                                        hoverBg: "bg-[#FFF1F2]" // Light Pink
                                    },
                                    {
                                        icon: Bot,
                                        title: "AI-Powered Insights",
                                        description: "Go beyond simple reports. Zen AI acts as a sentinel for your business, identifying your most valuable products.",
                                        bgColor: "bg-purple-100",
                                        iconColor: "text-purple-600",
                                        hoverBg: "bg-[#FAFAF9]" // Light Stone/White
                                    },
                                    {
                                        icon: Users,
                                        title: "Integrated CRM",
                                        description: "Build lasting relationships. Every sale is linked to a customer profile to power your loyalty programs.",
                                        bgColor: "bg-pink-100",
                                        iconColor: "text-pink-600",
                                        hoverBg: "bg-[#FFFBEB]" // Light Cream/Yellow
                                    },
                                    {
                                        icon: BarChart2,
                                        title: "Advanced Reporting",
                                        description: "Deep-dive into your business performance with detailed reports on sales, profit & loss, and top products.",
                                        bgColor: "bg-sky-100",
                                        iconColor: "text-sky-600",
                                        hoverBg: "bg-[#EFF6FF]" // Light Blue
                                    },
                                    {
                                        icon: Lock,
                                        title: "Granular User Permissions",
                                        description: "Securely manage your team by inviting staff and assigning roles with granular permissions for inventory, reports, and sales.",
                                        bgColor: "bg-yellow-100",
                                        iconColor: "text-yellow-600",
                                        hoverBg: "bg-[#FFF1F2]" // Light Pink
                                    },
                                    {
                                        icon: WifiOff,
                                        title: "Robust Offline Mode",
                                        description: "Never miss a sale. The Zeneva POS is built to work perfectly offline, saving all transactions locally.",
                                        bgColor: "bg-gray-200",
                                        iconColor: "text-gray-700",
                                        hoverBg: "bg-[#FFFBEB]" // Light Cream/Yellow
                                    },
                                    {
                                        icon: Download,
                                        title: "Bulk Data Tools",
                                        description: "Migrate your existing inventory effortlessly with our smart CSV importer. Export your data at any time.",
                                        bgColor: "bg-teal-100",
                                        iconColor: "text-teal-600",
                                        hoverBg: "bg-[#EFF6FF]" // Light Blue
                                    },
                                    {
                                        icon: Clock,
                                        title: "Backorders & Backdating",
                                        description: "Effortlessly record sales for items that are out of stock. Backdate missed sales to keep your records perfectly accurate.",
                                        bgColor: "bg-rose-100",
                                        iconColor: "text-rose-600",
                                        hoverBg: "bg-[#FFF1F2]" // Light Rose
                                    },
                                    {
                                        icon: InfinityIcon,
                                        title: "Unlimited Sales Recording",
                                        description: "Record an infinite amount of sales transactions. The system scales effortlessly with your business volume without slowing down.",
                                        bgColor: "bg-cyan-100",
                                        iconColor: "text-cyan-600",
                                        hoverBg: "bg-[#ECFEFF]" // Light Cyan
                                    },
                                    {
                                        icon: FileText,
                                        title: "Process Invoicing",
                                        description: "Generate professional invoices instantly for B2B clients or unpaid orders. Track unpaid balances efficiently.",
                                        bgColor: "bg-fuchsia-100",
                                        iconColor: "text-fuchsia-600",
                                        hoverBg: "bg-[#FDF4FF]" // Light Fuchsia
                                    },
                                    {
                                        icon: ShieldCheck,
                                        title: "Security & Audit Log",
                                        description: "Enhance security with a detailed record of all critical events, complete with automated issue scanning.",
                                        bgColor: "bg-red-100",
                                        iconColor: "text-red-600",
                                        hoverBg: "bg-[#FAFAF9]" // Light Stone/White
                                    },
                                    {
                                        icon: Package,
                                        title: "Inventory Management",
                                        description: "Effortlessly track stock levels, manage variants, and receive low-stock alerts to ensure you never run out of your best-selling products.",
                                        bgColor: "bg-orange-100",
                                        iconColor: "text-orange-600",
                                        hoverBg: "bg-[#FFF7ED]" // Light Orange
                                    },
                                    {
                                        icon: ScanBarcode,
                                        title: "Barcode Scanning",
                                        description: "Speed up your checkout process significantly. Zeneva supports all standard barcode scanners for instant product lookup.",
                                        bgColor: "bg-indigo-100",
                                        iconColor: "text-indigo-600",
                                        hoverBg: "bg-[#EEF2FF]" // Light Indigo
                                    },
                                    {
                                        icon: Printer,
                                        title: "Receipt Printing",
                                        description: "Provide professional, branded receipts for every transaction. Compatible with most thermal receipt printers.",
                                        bgColor: "bg-amber-100",
                                        iconColor: "text-amber-600",
                                        hoverBg: "bg-[#FFFBEB]" // Light Amber
                                    }
                                ].map((feature, index) => (
                                    <div key={index} className="group relative p-8 bg-white border-2 border-dashed border-slate-200 rounded-lg overflow-hidden transition-all duration-300 isolate cursor-pointer shadow-sm">
                                        {/* Slide-in Background Animation */}
                                        <div className={`absolute inset-0 w-0 group-hover:w-full transition-all duration-500 ease-out ${feature.hoverBg} -z-10`}></div>

                                        <div className={`w-12 h-12 ${feature.bgColor} ${feature.iconColor} rounded-xl flex items-center justify-center mb-6 relative z-10 transition-colors duration-300 group-hover:bg-white/80`}>
                                            <feature.icon width="24" height="24" />
                                        </div>
                                        <h3 className="text-xl font-semibold text-slate-900 mb-2 relative z-10">{feature.title}</h3>
                                        <p className="text-slate-500 text-sm leading-relaxed relative z-10 group-hover:text-slate-700 transition-colors">{feature.description}</p>

                                        {/* Always visible corner accents */}
                                        <div className="absolute top-4 right-4 h-3 w-3 border-t-2 border-r-2 border-slate-300 z-10"></div>
                                        <div className="absolute bottom-4 left-4 h-3 w-3 border-b-2 border-l-2 border-slate-300 z-10"></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    <section ref={zenAIRef} id="how-it-works" className="py-24 px-6 bg-white border-t-2 border-slate-100 relative overflow-hidden bg-noise">
                        <div className="absolute inset-0 z-0 opacity-50" style={{ backgroundImage: 'radial-gradient(circle at 25px 25px, hsl(var(--border)) 1px, transparent 0%)', backgroundSize: '50px 50px' }}></div>
                        <div className="aura-background"></div>
                        <div className="sm:px-6 lg:px-8 max-w-7xl mx-auto relative z-10">
                            <div className="text-center mb-16">
                                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[10px] text-primary ring-1 ring-primary/20 uppercase tracking-tight mb-4 font-semibold">
                                    <Workflow className="mr-1 h-3 w-3" />
                                    The Operating System for Profit-Driven Retail
                                </span>
                                <h2 className="text-4xl md:text-5xl font-light tracking-tight text-slate-900 mb-6 font-bricolage">
                                    <Link href="/about/our-mission" className="text-primary transition-colors cursor-pointer">
                                        Zen AI: The Brain Behind Every Sale
                                    </Link>
                                </h2>
                                <p className="text-lg text-slate-500 font-light max-w-3xl mx-auto mb-8">
                                    Zeneva connects POS, inventory, storefront, CRM, and analytics into one intelligent system — with Zen AI at the center, turning daily operations into profit-maximizing decisions.
                                </p>

                                <div className="bg-white border-2 border-dashed border-slate-200 rounded-lg p-6 md:p-8 max-w-4xl mx-auto text-left relative overflow-hidden shadow-sm">
                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                        <BrainCircuit className="w-32 h-32 text-slate-900" />
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-8 relative z-10">
                                        <div>
                                            <h3 className="text-xl font-semibold mb-8 text-slate-900">What Zen AI actually does:</h3>
                                            <ul className="space-y-8">
                                                <li className="flex items-start gap-4">
                                                    <div className="bg-primary/10 p-2.5 rounded-xl shrink-0 border border-primary/20 shadow-sm">
                                                        <TrendingUp className="w-6 h-6 text-primary" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-slate-900 text-base">Revenue Opportunities</h4>
                                                        <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                                                            Predicts what will sell, when, and how much. Identifies best-selling SKUs by time and day.
                                                        </p>
                                                    </div>
                                                </li>
                                                <li className="flex items-start gap-4">
                                                    <div className="bg-primary/10 p-2.5 rounded-xl shrink-0 border border-primary/20 shadow-sm">
                                                        <Store className="w-6 h-6 text-primary" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-slate-900 text-base">Smart Merchandising</h4>
                                                        <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                                                            The best merchandiser that would increase impulse buying by showing optimal product placement.
                                                        </p>
                                                    </div>
                                                </li>
                                                <li className="flex items-start gap-4">
                                                    <div className="bg-primary/10 p-2.5 rounded-xl shrink-0 border border-primary/20 shadow-sm">
                                                        <Search className="w-6 h-6 text-primary" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-slate-900 text-base">Market Opportunities</h4>
                                                        <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                                                            Shows the business owner new untapped market opportunities and flags cash trapped in inventory.
                                                        </p>
                                                    </div>
                                                </li>
                                            </ul>
                                        </div>

                                        <div className="relative flex flex-col justify-center items-center py-4">
                                            {/* AI Connection Visual */}
                                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-[300px] pointer-events-none">
                                                <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-0.5 h-[60%] bg-gradient-to-b from-slate-200 via-primary/20 to-slate-200"></div>
                                            </div>

                                            {/* Central AI Node */}
                                            <div className="relative z-10 mb-8">
                                                <div className="w-14 h-14 bg-slate-900 rounded-full flex items-center justify-center shadow-lg ring-4 ring-white">
                                                    <Sparkles className="w-7 h-7 text-primary animate-pulse" />
                                                </div>
                                            </div>

                                            {/* Chat Bubbles */}
                                            <div className="space-y-6 w-full max-w-sm relative z-10">
                                                {/* Bubble 1 */}
                                                <div
                                                    onClick={handleFoodClick}
                                                    className="relative group cursor-pointer transform hover:scale-[1.02] transition-transform duration-300"
                                                >
                                                    {/* Icon - Outside Clipping */}
                                                    <div className="absolute -top-3 -left-3 bg-white border border-slate-100 p-1.5 rounded-full shadow-sm z-20">
                                                        <Bot className="w-4 h-4 text-emerald-600" />
                                                    </div>

                                                    {/* Clipped Card Container */}
                                                    <div className={`relative rounded-2xl rounded-tl-sm overflow-hidden bg-white shadow-xl transition-all duration-300 ${isFoodPulsing ? 'p-[2px]' : 'border border-slate-100'}`}>

                                                        {/* Spinning Beam Background */}
                                                        <div className={`absolute inset-[-50%] bg-[conic-gradient(from_0deg,transparent_0_280deg,#10b981_360deg)] animate-[spin_8s_linear_infinite] opacity-0 blur-md transition-opacity duration-300 ${isFoodPulsing ? 'opacity-100' : ''}`}></div>

                                                        {/* Content */}
                                                        <div className="relative bg-white p-5 h-full rounded-[inherit]">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                                                <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">Food & Perishables</span>
                                                            </div>
                                                            <p className="text-slate-600 text-sm leading-relaxed font-medium min-h-[60px] flex items-center transition-opacity duration-300">
                                                                “{foodInsights[foodIndex]}”
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Bubble 2 */}
                                                <div
                                                    onClick={handleFashionClick}
                                                    className="relative group cursor-pointer transform hover:scale-[1.02] transition-transform duration-300 ml-6"
                                                >
                                                    <div className="absolute -top-3 -right-3 bg-white border border-slate-100 p-1.5 rounded-full shadow-sm z-20">
                                                        <Bot className="w-4 h-4 text-blue-600" />
                                                    </div>

                                                    <div className={`relative rounded-2xl rounded-tr-sm overflow-hidden bg-white shadow-xl transition-all duration-300 ${isFashionPulsing ? 'p-[2px]' : 'border border-slate-100'}`}>
                                                        <div className={`absolute inset-[-50%] bg-[conic-gradient(from_0deg,transparent_0_280deg,#3b82f6_360deg)] animate-[spin_8s_linear_infinite] opacity-0 blur-md transition-opacity duration-300 ${isFashionPulsing ? 'opacity-100' : ''}`}></div>

                                                        <div className="relative bg-white p-5 h-full rounded-[inherit]">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                                                                <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">Fashion & Retail</span>
                                                            </div>
                                                            <p className="text-slate-600 text-sm leading-relaxed font-medium min-h-[60px] flex items-center transition-opacity duration-300">
                                                                “{fashionInsights[fashionIndex]}”
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="relative mx-auto max-w-4xl">
                                <div className="flex items-center justify-center gap-6 sm:gap-10 relative z-10">
                                    <div className="group relative cursor-pointer">
                                        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 border border-neutral-200 shadow-lg group-hover:scale-110 group-hover:border-primary/50 group-hover:shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)] transition-all duration-300">
                                            <Monitor className="text-neutral-600 group-hover:text-primary transition-colors h-6 w-6" />
                                        </span>
                                        <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-semibold tracking-wide text-neutral-500 uppercase transition-opacity">POS</span>
                                    </div>
                                    <div className="group relative cursor-pointer">
                                        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 border border-neutral-200 shadow-lg group-hover:scale-110 group-hover:border-primary/50 group-hover:shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)] transition-all duration-300">
                                            <Package className="text-neutral-600 group-hover:text-primary transition-colors h-6 w-6" />
                                        </span>
                                        <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-semibold tracking-wide text-neutral-500 uppercase transition-opacity">Inventory</span>
                                    </div>
                                    <div className="group relative cursor-pointer">
                                        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 border border-neutral-200 shadow-lg group-hover:scale-110 group-hover:border-primary/50 group-hover:shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)] transition-all duration-300">
                                            <Globe className="text-neutral-600 group-hover:text-primary transition-colors h-6 w-6" />
                                        </span>
                                        <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-semibold tracking-wide text-neutral-500 uppercase transition-opacity">Storefront</span>
                                    </div>
                                    <div className="group relative cursor-pointer">
                                        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 border border-neutral-200 shadow-lg group-hover:scale-110 group-hover:border-primary/50 group-hover:shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)] transition-all duration-300">
                                            <Users className="text-neutral-600 group-hover:text-primary transition-colors h-6 w-6" />
                                        </span>
                                        <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-semibold tracking-wide text-neutral-500 uppercase transition-opacity">CRM</span>
                                    </div>
                                    <div className="group relative cursor-pointer">
                                        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 border border-neutral-200 shadow-lg group-hover:scale-110 group-hover:border-primary/50 group-hover:shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)] transition-all duration-300">
                                            <BarChart3 className="text-neutral-600 group-hover:text-primary transition-colors h-6 w-6" />
                                        </span>
                                        <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-semibold tracking-wide text-neutral-500 uppercase transition-opacity">Analytics</span>
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
                                        <span className="font-medium text-xs">Smart Forecasting</span>
                                    </div>
                                    <div className="hidden sm:block w-16 h-px border-t border-dashed border-slate-200"></div>
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-200 bg-slate-100/80 cursor-pointer">
                                        <Bot className="h-4 w-4 text-primary" />
                                        <span className="font-medium text-xs">Actionable Insights</span>
                                    </div>
                                    <div className="hidden sm:block w-16 h-px border-t border-dashed border-slate-200"></div>
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-200 bg-slate-100/80 cursor-pointer">
                                        <Database className="h-4 w-4 text-primary" />
                                        <span className="font-medium text-xs">Unified Data</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Trust & Privacy Section */}
                    <section className="py-20 px-6 bg-slate-900 text-white relative overflow-hidden">
                        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay"></div>
                        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/20 rounded-full blur-[100px] pointer-events-none"></div>
                        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-500/20 rounded-full blur-[100px] pointer-events-none"></div>
                        
                        <div className="max-w-6xl mx-auto relative z-10">
                            <div className="text-center max-w-2xl mx-auto mb-12">
                                <ShieldCheck className="h-12 w-12 text-primary mx-auto mb-6" />
                                <h2 className="text-3xl md:text-4xl font-light tracking-tight font-bricolage mb-4">
                                    Enterprise-Grade Security
                                </h2>
                                <p className="text-lg text-slate-300 font-dm-sans">
                                    Zeneva is built on infrastructure that complies with the world's strictest security standards. Your data is protected by the same systems trusted by top global enterprises.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <div className="bg-slate-800/50 border border-slate-700/50 backdrop-blur-md rounded-2xl p-6 text-center hover:bg-slate-800 transition-colors">
                                    <div className="w-12 h-12 rounded-full bg-slate-700/50 flex items-center justify-center mx-auto mb-4">
                                        <Lock className="h-5 w-5 text-emerald-400" />
                                    </div>
                                    <h3 className="font-semibold text-lg mb-2">256-bit Encryption</h3>
                                    <p className="text-sm text-slate-400">Bank-level encryption for all your data at rest and in transit.</p>
                                </div>
                                <div className="bg-slate-800/50 border border-slate-700/50 backdrop-blur-md rounded-2xl p-6 text-center hover:bg-slate-800 transition-colors">
                                    <div className="w-12 h-12 rounded-full bg-slate-700/50 flex items-center justify-center mx-auto mb-4">
                                        <Shield className="h-5 w-5 text-blue-400" />
                                    </div>
                                    <h3 className="font-semibold text-lg mb-2">SOC 2 Compliant</h3>
                                    <p className="text-sm text-slate-400">Our cloud infrastructure undergoes regular rigorous SOC 2 & SOC 3 audits.</p>
                                </div>
                                <div className="bg-slate-800/50 border border-slate-700/50 backdrop-blur-md rounded-2xl p-6 text-center hover:bg-slate-800 transition-colors">
                                    <div className="w-12 h-12 rounded-full bg-slate-700/50 flex items-center justify-center mx-auto mb-4">
                                        <Server className="h-5 w-5 text-indigo-400" />
                                    </div>
                                    <h3 className="font-semibold text-lg mb-2">ISO 27001 Certified</h3>
                                    <p className="text-sm text-slate-400">Data centers certified for information security management.</p>
                                </div>
                                <div className="bg-slate-800/50 border border-slate-700/50 backdrop-blur-md rounded-2xl p-6 text-center hover:bg-slate-800 transition-colors">
                                    <div className="w-12 h-12 rounded-full bg-slate-700/50 flex items-center justify-center mx-auto mb-4">
                                        <Globe className="h-5 w-5 text-orange-400" />
                                    </div>
                                    <h3 className="font-semibold text-lg mb-2">GDPR Ready</h3>
                                    <p className="text-sm text-slate-400">Full data portability with easy exports and complete right to erasure.</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section id="business-types" className="py-24 px-6 bg-white border-t border-slate-100">
                        <div className="max-w-7xl mx-auto">
                            <div className="text-center max-w-2xl mx-auto mb-16">
                                <h2 className="text-4xl font-light text-slate-900 tracking-tight font-bricolage mb-4">
                                    Perfect for Your Business
                                </h2>
                                <p className="text-lg text-slate-500 tracking-tight font-dm-sans">
                                    Zeneva adapts to any retail environment. From fashion boutiques to electronics stores, our platform is built to handle your unique inventory needs.
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
                                            <div className="absolute bottom-0 left-0 p-4 md:p-6 text-white">
                                                <h3 className="text-2xl font-light tracking-tight font-bricolage">{type.name}</h3>
                                                <p className="mt-1 text-sm text-white/90">{type.description}</p>
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
                                    Choose the Perfect Plan for Your Business
                                </h2>
                                <p className="text-lg text-slate-500 tracking-tight font-dm-sans">
                                    Start free and stay free for as long as you like — no trial, no countdown, no credit card. Upgrade the day your shop outgrows it.
                                </p>
                            </div>

                            <div className="flex flex-col md:flex-row justify-center items-center gap-4 mb-12">
                                {/* Billing Toggle */}
                                <div className="inline-flex items-center p-1 bg-neutral-100/80 border-2 border-dashed border-neutral-200 rounded-xl">
                                    <button
                                        onClick={() => setBillingCycle('monthly')}
                                        className={`px-8 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${billingCycle === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Monthly
                                    </button>
                                    <button
                                        onClick={() => setBillingCycle('yearly')}
                                        className={`px-8 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${billingCycle === 'yearly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Yearly
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                {/* Starter Plan */}
                                <div className="relative flex flex-col p-8 bg-white border-2 border-dashed border-slate-200 rounded-lg shadow-sm">
                                    <h3 className="text-lg font-semibold leading-5">Starter</h3>
                                    <p className="mt-4 text-slate-500 text-sm">For new businesses getting started with inventory management.</p>

                                    <div className="mt-4">
                                        <span className="text-4xl font-bold tracking-tight">Free</span>
                                    </div>
                                    <ul className="mt-6 space-y-4 text-sm">
                                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> Up to 50 products</li>
                                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> 1 Staff Account</li>
                                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> Standard POS (Unlimited Sales)</li>
                                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> Basic Analytics</li>
                                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> Invoicing & Receipts</li>
                                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> <b>Free Online Storefront</b></li>
                                    </ul>
                                    <div className="mt-auto pt-6">
                                        <Button asChild size="lg" className="w-full">
                                            <Link href="/signup">Get Started for Free</Link>
                                        </Button>
                                    </div>
                                </div>
                                {/* Pro Plan */}
                                <div className="relative flex flex-col p-8 bg-white border-2 border-dashed border-primary rounded-lg shadow-2xl shadow-primary/10">
                                    <p className="absolute top-0 -translate-y-1/2 bg-primary text-white px-3 py-1 text-sm font-semibold tracking-wide rounded-full">Most Popular</p>
                                    <h3 className="text-lg font-semibold leading-5">Pro</h3>
                                    <p className="mt-4 text-slate-500 text-sm">For growing businesses that need advanced tools and an online presence.</p>

                                    <div className="mt-4">
                                        <span className="text-4xl font-bold tracking-tight">
                                            {billingCycle === 'monthly' ? '₦10,000' : '₦100,000'}
                                        </span>
                                        <span className="text-base font-medium text-slate-500">
                                            {billingCycle === 'monthly' ? '/mo' : '/year'}
                                        </span>
                                        {billingCycle === 'yearly' && (
                                            <div className="text-xs text-emerald-600 font-bold mt-1 block animate-pulse">Save ₦20,000!</div>
                                        )}
                                    </div>
                                    <ul className="mt-6 space-y-4 text-sm">
                                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> Up to 1,500 products</li>
                                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> 5 Staff Accounts</li>
                                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> Advanced POS with barcode scanning</li>
                                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> Invoicing & Debt Management</li>
                                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> Zen AI — 400 credits/month</li>
                                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> Smart Bulk Inventory Import</li>
                                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> Shareable Receipt Links (WhatsApp/SMS)</li>
                                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> Backorders & Backdating Capability</li>
                                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> Advanced Reports & Analytics</li>
                                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> AI Product Troubleshooter</li>
                                        <li className="flex items-center gap-3 font-semibold"><Check className="h-5 w-5 text-primary" /> Granular Staff Permissions (RBAC)</li>
                                    </ul>
                                    <div className="mt-auto pt-6">
                                        <Button asChild size="lg" className="w-full">
                                            <Link href="/signup">Upgrade to Pro</Link>
                                        </Button>
                                    </div>
                                </div>
                                {/* Business Plan */}
                                <div className="relative flex flex-col p-8 bg-white border-2 border-dashed border-slate-200 rounded-lg shadow-sm">
                                    <h3 className="text-lg font-semibold leading-5 text-slate-900">Business</h3>
                                    <p className="mt-4 text-slate-500 text-sm">For established businesses that require our most powerful AI tools and support.</p>
  
                                    <div className="mt-4">
                                        <span className="text-4xl font-bold tracking-tight">
                                            {billingCycle === 'monthly' ? '₦30,000' : '₦300,000'}
                                        </span>
                                        <span className="text-base font-medium text-slate-500">
                                            {billingCycle === 'monthly' ? '/mo' : '/year'}
                                        </span>
                                        {billingCycle === 'yearly' && (
                                            <div className="text-xs text-emerald-600 font-bold mt-1 block">Save ₦60,000!</div>
                                        )}
                                    </div>
                                    <ul className="mt-6 space-y-4 text-sm">
                                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> Unlimited products & staff accounts</li>
                                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> All features in Pro</li>
                                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> Zen AI — 1,500 credits/month</li>
                                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> AI Business Performance Dashboard</li>
                                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> Advanced Customer Intelligence (CRM+)</li>
                                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> Inventory Velocity Reports (ABC Analysis)</li>
                                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> Automated Email Receipts</li>
                                        <li className="flex items-center gap-3 font-semibold"><Check className="h-5 w-5 text-primary" /> Multi-Branch Management</li>
                                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-primary" /> Priority Phone & Email Support</li>
                                    </ul>
                                    <div className="mt-auto pt-6">
                                        <Button asChild size="lg" className="w-full">
                                            <Link href="/signup">Upgrade to Business</Link>
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>


                    <section id="faq" className="py-24 px-6 border-t bg-white border-slate-100">
                        <div className="max-w-3xl mr-auto ml-auto">
                            <h2 className="text-3xl tracking-tight mb-12 text-center font-bricolage font-light text-slate-900">Frequently asked questions</h2>
                            <Accordion type="multiple" className="w-full">
                                {faqItems.map((item, index) => (
                                    <AccordionItem key={index} value={`item-${index}`}>
                                        <AccordionTrigger className="text-lg text-left">{item.question}</AccordionTrigger>
                                        <AccordionContent className="text-base text-muted-foreground leading-relaxed">
                                            {item.answer}
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                            <div className="text-center mt-12">
                                <p className="mb-4 font-dm-sans tracking-tight text-neutral-600">Still have questions?</p>
                                <Button asChild>
                                    <a href="#contact">Contact Us</a>
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

                        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center relative z-10 text-left">
                            <div>
                                <h2 className="text-4xl md:text-5xl font-light tracking-tight mb-6 font-bricolage text-slate-900">
                                    Turn Data Into Profit — <span className="text-primary">Automatically</span>
                                </h2>
                                <p className="text-lg text-slate-500 mb-8 leading-relaxed">
                                    Zeneva doesn’t just track activity. It actively pushes your business toward maximum profit by balancing demand, stock levels, and customer behavior in real time.
                                </p>

                                <div className="space-y-6 mb-10">
                                    <div className="flex gap-4">
                                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                            <TrendingUp className="w-6 h-6 text-primary" />
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-semibold text-slate-900">Reduce stockouts</h4>
                                            <p className="text-slate-500">Capture lost demand before it disappears.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                            <DollarSign className="w-6 h-6 text-primary" />
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-semibold text-slate-900">Reduce overstock</h4>
                                            <p className="text-slate-500">Free locked capital for growth.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                            <Box className="w-6 h-6 text-primary" />
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-semibold text-slate-900">Optimize production timing</h4>
                                            <p className="text-slate-500">Zero waste. Peak freshness.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                            <Trophy className="w-6 h-6 text-primary" />
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-semibold text-slate-900">Identify winning products</h4>
                                            <p className="text-slate-500">Double down with confidence.</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 bg-white/10 backdrop-blur-xl rounded-xl border border-white/20 shadow-sm">
                                    <p className="text-lg font-medium text-slate-900 text-center">
                                        Every decision moves the profit dial forward.
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

                    <a href="https://wa.me/2349064233805?text=Hello%2C%20I'm%20interested%20in%20Zeneva.%20I'd%20like%20to%20learn%20more%20about%20how%20it%20can%20help%20my%20business." target="_blank" rel="noopener noreferrer" className="whatsapp-button z-50" aria-label="Contact us on WhatsApp">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
                            <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.06 2.264v.114c-.015.99.472 1.977 1.017 2.78 1.23 1.82 2.506 3.41 4.554 4.34.616.287 2.035.888 2.722.888.817 0 2.15-.515 2.478-1.318.13-.33.244-.73.244-1.088 0-.058 0-.144-.03-.215-.1-.172-2.434-1.39-2.678-1.39zm-2.908 7.593c-1.747 0-3.48-.53-4.942-1.49L7.793 24.41l1.132-3.337a8.955 8.955 0 0 1-1.72-5.272c0-4.955 4.04-8.995 8.997-8.995S25.2 10.845 25.2 15.8c0 4.958-4.04 8.998-8.998 8.998zm0-19.798c-5.96 0-10.8 4.842-10.8 10.8 0 1.964.53 3.898 1.546 5.574L5 27.176l5.974-1.92a10.807 10.807 0 0 0 16.03-9.455c0-5.958-4.842-10.8-10.802-10.8z" fillRule="evenodd" fill="#ffffff"></path>
                        </svg>
                    </a>




                    {/* Global Payments Banner */}
                    <section className="pt-20 pb-0 px-6">
                        <div className="max-w-7xl mx-auto">
                            <div className="relative overflow-hidden rounded-3xl bg-stone-950 text-white p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-12 group shadow-2xl border border-white/5">
                                {/* Abstract background pattern */}
                                <div className="absolute inset-0 z-0 opacity-10" style={{
                                    backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                                    backgroundSize: '32px 32px'
                                }}></div>
                                <div className="absolute -top-24 -left-24 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
                                
                                <div className="relative z-10 max-w-xl text-left">
                                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4 font-bricolage leading-tight">
                                        Global Access. <br />Seamless <span className="text-primary">USD</span> Subscriptions.
                                    </h2>
                                    <p className="text-sm md:text-base text-white/70 mb-8 leading-relaxed max-w-md font-light">
                                        Zeneva is built for the world. We accept international card payments and USD subscription billing, ensuring you can access our premium retail operating system from anywhere on the planet.
                                    </p>
                                    <Link href="/signup" className="inline-flex items-center gap-2 text-white font-semibold group/link border-b border-transparent hover:border-white transition-all py-1">
                                        <span className="text-sm">Get Started on Zeneva Today</span>
                                        <ArrowRight className="w-4 h-4 transition-transform group-hover/link:translate-x-1" />
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

                    <MarketingFooter />
                </div >
            </div >
        </ThemeProvider >
    );
}
