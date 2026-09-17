'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Check, ArrowRight, Loader2, ShieldCheck, Star, Store } from 'lucide-react';
import type { UserProfile, BusinessInstance } from '@/types';
import { useFirestore, auth } from '@/firebase';
import { writeBatch, doc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { add, format } from 'date-fns';
import { Badge } from '../ui/badge';
import { safeToDate, getCountryFromIP } from '@/lib/utils';
import { useCallback, useState, useEffect } from 'react';
import usePaystack from '@/hooks/use-paystack';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';
import useDodoPayments from '@/hooks/use-dodopayments';
import { track } from '@vercel/analytics';
import { AI_MONTHLY_LIMITS, effectivePlan, isPaidPlan, isPaidPlanExpired } from '@/lib/plan';
import { apiBase } from '@/lib/platform';

import { useI18n } from '@/context/i18n-context';

const PAYSTACK_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '';

type PlanDef = {
    name: string;
    price: number;
    priceUSD: number;
    features: string[];
    planId: string;
};

const getPlans = (t: (key: string) => string): PlanDef[] => [
    {
        name: t('pricing.proName'),
        price: 10000,
        priceUSD: 10,
        features: [
            `${t('pricing.proF1')} & ${t('pricing.proF2')}`,
            t('pricing.proF3'),
            t('pricing.proF4'),
            t('pricing.proF5'),
            t('pricing.proF6'),
            t('pricing.proF7'),
            t('pricing.proF8'),
            t('pricing.proF9'),
            t('pricing.proF10'),
            t('pricing.proF12'),
            t('pricing.proF11'),
            t('pricing.proF13'),
            t('pricing.proF14'),
        ],
        planId: 'pro',
    },
    {
        name: t('pricing.bizName'),
        price: 30000,
        priceUSD: 30,
        features: [
            t('pricing.bizF1'),
            t('pricing.bizF2'),
            t('pricing.bizF8'),
            t('pricing.bizF9'),
            t('pricing.bizF3'),
            t('pricing.bizF4'),
            t('pricing.bizF5'),
            t('pricing.bizF6'),
            t('pricing.bizF7'),
            t('pricing.bizF10'),
            t('pricing.bizF11'),
            t('pricing.bizF12'),
        ],
        planId: 'business',
    }
];

const billingCycles = [
    { id: '1m', months: 1, label: '1 month', discount: 0 },
    { id: '3m', months: 3, label: '3 months', discount: 5 }, // 5% off
    { id: '6m', months: 6, label: '6 months', discount: 10 }, // 10% off
    { id: '12m', months: 12, label: '1 year', discount: 15 }, // 15% off
];

// New self-contained button component using custom hook
const PaystackSubscriptionButton = ({ 
    plan, 
    cycle,
    finalAmount,
    userProfile, 
    businessInstance, 
    isCurrentPlan, 
    isProcessing, 
    setProcessingPlan,
    currency
}: { 
    plan: PlanDef, 
    cycle: typeof billingCycles[0],
    finalAmount: number,
    userProfile: UserProfile, 
    businessInstance: BusinessInstance,
    isCurrentPlan: boolean,
    isProcessing: boolean,
    setProcessingPlan: (planId: string | null) => void;
    currency: 'NGN' | 'USD';
}) => {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { initializePayment, isSdkReady: isScriptLoaded } = usePaystack();
    const { isImpersonating } = ({} as any);

    const handleSuccessfulPayment = useCallback(async (transaction: any) => {
        if (!firestore || !userProfile || !businessInstance) {
            toast({ variant: 'destructive', title: 'Error', description: 'Session expired. Please refresh and try again.' });
            setProcessingPlan(null);
            return;
        }

        const paymentRef = typeof transaction === 'string'
            ? transaction
            : (transaction?.reference || transaction?.ref || '');

        if (!paymentRef) {
            toast({ variant: 'destructive', title: 'Error', description: 'Payment reference missing. Please contact support.' });
            setProcessingPlan(null);
            return;
        }

        try {
            // Verification, pricing and the Firestore write all happen on the
            // server now. The client cannot be trusted with any of them: it used
            // to check the amount against a price it had itself chosen, then
            // write `plan` directly — both bypassable from a modded build.
            // `firestore.rules` now rejects client writes to entitlement fields.
            toast({ title: "Processing...", description: "Verifying your payment securely." });

            const { activateSubscription } = await import('@/actions/subscription');
            const { idToken } = await import('@/lib/id-token');

            const result = await activateSubscription({
                idToken: await idToken(),
                reference: paymentRef,
                planId: plan.planId,
                cycleId: cycle.id,
                currency,
            });

            if (!result.ok) {
                throw new Error(result.error);
            }

            try {
                track('billing_checkout_success', {
                    plan: plan.name,
                    cycle: cycle.label,
                    amount: finalAmount,
                    currency: currency,
                    gateway: 'Paystack',
                    businessId: businessInstance.id
                });
            } catch (trackErr) {
                console.warn("Failed to track checkout success event:", trackErr);
            }

            toast({
                variant: 'success',
                title: 'Subscription Successful!',
                description: `You are now subscribed to the ${plan.name} plan.`,
            });
        } catch (error: any) {
            console.error("Payment processing error:", error);
            toast({ variant: 'destructive', title: 'Subscription Failed', description: error.message || 'An unexpected error occurred. Please contact support.' });
        } finally {
            setProcessingPlan(null);
        }
    }, [firestore, userProfile, businessInstance, plan, cycle, finalAmount, toast, setProcessingPlan]);
    
    const handleSubscribe = useCallback(() => {
        if (isImpersonating) {
            toast({
                variant: 'destructive',
                title: 'Action blocked during impersonation',
                description: 'You cannot initiate billing on behalf of a user. Stop impersonating first.',
            });
            return;
        }
        if (isProcessing) return;
        
        // Safety check for keys and email
        if (!PAYSTACK_PUBLIC_KEY || PAYSTACK_PUBLIC_KEY.includes('your_public_key') || PAYSTACK_PUBLIC_KEY === 'pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx') {
            toast({
                variant: 'destructive',
                title: 'Configuration Error',
                description: 'The payment system is not correctly configured. Please contact the administrator (Invalid Public Key).'
            });
            return;
        }

        if (!userProfile?.email) {
            toast({
                variant: 'destructive',
                title: 'User Profile Incomplete',
                description: 'We need your email address to process the payment. Please update your profile.'
            });
            return;
        }

        setProcessingPlan(plan.planId);

        try {
            track('billing_checkout_initiated', {
                plan: plan.name,
                cycle: cycle.label,
                amount: finalAmount,
                currency: currency,
                gateway: 'Paystack',
                businessId: businessInstance.id
            });
        } catch (trackErr) {
            console.warn("Failed to track checkout start event:", trackErr);
        }

        // Log checkout attempt to Firestore for Admin Dashboard visibility
        try {
            addDoc(collection(firestore, 'checkout_attempts'), {
                userId: userProfile.id,
                userEmail: userProfile.email || '',
                userName: userProfile.name || '',
                businessId: businessInstance.id,
                businessName: businessInstance.name || '',
                plan: plan.name,
                cycle: cycle.label,
                amount: finalAmount,
                currency: currency,
                gateway: 'Paystack',
                timestamp: serverTimestamp(),
                status: 'initiated'
            });
        } catch (dbErr) {
            console.error("Failed to log checkout attempt to Firestore:", dbErr);
        }
        
        initializePayment({
            key: PAYSTACK_PUBLIC_KEY,
            email: userProfile.email,
            amount: Math.round(finalAmount * 100), // Ensure it's an integer
            currency: currency,
            reference: `z-${businessInstance.id.substring(0, 6)}-${Date.now()}`,
            metadata: {
                custom_fields: [
                    {
                        display_name: "Business ID",
                        variable_name: "business_id",
                        value: businessInstance.id
                    },
                    {
                        display_name: "Plan",
                        variable_name: "plan",
                        value: plan.name
                    }
                ]
            },
            onSuccess: (transaction: any) => {
                handleSuccessfulPayment(transaction);
            },
            onClose: () => {
                setProcessingPlan(null);
            },
        });
    }, [initializePayment, userProfile, businessInstance, plan, finalAmount, isProcessing, setProcessingPlan, handleSuccessfulPayment, toast, isImpersonating]);

    const buttonText = isCurrentPlan ? 'Renew Subscription' : `Subscribe to ${plan.name}`;

    return (
        <Button
            onClick={handleSubscribe}
            className="w-full"
            disabled={isProcessing}
        >
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ArrowRight className="mr-2 h-4 w-4" />}
            {buttonText}
        </Button>
    )
}

