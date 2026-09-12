'use client';
 
import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Bot, Sparkles } from 'lucide-react';
import { useI18n } from '@/context/i18n-context';
import { MotionBackdrop } from '@/components/shared/motion-backdrop';
import { WARM_WHITE } from '@/lib/marketing/backdrop';

// Keys, not copy — the rotation indices are locale-independent, so the arrays
// can stay at module scope and only the lookup happens at render.
const foodInsights = [
    'landing.zenFood1',
    'landing.zenFood2',
    'landing.zenFood3',
    'landing.zenFood4',
    'landing.zenFood5',
];

const fashionInsights = [
    'landing.zenFashion1',
    'landing.zenFashion2',
    'landing.zenFashion3',
    'landing.zenFashion4',
    'landing.zenFashion5',
];

export function ZenAIInsights() {
    const { t } = useI18n();
    const containerRef = useRef<HTMLDivElement>(null);
    const [hasTriggered, setHasTriggered] = useState(false);
    const [foodIndex, setFoodIndex] = useState(0);
    const [fashionIndex, setFashionIndex] = useState(0);
    const [isFoodPulsing, setIsFoodPulsing] = useState(false);
    const [isFashionPulsing, setIsFashionPulsing] = useState(false);

    useEffect(() => {
        const foodInterval = setInterval(() => {
            setFoodIndex((prev) => (prev + 1) % foodInsights.length);
        }, 6000);
        return () => clearInterval(foodInterval);
    }, []);

    useEffect(() => {
        const fashionInterval = setInterval(() => {
            setFashionIndex((prev) => (prev + 1) % fashionInsights.length);
        }, 8000);
        return () => clearInterval(fashionInterval);
    }, []);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !hasTriggered) {
                    handleFoodClick();
                    handleFashionClick();
                    setHasTriggered(true);
                }
            },
            { threshold: 0.1 }
        );

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, [hasTriggered]);

    const handleFoodClick = () => {
        setIsFoodPulsing(true);
        setTimeout(() => setIsFoodPulsing(false), 3000);
    };

    const handleFashionClick = () => {
        setIsFashionPulsing(true);
        setTimeout(() => setIsFashionPulsing(false), 3000);
    };

    return (
        /*
         * The cinematic ground from `motion-backdrop.tsx` — the same tokens the
         * recorder paints, so this section and a recorded take are one design.
         *
         * `fade={false}` deliberately. The dissolve exists to melt the bottom edge
         * of *imagery* into the ground; this section's bottom edge is the second
         * bubble's text, and masking that would fade the last line of a quote out
         * to nothing. The mask belongs where a picture meets a caption, which is
         * not what this is.
         */
        <MotionBackdrop
            fade={false}
            className="rounded-3xl px-4 py-10 sm:py-14"
        >
            <div ref={containerRef} className="relative flex flex-col justify-center items-center py-4">
                {/* AI Connection Visual */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-[300px] pointer-events-none">
                    {/*
                      Warm, not slate. On the orange ground a cool grey line reads as
                      a different light source — the same reason the cards below sit
                      on WARM_WHITE rather than pure white.
                    */}
                    <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-0.5 h-[60%] bg-gradient-to-b from-transparent via-primary/25 to-transparent"></div>
                </div>

                {/* Central AI Node */}
                <div className="relative z-10 mb-8">
                    <div className="w-14 h-14 bg-slate-900 rounded-full flex items-center justify-center shadow-lg ring-4 ring-white/70">
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
                        <div className="absolute -top-3 -start-3 border p-1.5 rounded-full shadow-sm z-20" style={{ background: WARM_WHITE, borderColor: 'rgba(120,52,10,.10)' }}>
                            <Bot className="w-4 h-4 text-emerald-600" />
                        </div>

                        {/* Clipped Card Container */}
                        <div
                            className={`relative rounded-2xl rounded-ss-sm overflow-hidden shadow-xl transition-all duration-300 ${isFoodPulsing ? 'p-[2px]' : 'border'}`}
                            style={{ background: WARM_WHITE, borderColor: isFoodPulsing ? undefined : 'rgba(120,52,10,.10)' }}
                        >
                            {/* Spinning Beam Background */}
                            <div className={`absolute inset-[-50%] bg-[conic-gradient(from_0deg,transparent_0_280deg,#10b981_360deg)] animate-[spin_8s_linear_infinite] opacity-0 blur-md transition-opacity duration-300 ${isFoodPulsing ? 'opacity-100' : ''}`}></div>

                            {/* Content */}
                            <div className="relative p-5 h-full rounded-[inherit]" style={{ background: WARM_WHITE }}>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">{t('landing.zenFoodLabel')}</span>
                                </div>
                                <p className="text-slate-700 text-sm leading-relaxed font-medium min-h-[60px] flex items-center transition-opacity duration-300">
                                    “{t(foodInsights[foodIndex])}”
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Bubble 2 */}
                    <div
                        onClick={handleFashionClick}
                        className="relative group cursor-pointer transform hover:scale-[1.02] transition-transform duration-300 ms-6"
                    >
                        <div className="absolute -top-3 -end-3 border p-1.5 rounded-full shadow-sm z-20" style={{ background: WARM_WHITE, borderColor: 'rgba(120,52,10,.10)' }}>
                            <Bot className="w-4 h-4 text-blue-600" />
                        </div>

                        <div
                            className={`relative rounded-2xl rounded-se-sm overflow-hidden shadow-xl transition-all duration-300 ${isFashionPulsing ? 'p-[2px]' : 'border'}`}
                            style={{ background: WARM_WHITE, borderColor: isFashionPulsing ? undefined : 'rgba(120,52,10,.10)' }}
                        >
                            <div className={`absolute inset-[-50%] bg-[conic-gradient(from_0deg,transparent_0_280deg,#3b82f6_360deg)] animate-[spin_8s_linear_infinite] opacity-0 blur-md transition-opacity duration-300 ${isFashionPulsing ? 'opacity-100' : ''}`}></div>

                            <div className="relative p-5 h-full rounded-[inherit]" style={{ background: WARM_WHITE }}>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">{t('landing.zenFashionLabel')}</span>
                                </div>
                                <p className="text-slate-700 text-sm leading-relaxed font-medium min-h-[60px] flex items-center transition-opacity duration-300">
                                    “{t(fashionInsights[fashionIndex])}”
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </MotionBackdrop>
    );
}
