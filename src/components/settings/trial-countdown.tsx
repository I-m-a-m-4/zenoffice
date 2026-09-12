
'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Clock, ShieldCheck, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { safeToDate } from '@/lib/utils';
import { isPaidPlan, isPaidPlanExpired, effectivePlan } from '@/lib/plan';

interface TrialCountdownProps {
  /** The business whose billing status is being shown. */
  business?: any;
  /** Legacy prop kept so existing callers keep compiling. */
  expiryDate?: Date | null;
}

/**
 * Billing status for the current plan.
 *
 * There is no trial any more, so there are only three states worth showing:
 * a free plan that never expires, a paid plan counting down to its renewal,
 * and a paid plan that has lapsed back to free. None of them is an error —
 * a lapsed subscription still leaves a working shop on the Starter plan.
 */
const TrialCountdown: React.FC<TrialCountdownProps> = ({ business, expiryDate }) => {
    const paid = isPaidPlan(business);
    const lapsed = isPaidPlanExpired(business);
    const plan = effectivePlan(business);

    const renewalDate = React.useMemo(() => {
        if (business?.trialExpiresAt) return safeToDate(business.trialExpiresAt);
        return expiryDate ?? null;
    }, [business, expiryDate]);

    const [timeLeft, setTimeLeft] = useState<{
        days: number; hours: number; minutes: number; seconds: number;
    } | null>(null);

    useEffect(() => {
        // Only a live paid subscription has anything to count down to.
        if (!paid || lapsed || !renewalDate) {
            setTimeLeft(null);
            return;
        }

        const calculate = () => {
            const distance = renewalDate.getTime() - Date.now();
            if (distance < 0) return null;
            return {
                days: Math.floor(distance / (1000 * 60 * 60 * 24)),
                hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
                seconds: Math.floor((distance % (1000 * 60)) / 1000),
            };
        };

        setTimeLeft(calculate());
        const id = setInterval(() => {
            const next = calculate();
            if (next === null) clearInterval(id);
            setTimeLeft(next);
        }, 1000);

        return () => clearInterval(id);
    }, [paid, lapsed, renewalDate]);

    // A paid subscription that has run out. Not an error state — the shop keeps
    // working on the free plan, so say that rather than raising an alarm.
    if (lapsed) {
        return (
            <div className="flex items-center gap-3">
                <RefreshCw className="h-8 w-8 text-amber-500" />
                <div>
                    <p className="text-lg font-semibold text-amber-600">Subscription ended — now on Starter</p>
                    <p className="text-xs text-muted-foreground">
                        Your products and sales history are all still here. Renew to switch premium features back on.
                    </p>
                </div>
            </div>
        );
    }

    // Free plan. Nothing expires, so there is nothing to count down.
    if (!paid) {
        return (
            <div className="flex items-center gap-3">
                <ShieldCheck className="h-8 w-8 text-emerald-500" />
                <div>
                    <p className="text-lg font-semibold text-emerald-600">Starter plan — active</p>
                    <p className="text-xs text-muted-foreground">
                        Free forever. No trial, no expiry date.
                    </p>
                </div>
            </div>
        );
    }

    // Live paid subscription.
    return (
        <div className="flex items-center gap-3">
            <Clock className="h-8 w-8 text-primary animate-pulse" />
            <div>
                <p className="text-lg font-semibold text-primary capitalize">
                    {timeLeft
                        ? `${plan} · ${timeLeft.days}d ${timeLeft.hours}h ${timeLeft.minutes}m ${timeLeft.seconds}s remaining`
                        : `${plan} plan active`}
                </p>
                {renewalDate && (
                    <p className="text-xs text-muted-foreground">
                        Renews on {format(renewalDate, 'PPp')}.
                    </p>
                )}
            </div>
        </div>
    );
};

export default TrialCountdown;
