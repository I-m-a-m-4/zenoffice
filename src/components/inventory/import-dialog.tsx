
'use client';

import * as React from 'react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser } from '@/firebase';
import { writeBatch, collection, doc, serverTimestamp, getDoc, updateDoc, addDoc } from 'firebase/firestore';
import { logImportTelemetry } from '@/lib/import/telemetry';
import { Loader2, UploadCloud, FileSpreadsheet, AlertTriangle, CheckCircle, Package } from 'lucide-react';
import Papa from 'papaparse';
import { Product } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { ScrollArea } from '../ui/scroll-area';
import { useBusiness, usePOS } from '@/context/pos-context';
import { isCoreFeatureBlocked } from '@/lib/plan';
import Link from 'next/link';
import { track } from '@vercel/analytics';
import { UpgradeOverlay } from '@/components/shared/upgrade-overlay';

interface ImportDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSuccess: () => void;
  businessId: string | null | undefined;
  products: Product[] | null;
}

type ParsedProduct = Partial<Omit<Product, 'id' | 'businessId' | 'imageHint' | 'lowStockThreshold'>>;

// Mappings for common CSV header variations
const HEADER_MAPPINGS: { [key: string]: string[] } = {
  name: ['Name', 'Product Name', 'Item Name', 'Title'],
  sku: ['SKU', 'Code', 'Item Code'],
  // Prioritize more specific category names by listing them first
  category: ['Category', 'Categories', 'Product Category', 'Type'],
  // Add plural and common variations for price
  price: ['Price', 'Regular Price', 'Regular Prices', 'Sale Price', 'RetailPrice'],
  costPrice: ['Cost Price', 'Cost', 'Purchase Price'],
  stock: ['Stock', 'Quantity', 'In Stock', 'Qty', 'inventory'],
  description: ['Description', 'Body HTML', 'Details', 'ShortDescription'],
  // Add more image variations
  imageUrl: ['Image URL', 'ImageURL', 'Image Link', 'Image Src', 'Image', 'Images', 'Image 1'],
};


