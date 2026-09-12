
'use client';
import React from 'react';
import Barcode from 'react-barcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Product } from '@/types';
import { Printer } from 'lucide-react';
import { usePOS } from '@/context/pos-context';
import { useI18n } from '@/context/i18n-context';

interface BarcodeDialogProps {
  product: Product | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const BarcodePrintContent = React.forwardRef<HTMLDivElement, { product: Product, currencySymbol: string }>(({ product, currencySymbol }, ref) => {
    return (
        <div ref={ref} className="text-center p-8">
            <h3 className="text-lg font-semibold">{product.name}</h3>
            <p className="text-sm text-muted-foreground">{currencySymbol}{product.price.toLocaleString()}</p>
            <div className="flex justify-center my-4 bg-white p-4 rounded-lg">
                <Barcode value={product.sku} />
            </div>
        </div>
    );
});
BarcodePrintContent.displayName = 'BarcodePrintContent';


export default function BarcodeDialog({ product, isOpen, onOpenChange }: BarcodeDialogProps) {
  const printRef = React.useRef<HTMLDivElement>(null);
  const { currencySymbol } = usePOS();
  const { t } = useI18n();

  const handlePrint = () => {
    const printContent = printRef.current;
    if (printContent) {
        const printWindow = window.open('', '_blank', 'height=600,width=800');
        if (printWindow) {
            printWindow.document.write(`<html><head><title>${t('inventory.printBarcode')}</title>`);
            printWindow.document.write('<style>@media print { @page { size: auto; margin: 10mm; } body { font-family: sans-serif; text-align: center; } .barcode-container { display: inline-block; padding: 20px; border: 1px dashed #ccc; margin: 10px; page-break-inside: avoid; } }</style>');
            printWindow.document.write('</head><body>');
            printWindow.document.write('<div class="barcode-container">');
            printWindow.document.write(printContent.innerHTML);
            printWindow.document.write('</div>');
            printWindow.document.write('</body></html>');
            printWindow.document.close();
            printWindow.focus();
            printWindow.print();
            printWindow.close();
        }
    }
  };

  if (!product || !product.sku) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('inventory.productBarcodeTitle')}</DialogTitle>
          <DialogDescription>
            {t('inventory.barcodePrintHint')}
          </DialogDescription>
        </DialogHeader>
        <BarcodePrintContent ref={printRef} product={product} currencySymbol={currencySymbol}/>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.close')}</Button>
          <Button onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> {t('common.print')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
