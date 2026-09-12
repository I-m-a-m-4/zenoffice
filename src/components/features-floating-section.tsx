import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
    Tag,
    Palette,
    Users,
    FileText,
    PieChart,
    BarChart3,
    TicketPercent,
    Coins,
    UserCircle,
    ScanBarcode,
    ClipboardList,
    BrainCircuit
} from 'lucide-react';

interface FeatureIconProps {
    icon: React.ElementType;
    label: string;
    className?: string; // For positioning
}

const FeatureIcon = ({ icon: Icon, label, className }: FeatureIconProps) => {
    return (
        <div className={`absolute flex flex-col items-center gap-2 transform hover:scale-110 transition-transform duration-300 ${className}`}>
            <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center text-primary">
                <Icon size={28} strokeWidth={1.5} />
            </div>
            <span className="text-xs font-medium text-slate-700 text-center max-w-[100px] leading-tight opacity-80">
                {label}
            </span>
        </div>
    );
};

export function FeaturesFloatingSection() {
    return (
        <section className="py-32 px-6 relative overflow-hidden bg-[#FFF8F0]">
            <div className="max-w-7xl mx-auto relative h-auto md:h-[600px] flex flex-col items-center justify-center text-center z-10 w-full">

                {/* Central Content */}
                <div className="max-w-2xl relative z-20 mb-12 md:mb-0">
                    <h2 className="text-4xl md:text-5xl font-medium tracking-tight font-bricolage text-slate-900 mb-8 leading-tight">
                        One app that has all the features your business needs to grow.
                    </h2>
                    {/* Updated to orange theme (primary) */}
                    <Button asChild size="lg" className="bg-primary hover:bg-orange-600 text-white px-8 h-12 text-base font-medium rounded-md shadow-lg shadow-orange-900/10">
                        <Link href="/signup">
                            Get Started
                        </Link>
                    </Button>
                </div>

                {/* Floating Icons - Positioning roughly based on the image provided */}
                {/* Hidden on mobile, visible on md+ */}

                {/* Top Left */}
                <FeatureIcon icon={Tag} label="Manage Inventory" className="top-10 left-[10%] hidden md:flex" />
                <FeatureIcon icon={Palette} label="Website Builder" className="top-4 left-[28%] hidden lg:flex" />

                {/* Top Right */}
                <FeatureIcon icon={BrainCircuit} label="Zen AI" className="top-16 right-[35%] hidden lg:flex" />
                <FeatureIcon icon={Users} label="Manage Staff" className="top-12 right-[20%] hidden md:flex" />

                {/* Right Side */}
                <FeatureIcon icon={FileText} label="Invoices & Receipts" className="top-[30%] right-[2%] hidden lg:flex" />
                <FeatureIcon icon={BarChart3} label="Business Reports" className="top-[50%] right-[10%] hidden md:flex" />

                {/* Bottom Right */}
                <FeatureIcon icon={Coins} label="Multi-Currency" className="bottom-[20%] right-[18%] hidden lg:flex" />

                {/* Bottom Center/Left */}
                <FeatureIcon icon={ScanBarcode} label="Barcode Generator" className="bottom-8 right-[35%] hidden lg:flex" />
                <FeatureIcon icon={UserCircle} label="Customer Records" className="bottom-12 left-[32%] hidden md:flex" />

                {/* Left Side */}
                <FeatureIcon icon={ClipboardList} label="Record Expenses" className="bottom-8 left-[5%] hidden md:flex" />
                <FeatureIcon icon={TicketPercent} label="Discounts & Coupons" className="bottom-[25%] left-[12%] hidden lg:flex" />
                <FeatureIcon icon={PieChart} label="Business Analytics" className="top-[40%] left-[8%] hidden md:flex" />

                {/* Mobile Grid View - Shown only on small screens */}
                <div className="md:hidden grid grid-cols-2 gap-4 w-full px-4">
                    <div className="flex items-center gap-3 p-4 bg-white/80 rounded-xl shadow-sm border border-orange-100/50">
                        <Tag size={20} className="text-primary shrink-0" /> <span className="text-sm font-medium text-slate-800">Inventory</span>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-white/80 rounded-xl shadow-sm border border-orange-100/50">
                        <BrainCircuit size={20} className="text-primary shrink-0" /> <span className="text-sm font-medium text-slate-800">Zen AI</span>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-white/80 rounded-xl shadow-sm border border-orange-100/50">
                        <BarChart3 size={20} className="text-primary shrink-0" /> <span className="text-sm font-medium text-slate-800">Reports</span>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-white/80 rounded-xl shadow-sm border border-orange-100/50">
                        <Users size={20} className="text-primary shrink-0" /> <span className="text-sm font-medium text-slate-800">Staff</span>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-white/80 rounded-xl shadow-sm border border-orange-100/50">
                        <Palette size={20} className="text-primary shrink-0" /> <span className="text-sm font-medium text-slate-800">Website</span>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-white/80 rounded-xl shadow-sm border border-orange-100/50">
                        <FileText size={20} className="text-primary shrink-0" /> <span className="text-sm font-medium text-slate-800">Invoices</span>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-white/80 rounded-xl shadow-sm border border-orange-100/50">
                        <UserCircle size={20} className="text-primary shrink-0" /> <span className="text-sm font-medium text-slate-800">CRM</span>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-white/80 rounded-xl shadow-sm border border-orange-100/50">
                        <Coins size={20} className="text-primary shrink-0" /> <span className="text-sm font-medium text-slate-800">Payments</span>
                    </div>
                </div>

            </div>
        </section>
    );
}
