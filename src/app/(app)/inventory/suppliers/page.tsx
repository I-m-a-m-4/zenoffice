'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Truck,
  Plus,
  Search,
  ChevronLeft,
  Phone,
  Mail,
  MapPin,
  FileText,
  Edit2,
  Trash2,
  PackageCheck,
  Loader2,
  Building2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { usePOS } from '@/context/pos-context';
import { useFirestore } from '@/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import type { Supplier } from '@/types';

export default function SuppliersPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { business, currentUserProfile, currencySymbol } = usePOS();
  const firestore = useFirestore();

  const [suppliers, setSuppliers] = React.useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingSupplier, setEditingSupplier] = React.useState<Supplier | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  // Form State
  const [name, setName] = React.useState('');
  const [contactPerson, setContactPerson] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [paymentTerms, setPaymentTerms] = React.useState('Net 30');
  const [notes, setNotes] = React.useState('');

  // Listen to Firestore suppliers
  React.useEffect(() => {
    if (!business?.id || !firestore) {
      setIsLoading(false);
      return;
    }

    const suppliersRef = collection(firestore, 'businessInstances', business.id, 'suppliers');
    const q = query(suppliersRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as Supplier[];
      setSuppliers(docs);
      setIsLoading(false);
    }, (err) => {
      console.error('Error fetching suppliers:', err);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [business?.id, firestore]);

  const openAddDialog = () => {
    setEditingSupplier(null);
    setName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setAddress('');
    setPaymentTerms('Net 30');
    setNotes('');
    setIsDialogOpen(true);
  };

  const openEditDialog = (sup: Supplier) => {
    setEditingSupplier(sup);
    setName(sup.name || '');
    setContactPerson(sup.contactPerson || '');
    setPhone(sup.phone || '');
    setEmail(sup.email || '');
    setAddress(sup.address || '');
    setPaymentTerms(sup.paymentTerms || 'Net 30');
    setNotes(sup.notes || '');
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ variant: 'destructive', title: 'Supplier Name Required', description: 'Please enter a name for the supplier.' });
      return;
    }

    if (!business?.id || !firestore) return;
    setIsSaving(true);

    try {
      if (editingSupplier) {
        // Update
        const supRef = doc(firestore, 'businessInstances', business.id, 'suppliers', editingSupplier.id);
        await updateDoc(supRef, {
          name: name.trim(),
          contactPerson: contactPerson.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          address: address.trim() || null,
          paymentTerms,
          notes: notes.trim() || null,
          updatedAt: new Date()
        });
        toast({ title: 'Supplier Updated', description: `${name} has been updated successfully.` });
      } else {
        // Add
        const suppliersRef = collection(firestore, 'businessInstances', business.id, 'suppliers');
        await addDoc(suppliersRef, {
          businessId: business.id,
          name: name.trim(),
          contactPerson: contactPerson.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          address: address.trim() || null,
          paymentTerms,
          notes: notes.trim() || null,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        toast({ title: 'Supplier Created', description: `${name} has been added to your suppliers.` });
      }

      setIsDialogOpen(false);
    } catch (err) {
      console.error('Failed to save supplier:', err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save supplier. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (supplierId: string, supplierName: string) => {
    if (!confirm(`Are you sure you want to delete supplier "${supplierName}"?`)) return;
    if (!business?.id || !firestore) return;

    try {
      const supRef = doc(firestore, 'businessInstances', business.id, 'suppliers', supplierId);
      await deleteDoc(supRef);
      toast({ title: 'Supplier Deleted', description: `${supplierName} removed.` });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete supplier.' });
    }
  };

  const filteredSuppliers = suppliers.filter(s =>
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.contactPerson?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" asChild className="h-9 w-9">
            <Link href="/inventory">
              <ChevronLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Truck className="h-6 w-6 text-primary" /> Suppliers
            </h1>
            <p className="text-xs text-muted-foreground">Manage vendor contacts, payment terms, and purchase orders</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/inventory/suppliers/orders">
              <PackageCheck className="h-4 w-4 mr-2" /> Purchase Orders
            </Link>
          </Button>
          <Button onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" /> Add Supplier
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search suppliers by name, phone, email..."
          className="pl-9"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Supplier List Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredSuppliers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSuppliers.map((supplier) => (
            <Card key={supplier.id} className="hover:border-primary/50 transition-all flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{supplier.name}</CardTitle>
                      {supplier.contactPerson && (
                        <CardDescription className="text-xs">{supplier.contactPerson}</CardDescription>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs font-normal">
                    {supplier.paymentTerms || 'Net 30'}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="py-2 text-xs space-y-2">
                {supplier.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span>{supplier.phone}</span>
                  </div>
                )}
                {supplier.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span>{supplier.email}</span>
                  </div>
                )}
                {supplier.address && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{supplier.address}</span>
                  </div>
                )}
                {supplier.notes && (
                  <div className="p-2 bg-muted/40 rounded text-[11px] text-muted-foreground italic mt-2">
                    "{supplier.notes}"
                  </div>
                )}
              </CardContent>

              <div className="p-4 pt-2 border-t flex items-center justify-between text-xs mt-3">
                <Button variant="ghost" size="sm" onClick={() => openEditDialog(supplier)}>
                  <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/inventory/suppliers/orders?supplierId=${supplier.id}`}>
                      Create PO
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(supplier.id, supplier.name)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center p-12">
          <CardContent className="space-y-3 pt-6">
            <Truck className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <h3 className="text-lg font-semibold">No Suppliers Found</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Add your vendors and suppliers to streamline restocking and track purchase orders.
            </p>
            <Button onClick={openAddDialog} className="mt-2">
              <Plus className="h-4 w-4 mr-2" /> Add Your First Supplier
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Add / Edit Supplier Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}</DialogTitle>
            <DialogDescription>
              Store contact details and default payment terms for vendor orders.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-3">
            <div className="grid gap-1.5">
              <Label htmlFor="supName">Supplier Company Name *</Label>
              <Input
                id="supName"
                placeholder="e.g. Acme Wholesale Ltd"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="contactPerson">Contact Person</Label>
                <Input
                  id="contactPerson"
                  placeholder="e.g. John Doe"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="paymentTerms">Payment Terms</Label>
                <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                  <SelectTrigger id="paymentTerms">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Immediate">Immediate / Cash</SelectItem>
                    <SelectItem value="Net 15">Net 15 Days</SelectItem>
                    <SelectItem value="Net 30">Net 30 Days</SelectItem>
                    <SelectItem value="Net 60">Net 60 Days</SelectItem>
                    <SelectItem value="Cash on Delivery">Cash on Delivery (COD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  placeholder="+234..."
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="orders@acme.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="address">Warehouse / Office Address</Label>
              <Input
                id="address"
                placeholder="12 Commercial Way, Lagos"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="notes">Notes / Account #</Label>
              <Textarea
                id="notes"
                placeholder="Account manager details, preferred shipping method..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingSupplier ? 'Save Changes' : 'Create Supplier'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
