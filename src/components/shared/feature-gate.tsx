'use client';

import * as React from 'react';
import { Check, ShieldCheck, Zap, Sparkles, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import { getCountryFromIP } from '@/lib/utils';

const AnalyticsIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="chart-grad1" x1="0" y1="0" x2="0" y2="100%">
        <stop offset="0%" stopColor="#60A5FA" />
        <stop offset="100%" stopColor="#3B82F6" />
      </linearGradient>
      <linearGradient id="chart-grad2" x1="0" y1="0" x2="0" y2="100%">
        <stop offset="0%" stopColor="#818CF8" />
        <stop offset="100%" stopColor="#6366F1" />
      </linearGradient>
      <linearGradient id="chart-grad3" x1="0" y1="0" x2="0" y2="100%">
        <stop offset="0%" stopColor="#A78BFA" />
        <stop offset="100%" stopColor="#8B5CF6" />
      </linearGradient>
      <linearGradient id="trend-line" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.5" />
        <stop offset="100%" stopColor="#FFFFFF" />
      </linearGradient>
      <filter id="glow-blue" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="4" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    <rect x="20" y="50" width="16" height="30" rx="4" fill="url(#chart-grad1)" />
    <rect x="42" y="30" width="16" height="50" rx="4" fill="url(#chart-grad2)" />
    <rect x="64" y="10" width="16" height="70" rx="4" fill="url(#chart-grad3)" />
    <path d="M 28 55 L 50 35 L 72 15" stroke="url(#trend-line)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow-blue)" />
    <circle cx="72" cy="15" r="4" fill="#FFFFFF" filter="url(#glow-blue)" />
  </svg>
);

const PremiumCoinIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="gold-base" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FDE68A" />
        <stop offset="50%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#B45309" />
      </linearGradient>
      <linearGradient id="gold-inner" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#FEF3C7" />
        <stop offset="50%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#D97706" />
      </linearGradient>
      <filter id="glow-gold" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    <circle cx="50" cy="50" r="40" fill="url(#gold-base)" />
    <circle cx="50" cy="50" r="32" fill="url(#gold-inner)" />
    <path d="M 50 25 V 75 M 35 40 H 65 M 35 60 H 65 M 40 30 Q 60 30 60 50 Q 60 70 40 70" stroke="#FFFBEB" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" filter="url(#glow-gold)"/>
    <circle cx="75" cy="25" r="4" fill="#FFFFFF" filter="url(#glow-gold)" />
    <circle cx="20" cy="65" r="3" fill="#FFFFFF" filter="url(#glow-gold)" opacity="0.6"/>
  </svg>
);

const AIIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="ai-grad1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F472B6" />
        <stop offset="50%" stopColor="#D946EF" />
        <stop offset="100%" stopColor="#8B5CF6" />
      </linearGradient>
      <linearGradient id="ai-grad2" x1="100%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#38BDF8" />
        <stop offset="100%" stopColor="#6366F1" />
      </linearGradient>
      <filter id="glow-ai" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="5" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    <path d="M 50 15 L 80 32 L 80 68 L 50 85 L 20 68 L 20 32 Z" fill="url(#ai-grad1)" opacity="0.8" />
    <path d="M 50 25 L 70 38 L 70 62 L 50 75 L 30 62 L 30 38 Z" fill="url(#ai-grad2)" filter="url(#glow-ai)" />
    <circle cx="50" cy="50" r="10" fill="#FFFFFF" filter="url(#glow-ai)" />
    <path d="M 50 50 L 50 25 M 50 50 L 70 62 M 50 50 L 30 62" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
    <circle cx="30" cy="20" r="3" fill="#F472B6" filter="url(#glow-ai)" />
    <circle cx="85" cy="50" r="4" fill="#38BDF8" filter="url(#glow-ai)" />
    <circle cx="20" cy="80" r="2" fill="#8B5CF6" filter="url(#glow-ai)" />
  </svg>
);

interface FeaturePoint {
  title: string;
  description: string;
}

interface FeatureGateProps {
  children: React.ReactNode;
  requiredPlan: 'pro' | 'business';
  currentPlan: 'starter' | 'pro' | 'business' | undefined;
  hasLifetimeAccess: boolean;
  featureName: string;
  featureDescription: string;
  featurePoints?: FeaturePoint[];
  icon?: React.ElementType;
  className?: string;
  placeholderContent?: React.ReactNode;
  isLoading?: boolean;
  bypass?: boolean;
  variant?: 'full' | 'compact' | 'rich';
}