const DodoSubscriptionButton = ({ 
    plan, 
    cycle,
    finalAmount,
    userProfile, 
    businessInstance, 
    isCurrentPlan, 
    isProcessing, 
    setProcessingPlan
}: { 
    plan: PlanDef, 
    cycle: typeof billingCycles[0],
    finalAmount: number,
    userProfile: UserProfile, 
    businessInstance: BusinessInstance,
    isCurrentPlan: boolean,
    isProcessing: boolean,
    setProcessingPlan: (planId: string | null) => void;
}) => {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { initializeCheckout, isScriptLoaded } = useDodoPayments();
    const { isImpersonating } = ({} as any);

    const handleSubscribe = useCallback(async () => {
        if (isImpersonating) {
            toast({
                variant: 'destructive',
                title: 'Action blocked during impersonation',
                description: 'You cannot initiate billing on behalf of a user. Stop impersonating first.',
            });
            return;
        }
        if (!isScriptLoaded) {
            toast({ title: "Payment gateway is loading...", description: "Please wait a moment and try again." });
            return;
        }
        if (isProcessing) return;

        setProcessingPlan(plan.planId);

        try {
            track('billing_checkout_initiated', {
                plan: plan.name,
                cycle: cycle.label,
                amount: finalAmount,
                currency: 'USD',
                gateway: 'Dodo',
                businessId: businessInstance.id
            });
        } catch (trackErr) {
            console.warn("Failed to track Dodo checkout start:", trackErr);
        }

        // Log checkout attempt to Firestore for Admin Dashboard visibility
        try {
            addDoc(collection(firestore, 'checkout_attempts'), {
                userId: userProfile.id,
                userEmail: userProfile.email || '',
                userName: userProfile.name || '',
                businessId: businessInstance.id,
                businessName: businessInstance.name || '',
                plan: plan.name,
                cycle: cycle.label,
                amount: finalAmount,
                currency: 'USD',
                gateway: 'Dodo',
                timestamp: serverTimestamp(),
                status: 'initiated'
            });
        } catch (dbErr) {
            console.error("Failed to log checkout attempt to Firestore:", dbErr);
        }

        try {
            const response = await fetch(`${apiBase()}/api/dodo/checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    planId: plan.planId,
                    email: userProfile.email,
                    businessId: businessInstance.id,
                    cycleMonths: cycle.months
                }),
            });

            /*
             * Read the body as text and parse it ourselves.
             *
             * `response.json()` on a non-JSON body throws
             * "Unexpected token '<'", which is what the owner saw for the whole
             * time this endpoint was answering the HTML 404 page — a message
             * about JSON parsing for what was really a missing route. Any
             * infrastructure failure (404, 502, a proxy error page) is HTML,
             * so the status is the useful thing to report, not the parse error.
             */
            const raw = await response.text();
            let data: any = null;
            try {
                data = raw ? JSON.parse(raw) : null;
            } catch {
                console.error('Dodo checkout returned non-JSON:', response.status, raw.slice(0, 500));
                throw new Error(
                    response.status === 404
                        ? 'The payment service is unavailable (404). Please contact support.'
                        : `The payment service returned an unexpected response (HTTP ${response.status}).`,
                );
            }

            if (!response.ok) {
                throw new Error(data?.error || `Failed to initialize checkout (HTTP ${response.status})`);
            }

            if (!data?.checkout_url) {
                throw new Error('No checkout link was returned. Please try again.');
            }

            initializeCheckout(data.checkout_url);
        } catch (error: any) {
            console.error("Dodo initialization error:", error);
            toast({ 
                variant: 'destructive', 
                title: 'Checkout Failed', 
                description: error.message || 'Could not connect to the payment server.' 
            });
        } finally {
            setProcessingPlan(null);
        }
    }, [isScriptLoaded, isProcessing, plan, userProfile, businessInstance, cycle, finalAmount, initializeCheckout, toast, setProcessingPlan, firestore, isImpersonating]);

    const buttonText = isCurrentPlan ? 'Renew Subscription' : `Subscribe to ${plan.name}`;

    return (
        <Button
            onClick={handleSubscribe}
            className="w-full"
            disabled={isProcessing || !isScriptLoaded}
        >
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ShieldCheck className="mr-2 h-4 w-4" />}
            {buttonText} (USD)
        </Button>
    )
}

// Main component that uses the button
export default function SubscriptionSection({ userProfile, businessInstance }: { userProfile: UserProfile; businessInstance: BusinessInstance; }) {
    const { t } = useI18n();
    const plans = getPlans(t);
    const [processingPlan, setProcessingPlan] = useState<string | null>(null);
    const [globalCycleId, setGlobalCycleId] = useState('12m');
    const [activeSelection, setActiveSelection] = useState<{ planId: string, cycleId: string }>({ planId: 'pro', cycleId: '12m' });
    const [currency, setCurrency] = useState<'NGN' | 'USD'>('USD');

    useEffect(() => {
        getCountryFromIP().then((country) => {
            if (country === 'Nigeria') {
                setCurrency('NGN');
            } else {
                setCurrency('USD');
            }
        });
    }, []);

    const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
    const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isMobileApp = isTauri && isMobile;

    const handleCycleChange = (planId: string, cycleId: string) => {
        setActiveSelection({ planId, cycleId });
    };

    if (businessInstance.accessLevel === 'lifetime') {
        return (
            <Card className="mt-6 border-green-500/20 bg-green-500/5">
                <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-green-600" />
                        <CardTitle className="text-lg text-green-700">Lifetime Access Active</CardTitle>
                    </div>
                    <CardDescription>
                        Permanent access granted. No further payments required.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-4 text-sm text-green-600/80">
                        <div className="flex items-center gap-1.5"><Check className="h-4 w-4" /> Unlimited products</div>
                        <div className="flex items-center gap-1.5"><Check className="h-4 w-4" /> Unlimited users</div>
                        <div className="flex items-center gap-1.5"><Check className="h-4 w-4" /> AI Insights</div>
                    </div>
                </CardContent>
            </Card>
        );
    }



    return (
        <div className="space-y-6 mt-6">
            {/* Currency Toggle */}
            <div className="flex justify-center border-b pb-6">
                <div className="inline-flex p-1 bg-muted rounded-lg">
                    <button
                        onClick={() => setCurrency('USD')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                            currency === 'USD'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        USD ($)
                    </button>
                    <button
                        onClick={() => setCurrency('NGN')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                            currency === 'NGN'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Naira (₦)
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {plans.map((plan) => {
                    const isSelectedPlan = activeSelection.planId === plan.planId;
                    const visualCycleId = isSelectedPlan ? activeSelection.cycleId : '';
                    const computationCycleId = isSelectedPlan ? activeSelection.cycleId : '1m';
                    
                    const selectedCycle = billingCycles.find(c => c.id === computationCycleId)!;
                    
                    const displayBasePrice = currency === 'NGN' ? plan.price : (plan as any).priceUSD;
                    const finalAmount = displayBasePrice * selectedCycle.months * (1 - selectedCycle.discount / 100);
                    
                    const isCurrentPlan = plan.planId === businessInstance.plan;

                    return (
                        <Card key={plan.name} className={`flex flex-col ${isCurrentPlan ? 'border-primary ring-1 ring-primary/20' : ''}`}>
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <CardTitle className="flex items-center gap-2">
                                        {plan.planId === 'pro' ? (
                                            <Star className="h-5 w-5 text-indigo-500 shrink-0" />
                                        ) : (
                                            <Store className="h-5 w-5 text-amber-500 shrink-0" />
                                        )}
                                        {plan.name}
                                    </CardTitle>
                                    {isCurrentPlan && <Badge variant="secondary" className="font-bold">Current Plan</Badge>}
                                </div>
                                <CardDescription>
                                    <span className="text-3xl font-bold text-foreground">
                                        {currency === 'NGN' ? '₦' : '$'}{displayBasePrice.toLocaleString()}
                                    </span>
                                    <span className="text-muted-foreground ml-1">/ month</span>

                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex-grow space-y-6">
                                <ul className="space-y-2">
                                    {plan.features.map(feature => (
                                        <li key={feature} className="flex items-center gap-2 text-sm">
                                            <Check className="h-4 w-4 text-primary shrink-0" />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>

                                <div className="space-y-3 pt-4 border-t">
                                    <Label className="text-xs font-semibold text-muted-foreground uppercase">Billing Cycle</Label>
                                    <RadioGroup 
                                        value={visualCycleId}
                                        onValueChange={(value) => handleCycleChange(plan.planId, value)}
                                        className="grid gap-2"
                                    >
                                        {billingCycles.map(cycle => {
                                            const cyclePriceNGN = plan.price * cycle.months;
                                            const discountedPriceNGN = cyclePriceNGN * (1 - cycle.discount / 100);
                                            const discountedPriceUSD = ((plan as any).priceUSD * cycle.months) * (1 - cycle.discount / 100);

                                            return (
                                                <Label 
                                                    key={cycle.id}
                                                    htmlFor={`${plan.planId}-${cycle.id}`}
                                                    className={`flex items-center justify-between p-3 border rounded-md cursor-pointer transition-colors ${
                                                        visualCycleId === cycle.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                                                    }`}
                                                >
                                                    <div className="flex items-center space-x-2">
                                                        <RadioGroupItem value={cycle.id} id={`${plan.planId}-${cycle.id}`} className="mt-0.5 shrink-0" />
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-medium">{cycle.label}</span>
                                                            {cycle.discount > 0 && <span className="text-[10px] text-green-600 font-bold">-{cycle.discount}% OFF</span>}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-sm font-bold">
                                                            {currency === 'NGN' ? '₦' : '$'}{currency === 'NGN' ? discountedPriceNGN.toLocaleString() : discountedPriceUSD.toLocaleString()}
                                                        </span>

                                                    </div>
                                                </Label>
                                            )
                                        })}
                                    </RadioGroup>
                                </div>
                            </CardContent>
                            <CardFooter>
                                {currency === 'NGN' ? (
                                    <PaystackSubscriptionButton
                                        plan={plan}
                                        cycle={selectedCycle}
                                        finalAmount={finalAmount}
                                        userProfile={userProfile}
                                        businessInstance={businessInstance}
                                        isCurrentPlan={isCurrentPlan}
                                        isProcessing={processingPlan === plan.planId}
                                        setProcessingPlan={setProcessingPlan}
                                        currency={currency}
                                    />
                                ) : (
                                    <DodoSubscriptionButton
                                        plan={plan}
                                        cycle={selectedCycle}
                                        finalAmount={finalAmount}
                                        userProfile={userProfile}
                                        businessInstance={businessInstance}
                                        isCurrentPlan={isCurrentPlan}
                                        isProcessing={processingPlan === plan.planId}
                                        setProcessingPlan={setProcessingPlan}
                                    />
                                )}
                            </CardFooter>
                        </Card>
                    )
                })}
            </div>
        </div>
    );
}
