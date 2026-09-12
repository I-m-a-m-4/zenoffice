'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { collection, doc, addDoc, serverTimestamp, writeBatch, query, where, getDocs, limit } from 'firebase/firestore';
import { Loader2, ShoppingBag } from 'lucide-react';
import { isCoreFeatureBlocked } from '@/lib/plan';
import type { BusinessInstance, CartItem, OnlineOrder } from '@/types';
import usePaystack from '@/hooks/use-paystack';
import { apiBase } from '@/lib/platform';
import { sendReceiptEmail } from '@/lib/email';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { useStore } from '@/context/store-context';
import { ScrollArea } from '../ui/scroll-area';


const PAYSTACK_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '';

interface CheckoutDialogProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

export default function CheckoutDialog({ isOpen, onOpenChange }: CheckoutDialogProps) {
    const { cart, business, onOrderPlaced, subtotal } = useStore();
    const { toast } = useToast();
    const firestore = useFirestore();
    const { initializePayment, isScriptLoaded } = usePaystack();
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const [name, setName] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [phone, setPhone] = React.useState('');
    const [address, setAddress] = React.useState('');
    const [selectedShipping, setSelectedShipping] = React.useState<string | undefined>(undefined);

    const shippingOptions = business?.settings?.publicStore?.shippingOptions || [];
    const chosenShippingOption = shippingOptions.find(opt => opt.name === selectedShipping);
    const shippingCost = chosenShippingOption?.price || 0;

    const total = subtotal + shippingCost;

    const resetForm = () => {
        setName('');
        setEmail('');
        setPhone('');
        setAddress('');
        setSelectedShipping(undefined);
    }

    const createOrderInFirestore = async (paymentDetails: { method: 'Paystack' | 'Bank Transfer', reference?: string, status: 'paid' | 'pending' }) => {
        if (!firestore || !business) throw new Error("Firestore or Business not available");

        const batch = writeBatch(firestore);

        // 1. Find or Create Customer
        const customersRef = collection(firestore, 'customers');
        let customerId: string;
        let customerName = name;

        // Only query if we have a way to verify identity (e.g. valid auth) or if we are just creating blindly
        // For public checkout, we cannot query customer by email due to security rules.
        // So we try to create a new customer document.

        // Attempt to query only if user is logged in (staff/admin scenario) - though for public store they likely aren't
        // We will just create a new customer record for this order to ensure it works.
        // Ideally, we'd use a server action to de-dupe.

        const newCustomerRef = doc(customersRef);
        batch.set(newCustomerRef, {
            name: name,
            email: email.toLowerCase().trim(),
            phone: phone,
            businessId: business.id,
            createdAt: serverTimestamp(),
            loyaltyPoints: 0,
            source: 'online_store' // track source
        });
        customerId = newCustomerRef.id;

        // 2. Create Order
        const orderData: Omit<OnlineOrder, 'id'> = {
            businessId: business.id,
            customerId: customerId,
            customerName: customerName,
            customerEmail: email,
            customerPhone: phone,
            customerAddress: address,
            items: cart.map(item => ({
                productId: item.product.id,
                name: item.product.name,
                quantity: item.quantity,
                price: item.product.price,
            })),
            total,
            shippingDetails: chosenShippingOption,
            status: paymentDetails.status,
            paymentMethod: paymentDetails.method,
            paymentReference: paymentDetails.reference,
            createdAt: serverTimestamp(),
        };

        const ordersRef = collection(firestore, 'businessInstances', business.id, 'onlineOrders');
        const newOrderRef = doc(ordersRef);
        batch.set(newOrderRef, orderData);

        // 3. Commit batch
        await batch.commit();

        return { orderId: newOrderRef.id, finalCustomerName: customerName };
    }

    const handleSuccessfulPayment = React.useCallback(async (transaction: any) => {
        toast({ title: "Processing...", description: "Verifying your payment securely." });
        try {
            const isUSD = business?.settings?.currency === 'USD';
            const exchangeRate = business?.settings?.usdToNgnRate || 1500;
            const expectedPaystackAmount = isUSD ? Math.round(total * exchangeRate * 100) : Math.round(total * 100);
            const paymentRef = typeof transaction === 'string' ? transaction : (transaction?.reference || transaction?.ref || '');

            const verifyResponse = await fetch(`${apiBase()}/api/paystack/verify-transaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    reference: paymentRef, 
                    expectedAmount: expectedPaystackAmount, 
                    businessId: business?.id,
                    currency: isUSD ? 'NGN' : (business?.settings?.currency || 'NGN')
                }),
            });
            const verifyResult = await verifyResponse.json();
            if (!verifyResponse.ok || verifyResult.status !== 'success' || verifyResult.data.amount !== expectedPaystackAmount) {
                throw new Error(verifyResult.message || 'Payment verification failed.');
            }

            const { orderId, finalCustomerName } = await createOrderInFirestore({ method: 'Paystack', reference: transaction.reference, status: 'paid' });

            toast({ variant: 'success', title: 'Order Placed!', description: `Thank you, ${finalCustomerName}! Your order has been sent.` });

            onOrderPlaced();
            resetForm();

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Payment Error', description: error.message || 'There was an issue processing your payment.' });
        } finally {
            setIsSubmitting(false);
        }
    }, [total, createOrderInFirestore, toast, onOrderPlaced]);


    const handlePlaceOrder = async () => {
        if (!business) return;

        if (!name || !email || !address || !phone || (shippingOptions.length > 0 && !selectedShipping)) {
            toast({ variant: 'destructive', title: 'Missing Information', description: 'Please fill out all required fields, including shipping.' });
            return;
        }

        if (isCoreFeatureBlocked(business)) {
            toast({ variant: 'destructive', title: 'Store Unavailable', description: 'This store is currently not accepting new orders.' });
            return;
        }

        const hasPaystack = business.settings?.paystackSubaccount && business.settings.paystackSubaccount.length > 5;
        const hasBankDetails = business.settings?.paymentBankName && business.settings?.paymentBankAccountId;

        if (!hasPaystack && !hasBankDetails) {
            toast({ variant: 'destructive', title: 'Payment Not Configured', description: 'The store owner has not configured any payment methods.' });
            return;
        }

        setIsSubmitting(true);

        if (hasPaystack) {
            if (!isScriptLoaded) {
                toast({ variant: "destructive", title: "Payment Gateway Not Ready", description: "Please wait a moment." });
                setIsSubmitting(false);
                return;
            }

            // Calculate the amount and currency for Paystack
            // If the store is in USD, we convert to NGN for Paystack processing
            const isUSD = business?.settings?.currency === 'USD';
            const exchangeRate = business?.settings?.usdToNgnRate || 1500;
            const paystackAmount = isUSD ? Math.round(total * exchangeRate * 100) : Math.round(total * 100);
            const paystackCurrency = isUSD ? 'NGN' : (business?.settings?.currency || 'NGN');

            initializePayment({
                key: PAYSTACK_PUBLIC_KEY, 
                email, 
                amount: paystackAmount, 
                currency: paystackCurrency,
                reference: `z-${business.id.substring(0, 6)}-${Date.now()}`,
                subaccount: business?.settings?.paystackSubaccount, // Subaccount is NGN-based, so this is now safe
                onSuccess: handleSuccessfulPayment,
                onClose: () => setIsSubmitting(false),
            });
        } else {
            try {
                const { orderId, finalCustomerName } = await createOrderInFirestore({ method: 'Bank Transfer', status: 'pending' });
                toast({ variant: 'success', title: 'Order Placed!', description: `Your order has been placed. Please complete payment via bank transfer.` });
                onOrderPlaced();
                resetForm();
            } catch (e: any) {
                toast({ variant: 'destructive', title: 'Order Failed', description: e.message || 'Could not place your order.' });
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    const handleDialogChange = (open: boolean) => {
        if (!open) {
            resetForm();
        }
        onOpenChange(open);
    }

    const hasBankDetails = business?.settings?.paymentBankName && business.settings?.paymentBankAccountId;
    // Same expression as the local inside handlePlaceOrder (line ~164). The JSX
    // below referenced `hasPaystack` three times but only that function-scoped
    // copy existed, so rendering the dialog threw a ReferenceError.
    const hasPaystack = business?.settings?.paystackSubaccount && business.settings.paystackSubaccount.length > 5;
    const currencySymbol = business?.settings?.currency === 'USD' ? '$' : '₦';
    if (!business) return null;

    return (
        <Dialog open={isOpen} onOpenChange={handleDialogChange}>
            <DialogContent className="sm:max-w-lg flex flex-col h-full max-h-[95vh]">
                <DialogHeader>
                    <DialogTitle>Complete Your Order</DialogTitle>
                    <DialogDescription>Provide your details for fulfillment and payment.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="flex-1 -mx-6 px-6">
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div><Label htmlFor="name">Full Name</Label><Input id="name" value={name} onChange={e => setName(e.target.value)} required /></div>
                            <div><Label htmlFor="email">Email Address</Label><Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
                        </div>
                        <div><Label htmlFor="phone">Phone Number</Label><Input id="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} required /></div>
                        <div><Label htmlFor="address">Delivery Address</Label><Textarea id="address" value={address} onChange={e => setAddress(e.target.value)} required /></div>
                        {shippingOptions.length > 0 && (
                            <div>
                                <Label>Shipping Method</Label>
                                <Select onValueChange={setSelectedShipping} value={selectedShipping}>
                                    <SelectTrigger><SelectValue placeholder="Select a shipping option..." /></SelectTrigger>
                                    <SelectContent>
                                        {shippingOptions.map(opt => (
                                            <SelectItem key={opt.name} value={opt.name}>
                                                <div className="flex flex-col text-left">
                                                    <div className="flex justify-between w-full">
                                                        <span>{opt.name}{opt.type === 'pickup' ? ' (Pickup)' : ''}</span>
                                                        <span className="font-semibold ml-4">{currencySymbol}{opt.price.toLocaleString()}</span>
                                                    </div>
                                                    {opt.type === 'pickup' && opt.location && (
                                                        <p className="text-xs text-muted-foreground">{opt.location}</p>
                                                    )}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                </ScrollArea>
                <div className="mt-auto pt-4 space-y-4">
                    <Separator />
                    <div className="text-sm space-y-2">
                        <div className="flex justify-between"><span>Subtotal</span><span>{currencySymbol}{subtotal.toLocaleString()}</span></div>
                        <div className="flex justify-between"><span>Shipping</span><span>{currencySymbol}{shippingCost.toLocaleString()}</span></div>
                        <div className="flex justify-between font-bold text-lg"><span>Total</span><span>{currencySymbol}{total.toLocaleString()}</span></div>
                    </div>
                    {business?.settings?.currency === 'USD' && (
                        <p className="text-[10px] text-muted-foreground text-right italic -mt-3">
                            You will be charged approximately ₦{(total * (business.settings.usdToNgnRate || 1500)).toLocaleString()} via Paystack
                        </p>
                    )}

                    <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                        <h4 className="font-semibold mb-2">Payment Instructions</h4>
                        {hasPaystack && <p className="text-sm text-muted-foreground">You can pay securely with your card.</p>}
                        {hasBankDetails && (
                            <>
                                <p className="text-sm text-muted-foreground mt-2">
                                    {hasPaystack ? "Alternatively, you can make a direct bank transfer." : "Please make a direct bank transfer to the account below."}
                                </p>
                                <p className="text-sm font-medium mt-1">Bank: {business?.settings?.paymentBankName}</p>
                                <p className="text-sm font-medium">Account: {business?.settings?.paymentBankAccountId}</p>
                            </>
                        )}
                    </div>
                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button onClick={handlePlaceOrder} disabled={isSubmitting} className="bg-primary text-primary-foreground hover:bg-primary/90">
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {hasPaystack ? `Pay ${currencySymbol}${total.toLocaleString()}` : `Place Order`}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    )
}
