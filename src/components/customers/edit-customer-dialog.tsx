
'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { usePOS } from '@/context/pos-context';
import type { Customer } from '@/types';

interface EditCustomerDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
}

export default function EditCustomerDialog({ isOpen, onOpenChange, customer }: EditCustomerDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { triggerRefresh, addToQueue } = usePOS();
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [code, setCode] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);
  const isSavingRef = React.useRef(false);

  React.useEffect(() => {
    if (customer) {
      setName(customer.name);
      setEmail(customer.email);
      setPhone(customer.phone || '');
      setCode(customer.code || '');
    }
  }, [customer]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || isSavingRef.current) return;
    isSavingRef.current = true;
    setIsSaving(true);
    try {
      const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;
      const values = {
        name,
        email,
        phone,
        code: code.trim().toUpperCase(),
      };
      
      addToQueue({
        type: 'update-customer',
        payload: {
          id: customer.id,
          values
        }
      }, `Updating customer: ${name}`);

      toast({ title: 'Update Queued', description: `${name} will be updated ${navigator.onLine ? 'momentarily' : 'when you are online'}.`, variant: 'success' });
      onOpenChange(false);
    } catch (error) {
      toast({ title: 'Error', description: 'Could not update customer.', variant: 'destructive' });
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 pointer-events-auto animate-in fade-in duration-200" 
          onClick={() => onOpenChange(false)} 
        />
      )}
      <Dialog open={isOpen} onOpenChange={onOpenChange} modal={false}>
        <DialogContent className="sm:max-w-[500px] z-50">
        <DialogHeader>
          <DialogTitle>Edit Customer</DialogTitle>
          <DialogDescription>
            Update the details for {customer?.name}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" required />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">Email <span className="text-[10px] text-muted-foreground font-normal">(Optional)</span></Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="phone" className="text-right">Phone <span className="text-[10px] text-muted-foreground font-normal">(Optional)</span></Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="code" className="text-right">Unique Code <span className="text-[10px] text-muted-foreground font-normal">(Optional)</span></Label>
              <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. CUST-001" className="col-span-3" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      </Dialog>
    </>
  );
}
