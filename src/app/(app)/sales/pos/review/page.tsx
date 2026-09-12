
'use client';
import * as React from 'react';
import ReceiptDetails from "@/components/receipts/receipt-details";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { usePOS } from "@/context/pos-context";
import { hasProFeatures, isCoreFeatureBlocked } from "@/lib/plan";
import { UpgradeOverlay } from "@/components/shared/upgrade-overlay";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useBusiness } from '@/context/pos-context';
import { useUser, useFirestore } from '@/firebase';
import { collection, doc, writeBatch, serverTimestamp, DocumentReference, DocumentSnapshot } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid'; // To generate a unique receipt number
import { sendReceiptEmail } from '@/lib/email';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { logAuditEvent } from '@/lib/audit';
import { useI18n } from '@/context/i18n-context';
import { trackFeature } from '@/lib/product-telemetry';
import { formatNumber, formatDateTime } from '@/lib/i18n/format';


function ReviewPageContent() {
    const router = useRouter();
    const { toast } = useToast();
    const { cart, selectedCustomer, subtotal, tax, discount, total, paymentMethod, amountReceived, currencySymbol, resetPOS, products, currentUserProfile, offlineProfile, customers, autoPrint, setAutoPrint, addToQueue, holdCurrentSale } = usePOS();
    const firestore = useFirestore();
    const business = useBusiness();
    const { user } = useUser();
    const { t, locale } = useI18n();
    const [isCompleting, setIsCompleting] = React.useState(false);
    const [shouldSendEmail, setShouldSendEmail] = React.useState(false);
    const searchParams = useSearchParams();
    const isAutoPrompted = searchParams.get('auto') === 'true';
    const [backdate, setBackdate] = React.useState('');
    const [backdateTime, setBackdateTime] = React.useState('');
    const isAdmin = currentUserProfile?.role === 'admin' || business?.ownerId === currentUserProfile?.id;
    const receiptContentRef = React.useRef<HTMLDivElement>(null);
    const hasPrintedRef = React.useRef(false);
    const checkoutStartedRef = React.useRef(false);

    // Hydration fix
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => { setMounted(true); }, []);

    // Memoize the receipt number so it doesn't change on every render
    const stableReceiptNumber = React.useMemo(() => `rec-${uuidv4().split('-')[0]}`, []);

    // Parse the backdate input once. A datetime-local field can hand back a
    // partial or unparseable value while the user is still picking, and
    // `new Date('')`/`new Date('garbage')` is an Invalid Date whose
    // .toISOString() throws - which used to abort checkout after the
    // "already started" guard had latched, wedging the POS.
    const backdatedAt = React.useMemo(() => {
        if (!backdate) return null;
        // date input gives "YYYY-MM-DD" — parse at local midnight so the
        // day the admin chose is what lands on the receipt, not UTC midnight.
        const [year, month, day] = backdate.split('-').map(Number);
        if (!year || !month || !day) return null;

        let h = 0, m = 0;
        if (backdateTime) {
            const [hours, minutes] = backdateTime.split(':').map(Number);
            if (!isNaN(hours) && !isNaN(minutes)) {
                h = hours;
                m = minutes;
            }
        }

        const parsed = new Date(year, month - 1, day, h, m, 0);
        return isNaN(parsed.getTime()) ? null : parsed;
    }, [backdate, backdateTime]);

    // Create a temporary receipt object for display before saving
    const displayReceipt = React.useMemo(() => ({
        id: 'temp-id',
        businessId: business?.id || 'temp-biz-id',
        receiptNumber: stableReceiptNumber,
        items: cart.map(item => ({
            productId: item.product.id,
            name: item.product.name,
            quantity: item.quantity,
            price: item.product.price,
            costPrice: item.product.costPrice || 0,
        })),
        customer: selectedCustomer || undefined,
        subtotal,
        tax,
        discount,
        total,
        paymentMethod: paymentMethod as 'Cash' | 'Card' | 'Bank Transfer' | 'Invoice',
        status: (paymentMethod === 'Invoice' ? 'unpaid' : 'paid') as 'pending' | 'unpaid' | 'paid',
        createdAt: backdatedAt || new Date(), // Use a real date for optimistic display
    }), [stableReceiptNumber, business?.id, cart, selectedCustomer, subtotal, tax, discount, total, paymentMethod, backdatedAt]);

    const isAutoPromptedRef = React.useRef(false);
    const [showUpgradeOverlay, setShowUpgradeOverlay] = React.useState(false);

    // Gate that must be true before checkout can proceed.
    const canCompleteSale = !!business && !!user && cart.length > 0 && !!products && !!currentUserProfile;

    const handleCompleteSale = React.useCallback(() => {
        if (isCoreFeatureBlocked(business)) {
            setShowUpgradeOverlay(true);
            return;
        }

        if (!canCompleteSale) {
            toast({ variant: 'destructive', title: t('errors.genericTitle'), description: t('pos.completeSaleFailed') });
            return;
        }

        setIsCompleting(true);
        if (checkoutStartedRef.current) return;

        if (!business || !user || cart.length === 0 || !products || !currentUserProfile) {
            toast({ variant: 'destructive', title: t('errors.genericTitle'), description: t('pos.completeSaleFailed') });
            setIsCompleting(false);
            return;
        }

        checkoutStartedRef.current = true;

        // 1. Validations (Backorder & Operating Hours)
        for (const cartItem of cart) {
            const productFromCache = products.find(p => p.id === cartItem.product.id);
            const isService = productFromCache?.categoryType === 'service';
            if (!isService && (!productFromCache || (productFromCache.stock || 0) < cartItem.quantity)) {
                toast({
                    variant: 'backorder' as any,
                    title: t('pos.backorderTitle'),
                    description: t('pos.backorderDescription', { name: cartItem.product.name })
                });
            }
        }

        const operatingHours = business.settings?.operatingHours;
        let isOutsideHours = false;
        if (operatingHours?.enabled) {
            const saleDate = backdatedAt || new Date();
            const [openH, openM] = operatingHours.openTime.split(':').map(Number);
            const [closeH, closeM] = operatingHours.closeTime.split(':').map(Number);
            const nowMinutes = saleDate.getHours() * 60 + saleDate.getMinutes();
            const openMinutes = openH * 60 + openM;
            const closeMinutes = closeH * 60 + closeM;

            if (closeMinutes < openMinutes) {
                isOutsideHours = !(nowMinutes >= openMinutes || nowMinutes <= closeMinutes);
            } else {
                isOutsideHours = nowMinutes < openMinutes || nowMinutes > closeMinutes;
            }

            if (isOutsideHours && operatingHours.preventSalesOutsideHours && !isAdmin) {
                toast({
                    variant: 'destructive',
                    title: t('pos.operatingHoursTitle'),
                    description: t('pos.operatingHoursDescription', { open: operatingHours.openTime, close: operatingHours.closeTime })
                });
                return;
            }
        }

        setIsCompleting(true);

        // 2. Prepare Data for Queue (Securely Recalculate)
        const newReceiptId = uuidv4();
        let secureSubtotal = 0;
        let secureTotalCost = 0;

        const itemsForReceipt = cart.map(cartItem => {
            const masterProduct = products.find(p => p.id === cartItem.product.id);
            const costPrice = cartItem.costPriceOverride ?? (masterProduct?.costPrice || 0);

            // SECURITY: If not a manual override, use the price from the master product list
            let finalPrice = cartItem.product.price;
            if (!cartItem.isPriceOverride && masterProduct) {
                if (cartItem.unit) {
                    // Check if there's a unit conversion with a specific price override
                    const conversion = masterProduct.uomConversions?.find(u => u.unitName === cartItem.unit);
                    finalPrice = conversion?.price ?? (masterProduct.price * (cartItem.multiplier || 1));
                } else {
                    finalPrice = masterProduct.price;
                }
            }

            // Detect if the price in cart was tampered with (different from expected)
            if (finalPrice !== cartItem.product.price) {
                console.warn(`Price mismatch detected for ${cartItem.product.name}. Expected ${finalPrice}, got ${cartItem.product.price}. Reverting to secure price.`);
            }

            secureSubtotal += finalPrice * cartItem.quantity;
            secureTotalCost += costPrice * cartItem.quantity;

            return {
                productId: cartItem.product.id,
                name: cartItem.unit ? `${cartItem.product.name} (${cartItem.unit})` : cartItem.product.name,
                quantity: cartItem.quantity,
                unit: cartItem.unit || null,
                multiplier: cartItem.multiplier || 1,
                price: finalPrice,
                costPrice: costPrice,
                /*
                 * Whether the cashier typed this price in, and what the shelf
                 * said at the time.
                 *
                 * A manual price is the most direct way to under-charge without
                 * a discount showing on the receipt total — the customer can pay
                 * the full shelf price in cash while the till records less. The
                 * loss-prevention scan cannot tell that apart from a legitimate
                 * repricing unless the shelf price is captured *here*, at the
                 * moment of sale: comparing against the product's current price
                 * later flags every honest price rise as an override.
                 * See src/lib/forensics.ts, check D4.
                 */
                priceOverridden: !!cartItem.isPriceOverride,
                listPrice: masterProduct?.price ?? cartItem.originalPrice ?? finalPrice,
            };
        });

        const secureTax = secureSubtotal * (business.settings?.defaultTaxRate || 0) / 100;
        const secureTotal = secureSubtotal + secureTax - discount;
        const profit = secureTotal - secureTotalCost;
        const status = paymentMethod === 'Invoice' ? 'unpaid' : 'paid';

        const wasScanned = cart.some(c => c.addedViaBarcode);
        const receiptMethod = autoPrint ? 'printed' : (shouldSendEmail ? 'digital' : 'none');

        /*
         * Product telemetry for the whole POS loop, recorded once here rather than
         * scattered across the cart, customer picker and print button.
         *
         * This is the only point where the sale is known to have actually gone
         * through, and the page has already derived everything needed — counting a
         * barcode scan when the item was added would credit abandoned carts too, and
         * "did shops choose print or email" is only answerable about completed sales.
         *
         * `pos_sale_completed` is also the denominator: adoption of every other POS
         * counter is measured against people who genuinely sell, not against every
         * account that ever signed up. See src/lib/product-telemetry.ts.
         */
        trackFeature('pos_sale_completed');
        if (wasScanned) trackFeature('pos_barcode_scan');
        if (selectedCustomer) trackFeature('pos_customer_attached');
        if (receiptMethod === 'printed') trackFeature('pos_receipt_printed');
        else if (receiptMethod === 'digital') trackFeature('pos_receipt_emailed');

        const receiptData = {
            id: newReceiptId,
            businessId: business.id,
            receiptNumber: displayReceipt.receiptNumber,
            items: itemsForReceipt,
            customer: selectedCustomer ? { id: selectedCustomer.id, name: selectedCustomer.name, email: selectedCustomer.email } : null,
            subtotal: secureSubtotal,
            tax: secureTax,
            discount,
            total: secureTotal,
            totalCost: secureTotalCost,
            profit,
            paymentMethod,
            status,
            createdAt: backdatedAt || new Date(),
            isBackdated: !!backdatedAt,
            createdBy: user.uid,
            flagged: isOutsideHours ? { reason: 'outside_operating_hours', openTime: operatingHours?.openTime, closeTime: operatingHours?.closeTime } : null,
            wasScanned,
            isOffline: !navigator.onLine,
            receiptMethod,
        };

        const productUpdates = cart.map(cartItem => {
            const product = products.find(p => p.id === cartItem.product.id);
            const multiplier = cartItem.multiplier || 1;
            const baseQuantitySold = cartItem.quantity * multiplier;
            return {
                id: cartItem.product.id,
                /*
                 * `quantitySold` is what the queue actually writes with, as
                 * `increment(-quantitySold)`. `newStock` is an absolute figure
                 * computed from *this* device's cached stock, so two tills selling
                 * the same item both wrote a number derived from a stale read and
                 * the second one silently erased the first — which is the "stock
                 * doesn't update across users" report. The absolute value is kept
                 * because the optimistic local update and the audit log's
                 * before/after pair still want it, and because a sale queued by an
                 * older build carries only this field: the queue falls back to
                 * writing it absolutely when `quantitySold` is missing.
                 */
                quantitySold: baseQuantitySold,
                newStock: (product?.stock || 0) - baseQuantitySold,
                type: product?.type,
                components: product?.components
            };
        });

        const customerUpdate = selectedCustomer ? {
            id: selectedCustomer.id,
            loyaltyPoints: business.settings?.loyaltyProgramEnabled ? (selectedCustomer.loyaltyPoints || 0) + Math.floor(secureTotal * (business.settings.pointsPerUnit || 0)) : (selectedCustomer.loyaltyPoints || 0),
            totalSpent: secureTotal
        } : null;

        // 3. ADD TO QUEUE (This is now instant and handles SQLite)
        addToQueue({
            type: 'complete-sale',
            payload: {
                receiptData: { ...receiptData, createdAt: receiptData.createdAt.toISOString() }, // Stringify date for queue
                productUpdates,
                customerUpdate
            }
        }, t('pos.queueRecordingSale', { number: receiptData.receiptNumber }));

        // Queue audit logs for stock adjustment due to sales
        const activeProfile = currentUserProfile || offlineProfile;

        // The backdate control promises "this action will be flagged in the audit
        // log", so record it. Queued rather than written directly so it survives
        // an offline checkout like every other write on this page.
        if (backdatedAt) {
            addToQueue({
                type: 'add-audit-log',
                payload: {
                    businessId: business.id,
                    userId: activeProfile?.id || user.uid,
                    userName: activeProfile?.name || 'Staff',
                    userEmail: activeProfile?.email || user.email || '',
                    userRole: activeProfile?.role || 'staff',
                    action: 'sale.backdated',
                    entityType: 'Receipt',
                    entityId: newReceiptId,
                    details: {
                        entityName: displayReceipt.receiptNumber,
                        backdatedTo: backdatedAt.toISOString(),
                        recordedAt: new Date().toISOString(),
                        total: secureTotal,
                        reason: 'Sale recorded with an admin-selected date'
                    }
                }
            }, t('pos.queueFlaggingBackdated', { number: displayReceipt.receiptNumber }));
        }

        cart.forEach(cartItem => {
            const masterProduct = products.find(p => p.id === cartItem.product.id);
            const isService = masterProduct?.categoryType === 'service';

            const multiplier = cartItem.multiplier || 1;
            const quantitySold = cartItem.quantity * multiplier;

            if (isService) {
                addToQueue({
                    type: 'add-audit-log',
                    payload: {
                        businessId: business.id,
                        userId: activeProfile?.id || user.uid,
                        userName: activeProfile?.name || 'Staff',
                        userEmail: activeProfile?.email || user.email || '',
                        userRole: activeProfile?.role || 'staff',
                        action: 'product.sale',
                        entityType: 'Service',
                        entityId: cartItem.product.id,
                        details: {
                            entityName: cartItem.product.name,
                            adjustment: -quantitySold,
                            reason: `Sold in Sale ${displayReceipt.receiptNumber}`,
                            receiptId: newReceiptId
                        }
                    }
                }, t('pos.queueLoggingService', { name: cartItem.product.name }));
                return;
            }

            addToQueue({
                type: 'add-audit-log',
                payload: {
                    businessId: business.id,
                    userId: activeProfile?.id || user.uid,
                    userName: activeProfile?.name || 'Staff',
                    userEmail: activeProfile?.email || user.email || '',
                    userRole: activeProfile?.role || 'staff',
                    action: 'product.sale',
                    entityType: 'Product',
                    entityId: cartItem.product.id,
                    details: {
                        entityName: cartItem.product.name,
                        oldStock: masterProduct?.stock || 0,
                        newStock: (masterProduct?.stock || 0) - quantitySold,
                        adjustment: -quantitySold,
                        reason: `Sold in Sale ${displayReceipt.receiptNumber}`,
                        receiptId: newReceiptId
                    }
                }
            }, t('pos.queueLoggingDeduction', { name: cartItem.product.name }));
        });

        // 4. Handle Email Receipt (Try sending immediately if online)
        if (navigator.onLine && shouldSendEmail && selectedCustomer?.email) {
            const isEmailAllowed = hasProFeatures(business);
            if (isEmailAllowed) {
                // The receipt email prefixes its own currency symbol, so this
                // formats the bare amount. Uses the seller's chosen locale
                // rather than the old hardcoded 'en-NG'.
                const money = (v: number) => formatNumber(v, locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                const items_html = cart.map(item =>
                    `<tr>
                        <td style="padding: 5px; border-bottom: 1px solid #eee;">
                            <div style="font-weight: bold;">${item.product.name}</div>
                            <div style="color: #666; font-size: 12px;">${item.quantity} x ${currencySymbol}${money(item.product.price)}</div>
                        </td>
                        <td style="padding: 5px; text-align: right; border-bottom: 1px solid #eee;">
                            ${currencySymbol}${money(item.product.price * item.quantity)}
                        </td>
                    </tr>`
                ).join('');

                sendReceiptEmail({
                    to_email: selectedCustomer.email,
                    to_name: selectedCustomer.name,
                    business_name: business.name,
                    receipt_id: newReceiptId.substring(0, 8),
                    items_html,
                    currency_symbol: currencySymbol,
                    subtotal: money(secureSubtotal),
                    tax: money(secureTax),
                    discount: money(discount),
                    total: money(secureTotal),
                    payment_method: paymentMethod,
                    date: formatDateTime(receiptData.createdAt, locale)
                }).catch(e => console.error("Email failed:", e?.text || e?.message || e));
            }
        }

        // 5. Cleanup & Navigation
        if (autoPrint && !hasPrintedRef.current) {
            hasPrintedRef.current = true;
            setTimeout(() => {
                const handleAfterPrint = () => {
                    window.removeEventListener('afterprint', handleAfterPrint);
                    router.push('/sales/pos/select-products');
                    resetPOS();
                };
                window.addEventListener('afterprint', handleAfterPrint);

                try {
                    if (typeof window !== 'undefined' && window.print) {
                        window.print();
                    } else {
                        handleAfterPrint();
                    }
                } catch (printError) {
                    console.warn("Printing failed or unsupported on this device:", printError);
                    handleAfterPrint();
                }

                // Fallback for browsers (especially mobile and standalone PWAs) that don't reliably fire afterprint
                const isMobile = typeof window !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
                setTimeout(() => {
                    window.removeEventListener('afterprint', handleAfterPrint);
                    // Check if we haven't already navigated (resetPOS clears cart)
                    if (cart.length > 0) {
                        router.push('/sales/pos/select-products');
                        resetPOS();
                    }
                }, isMobile ? 1500 : 3000); // 1.5s on mobile, 3s on desktop fallback instead of 60s
            }, 500);
        } else if (!autoPrint) {
            router.push('/sales/pos/select-products');
            resetPOS();
        }

        toast({
            variant: navigator.onLine ? 'success' : 'default',
            title: navigator.onLine ? t('pos.saleRecorded') : t('pos.saleQueuedOffline'),
            description: navigator.onLine
                ? t('pos.saleRecordedDescription', { number: receiptData.receiptNumber })
                : t('pos.saleQueuedOfflineDescription'),
        });

        // Note: We don't set isCompleting(false) here if redirect is happening
        // to prevent the auto-submit useEffect from re-firing.
        // It will be reset when the component unmounts or POS is reset.

    }, [business, user, cart, products, currentUserProfile, subtotal, tax, discount, total, paymentMethod, currencySymbol, amountReceived, resetPOS, router, autoPrint, backdatedAt, shouldSendEmail, toast, addToQueue, displayReceipt.receiptNumber, selectedCustomer, t, locale]);

    // **Auto-Submit Logic**
    // We only want to trigger this ONCE when auto-prompted
    React.useEffect(() => {
        if (isAutoPrompted && !isCompleting && cart.length > 0) {
            handleCompleteSale();
        }
    }, [isAutoPrompted, isCompleting, cart.length, handleCompleteSale]);

    const canSendEmail = React.useMemo(() => hasProFeatures(business), [business]);

    if (!mounted) {
        return (
            <div className="flex flex-col items-center justify-center p-12 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse">{t('pos.initializingCheckout')}</p>
            </div>
        );
    }

    if (cart.length === 0 && !isCompleting) {
        return (
            <div className="text-center">
                <p>{t('pos.cartEmpty')}</p>
                <Button asChild variant="link">
                    <Link href="/sales/pos/select-products">{t('pos.startNewSale')}</Link>
                </Button>
            </div>
        )
    }

    return (
        <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2">
                <h2 className="text-2xl font-bold mb-4 font-headline no-print">{t('pos.reviewYourSale')}</h2>
                <ReceiptDetails ref={receiptContentRef} receipt={displayReceipt} business={business} currencySymbol={currencySymbol} amountReceived={amountReceived} showAdminDetails={isAdmin} />
            </div>
            <div className="no-print">
                <div className="p-4 rounded-lg bg-card border space-y-4">
                    <h3 className="text-lg font-semibold">{t('pos.readyToComplete')}</h3>
                    <p className="text-sm text-muted-foreground">
                        {t('pos.readyToCompleteBody')}
                    </p>

                    {isAdmin && (
                        <>
                            <Separator />
                            <div className="flex flex-col gap-2 py-2">
                                <Label htmlFor="backdate" className="text-sm font-semibold flex flex-col gap-1 cursor-pointer">
                                    <span>{t('pos.backdateSale')}</span>
                                    <span className="font-normal text-muted-foreground text-xs">
                                        {t('pos.backdateSaleHint')}
                                    </span>
                                </Label>
                                <div className="flex gap-2 mt-1">
                                    <Input
                                        id="backdate"
                                        type="date"
                                        className="w-full"
                                        max={new Date().toISOString().split('T')[0]}
                                        value={backdate}
                                        onChange={(e) => setBackdate(e.target.value)}
                                    />
                                    <Input
                                        id="backdateTime"
                                        type="time"
                                        className="w-32"
                                        value={backdateTime}
                                        onChange={(e) => setBackdateTime(e.target.value)}
                                        disabled={!backdate}
                                        title="Optional Time"
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {selectedCustomer?.email && canSendEmail && (
                        <>
                            <Separator />
                            <div className="flex items-center justify-between py-2">
                                <Label htmlFor="send-email-receipt" className="flex flex-col gap-1 cursor-pointer">
                                    <span>{t('pos.emailReceipt')}</span>
                                    <span className="font-normal text-muted-foreground text-xs">
                                        {t('pos.emailReceiptHint', { email: selectedCustomer.email })}
                                    </span>
                                </Label>
                                <Switch
                                    id="send-email-receipt"
                                    checked={shouldSendEmail}
                                    onCheckedChange={setShouldSendEmail}
                                />
                            </div>
                        </>
                    )}

                    <Separator />
                    <div className="flex items-center justify-between py-2">
                        <Label htmlFor="auto-print" className="cursor-pointer font-medium text-sm">
                            {t('pos.printReceipt')}
                        </Label>
                        <input
                            type="checkbox"
                            id="auto-print"
                            className="w-4 h-4 cursor-pointer"
                            checked={autoPrint}
                            onChange={(e) => setAutoPrint(e.target.checked)}
                        />
                    </div>

                    <div className="flex flex-col gap-2 pt-2">
                        <Button size="lg" className="w-full text-lg h-12 shadow-md hover:shadow-lg transition-all" onClick={handleCompleteSale} disabled={isCompleting}>
                            {isCompleting && <Loader2 className="me-2 h-5 w-5 animate-spin" />}
                            {isCompleting ? t('pos.finalizing') : (paymentMethod === 'Invoice' ? t('pos.issueInvoice') : t('pos.completeSale'))}
                        </Button>
                        <Button size="lg" className="w-full h-12" variant="outline" onClick={() => {
                            holdCurrentSale();
                            router.push('/sales/pos/select-products');
                        }} disabled={isCompleting}>
                            {t('pos.parkSale')}
                        </Button>
                        <Button size="lg" className="w-full" variant="outline" asChild>
                            <Link href="/sales/pos/payment">{t('pos.backToPayment')}</Link>
                        </Button>
                    </div>
                </div>
            </div>

            <UpgradeOverlay open={showUpgradeOverlay} onOpenChange={setShowUpgradeOverlay} />
        </div>
    )
}

export default function ReviewPage() {
    const { t } = useI18n();
    return (
        <React.Suspense fallback={
            <div className="flex flex-col items-center justify-center p-12 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse">{t('pos.initializingCheckout')}</p>
            </div>
        }>
            <ReviewPageContent />
        </React.Suspense>
    );
}
