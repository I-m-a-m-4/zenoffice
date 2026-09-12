import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { usePOS } from '@/context/pos-context';
import type { Product } from '@/types';
import { useI18n } from '@/context/i18n-context';

export function QuickRestockModal({ 
    product, 
    onClose 
}: { 
    product: Product | null; 
    onClose: () => void;
}) {
    const { t } = useI18n();
    const { toast } = useToast();
    const { addToQueue } = usePOS();
    const [quantityToAdd, setQuantityToAdd] = React.useState('');
    const [backdate, setBackdate] = React.useState('');
    const [isSaving, setIsSaving] = React.useState(false);

    const currentStock = product?.stock || 0;
    const addedAmount = parseInt(quantityToAdd) || 0;
    const newTotal = currentStock + addedAmount;

    const handleSave = () => {
        if (!product) return;
        if (isNaN(addedAmount) || addedAmount === 0) {
            onClose();
            return;
        }

        setIsSaving(true);
        const customDate = backdate ? new Date(backdate) : new Date();
        const dateDesc = backdate ? ` (Backdated to ${customDate.toLocaleDateString()})` : '';

        addToQueue({
            type: 'update-product',
            payload: { 
                productId: product.id, 
                values: { 
                    stock: newTotal,
                    updatedAt: customDate
                } 
            }
        }, `Restocked ${product.name} (Added ${addedAmount})${dateDesc}`);

        addToQueue({
            type: 'add-audit-log',
            payload: {
                action: 'product.stock_adjustment',
                entityType: 'Product',
                entityId: product.id,
                entityName: product.name,
                details: {
                    adjustment: addedAmount,
                    oldStock: currentStock,
                    newStock: newTotal,
                    reason: `Restocked ${addedAmount} units${dateDesc}`
                },
                createdAt: customDate
            }
        }, `Logged stock adjustment for ${product.name}`);
        
        toast({
            title: 'Stock Updated',
            description: `Successfully added ${addedAmount} to ${product.name}. New total: ${newTotal}${dateDesc}`,
        });
        
        setIsSaving(false);
        onClose();
    };

    return (
        <Dialog open={!!product} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[420px]">
                <DialogHeader>
                    <DialogTitle>Quick Restock: {product?.name}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-5 py-3">
                    <div className="flex items-center justify-between px-4 py-3 bg-muted rounded-lg">
                        <div className="text-center">
                            <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Current Stock</p>
                            <p className="text-2xl font-bold">{currentStock}</p>
                        </div>
                        <div className="text-2xl font-light text-muted-foreground">+</div>
                        <div className="text-center">
                            <p className="text-xs text-primary mb-1 uppercase tracking-wider font-semibold">Adding</p>
                            <p className="text-2xl font-bold text-primary">{addedAmount}</p>
                        </div>
                        <div className="text-2xl font-light text-muted-foreground">=</div>
                        <div className="text-center">
                            <p className="text-xs text-green-600 mb-1 uppercase tracking-wider font-semibold">New Total</p>
                            <p className="text-2xl font-bold text-green-600">{newTotal}</p>
                        </div>
                    </div>
                    
                    <div className="grid gap-2">
                        <Label htmlFor="restockQty">Quantity to Add</Label>
                        <Input
                            id="restockQty"
                            type="number"
                            placeholder="e.g. 10"
                            value={quantityToAdd}
                            onChange={(e) => setQuantityToAdd(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSave();
                            }}
                            autoFocus
                        />
                        <p className="text-xs text-muted-foreground">Type a negative number to subtract stock.</p>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="backdate" className="flex items-center justify-between text-xs font-medium">
                            <span>Entry Date (Backdate)</span>
                            <span className="text-muted-foreground font-normal">Optional</span>
                        </Label>
                        <Input
                            id="backdate"
                            type="datetime-local"
                            value={backdate}
                            onChange={(e) => setBackdate(e.target.value)}
                        />
                        <p className="text-[11px] text-muted-foreground">Pick a past date to record stock brought in on previous days.</p>
                    </div>

                    {product?.lowStockThreshold !== undefined && newTotal <= (product.lowStockThreshold ?? 5) && (
                        <div className="flex items-center gap-2 p-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 rounded-md text-xs font-medium">
                            <span className="shrink-0 font-bold">⚠️</span>
                            <span>Stock will still be at or below reorder point ({product.lowStockThreshold ?? 5} units).</span>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} disabled={isSaving || !quantityToAdd}>Save Stock</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
