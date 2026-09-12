
'use client';
import * as React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { usePOS } from "@/context/pos-context";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Banknote, CreditCard, Landmark, Loader2, FileText } from "lucide-react";
import { useBusiness } from '@/context/pos-context';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/context/i18n-context';
import { trackFeature } from '@/lib/product-telemetry';

export default function PaymentPage() {
    const { subtotal, tax, taxRate, discount, total, setTax, setDiscount, paymentMethod, setPaymentMethod, amountReceived, setAmountReceived, currencySymbol, autoPrint, setAutoPrint } = usePOS();
    const business = useBusiness();
    const router = useRouter();
    const { t } = useI18n();
    const [isNavigating, setIsNavigating] = React.useState(false);

    const handleNext = () => {
        setIsNavigating(true);
        // Added a timeout safeguard to prevent the button from being stuck if navigation is slow
        const timer = setTimeout(() => setIsNavigating(false), 5000);
        
        if (autoPrint) {
            router.push('/sales/pos/review?auto=true');
        } else {
            router.push('/sales/pos/review');
        }
        
        return () => clearTimeout(timer);
    };

    return (
        <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2">
                <Card>
                    <CardHeader>
                        <CardTitle>{t('pos.paymentMethod')}</CardTitle>
                        <CardDescription>{t('pos.paymentMethodDescription')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <Label htmlFor="cash" className="cursor-pointer">
                                <Card className={`flex flex-col items-center justify-center p-6 ${paymentMethod === 'Cash' ? 'border-primary ring-1 ring-primary' : ''} hover:border-primary hover:bg-muted transition-colors h-full`}>
                                    <RadioGroupItem value="Cash" id="cash" className="sr-only" />
                                    <Banknote className="h-8 w-8 mb-2" />
                                    <span className="font-semibold text-sm">{t('pos.cash')}</span>
                                    <span className="text-[10px] text-muted-foreground mt-1">{t('pos.cashDescription')}</span>
                                </Card>
                            </Label>
                            <Label htmlFor="card" className="cursor-pointer">
                                <Card className={`flex flex-col items-center justify-center p-6 ${paymentMethod === 'Card' ? 'border-primary ring-1 ring-primary' : ''} hover:border-primary hover:bg-muted transition-colors h-full`}>
                                    <RadioGroupItem value="Card" id="card" className="sr-only" />
                                    <CreditCard className="h-8 w-8 mb-2" />
                                    <span className="font-semibold text-sm">{t('pos.card')}</span>
                                    <span className="text-[10px] text-muted-foreground mt-1">{t('pos.cardDescription')}</span>
                                </Card>
                            </Label>
                            <Label htmlFor="bank" className="cursor-pointer">
                                <Card className={`flex flex-col items-center justify-center p-6 ${paymentMethod === 'Bank Transfer' ? 'border-primary ring-1 ring-primary' : ''} hover:border-primary hover:bg-muted transition-colors h-full`}>
                                    <RadioGroupItem value="Bank Transfer" id="bank" className="sr-only" />
                                    <Landmark className="h-8 w-8 mb-2" />
                                    <span className="font-semibold text-sm">{t('pos.bankTransfer')}</span>
                                    <span className="text-[10px] text-muted-foreground mt-1">{t('pos.bankTransferDescription')}</span>
                                </Card>
                            </Label>
                            <Label htmlFor="invoice" className="cursor-pointer">
                                <Card className={`flex flex-col items-center justify-center p-6 ${paymentMethod === 'Invoice' ? 'border-primary ring-1 ring-primary' : ''} hover:border-primary hover:bg-muted transition-colors h-full`}>
                                    <RadioGroupItem value="Invoice" id="invoice" className="sr-only" />
                                    <FileText className="h-8 w-8 mb-2" />
                                    <span className="font-semibold text-sm">{t('pos.invoice')}</span>
                                    <span className="text-[10px] text-muted-foreground mt-1">{t('pos.invoiceDescription')}</span>
                                </Card>
                            </Label>
                        </RadioGroup>
                        {paymentMethod === 'Invoice' && (
                            <Alert className="mt-4 bg-blue-50 border-blue-200">
                                <FileText className="h-4 w-4 text-blue-600" />
                                <AlertTitle className="text-blue-800">{t('pos.invoiceAlertTitle')}</AlertTitle>
                                <AlertDescription className="text-blue-700">
                                    {t('pos.invoiceAlertBody')}
                                </AlertDescription>
                            </Alert>
                        )}
                        {paymentMethod === 'Bank Transfer' && (
                            <Alert className="mt-4 border-emerald-500/20 bg-emerald-500/5">
                                <Landmark className="h-4 w-4 text-emerald-600" />
                                <AlertTitle className="text-emerald-800 flex items-center gap-1.5 font-bold">
                                    {t('pos.terminalAccountTitle')}
                                    <Badge className="bg-emerald-500 text-white text-[9px] border-none font-semibold">{t('pos.statusActive')}</Badge>
                                </AlertTitle>
                                <AlertDescription className="text-emerald-700 mt-2 space-y-1">
                                    {business?.settings?.terminalAccountNumber ? (
                                        <>
                                            {t('pos.transferInstruction')}<br />
                                            <strong>{t('pos.bankLabel')}</strong> {business?.settings?.terminalBankName || 'Wema Bank'}<br />
                                            <strong>{t('pos.accountLabel')}</strong> {business?.settings?.terminalAccountNumber}<br />
                                            <strong>{t('pos.accountNameLabel')}</strong> {business?.settings?.terminalAccountName || `Zeneva - ${business.name}`}
                                            <p className="text-[10px] text-emerald-600 mt-2">{t('pos.terminalChime')}</p>
                                        </>
                                    ) : (
                                        <>
                                            <strong>{t('pos.bankLabel')}</strong> {business?.settings?.paymentBankName || t('pos.notConfigured')}<br />
                                            <strong>{t('pos.accountLabel')}</strong> {business?.settings?.paymentBankAccountId || t('pos.notConfigured')}<br />
                                            <p className="text-[10px] text-amber-600 mt-2">{t('pos.terminalNotProvisioned')}</p>
                                        </>
                                    )}
                                </AlertDescription>
                            </Alert>
                        )}
                        {paymentMethod === 'Cash' && (
                            <div className="mt-6 p-4 rounded-lg border bg-card">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="amountReceived" className="font-semibold text-sm">Amount Received ({currencySymbol})</Label>
                                        <Input 
                                            id="amountReceived" 
                                            type="number" 
                                            placeholder="Enter cash received..."
                                            value={amountReceived || ''}
                                            onChange={e => {
                                                const next = Number(e.target.value);
                                                setAmountReceived(next);
                                                // Both counted on a transition, not per keystroke.
                                                // Typing "5000" against a ₦100 total crosses the
                                                // total at "500" and again at "5000", so testing the
                                                // crossing rather than the value is what keeps this
                                                // "did change get calculated" instead of "how many
                                                // digits did they type".
                                                if (!amountReceived && next > 0) {
                                                    trackFeature('pos_amount_received_used');
                                                }
                                                if (total > 0 && amountReceived < total && next >= total) {
                                                    trackFeature('pos_change_shown');
                                                }
                                            }}
                                            className="h-12 text-lg font-medium"
                                        />
                                    </div>
                                    <div className="flex justify-between items-center pt-2">
                                        <span className="text-muted-foreground font-medium">Change to Return:</span>
                                        <span className={`text-xl font-bold ${amountReceived >= total ? 'text-emerald-600' : 'text-primary'}`}>
                                            {currencySymbol}{Math.max(0, amountReceived - total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
                <Card className="mt-8">
                    <CardHeader>
                        <CardTitle>{t('pos.discountAndTax')}</CardTitle>
                        <CardDescription>{t('pos.discountAndTaxDescription')}</CardDescription>
                    </CardHeader>
                    <CardContent className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="discount">{t('pos.discountLabel', { symbol: currencySymbol })}</Label>
                            <Input id="discount" type="number" value={discount} onChange={e => {
                                const next = Number(e.target.value);
                                // On the transition to a non-zero discount, so clearing and
                                // retyping one figure is not counted as two discounts.
                                if (!discount && next > 0) trackFeature('pos_discount_applied');
                                setDiscount(next);
                            }} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="tax">{t('pos.taxRateLabel')}</Label>
                            <Input id="tax" type="number" value={taxRate} onChange={e => {
                                const next = Number(e.target.value);
                                // Only an actual departure from the shop's configured rate counts
                                // as an override — echoing the default back is not a signal that
                                // the default is wrong, which is the question this answers.
                                if (next !== taxRate) trackFeature('pos_tax_override');
                                setTax(next);
                            }} />
                        </div>
                    </CardContent>
                </Card>
            </div>
            <div>
                <Card>
                    <CardHeader>
                        <CardTitle>{t('pos.orderSummary')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">{t('common.subtotal')}</span>
                            <span>{currencySymbol}{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">{t('common.tax')}</span>
                            <span>{currencySymbol}{tax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">{t('common.discount')}</span>
                            <span className="text-destructive">-{currencySymbol}{discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-bold text-lg">
                            <span>{t('common.total')}</span>
                            <span>{currencySymbol}{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>

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
                    </CardContent>
                    <CardFooter className="flex flex-col gap-2">
                        <Button className="w-full h-12 text-lg" onClick={handleNext} disabled={isNavigating}>
                            {isNavigating && <Loader2 className="me-2 h-5 w-5 animate-spin" />}
                            {autoPrint ? t('pos.finalizeAndPrint') : t('pos.reviewAndComplete')}
                        </Button>
                        <Button className="w-full" variant="outline" asChild>
                            <Link href="/sales/pos/customer">{t('common.back')}</Link>
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    )
}
