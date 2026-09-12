'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { Trophy, Users, DollarSign, Sparkles, ShoppingBag, Store, Star, ArrowUpRight, Flame, Heart, Loader, X } from 'lucide-react';
import type { Receipt, Product, BusinessInstance, UserProfile } from '@/types';
import Confetti from '@/components/shared/confetti';
import { cn } from '@/lib/utils';
import {
  billingCurrencyByBusiness,
  internalOwnerIds,
  subscriptionRunRate,
} from '@/lib/platform-revenue';
import { adminApiFetch } from '@/lib/admin-api';

// =================================================================
// AchievementModal Component
// =================================================================
interface AchievementModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  isDarkMode: boolean;
}

export const AchievementModal: React.FC<AchievementModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  isDarkMode
}) => {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowConfetti(true);
    } else {
      setShowConfetti(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <Confetti trigger={showConfetti} onComplete={() => setShowConfetti(false)} />
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in zoom-in duration-300">
        <div className={cn(
          "relative w-full max-w-md p-8 rounded-2xl shadow-2xl border flex flex-col items-center text-center overflow-hidden",
          isDarkMode ? 'bg-[#0f172a] border-primary/30' : 'bg-white border-primary/20'
        )}>
          {/* Decorative background glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-primary/20 rounded-full blur-[60px] pointer-events-none" />

          <button onClick={onClose} className={cn(
            "absolute top-4 right-4 p-2 rounded-full transition-colors z-10",
            isDarkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-800/10'
          )}>
            <X className="w-5 h-5" />
          </button>
          
          <div className="text-7xl mb-6 animate-bounce">🎉</div>
          
          <h2 className={cn(
            "text-3xl font-black tracking-tight mb-3 bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent"
          )}>
            {title}
          </h2>
          
          <p className={cn(
            "text-sm font-medium mb-8 leading-relaxed",
            isDarkMode ? 'text-slate-300' : 'text-slate-600'
          )}>
            {message}
          </p>
          
          <button 
            onClick={onClose} 
            className="px-8 py-3 bg-primary hover:bg-primary/90 text-slate-950 font-black tracking-wider uppercase text-sm rounded-xl shadow-lg shadow-primary/30 transition-all transform hover:scale-105 active:scale-95"
          >
            Awesome!
          </button>
        </div>
      </div>
    </>
  );
};

// =================================================================
// AchievementsPage Component
// =================================================================
// Helper to convert Firebase Admin timestamp objects
const reviveTimestamps = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    if (obj instanceof Date) return obj;
    if (Array.isArray(obj)) return obj.map(reviveTimestamps);
    
    if (typeof obj === 'object') {
        if ('_seconds' in obj && '_nanoseconds' in obj) {
            const ms = obj._seconds * 1000 + obj._nanoseconds / 1000000;
            const d = new Date(ms);
            return {
                seconds: obj._seconds,
                nanoseconds: obj._nanoseconds,
                toDate: () => d
            };
        }
        
        const newObj: any = {};
        for (const key in obj) {
            newObj[key] = reviveTimestamps(obj[key]);
        }
        return newObj;
    }
    return obj;
};

export default function AchievementsPage() {
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';

  const [showConfetti, setShowConfetti] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState<any>(null);

  const [adminData, setAdminData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchAdminData = async () => {
      try {
          setLoadError(null);
          // adminApiFetch, not a bare relative fetch: in the Tauri bundle a relative
          // path resolves against tauri://localhost and 404s. It also attaches the
          // ID token the endpoint now requires.
          const data = await adminApiFetch('/api/admin/metrics', { timeoutMs: 90000 });
          const revivedData = reviveTimestamps(data);
          setAdminData(revivedData);
      } catch (error: any) {
          console.error('Failed to fetch admin data:', error);
          setLoadError(error?.message || 'Could not load platform metrics.');
      } finally {
          setIsLoading(false);
      }
  };

  useEffect(() => {
      fetchAdminData();
  }, []);

  const triggerConfetti = () => {
    setShowConfetti(true);
  };

  const stats = useMemo(() => {
    if (!adminData) return null;

    const { businesses, products, receipts, users, purchases } = adminData;

    const totalSales = (receipts || []).length;
    const totalProducts = (products || []).length;
    const activeSellers = (businesses || []).filter((b: any) => b.status !== 'deleted').length;
    const totalGmv = (receipts || []).reduce((sum: number, r: any) => sum + (r.total || 0), 0);
    const totalUsers = (users || []).length;
    
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dailyActiveUsers = (users || []).filter((u: any) => {
      if (!u.lastSeen) return false;
      const date = u.lastSeen.toDate ? u.lastSeen.toDate() : new Date(u.lastSeen);
      return date > oneDayAgo;
    }).length;
    
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const activeWithin7Days = (users || []).filter((u: any) => {
      if (!u.lastSeen) return false;
      const date = u.lastSeen.toDate ? u.lastSeen.toDate() : new Date(u.lastSeen);
      return date > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    }).length;
    const totalOldUsers = (users || []).filter((u: any) => {
      const date = u.createdAt?.toDate ? u.createdAt.toDate() : new Date(u.createdAt || Date.now());
      return date < thirtyDaysAgo;
    }).length;
    const retentionPercentage = totalOldUsers > 0 ? Math.round((activeWithin7Days / totalOldUsers) * 100) : 100;

    // Calculate MRR and ARR
    //
    // Read off the subscriptions that are live right now rather than summed from
    // the last 30 days of payments: an annual subscriber who paid in January
    // contributes nothing in March despite still paying us, and one who just paid
    // a year up front contributes twelve months to a single month. Shared with the
    // admin dashboard and the cap table valuation so all three agree.
    const { mrr } = subscriptionRunRate({
        businesses: businesses || [],
        internalOwners: internalOwnerIds(users || []),
        billingCurrencies: billingCurrencyByBusiness(purchases || []),
        purchases: purchases || [],
    });
    const arr = mrr * 12;

    return {
      totalGmv,
      totalUsers,
      totalSuccessfulOrders: totalSales,
      activeSellers,
      totalProducts,
      dailyActiveUsers,
      retentionPercentage,
      mrr,
      arr
    };
  }, [adminData]);

  const achievements = useMemo(() => {
    return [
      // GMV Milestones
      {
        id: "achievement_100k_gmv",
        title: "₦100K GMV Milestone",
        description: "Zeneva successfully crossed ₦100,000 in Gross Merchandise Value.",
        icon: DollarSign,
        color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
        unlocked: stats ? stats.totalGmv >= 100000 : false,
      },
      {
        id: "achievement_1m_gmv",
        title: "₦1M GMV Milestone",
        description: "Zeneva crosses ₦1,000,000 in Gross Merchandise Value.",
        icon: DollarSign,
        color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
        unlocked: stats ? stats.totalGmv >= 1000000 : false,
      },
      {
        id: "achievement_10m_gmv",
        title: "₦10M GMV Milestone",
        description: "Zeneva crosses ₦10,000,000 in Gross Merchandise Value.",
        icon: Trophy,
        color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
        unlocked: stats ? stats.totalGmv >= 10000000 : false,
      },
      {
        id: "achievement_50m_gmv",
        title: "₦50M GMV Milestone",
        description: "Zeneva crosses ₦50,000,000 in Gross Merchandise Value.",
        icon: Flame,
        color: "bg-orange-500/10 text-orange-500 border-orange-500/20",
        unlocked: stats ? stats.totalGmv >= 50000000 : false,
      },
      {
        id: "achievement_100m_gmv",
        title: "₦100M GMV Milestone",
        description: "Zeneva crosses ₦100,000,000 in Gross Merchandise Value.",
        icon: Flame,
        color: "bg-red-500/10 text-red-500 border-red-500/20",
        unlocked: stats ? stats.totalGmv >= 100000000 : false,
      },
      // Revenue Milestones (MRR)
      {
        id: "achievement_10k_mrr",
        title: "₦10K MRR",
        description: "Zeneva crossed ₦10,000 in Monthly Recurring Revenue.",
        icon: DollarSign,
        color: "bg-green-500/10 text-green-500 border-green-500/20",
        unlocked: stats ? stats.mrr >= 10000 : false,
      },
      {
        id: "achievement_100k_mrr",
        title: "₦100K MRR",
        description: "Zeneva crossed ₦100,000 in Monthly Recurring Revenue.",
        icon: Trophy,
        color: "bg-green-500/10 text-green-500 border-green-500/20",
        unlocked: stats ? stats.mrr >= 100000 : false,
      },
      {
        id: "achievement_1m_mrr",
        title: "₦1M MRR",
        description: "Zeneva crossed ₦1,000,000 in Monthly Recurring Revenue.",
        icon: Sparkles,
        color: "bg-green-500/10 text-green-500 border-green-500/20",
        unlocked: stats ? stats.mrr >= 1000000 : false,
      },
      // Revenue Milestones (ARR)
      {
        id: "achievement_120k_arr",
        title: "₦120K ARR",
        description: "Zeneva crossed ₦120,000 in Annual Recurring Revenue.",
        icon: DollarSign,
        color: "bg-teal-500/10 text-teal-500 border-teal-500/20",
        unlocked: stats ? stats.arr >= 120000 : false,
      },
      {
        id: "achievement_1_2m_arr",
        title: "₦1.2M ARR",
        description: "Zeneva crossed ₦1,200,000 in Annual Recurring Revenue.",
        icon: Trophy,
        color: "bg-teal-500/10 text-teal-500 border-teal-500/20",
        unlocked: stats ? stats.arr >= 1200000 : false,
      },
      {
        id: "achievement_12m_arr",
        title: "₦12M ARR",
        description: "Zeneva crossed ₦12,000,000 in Annual Recurring Revenue.",
        icon: Sparkles,
        color: "bg-teal-500/10 text-teal-500 border-teal-500/20",
        unlocked: stats ? stats.arr >= 12000000 : false,
      },
      // User Milestones
      {
        id: "achievement_500_users",
        title: "500 Users Milestone",
        description: "Zeneva crossed 500 registered users.",
        icon: Users,
        color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
        unlocked: stats ? stats.totalUsers >= 500 : false,
      },
      {
        id: "achievement_1k_users",
        title: "1,000 Users",
        description: "Zeneva crossed 1,000 registered users.",
        icon: Users,
        color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
        unlocked: stats ? stats.totalUsers >= 1000 : false,
      },
      {
        id: "achievement_10k_users",
        title: "10,000 Users",
        description: "Zeneva crossed 10,000 registered users.",
        icon: Users,
        color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
        unlocked: stats ? stats.totalUsers >= 10000 : false,
      },
      {
        id: "achievement_50k_users",
        title: "50,000 Users",
        description: "Zeneva crossed 50,000 registered users.",
        icon: Users,
        color: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
        unlocked: stats ? stats.totalUsers >= 50000 : false,
      },
      {
        id: "achievement_100k_users",
        title: "100,000 Users",
        description: "Zeneva crossed 100,000 registered users.",
        icon: Star,
        color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
        unlocked: stats ? stats.totalUsers >= 100000 : false,
      },
      // Order Milestones
      {
        id: "achievement_100_orders",
        title: "100 Successful Orders",
        description: "100 orders successfully delivered and completed.",
        icon: ShoppingBag,
        color: "bg-purple-500/10 text-purple-500 border-purple-500/20",
        unlocked: stats ? stats.totalSuccessfulOrders >= 100 : false,
      },
      {
        id: "achievement_1k_orders",
        title: "1,000 Successful Orders",
        description: "1,000 orders successfully delivered and completed.",
        icon: ShoppingBag,
        color: "bg-purple-500/10 text-purple-500 border-purple-500/20",
        unlocked: stats ? stats.totalSuccessfulOrders >= 1000 : false,
      },
      {
        id: "achievement_10k_orders",
        title: "10,000 Successful Orders",
        description: "10,000 orders successfully delivered and completed.",
        icon: ShoppingBag,
        color: "bg-purple-500/10 text-purple-500 border-purple-500/20",
        unlocked: stats ? stats.totalSuccessfulOrders >= 10000 : false,
      },
      // Seller & Listing Milestones
      {
        id: "achievement_100_sellers",
        title: "100 Active Sellers",
        description: "100 sellers with at least one active listing.",
        icon: Store,
        color: "bg-teal-500/10 text-teal-500 border-teal-500/20",
        unlocked: stats ? stats.activeSellers >= 100 : false,
      },
      {
        id: "achievement_1k_sellers",
        title: "1,000 Active Sellers",
        description: "1,000 sellers with at least one active listing.",
        icon: Store,
        color: "bg-teal-500/10 text-teal-500 border-teal-500/20",
        unlocked: stats ? stats.activeSellers >= 1000 : false,
      },
      {
        id: "achievement_1k_listings",
        title: "1,000 Active Listings",
        description: "1,000 products currently listed on the platform.",
        icon: Store,
        color: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
        unlocked: stats ? stats.totalProducts >= 1000 : false,
      },
      // Retention & Activity
      {
        id: "achievement_100_daily_active",
        title: "100 Daily Active Users",
        description: "Reached 100 daily active users (DAU).",
        icon: ArrowUpRight,
        color: "bg-pink-500/10 text-pink-500 border-pink-500/20",
        unlocked: stats ? stats.dailyActiveUsers >= 100 : false,
      },
      {
        id: "achievement_high_retention",
        title: "Super Retention",
        description: "Over 30% user retention month-over-month.",
        icon: Heart,
        color: "bg-rose-500/10 text-rose-500 border-rose-500/20",
        unlocked: stats ? stats.retentionPercentage >= 30 : false,
      }
    ];
  }, [stats]);

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-4 text-lg">Loading Achievements...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <Trophy className="h-8 w-8 text-muted-foreground" />
        <p className="text-lg font-semibold">Could not load achievements</p>
        <p className="max-w-sm text-sm text-muted-foreground">{loadError}</p>
        <button
          onClick={() => { setIsLoading(true); fetchAdminData(); }}
          className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-[calc(100vh-140px)] flex flex-col space-y-6 animate-in fade-in zoom-in duration-300">
      <Confetti trigger={showConfetti} onComplete={() => setShowConfetti(false)} />

      {/* Header */}
      <div className="flex items-center justify-between shrink-0 px-1">
        <div>
          <h2 className={cn(
            "text-2xl font-black tracking-tight flex items-center gap-2",
            isDarkMode ? 'text-white' : 'text-slate-900'
          )}>
            <Trophy className="w-6 h-6 text-yellow-500" />
            Platform Achievements
          </h2>
          <p className={cn(
            "text-sm mt-1",
            isDarkMode ? 'text-slate-400' : 'text-slate-500'
          )}>
            Track and celebrate major milestones reached by the platform.
          </p>
        </div>
        <button 
          onClick={triggerConfetti}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-purple-500 text-white font-bold rounded-lg shadow-lg hover:opacity-90 transition-opacity"
        >
          <Sparkles className="w-4 h-4" />
          Celebrate!
        </button>
      </div>

      {/* Scrollable grid area */}
      <div className="flex-1 overflow-y-auto pr-2 pb-12 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="flex flex-col gap-6 max-w-3xl mx-auto">
          {achievements.map((achievement, idx) => {
            const Icon = achievement.icon;
            const isUnlocked = achievement.unlocked;
            return (
              <div key={achievement.id} className="relative group">
                {/* Connecting dashed line to the next card */}
                {idx !== achievements.length - 1 && (
                  <div className={cn(
                    "absolute left-[41px] top-1/2 w-px h-[calc(100%+24px)] border-l-2 border-dashed group-hover:border-primary/40 transition-colors -ml-px z-0",
                    isDarkMode ? 'border-slate-800' : 'border-slate-300'
                  )} />
                )}
                
                <div 
                  onClick={() => {
                    if (isUnlocked) {
                      setSelectedAchievement(achievement);
                    }
                  }}
                  className={cn(
                    "relative z-10 p-5 rounded-lg border cursor-pointer transition-all",
                    isUnlocked 
                      ? isDarkMode ? 'bg-[#0f172a] border-primary/30 hover:border-primary/60 shadow-md shadow-primary/5' : 'bg-white border-primary/30 hover:border-primary/60 shadow-sm'
                      : isDarkMode ? 'bg-[#0a0f1d] border-slate-800 opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-500' : 'bg-slate-50 border-slate-200 opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-500'
                  )}
                >
                  <div className="flex items-center gap-6">
                    <div className={cn(
                      "relative z-20 p-3 rounded-lg border shrink-0",
                      achievement.color,
                      isDarkMode ? 'bg-[#0f172a]' : 'bg-white'
                    )}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className={cn(
                        "text-base font-bold leading-tight mb-1",
                        isDarkMode ? 'text-white' : 'text-slate-900'
                      )}>
                        {achievement.title}
                      </h3>
                      <p className={cn(
                        "text-[11px] leading-snug",
                        isDarkMode ? 'text-slate-400' : 'text-slate-500'
                      )}>
                        {achievement.description}
                      </p>
                    </div>
                    <div className="shrink-0">
                      {isUnlocked ? (
                        <span className="text-[10px] font-black uppercase tracking-wider text-primary flex items-center gap-1.5 bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20">
                          <Trophy className="w-3 h-3" /> Unlocked
                        </span>
                      ) : (
                        <span className={cn(
                          "text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 px-3 py-1.5 rounded-lg border",
                          isDarkMode ? 'text-slate-600 border-slate-800 bg-slate-900/50' : 'text-slate-400 border-slate-200 bg-slate-100/50'
                        )}>
                          Locked
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AchievementModal
        isOpen={!!selectedAchievement}
        onClose={() => setSelectedAchievement(null)}
        title={selectedAchievement?.title || ''}
        message={selectedAchievement?.description || ''}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}
