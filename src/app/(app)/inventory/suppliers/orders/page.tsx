'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  PackageCheck,
  Plus,
  Search,
  ChevronLeft,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  Truck,
  Trash2,
  Loader2,
  FileSpreadsheet
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
import { collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import type { Supplier, SupplierPurchase, PurchaseOrderItem, Product } from '@/types';

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSupplierId = searchParams.get('supplierId');
  const { toast } = useToast();
  const { business, products, currentUserProfile, currencySymbol, addToQueue } = usePOS();
  const firestore = useFirestore();

  const [orders, setOrders] = React.useState<SupplierPurchase[]>([]);
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [searchTerm, setSearchTerm] = React.useState('');

  // Dialog State for New PO
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  // New PO Form State
  const [selectedSupplierId, setSelectedSupplierId] = React.useState<string>(initialSupplierId || '');
  const [poNotes, setPoNotes] = React.useState('');
  const [poItems, setPoItems] = React.useState<{ productId: string; productName: string; quantity: number; unitCost: number }[]>([]);
  
  // Selected product input for adding to PO
  const [selectedProductId, setSelectedProductId] = React.useState('');
  const [itemQty, setItemQty] = React.useState('10');
  const [itemCost, setItemCost] = React.useState('');

  // Fetch Suppliers
  React.useEffect(() => {
    if (!business?.id || !firestore) return;
    const suppliersRef = collection(firestore, 'businessInstances', business.id, 'suppliers');
    const unsubscribe = onSnapshot(suppliersRef, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Supplier[];
      setSuppliers(docs);
    });
    return () => unsubscribe();
  }, [business?.id, firestore]);

  // Listen to Firestore purchaseOrders
  React.useEffect(() => {
    if (!business?.id || !firestore) {
      setIsLoading(false);
      return;
    }

    const ordersRef = collection(firestore, 'businessInstances', business.id, 'purchaseOrders');
    const q = query(ordersRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as SupplierPurchase[];
      setOrders(docs);
      setIsLoading(false);
    }, (err) => {
      console.error('Error fetching purchase orders:', err);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [business?.id, firestore]);

  // Open dialog pre-filled if supplierId parameter present
  React.useEffect(() => {
    if (initialSupplierId && suppliers.length > 0) {
      setSelectedSupplierId(initialSupplierId);
      setIsDialogOpen(true);
    }
  }, [initialSupplierId, suppliers]);

  const handleAddItemToPo = () => {
    if (!selectedProductId) return;
    const prod = products?.find(p => p.id === selectedProductId);
    if (!prod) return;

    const qty = parseInt(itemQty, 10) || 1;
    const cost = parseFloat(itemCost) || prod.costPrice || prod.price || 0;

    setPoItems(prev => {
      const existingIdx = prev.findIndex(item => item.productId === selectedProductId);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx].quantity += qty;
        updated[existingIdx].unitCost = cost;
        return updated;
      }
      return [...prev, {
        productId: prod.id,
        productName: prod.name,
        quantity: qty,
        unitCost: cost
      }];
    });

    setSelectedProductId('');
    setItemQty('10');
    setItemCost('');
  };

  const handleRemoveItem = (index: number) => {
    setPoItems(prev => prev.filter((_, i) => i !== index));
  };

  const totalPoCost = poItems.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);

  const handleCreateOrder = async (status: 'draft' | 'ordered') => {
    if (!selectedSupplierId) {
      toast({ variant: 'destructive', title: 'Supplier Required', description: 'Please select a supplier.' });
      return;
    }
    if (poItems.length === 0) {
      toast({ variant: 'destructive', title: 'No Items Added', description: 'Please add at least one product to the PO.' });
      return;
    }
    if (!business?.id || !firestore) return;

    setIsSaving(true);
    const supplierObj = suppliers.find(s => s.id === selectedSupplierId);

    try {
      const poNumber = `PO-${Math.floor(100000 + Math.random() * 900000)}`;
      const ordersRef = collection(firestore, 'businessInstances', business.id, 'purchaseOrders');

      await addDoc(ordersRef, {
        businessId: business.id,
        purchaseNumber: poNumber,
        supplierId: selectedSupplierId,
        supplierName: supplierObj?.name || 'Unknown Supplier',
        items: poItems.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantityOrdered: item.quantity,
          quantityReceived: status === 'ordered' ? 0 : 0,
          unitCost: item.unitCost,
          totalCost: item.quantity * item.unitCost
        })),
        totalAmount: totalPoCost,
        status: status,
        paymentStatus: 'unpaid',
        notes: poNotes.trim() || null,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      toast({ title: 'Purchase Order Created', description: `Order ${poNumber} raised for ${supplierObj?.name}` });
      setIsDialogOpen(false);
      setPoItems([]);
      setPoNotes('');
    } catch (err) {
      console.error('Error creating purchase order:', err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to create purchase order.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkAsReceived = async (order: SupplierPurchase) => {
    if (!confirm(`Confirm receipt of purchase order "${order.purchaseNumber}"? This will automatically update product stock level.`)) return;
    if (!business?.id || !firestore || !products) return;

    try {
      // 1. Restock products in queue / batch update
      order.items.forEach(item => {
        if (item.productId) {
          const currentProd = products.find(p => p.id === item.productId);
          if (currentProd) {
            const newStock = (currentProd.stock || 0) + (item.quantityOrdered || 0);
            addToQueue({
              type: 'update-product',
              payload: {
                productId: item.productId,
                values: {
                  stock: newStock,
                  costPrice: item.unitCost || currentProd.costPrice || 0
                }
              }
            }, `PO Restocked ${currentProd.name} (+${item.quantityOrdered})`);
          }
        }
      });

      // 2. Update PO status in Firestore
      const orderRef = doc(firestore, 'businessInstances', business.id, 'purchaseOrders', order.id);
      await updateDoc(orderRef, {
        status: 'received',
        deliveryDate: new Date(),
        updatedAt: new Date()
      });

      toast({
        title: 'Stock Restocked! 🎉',
        description: `Order ${order.purchaseNumber} received and stock levels updated successfully.`
      });
    } catch (err) {
      console.error('Error receiving order:', err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update order status.' });
    }
  };

  const filteredOrders = orders.filter(o => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return o.purchaseNumber?.toLowerCase().includes(term) || o.supplierName?.toLowerCase().includes(term);
  });

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" asChild className="h-9 w-9">
            <Link href="/inventory/suppliers">
              <ChevronLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <PackageCheck className="h-6 w-6 text-primary" /> Purchase Orders
            </h1>
            <p className="text-xs text-muted-foreground">Order inventory from vendors and auto-restock when received</p>
          </div>
        </div>

        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Purchase Order
        </Button>
      </div>

      {/* Filter Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search PO # or supplier name..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          {['all', 'draft', 'ordered', 'received'].map(st => (
            <Button
              key={st}
              variant={statusFilter === st ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(st)}
              className="capitalize text-xs"
            >
              {st}
            </Button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredOrders.length > 0 ? (
        <div className="space-y-4">
          {filteredOrders.map(order => (
            <Card key={order.id} className="hover:border-primary/50 transition-all">
              <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-base">{order.purchaseNumber}</span>
                    <Badge variant={order.status === 'received' ? 'default' : order.status === 'ordered' ? 'secondary' : 'outline'}>
                      {order.status === 'received' && <CheckCircle2 className="h-3 w-3 mr-1 text-green-500 inline" />}
                      {order.status === 'ordered' && <Clock className="h-3 w-3 mr-1 text-amber-500 inline" />}
                      {order.status.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">
                    Supplier: <span className="text-foreground">{order.supplierName}</span> · {order.items?.length || 0} line item(s)
                  </p>
                  {order.notes && (
                    <p className="text-xs text-muted-foreground italic">"{order.notes}"</p>
                  )}
                </div>

                <div className="flex items-center justify-between md:justify-end gap-6 pt-3 md:pt-0 border-t md:border-0">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Total Cost</p>
                    <p className="text-lg font-bold text-emerald-600">
                      {currencySymbol}{(order.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  {order.status !== 'received' && (
                    <Button onClick={() => handleMarkAsReceived(order)} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
                      <CheckCircle2 className="h-4 w-4 mr-1.5" /> Receive & Restock
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center p-12">
          <CardContent className="space-y-3 pt-6">
            <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <h3 className="text-lg font-semibold">No Purchase Orders</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Raise purchase orders to manage incoming inventory from vendors.
            </p>
            <Button onClick={() => setIsDialogOpen(true)} className="mt-2">
              <Plus className="h-4 w-4 mr-2" /> Raise New PO
            </Button>
          </CardContent>
        </Card>
      )}

      {/* New Purchase Order Modal */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Raise New Purchase Order</DialogTitle>
            <DialogDescription>
              Select a supplier and add products to order.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Supplier Select */}
            <div className="grid gap-1.5">
              <Label>Select Supplier *</Label>
              <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a supplier..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name} ({s.paymentTerms || 'Net 30'})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Product Selector Row */}
            <div className="p-3 bg-muted/40 rounded-lg space-y-3 border">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Add Products to Order</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Select value={selectedProductId} onValueChange={(val) => {
                  setSelectedProductId(val);
                  const prod = products?.find(p => p.id === val);
                  if (prod && (prod.costPrice || prod.price)) {
                    setItemCost((prod.costPrice || prod.price).toString());
                  }
                }}>
                  <SelectTrigger className="sm:col-span-3">
                    <SelectValue placeholder="Search product to add..." />
                  </SelectTrigger>
                  <SelectContent>
                    {products?.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name} (Stock: {p.stock || 0})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="grid gap-1">
                  <span className="text-[11px] text-muted-foreground">Quantity</span>
                  <Input type="number" placeholder="Qty" value={itemQty} onChange={(e) => setItemQty(e.target.value)} />
                </div>

                <div className="grid gap-1">
                  <span className="text-[11px] text-muted-foreground">Unit Cost ({currencySymbol})</span>
                  <Input type="number" step="0.01" placeholder="Cost" value={itemCost} onChange={(e) => setItemCost(e.target.value)} />
                </div>

                <div className="flex items-end">
                  <Button type="button" onClick={handleAddItemToPo} disabled={!selectedProductId} className="w-full">
                    <Plus className="h-4 w-4 mr-1" /> Add Line
                  </Button>
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            {poItems.length > 0 ? (
              <div className="border rounded-md divide-y divide-border overflow-hidden">
                <div className="p-2 bg-muted/60 text-xs font-semibold grid grid-cols-12">
                  <span className="col-span-5">Product</span>
                  <span className="col-span-2 text-center">Qty</span>
                  <span className="col-span-2 text-right">Cost</span>
                  <span className="col-span-2 text-right">Total</span>
                  <span className="col-span-1 text-center"></span>
                </div>
                {poItems.map((item, idx) => (
                  <div key={idx} className="p-2 text-xs grid grid-cols-12 items-center">
                    <span className="col-span-5 font-medium truncate">{item.productName}</span>
                    <span className="col-span-2 text-center">{item.quantity}</span>
                    <span className="col-span-2 text-right">{currencySymbol}{item.unitCost}</span>
                    <span className="col-span-2 text-right font-semibold">{currencySymbol}{(item.quantity * item.unitCost).toLocaleString()}</span>
                    <span className="col-span-1 text-center">
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleRemoveItem(idx)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </span>
                  </div>
                ))}
                <div className="p-3 bg-muted/30 flex justify-between items-center text-sm font-bold">
                  <span>PO Total:</span>
                  <span className="text-emerald-600 text-base">{currencySymbol}{totalPoCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic text-center py-4">No products added to this purchase order yet.</p>
            )}

            {/* Notes */}
            <div className="grid gap-1.5">
              <Label htmlFor="poNotes">Order Notes / Delivery Instructions</Label>
              <Textarea
                id="poNotes"
                placeholder="e.g. Please deliver to Warehouse B before Friday."
                value={poNotes}
                onChange={(e) => setPoNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => handleCreateOrder('draft')} disabled={isSaving || poItems.length === 0}>
                Save Draft
              </Button>
              <Button onClick={() => handleCreateOrder('ordered')} disabled={isSaving || poItems.length === 0}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Raise Order
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
