'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { writeBatch, collection, doc, serverTimestamp, increment } from 'firebase/firestore';
import { Loader2, UploadCloud, FileSpreadsheet, AlertTriangle, CheckCircle } from 'lucide-react';
import Papa from 'papaparse';
import { Customer } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { ScrollArea } from '../ui/scroll-area';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { useBranch } from '@/context/branch-context';
import { usePOS } from '@/context/pos-context';
import { isCoreFeatureBlocked } from '@/lib/plan';
import { UpgradeOverlay } from '@/components/shared/upgrade-overlay';

interface ImportCustomersDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSuccess: () => void;
  businessId: string;
  existingCustomers: Customer[];
}

type ParsedCustomer = Partial<Pick<Customer, 'name' | 'email' | 'phone' | 'code'>>;
type ParsedCustomerWithEmail = ParsedCustomer & { email: string; };

const HEADER_MAPPINGS: { [key: string]: string[] } = {
  name: ['name', 'Name', 'Full Name', 'Customer Name'],
  email: ['email', 'Email', 'Email Address'],
  phone: ['phone', 'Phone', 'Phone Number', 'Mobile'],
  code: ['code', 'Code', 'Unique Code', 'Customer Code', 'ID'],
};

export default function ImportCustomersDialog({ isOpen, onOpenChange, onSuccess, businessId, existingCustomers }: ImportCustomersDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  /**
   * Imported rows carried no `branchId`, unlike every customer created through
   * `addToQueue` (which injects the active branch on `add-customer`). In a
   * multi-branch shop that meant an imported customer belonged to no branch and so
   * appeared under none of them once the list is branch-filtered.
   */
  const { activeBranchId } = useBranch();
  const { business } = usePOS();

  const [file, setFile] = React.useState<File | null>(null);
  const [parsedData, setParsedData] = React.useState<ParsedCustomerWithEmail[]>([]);
  const [isParsing, setIsParsing] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showUpgradeOverlay, setShowUpgradeOverlay] = React.useState(false);
  const [generatePlaceholderEmail, setGeneratePlaceholderEmail] = React.useState(true);
  const existingEmails = React.useMemo(() => new Set(existingCustomers.map(c => c.email.toLowerCase())), [existingCustomers]);

  const parseFile = React.useCallback((fileToParse: File) => {
    setIsParsing(true);
    setParsedData([]);
    setError(null);
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
          email: findHeader(HEADER_MAPPINGS.email),
          phone: findHeader(HEADER_MAPPINGS.phone),
          code: findHeader(HEADER_MAPPINGS.code),
        };

        if (!mappedHeaders.name) {
          setError("CSV must contain a 'Name' column.");
          setIsParsing(false);
          return;
        }

        const data: ParsedCustomer[] = results.data.map((row: any) => ({
          name: row[mappedHeaders.name!] || undefined,
          email: mappedHeaders.email ? row[mappedHeaders.email] || undefined : undefined,
          phone: mappedHeaders.phone ? String(row[mappedHeaders.phone] || '') : undefined,
          code: mappedHeaders.code ? String(row[mappedHeaders.code] || '').trim().toUpperCase() : undefined,
        }));

        const validData = data.filter(d => d.name);

        const processedData = validData.map(d => {
          if (generatePlaceholderEmail && !d.email && d.name) {
            const sanitizedName = d.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (sanitizedName) {
              const uniqueSuffix = Math.random().toString(36).substring(2, 6);
              return {
                ...d,
                email: `${sanitizedName}${uniqueSuffix}@zeneva-import.local`,
              };
            }
          }
          return d;
        }).filter((d): d is ParsedCustomerWithEmail => !!d.name); // Only name is strictly required

        const newData = processedData.filter(d => {
          if (!d.email) return true;
          return !existingEmails.has(d.email.toLowerCase());
        });

        if (newData.length !== processedData.length && newData.length < validData.length) {
          toast({
            variant: 'warning',
            title: 'Duplicates Found',
            description: `${processedData.length - newData.length} customers already exist and will be skipped.`
          })
        }

        setParsedData(newData);
        setIsParsing(false);
      },
      error: (err) => {
        setError(err.message);
        setIsParsing(false);
      }
    });
  }, [generatePlaceholderEmail, existingEmails, toast]);

  React.useEffect(() => {
    if (file) {
      parseFile(file);
    } else {
      setParsedData([]);
      setError(null);
    }
  }, [file, generatePlaceholderEmail, parseFile]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv') {
        setError('Invalid file type. Please upload a CSV file.');
        setFile(null);
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleImport = async () => {
    if (!businessId || !firestore || parsedData.length === 0) return;
    if (business && isCoreFeatureBlocked(business)) {
        setShowUpgradeOverlay(true);
        return;
    }
    setIsImporting(true);
    try {
      const customersRef = collection(firestore, 'customers');
      const statsRef = doc(firestore, 'businessInstances', businessId, 'stats', 'overall');
      
      // Batch size limit is 500 in Firestore
      const BATCH_SIZE = 450; // Leave some room for stats update
      const totalBatches = Math.ceil(parsedData.length / BATCH_SIZE);
      
      for (let i = 0; i < totalBatches; i++) {
        const batch = writeBatch(firestore);
        const chunk = parsedData.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        
        chunk.forEach(customerData => {
          const newCustomerRef = doc(customersRef);
          batch.set(newCustomerRef, {
            name: customerData.name,
            email: customerData.email,
            lowercaseName: customerData.name?.toLowerCase() || '',
            lowercaseEmail: customerData.email?.toLowerCase() || '',
            phone: customerData.phone || '',
            code: customerData.code || '',
            businessId,
            ...(activeBranchId ? { branchId: activeBranchId } : {}),
            loyaltyPoints: 0,
            totalSpent: 0, // CRITICAL: Required for query ordering
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(), // CRITICAL: Required for sync logic
          });
        });
        
        // Update stats in the last batch or once per batch
        // We'll update it once per batch for safety
        batch.set(statsRef, { totalCustomers: increment(chunk.length) }, { merge: true });
        
        await batch.commit();
      }

      toast({
        variant: 'success',
        title: 'Import Successful',
        description: `${parsedData.length} new customers have been added.`,
      });
      onSuccess();
    } catch (e) {
      console.error("Import failed:", e);
      toast({
        variant: 'destructive',
        title: 'Import Failed',
        description: 'An error occurred while saving the customers. Please try again.',
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
    setGeneratePlaceholderEmail(true);
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
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Import Customers from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file to bulk-add customers. Ensure your file has columns for 'Name' and 'Email' or 'Phone'.
          </DialogDescription>
        </DialogHeader>

        {!file ? (
          <div className="mt-4 flex justify-center rounded-lg border-2 border-dashed border-border px-6 py-10">
            <div className="text-center">
              <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
              <label
                htmlFor="customer-file-upload"
                className="relative cursor-pointer rounded-md font-semibold text-primary focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 hover:text-primary/80"
              >
                <span>Upload a file</span>
                <input id="customer-file-upload" name="customer-file-upload" type="file" className="sr-only" accept=".csv" onChange={handleFileChange} />
              </label>
              <p className="pl-1">or drag and drop</p>
              <p className="text-xs leading-5 text-muted-foreground">CSV up to 5MB</p>
            </div>
          </div>
        ) : (
          <div className='mt-4'>
            <div className='flex items-center gap-3 p-3 rounded-lg bg-muted border'>
              <FileSpreadsheet className="h-6 w-6 text-primary" />
              <div className='flex-1'>
                <p className='text-sm font-medium'>{file.name}</p>
                <p className='text-xs text-muted-foreground'>
                  {isParsing ? <Loader2 className="h-4 w-4 animate-spin inline-block mr-1" /> : <CheckCircle className="h-4 w-4 text-green-500 inline-block mr-1" />}
                  {isParsing ? 'Parsing...' : `${parsedData.length} new customers found.`}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setFile(null)}>Change file</Button>
            </div>

            <div className="mt-4 flex items-center space-x-2">
              <Checkbox
                id="generate-email"
                checked={generatePlaceholderEmail}
                onCheckedChange={(checked) => setGeneratePlaceholderEmail(!!checked)}
              />
              <Label htmlFor="generate-email" className="text-sm font-normal text-muted-foreground cursor-pointer">
                Generate placeholder emails for rows that are missing one (based on customer name). If unchecked, rows without an email will be skipped.
              </Label>
            </div>

            {parsedData.length > 0 && (
              <div className='mt-4'>
                <h4 className='text-sm font-medium mb-2'>Preview of new customers to import:</h4>
                <ScrollArea className="h-60">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Phone</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedData.slice(0, 10).map((p, i) => (
                        <TableRow key={i}>
                          <TableCell>{p.name}</TableCell>
                          <TableCell>{p.email}</TableCell>
                          <TableCell>{p.code || 'N/A'}</TableCell>
                          <TableCell>{p.phone || 'N/A'}</TableCell>
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
            <AlertTriangle className="h-5 w-5" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <DialogFooter className='mt-4'>
          <Button variant="outline" size="lg" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="lg" onClick={handleImport} disabled={isParsing || isImporting || parsedData.length === 0 || !!error || !businessId}>
            {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isImporting ? 'Importing...' : `Import ${parsedData.length} Customers`}
          </Button>
        </DialogFooter>
      </DialogContent>
      <UpgradeOverlay open={showUpgradeOverlay} onOpenChange={setShowUpgradeOverlay} />
    </Dialog>
    </>
  );
}