export default function ImportDialog({ isOpen, onOpenChange, onSuccess, businessId, products }: ImportDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const business = useBusiness();
  const { triggerConfetti, triggerRefresh } = usePOS();

  const [file, setFile] = React.useState<File | null>(null);
  const [parsedData, setParsedData] = React.useState<ParsedProduct[]>([]);
  const [isParsing, setIsParsing] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showUpgradeOverlay, setShowUpgradeOverlay] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      logImportTelemetry(firestore, {
        userId: user?.uid || 'anonymous',
        userEmail: user?.email || '',
        userName: user?.displayName || '',
        businessId: businessId || business?.id || '',
        businessName: business?.name || '',
        action: 'opened_classic_modal',
        source: 'spreadsheet',
      });
    }
  }, [isOpen, businessId, business, firestore, user]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      logImportTelemetry(firestore, {
        userId: user?.uid || 'anonymous',
        userEmail: user?.email || '',
        userName: user?.displayName || '',
        businessId: businessId || business?.id || '',
        businessName: business?.name || '',
        action: 'selected_classic_file',
        source: 'spreadsheet',
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        fileType: selectedFile.type,
      });

      if (selectedFile.type !== 'text/csv') {
        setError('Invalid file type. Please upload a CSV file.');
        setFile(null);
        setParsedData([]);
        return;
      }
      setFile(selectedFile);
      setError(null);
      parseFile(selectedFile);
    }
  };

  const parseFile = (fileToParse: File) => {
    setIsParsing(true);
    setParsedData([]);
    Papa.parse(fileToParse, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields;
        if (!headers) {
          setError('Could not read headers from CSV file.');
          setIsParsing(false);
          return;
        }

        const lowerCaseHeaders = headers.map(h => h.toLowerCase().trim());
        
        const findHeader = (possibleNames: string[]): string | undefined => {
            for (const name of possibleNames) {
                const lowerName = name.toLowerCase();
                const index = lowerCaseHeaders.indexOf(lowerName);
                if (index !== -1) {
                    return headers[index];
                }
            }
            return undefined;
        };
        
        const mappedHeaders = {
            name: findHeader(HEADER_MAPPINGS.name),
            sku: findHeader(HEADER_MAPPINGS.sku),
            category: findHeader(HEADER_MAPPINGS.category),
            price: findHeader(HEADER_MAPPINGS.price),
            costPrice: findHeader(HEADER_MAPPINGS.costPrice),
            stock: findHeader(HEADER_MAPPINGS.stock),
            description: findHeader(HEADER_MAPPINGS.description),
            imageUrl: findHeader(HEADER_MAPPINGS.imageUrl),
        };

        if (!mappedHeaders.name || !mappedHeaders.price) {
          setError("CSV must contain at least 'Name' and 'Price' columns (or a common variation like 'Regular Price').");
          setIsParsing(false);
          return;
        }

        const data: ParsedProduct[] = results.data.map((row: any) => ({
          name: row[mappedHeaders.name!] || 'Untitled Product',
          sku: mappedHeaders.sku ? row[mappedHeaders.sku] || '' : '',
          category: mappedHeaders.category ? row[mappedHeaders.category] || 'Uncategorized' : 'Uncategorized',
          price: parseFloat(String(row[mappedHeaders.price!]).replace(/[^0-9.-]+/g,"")) || 0,
          costPrice: mappedHeaders.costPrice ? parseFloat(String(row[mappedHeaders.costPrice]).replace(/[^0-9.-]+/g,"")) || 0 : 0,
          stock: mappedHeaders.stock ? parseInt(row[mappedHeaders.stock], 10) || 0 : 0,
          description: mappedHeaders.description ? row[mappedHeaders.description] || '' : '',
          imageUrl: mappedHeaders.imageUrl ? row[mappedHeaders.imageUrl] || '' : '',
        }));
        
        setParsedData(data);
        setIsParsing(false);
      },
      error: (err) => {
        setError(err.message);
        setIsParsing(false);
      }
    });
  };

  const handleImport = async () => {
    if (!businessId || !firestore || parsedData.length === 0 || !business || !products) {
        toast({
            variant: 'destructive',
            title: 'Import Failed',
            description: 'Cannot import products without required session data.',
        });
        return;
    }
    if (isCoreFeatureBlocked(business)) {
        setShowUpgradeOverlay(true);
        return;
    }

    setIsImporting(true);
    try {
      const batch = writeBatch(firestore);
      const productsRef = collection(firestore, 'products');
      
      parsedData.forEach(productData => {
        const newProductRef = doc(productsRef);
        batch.set(newProductRef, {
          ...productData,
          businessId: businessId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();
      triggerConfetti();
      
      try {
        const businessDocRef = doc(firestore, 'businessInstances', businessId);
        const businessDocSnap = await getDoc(businessDocRef);
        if (businessDocSnap.exists()) {
          const businessData = businessDocSnap.data();
          const existingCategories = businessData.settings?.productCategories || [];
          const newCategories = parsedData.map(p => p.category).filter(Boolean);
          // @ts-ignore
          const allCategories = [...new Set([...existingCategories, ...newCategories])].sort();

          await updateDoc(businessDocRef, {
            "settings.productCategories": allCategories,
          });
        }
      } catch (categoryError) {
        console.error("Could not update categories:", categoryError);
        toast({
            variant: 'warning',
            title: 'Categories Not Updated',
            description: 'Products were imported, but we couldn\'t automatically update your category list.',
        });
      }

      toast({
        variant: 'success',
        title: 'Import Successful',
        description: `${parsedData.length} products have been added to your inventory.`,
      });
      onSuccess();
      triggerRefresh();
    } catch (e) {
      console.error("Import failed:", e);
      toast({
        variant: 'destructive',
        title: 'Import Failed',
        description: 'An error occurred while saving the products. Please try again.',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const resetState = () => {
    setFile(null);
    setParsedData([]);
    setError(null);
    setIsParsing(false);
    setIsImporting(false);
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetState();
    }
    onOpenChange(open);
  }

  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => { setIsMounted(true); }, []);

  return (
    <>
      {isMounted && isOpen && createPortal(
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px] transition-opacity animate-in fade-in-0" 
          onClick={() => handleOpenChange(false)} 
        />,
        document.body
      )}
      <Dialog open={isOpen} onOpenChange={handleOpenChange} modal={false}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import Products from CSV</DialogTitle>
           <DialogDescription asChild>
            <div className="text-sm text-muted-foreground">
                <p>Upload a CSV file to bulk-add products. Your file must have columns for at least <strong>Name</strong> and <strong>Price</strong>. We also support common variations like 'Regular Price' (from WooCommerce) and various 'Image' headers.</p>
                <p>For more details on formatting, visit our <Link href="/support#csv-formatting" className="text-primary underline" onClick={() => onOpenChange(false)}>Support page</Link>.</p>
            </div>
           </DialogDescription>
        </DialogHeader>
        
        {!file ? (
             <div className="mt-4 flex justify-center rounded-lg border-2 border-dashed border-border px-6 py-10">
                <div className="text-center">
                    <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
                    <label
                        htmlFor="file-upload"
                        className="relative cursor-pointer rounded-md font-semibold text-primary focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 hover:text-primary/80"
                    >
                        <span>Upload a file</span>
                        <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".csv" onChange={handleFileChange} />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                    <p className="text-xs leading-5 text-muted-foreground">CSV up to 10MB</p>
                </div>
            </div>
        ): (
            <div className='mt-4'>
                <div className='flex items-center gap-3 p-3 rounded-lg bg-muted border'>
                    <FileSpreadsheet className="h-6 w-6 text-primary"/>
                    <div className='flex-1'>
                        <p className='text-sm font-medium'>{file.name}</p>
                        <p className='text-xs text-muted-foreground'>
                            {isParsing ? <Loader2 className="h-4 w-4 animate-spin inline-block mr-1"/> : <CheckCircle className="h-4 w-4 text-green-500 inline-block mr-1"/>}
                            {isParsing ? 'Parsing...' : `${parsedData.length} products found.`}
                        </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setFile(null); setParsedData([]); }}>Change file</Button>
                </div>

                {parsedData.length > 0 && (
                    <div className='mt-4'>
                        <h4 className='text-sm font-medium mb-2'>Preview:</h4>
                        <ScrollArea className="h-64">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Image</TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Category</TableHead>
                                        <TableHead>Price</TableHead>
                                        <TableHead>Cost Price</TableHead>
                                        <TableHead>Stock</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {parsedData.slice(0, 10).map((p, i) => (
                                        <TableRow key={i}>
                                            <TableCell>
                                                {p.imageUrl ? (
                                                    <Image
                                                        src={p.imageUrl}
                                                        alt={p.name || 'Product Image'}
                                                        width={40}
                                                        height={40}
                                                        className="aspect-square rounded-md object-cover"
                                                    />
                                                ) : (
                                                    <div className="h-10 w-10 bg-muted rounded-md flex items-center justify-center text-muted-foreground">
                                                        <Package/>
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>{p.name}</TableCell>
                                            <TableCell>{p.category}</TableCell>
                                            <TableCell>₦{p.price?.toFixed(2)}</TableCell>
                                            <TableCell>₦{p.costPrice?.toFixed(2)}</TableCell>
                                            <TableCell>{p.stock}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                        {parsedData.length > 10 && <p className='text-xs text-muted-foreground text-center mt-2'>...and {parsedData.length - 10} more rows.</p>}
                    </div>
                )}
            </div>
        )}
        
        {error && (
             <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
                <AlertTriangle className="h-5 w-5"/>
                <p className="text-sm">{error}</p>
             </div>
        )}

        <DialogFooter className='mt-4'>
          <Button variant="outline" size="lg" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="lg" onClick={handleImport} disabled={isParsing || isImporting || parsedData.length === 0 || !!error || !businessId}>
            {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
            {isImporting ? 'Importing...' : `Import ${parsedData.length} Products`}
          </Button>
        </DialogFooter>
      </DialogContent>
      <UpgradeOverlay open={showUpgradeOverlay} onOpenChange={setShowUpgradeOverlay} />
    </Dialog>
    </>
  );
}
