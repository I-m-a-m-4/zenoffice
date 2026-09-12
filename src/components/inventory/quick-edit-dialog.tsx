
'use client';

import * as React from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { logAuditEvent } from '@/lib/audit';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import type { Product, UserProfile } from '@/types';
import { usePOS } from '@/context/pos-context';
import { useI18n } from '@/context/i18n-context';
import { getIndustryConfig } from '@/lib/industry';

interface QuickEditDialogProps {
  product: Product | null;
  userProfile: UserProfile;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const makeQuickEditSchema = (t: (key: string) => string) => z.object({
  price: z.coerce.number().min(0, t('inventory.valPricePositive')),
  costPrice: z.coerce.number().min(0, t('inventory.valCostPositive')).optional(),
  material: z.string().optional(),
  variantValue: z.string().optional(),
  baseUnit: z.string().optional(),
  dosage: z.string().optional(),
  manufacturer: z.string().optional(),
  weightVolume: z.string().optional(),
  brand: z.string().optional(),
  packaging: z.string().optional(),
  spiceLevel: z.string().optional(),
});

type QuickEditFormValues = z.infer<ReturnType<typeof makeQuickEditSchema>>;

export default function QuickEditDialog({ product, userProfile, isOpen, onOpenChange }: QuickEditDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { triggerRefresh, addToQueue, business } = usePOS();
  const { t } = useI18n();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isSubmittingRef = React.useRef(false);
  const industryConfig = getIndustryConfig(business?.settings?.industry);

  const quickEditSchema = React.useMemo(() => makeQuickEditSchema(t), [t]);

  const canManageProduct = userProfile?.role === 'admin' || userProfile?.role === 'manager';

  const form = useForm<QuickEditFormValues>({
    resolver: zodResolver(quickEditSchema),
    defaultValues: {
      price: 0,
      costPrice: 0,
      material: '',
      variantValue: '',
      baseUnit: '',
      dosage: '',
      manufacturer: '',
      weightVolume: '',
      brand: '',
      packaging: '',
      spiceLevel: '',
    },
  });

  // This useEffect will reset the form whenever a new product is selected
  React.useEffect(() => {
    if (product) {
      form.reset({
        price: product.price || 0,
        costPrice: product.costPrice || 0,
        material: (product as any).material || '',
        variantValue: product.variantValue || '',
        baseUnit: product.baseUnit || '',
        dosage: (product as any).dosage || '',
        manufacturer: (product as any).manufacturer || '',
        weightVolume: (product as any).weightVolume || '',
        brand: (product as any).brand || '',
        packaging: (product as any).packaging || '',
        spiceLevel: (product as any).spiceLevel || '',
      });
    }
  }, [product, form]);


  const handleUpdate = async (values: QuickEditFormValues) => {
    if (!product || isSubmitting || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      const dataToUpdate: any = {};

      if (canManageProduct) {
        dataToUpdate.price = values.price;
        dataToUpdate.costPrice = values.costPrice;
        dataToUpdate.material = values.material;
        dataToUpdate.variantValue = values.variantValue;
        dataToUpdate.baseUnit = values.baseUnit;
        dataToUpdate.dosage = values.dosage;
        dataToUpdate.manufacturer = values.manufacturer;
        dataToUpdate.weightVolume = values.weightVolume;
        dataToUpdate.brand = values.brand;
        dataToUpdate.packaging = values.packaging;
        dataToUpdate.spiceLevel = values.spiceLevel;

        /*
         * Price and cost changes, recorded as a before/after pair.
         *
         * This is the evidence behind the price-swap check in
         * src/lib/forensics.ts: drop a price, sell the item cheap, put the price
         * back. Both edits leave the catalogue looking untouched, so the only
         * trace is the pair of logs — and without the `from` value there is no
         * way to tell a cut from a rise. Cost changes matter for the opposite
         * reason: cost is the denominator of every margin figure in the app, so
         * raising it is how a suspiciously thin margin is made to look ordinary.
         *
         * Queued rather than written directly so it survives an offline edit,
         * matching the stock adjustment above.
         */
        const priceMoved = values.price !== product.price;
        const costMoved = values.costPrice !== (product.costPrice ?? 0);
        if (priceMoved || costMoved) {
          const changes: Record<string, { from: any; to: any }> = {};
          if (priceMoved) changes.price = { from: product.price ?? 0, to: values.price };
          if (costMoved) changes.costPrice = { from: product.costPrice ?? 0, to: values.costPrice };

          addToQueue({
            type: 'add-audit-log',
            payload: {
              businessId: business?.id || '',
              userId: userProfile.id,
              userName: userProfile.name,
              userEmail: userProfile.email,
              userRole: userProfile.role,
              action: 'product.update',
              entityType: 'Product',
              entityId: product.id,
              details: {
                entityName: product.name,
                changes,
                reason: 'Manual Quick Edit',
              }
            }
          }, `Logging price change for ${product.name}`);
        }
      }

      addToQueue({
        type: 'update-product',
        payload: {
          productId: product.id,
          values: dataToUpdate
        }
      }, `Quick edit for ${product.name}`);

      toast({
        variant: 'success',
        title: t('inventory.changesSavedTitle'),
        description: navigator.onLine
          ? t('inventory.changesQueuedOnline', { name: product.name })
          : t('inventory.changesSavedOffline', { name: product.name }),
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('inventory.updateFailedTitle'),
        description: t('inventory.queueFailedBody'),
      });
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('inventory.quickEditTitle', { name: product?.name ?? '' })}</DialogTitle>
          <DialogDescription>
            {product?.categoryType === 'service'
              ? t('inventory.quickEditServiceHint')
              : t('inventory.quickEditProductHint')}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleUpdate)} className="space-y-4">
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('common.price')}</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} disabled={!canManageProduct} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="costPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('inventory.costPrice')}</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} disabled={!canManageProduct} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <FormField
                    control={form.control}
                    name="baseUnit"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>{t('inventory.measurementUnit')}</FormLabel>
                        <FormControl>
                            <Input placeholder={industryConfig.defaultUnit} {...field} disabled={!canManageProduct} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                {industryConfig.productFields.map((fieldDef) => (
                    <FormField
                        key={fieldDef.key}
                        control={form.control}
                        name={fieldDef.key as any}
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>{fieldDef.label}</FormLabel>
                            <FormControl>
                                <Input placeholder={fieldDef.placeholder} {...field} disabled={!canManageProduct} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                ))}
            </div>
            <DialogFooter className='mt-6'>
              <Button variant="outline" size="lg" type="button" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
              <Button type="submit" size="lg" disabled={isSubmitting || !canManageProduct}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t('common.saveChanges')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