export default function FeatureGate({
  children,
  requiredPlan,
  currentPlan,
  hasLifetimeAccess,
  featureName,
  featureDescription,
  featurePoints,
  icon: Icon = BarChart2,
  className,
  placeholderContent,
  isLoading,
  bypass,
  variant = 'full',
}: FeatureGateProps) {
  const planHierarchy = {
    starter: 0,
    pro: 1,
    business: 2,
  };

  const userPlanLevel = planHierarchy[currentPlan || 'starter'];
  const requiredPlanLevel = planHierarchy[requiredPlan];

  const hasAccess = bypass || hasLifetimeAccess || userPlanLevel >= requiredPlanLevel;

  const [currency, setCurrency] = React.useState<'USD' | 'NGN'>('USD');

  React.useEffect(() => {
    getCountryFromIP().then((country) => {
      if (country === 'Nigeria') {
        setCurrency('NGN');
      } else {
        setCurrency('USD');
      }
    });
  }, []);

  if (isLoading) {
    return (
        <div className={`flex flex-col items-center justify-center p-12 min-h-[300px] ${className}`}>
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-xs text-muted-foreground mt-4 animate-pulse">Verifying credentials...</p>
        </div>
    );
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  const UpgradeNotice = () => (
    <FeatureGateUpgradeCard
      featureName={featureName}
      featureDescription={featureDescription}
      requiredPlan={requiredPlan}
      icon={Icon}
      featurePoints={featurePoints}
      currency={currency}
    />
  );

  const RichSectionNotice = () => (
    <div className="bg-background border rounded-xl shadow-xl max-w-sm w-full p-4 text-left border-orange-100 dark:border-orange-950/40 relative z-20">
        <h3 className="text-base font-bold tracking-tight mb-0.5 text-stone-900 dark:text-stone-100">Unlock {featureName}</h3>
        <p className="text-muted-foreground text-xs leading-normal mb-3">{featureDescription}</p>
        
        <div className="bg-gradient-to-r from-orange-50 via-orange-50/50 to-transparent dark:from-orange-950/10 dark:via-orange-950/5 to-transparent rounded-lg p-3 mb-3 border border-orange-100/50 dark:border-orange-950/20">
            <h4 className="text-xs font-bold text-orange-950 dark:text-orange-400 mb-1">
                Upgrade to {requiredPlan === 'business' ? 'Business' : 'Pro'}
            </h4>
            <p className="text-[11px] text-stone-700 dark:text-stone-300 font-medium">
                Unlocks reports, Zen AI tools, and unlimited products/inventory.
            </p>
        </div>

        <div className="flex items-center justify-between gap-4">
            <Button asChild size="sm" className="text-[11px] h-8 px-3.5 bg-orange-600 hover:bg-orange-700 text-white font-medium">
                <Link href="/billing">Get {requiredPlan === 'business' ? 'Business' : 'Pro'}</Link>
            </Button>
            <div className="text-[11px] text-muted-foreground font-medium">
                Starting at <span className="font-semibold text-foreground">{currency === 'NGN' ? (requiredPlan === 'business' ? '₦30,000' : '₦10,000') : (requiredPlan === 'business' ? '$30' : '$10')}/mo</span>.
            </div>
        </div>
    </div>
  );

  const CompactUpgradeNotice = () => (
    <div className="bg-background border rounded-xl shadow-xl max-w-xs w-full p-3.5 text-left border-orange-100/80 dark:border-orange-950/40 relative z-20">
        <h3 className="text-sm font-bold tracking-tight mb-0.5 text-stone-900 dark:text-stone-100">Unlock {featureName}</h3>
        
        <div className="bg-gradient-to-r from-orange-50/70 via-orange-50/30 to-transparent dark:from-orange-950/10 dark:via-orange-950/5 to-transparent rounded-lg p-2.5 mb-2.5 border border-orange-100/30 dark:border-orange-950/10">
            <h4 className="text-xs font-bold text-orange-950 dark:text-orange-400 mb-0.5">
                Requires {requiredPlan === 'business' ? 'Business' : 'Pro'} Plan
            </h4>
            <p className="text-[10px] text-stone-700 dark:text-stone-300 leading-tight">
                Unlock detailed statistics, AI analytics, and more.
            </p>
        </div>

        <div className="flex items-center justify-between gap-3 pt-0.5">
            <Button asChild size="sm" className="text-[10px] h-7 px-3 bg-orange-600 hover:bg-orange-700 text-white font-medium">
                <Link href="/billing">Upgrade</Link>
            </Button>
            <div className="text-[10px] text-muted-foreground">
                {currency === 'NGN' ? (requiredPlan === 'business' ? '₦30,000' : '₦10,000') : (requiredPlan === 'business' ? '$30' : '$10')}/mo
            </div>
        </div>
    </div>
  );

  const ActiveNotice = variant === 'rich' 
    ? RichSectionNotice 
    : variant === 'compact' 
      ? CompactUpgradeNotice 
      : UpgradeNotice;

  if (placeholderContent) {
    return (
        <div className={`relative ${className} ${!hasAccess && variant === 'full' ? 'min-h-[600px]' : ''}`}>
            <div className="grid gap-6">
                {placeholderContent}
            </div>
            <div className="absolute inset-0 bg-background/70 backdrop-blur-sm z-10 rounded-lg p-4 pointer-events-auto flex flex-col items-center justify-start py-12 overflow-y-auto">
                <ActiveNotice />
            </div>
        </div>
    )
  }

  return (
    <div className={`relative ${className} ${!hasAccess && variant === 'full' ? 'min-h-[600px]' : ''}`}>
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm z-10 rounded-lg p-4 pointer-events-auto flex flex-col items-center justify-start py-12 overflow-y-auto">
        <ActiveNotice />
      </div>
      <div className="opacity-30 blur-[4px] pointer-events-none select-none transition-all duration-500">{children}</div>
    </div>
  );
}

export function FeatureGateUpgradeCard({
  featureName,
  featureDescription,
  requiredPlan,
  icon: Icon = BarChart2,
  featurePoints,
  currency = 'USD',
  onUpgradeClick
}: {
  featureName: string;
  featureDescription: string;
  requiredPlan: 'pro' | 'business';
  icon?: React.ElementType;
  featurePoints?: { title: string; description: string }[];
  currency?: 'USD' | 'NGN';
  onUpgradeClick?: () => void;
}) {
  const defaultFeaturePoints = [
    { title: "Analytical Reports", description: "Get full access to detailed business graphs and analytics." },
    { title: "AI Executive Briefing", description: "Obtain automated ratings and smart health advice for your store." },
    { title: "Unlimited Access", description: "Track items, branches, and logs without limits." }
  ];

  const pointsToDisplay = featurePoints || defaultFeaturePoints;

  return (
    <div className="bg-background border border-dashed border-orange-500/40 bg-gradient-to-b from-orange-500/10 via-background to-background backdrop-blur-md overflow-hidden rounded-xl max-w-lg w-full p-8 text-center relative">
        {/* Premium Highlighted Icon with sparkles */}
        <div className="mx-auto mb-6 relative w-24 h-24 flex items-center justify-center">
          <div className="absolute inset-0 bg-amber-500/10 blur-xl rounded-full scale-150 animate-pulse" />
          <Sparkles className="absolute -top-1 -right-1 h-5 w-5 text-amber-500 animate-bounce" />
          <Sparkles className="absolute -bottom-2 -left-2 h-4 w-4 text-amber-400 opacity-75" />
          <div className="absolute top-8 -left-4 h-2.5 w-2.5 rounded-full bg-amber-300 animate-ping" />
          <div className="absolute bottom-8 -right-4 h-2 w-2 rounded-full bg-amber-400" />
          
          <div className="relative z-10 w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-pink-600 p-[3px] shadow-lg">
            <div className="w-full h-full bg-background rounded-[13px] flex items-center justify-center">
              <Icon className="h-9 w-9 text-orange-500" />
            </div>
          </div>
        </div>

        <h3 className="text-2xl sm:text-3xl font-black tracking-tight mb-2">Unlock {featureName}</h3>
        <p className="text-muted-foreground text-sm mb-6 leading-relaxed px-4">{featureDescription}</p>
        
        <div className="space-y-3.5 mb-8">
          {pointsToDisplay.map((point, index) => (
            <div key={index} className="flex items-start gap-3">
              <Check className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground text-left font-medium">
                <strong className="text-foreground font-semibold">{point.title}</strong>: {point.description}
              </p>
            </div>
          ))}
        </div>

        <div className="space-y-3 pt-2">
            <Button asChild onClick={onUpgradeClick} className="w-full h-12 bg-orange-400 hover:bg-orange-500 text-white hover:text-white font-extrabold rounded-full shadow-md hover:scale-[1.01] active:scale-95 transition-all duration-300">
                <Link href="/billing">Get {requiredPlan === 'business' ? 'Business' : 'Pro'} Plan</Link>
            </Button>
            <div className="text-xs text-muted-foreground font-semibold">
                Starting at <span className="font-extrabold text-foreground">{currency === 'NGN' ? (requiredPlan === 'business' ? '₦30,000' : '₦10,000') : (requiredPlan === 'business' ? '$30' : '$10')}/mo</span>.
            </div>
        </div>
    </div>
  );
}
