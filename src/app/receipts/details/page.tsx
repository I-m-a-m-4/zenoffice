'use client';
import ReceiptDetails from "@/components/receipts/receipt-details";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useSearchParams, notFound, useRouter } from "next/navigation";
import { ArrowLeft, Download, Printer, Share2, Loader2, PlusCircle } from "lucide-react";
import * as React from "react";
import { useRef, Suspense } from "react";
// Dynamic imports for browser-only libraries handled in the function to avoid SSR initialization errors
import { useDoc, useFirestore, useMemoFirebase } from "@/firebase";
import { doc, addDoc, serverTimestamp, collection } from "firebase/firestore";
import type { Receipt, BusinessInstance } from "@/types";
import { usePOS } from "@/context/pos-context";
import { CURRENCY_SYMBOLS } from "@/lib/constants";
import Link from 'next/link';

function ReceiptContent() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const receiptId = searchParams.get('id');
  const { queuedActions, business: posBusiness, user, receipts } = usePOS();

  const firestore = useFirestore();
  const receiptRef = useMemoFirebase(() => (firestore && receiptId ? doc(firestore, 'receipts', receiptId) : null), [firestore, receiptId]);
  const { data: firestoreReceipt, isLoading: isReceiptLoading } = useDoc<Receipt>(receiptRef);

  const receipt = React.useMemo(() => {
      if (firestoreReceipt) return firestoreReceipt;
      if (!receiptId) return null;
      const cached = receipts?.find(r => r.id === receiptId);
      if (cached) return cached;
      const action = queuedActions?.find(a => a.type === 'complete-sale' && a.payload.receiptData.id === receiptId);
      if (action) return action.payload.receiptData;
      return null;
  }, [firestoreReceipt, receiptId, queuedActions, receipts]);

  // Fetch business info directly from Firestore if not provided by global POS context (e.g. public link)
  const businessRef = useMemoFirebase(() => (firestore && receipt?.businessId ? doc(firestore, 'businessInstances', receipt.businessId) : null), [firestore, receipt?.businessId]);
  const { data: dbBusiness, isLoading: isBusinessLoading } = useDoc<BusinessInstance>(businessRef);

  const business = posBusiness || dbBusiness;
  const currencySymbol = business?.settings?.currency ? CURRENCY_SYMBOLS[business.settings.currency] : '₦';

  const router = useRouter();
  const receiptContentRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
      setMounted(true);
  }, []);

  React.useEffect(() => {
    if (receipt && receipt.paymentMethod === 'Invoice') {
      router.replace(`/invoice/details?id=${receipt.id}`);
    }
  }, [receipt, router]);

  const isLoading = isReceiptLoading || (receipt && !business && isBusinessLoading);

  if (!mounted || (isLoading && !receipt) || !firestore) {
      return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <span className="ml-2">Loading document...</span></div>;
  }

  if (!receiptId || !receipt) {
    notFound();
  }

  // If this is an invoice, yield to redirect effect
  if (receipt.paymentMethod === 'Invoice') {
    return null;
  }

  const isInvoice = false;

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
      const filename = isInvoice ? `invoice-${receipt.id.substring(0, 8)}.pdf` : `receipt-${receipt.id.substring(0, 8)}.pdf`;
      pdf.save(filename);
      toast({ title: "Download Started", description: `${isInvoice ? 'Invoice' : 'Receipt'} has been generated.`, variant: 'success' });
    }
  };

  const getPublicShareUrl = (id: string, isInvoiceDoc: boolean) => {
    const baseUrl = 'https://zeneva.space';
    const path = isInvoiceDoc ? '/invoice/details' : '/receipts/details';
    return `${baseUrl}${path}?id=${id}`;
  };

  const copyToClipboard = () => {
    if (!receipt) return;
    const publicUrl = getPublicShareUrl(receipt.id, isInvoice);
    navigator.clipboard.writeText(publicUrl).then(() => {
      toast({
        title: "Link Copied",
        description: `${isInvoice ? 'Invoice' : 'Receipt'} link has been copied to your clipboard.`,
        variant: 'success'
      });

      // Track receipt share in Firestore
      if (firestore) {
          addDoc(collection(firestore, 'receipt_shares'), {
              receiptId: receipt.id,
              receiptNumber: receipt.receiptNumber || `rec-${receipt.id.substring(0, 8)}`,
              businessId: receipt.businessId,
              businessName: business?.name || 'Unknown',
              timestamp: serverTimestamp(),
              type: 'copy',
              totalAmount: receipt.total,
              customerName: receipt.customer?.name || 'Walk-in'
          }).catch(e => console.error("Failed to log receipt share:", e));
      }
    }, () => {
      toast({
        title: "Copy Failed",
        description: "Could not copy link to clipboard.",
        variant: 'destructive'
      });
    });
  };

  const handleShare = async () => {
    if (!receipt || !firestore) return;
    const publicUrl = getPublicShareUrl(receipt.id, isInvoice);
    const shareData = {
      title: `${isInvoice ? 'Invoice' : 'Receipt'} ${receipt.id.substring(0, 8)}`,
      text: `Here is your ${isInvoice ? 'invoice' : 'receipt'} from ${business?.name || 'our store'} for ${currencySymbol}${receipt.total.toFixed(2)}.`,
      url: publicUrl,
    };

    // Track receipt share in Firestore
    addDoc(collection(firestore, 'receipt_shares'), {
        receiptId: receipt.id,
        receiptNumber: receipt.receiptNumber || `rec-${receipt.id.substring(0, 8)}`,
        businessId: receipt.businessId,
        businessName: business?.name || 'Unknown',
        timestamp: serverTimestamp(),
        type: 'share',
        totalAmount: receipt.total,
        customerName: receipt.customer?.name || 'Walk-in'
    }).catch(e => console.error("Failed to log receipt share:", e));

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        if ((error as DOMException).name !== 'AbortError') {
          toast({
            title: "Share failed",
            description: "Link copied to clipboard instead.",
            variant: 'warning',
          });
          copyToClipboard();
        }
      }
    } else {
      copyToClipboard();
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 py-4 min-h-screen">
      {user && (
        <div className="w-full max-w-2xl flex justify-start no-print">
          <Button variant="ghost" asChild size="sm">
            <Link href="/receipts">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to History
            </Link>
          </Button>
        </div>
      )}

      <div ref={receiptContentRef} className="border rounded-lg bg-card overflow-hidden">
        <ReceiptDetails receipt={receipt} business={business} currencySymbol={currencySymbol} isInvoice={isInvoice} showAdminDetails={!!user && (user.role === 'admin' || user.role === 'manager')} />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 no-print">
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
            Create Professional Receipts Like This
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

export default function ReceiptPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <ReceiptContent />
    </Suspense>
  );
}
