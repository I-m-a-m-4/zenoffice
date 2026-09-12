'use client';
import ReceiptDetails from "@/components/receipts/receipt-details";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, Printer, Share2, Loader2, PlusCircle, CheckCircle, ArrowLeft } from "lucide-react";
import { useSearchParams, notFound, useRouter } from "next/navigation";
import * as React from "react";
import { useRef, Suspense } from "react";
// Dynamic imports for browser-only libraries handled in the function to avoid SSR initialization errors
import { useDoc, useFirestore, useMemoFirebase } from "@/firebase";
import { doc, updateDoc } from "firebase/firestore";
import type { Receipt, BusinessInstance } from "@/types";
import { usePOS } from "@/context/pos-context";
import { CURRENCY_SYMBOLS } from "@/lib/constants";
import Link from 'next/link';

function InvoiceContent() {
    const { toast } = useToast();
    const searchParams = useSearchParams();
    const invoiceId = searchParams.get('id');
    const router = useRouter();
    const { business: posBusiness, user, receipts } = usePOS();

    const firestore = useFirestore();
    const invoiceRef = useMemoFirebase(() => (firestore && invoiceId ? doc(firestore, 'receipts', invoiceId) : null), [firestore, invoiceId]);
    const { data: firestoreInvoice, isLoading: isInvoiceLoading } = useDoc<Receipt>(invoiceRef);

    const invoice = React.useMemo(() => {
        if (firestoreInvoice) return firestoreInvoice;
        if (!invoiceId) return null;
        return receipts?.find(r => r.id === invoiceId) || null;
    }, [firestoreInvoice, invoiceId, receipts]);

    // Fetch business info directly from Firestore if not provided by global POS context (e.g. public link)
    const businessRef = useMemoFirebase(() => (firestore && invoice?.businessId ? doc(firestore, 'businessInstances', invoice.businessId) : null), [firestore, invoice?.businessId]);
    const { data: dbBusiness, isLoading: isBusinessLoading } = useDoc<BusinessInstance>(businessRef);

    const business = posBusiness || dbBusiness;
    const currencySymbol = business?.settings?.currency ? CURRENCY_SYMBOLS[business.settings.currency] : '₦';

    const receiptContentRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const isLoading = isInvoiceLoading || (invoice && !business && isBusinessLoading);

    if (!mounted || (isLoading && !invoice) || !firestore) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <span className="ml-2">Loading Invoice...</span></div>;
    }

    if (!invoiceId || !invoice) {
        notFound();
    }

    // If this record is NOT an invoice, redirect to receipts
    if (invoice.paymentMethod !== 'Invoice') {
        router.replace(`/receipts/details?id=${invoice.id}`);
        return null;
    }

    const handlePrint = () => {
        window.print();
    };

    const handleDownload = async () => {
        if (receiptContentRef.current) {
            toast({ title: "Generating PDF...", description: "Please wait while we prepare your document." });
            
            // Dynamic imports to prevent SSR/Build errors
            const html2canvas = (await import('html2canvas')).default;
            const { jsPDF } = await import('jspdf');

            const canvas = await html2canvas(receiptContentRef.current, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'p',
                unit: 'px',
                format: [canvas.width, canvas.height]
            });
            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            pdf.save(`invoice-${invoice.id.substring(0, 8)}.pdf`);
            toast({ title: "Download Started", description: "Invoice has been generated.", variant: 'success' });
        }
    };

    const handleMarkPaid = async () => {
        if (!firestore || !invoice) return;
        try {
            await updateDoc(doc(firestore, 'receipts', invoice.id), {
                status: 'paid'
            });
            toast({ variant: 'success', title: 'Payment Recorded', description: 'The invoice has been marked as paid.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not update payment status.' });
        }
    };

    const handleShare = async () => {
        if (!invoice) return;
        const publicUrl = `https://zeneva.space/invoice/details?id=${invoice.id}`;
        const shareData = {
            title: `Invoice ${invoice.id.substring(0, 8)}`,
            text: `View your invoice from ${business?.name || 'Zeneva POS'}: ${currencySymbol}${invoice.total.toLocaleString()}`,
            url: publicUrl,
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                await navigator.clipboard.writeText(publicUrl);
                toast({ title: "Link Copied", description: "Sharing link copied to clipboard." });
            }
        } catch (err) {
            console.error('Error sharing:', err);
        }
    };

    return (
        <div className="flex flex-col items-center gap-6 py-4 min-h-screen">
            {user && (
                <div className="w-full max-w-2xl flex justify-start no-print">
                    <Button variant="ghost" asChild size="sm">
                        <Link href="/invoices">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Invoices
                        </Link>
                    </Button>
                </div>
            )}

            <div ref={receiptContentRef} className="border rounded-lg bg-card overflow-hidden">
                <ReceiptDetails receipt={invoice} business={business} currencySymbol={currencySymbol} isInvoice={true} showAdminDetails={!!user && (user.role === 'admin' || user.role === 'manager')} />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 no-print">
                {user && invoice.status && invoice.status !== 'paid' && (
                    <Button onClick={handleMarkPaid} variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                        <CheckCircle className="mr-2 h-4 w-4" /> Mark as Paid
                    </Button>
                )}
                {user && (
                    <Button asChild variant="outline">
                        <Link href="/sales/pos/select-products"><PlusCircle className="mr-2 h-4 w-4" /> New Sale</Link>
                    </Button>
                )}
                <Button onClick={handlePrint} variant="outline">
                    <Printer className="mr-2 h-4 w-4" /> Print
                </Button>
                <Button onClick={handleDownload} variant="default">
                    <Download className="mr-2 h-4 w-4" /> Download PDF
                </Button>
                <Button onClick={handleShare} variant="outline">
                    <Share2 className="mr-2 h-4 w-4" /> Share
                </Button>
            </div>

            {/* Subtle Footer CTA for visitors */}
            <footer className="w-full max-w-2xl mt-auto pt-6 pb-4 border-t text-center no-print">
                <div className="flex flex-col items-center gap-1 px-4">
                    <p className="text-xs font-semibold text-foreground">
                        Create Professional Invoices Like This
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                        Manage your sales, inventory, and invoices with Zeneva POS.
                    </p>
                    <Link 
                        href="https://zeneva.space" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-primary hover:underline mt-1.5"
                    >
                        Get Started Free
                    </Link>
                </div>
            </footer>
        </div>
    );
}

export default function InvoiceDetailPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <InvoiceContent />
        </Suspense>
    );
}
