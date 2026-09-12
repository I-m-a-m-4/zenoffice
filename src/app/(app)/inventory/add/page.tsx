'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  ChevronLeft,
  Upload,
  CalendarIcon,
  QrCode,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash, Trash2, CheckCircle2 } from "lucide-react";
import { useFieldArray } from "react-hook-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import Image from "next/image";
import { useFirestore } from '@/firebase';
import { addDoc, collection, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { usePOS } from '@/context/pos-context';
import { effectivePlan, productLimit, isCoreFeatureBlocked } from '@/lib/plan';
import { logAuditEvent } from '@/lib/audit';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { BarcodeScanner } from '@/components/inventory/barcode-scanner';
import { useI18n } from '@/context/i18n-context';
import { getIndustryConfig } from '@/lib/industry';

import { Combobox } from '@/components/ui/combobox';
import { UpgradeOverlay } from '@/components/shared/upgrade-overlay';
/**
 * Built per render rather than at module scope because every message here is
 * user-visible and has to come from the active catalogue. `t` is memoised on
 * `[messages]` (`i18n-context.tsx`), so the caller's `useMemo` rebuilds the
 * schema only when the locale actually changes.
 */
const makeProductSchema = (t: (key: string) => string) => z.object({
  name: z.string().min(3, t('inventory.valNameMin')),
  description: z.string().optional(),
  price: z.coerce.number().min(0.01, t('inventory.valPriceRequired')),
  costPrice: z.coerce.number().optional(),
  stock: z.coerce.number().int(t('inventory.valStockWhole')).optional(),
  sku: z.string().optional(),
  category: z.string().optional(),
  expiryDate: z.date().optional(),
  categoryType: z.enum(['product', 'service']).default('product'),

  // Advanced Features & Electronics Tracking
  type: z.enum(['single', 'variant', 'composite']).default('single'),
  baseUnit: z.string().optional(),
  isSerializable: z.boolean().optional(),
  serialNumbersInput: z.string().optional(),
  uomConversions: z.array(z.object({
    unitName: z.string().min(1, t('inventory.valUnitNameRequired')),
    multiplier: z.coerce.number().min(1, t('inventory.valMultiplierMin')),
    price: z.coerce.number().optional()
  })).optional(),
  components: z.array(z.object({
    productId: z.string().min(1, t('inventory.valProductRequired')),
    quantity: z.coerce.number().min(1, t('inventory.valQuantityRequired'))
  })).optional(),
});

type ProductFormValues = z.infer<ReturnType<typeof makeProductSchema>>;


export default function AddProductPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useI18n();
  const productSchema = React.useMemo(() => makeProductSchema(t), [t]);
  const { business, products, currentUserProfile, isLoading, addToQueue, addProductWithImage } = usePOS();
  const industryConfig = React.useMemo(() => getIndustryConfig(business?.settings?.industry), [business?.settings?.industry]);
  const firestore = useFirestore();
  const [isSaving, setIsSaving] = React.useState(false);
  const isSubmitting = React.useRef(false);
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [imagePreview, setImagePreview] = React.useState<string | null>(null);

  const [expiryDateInput, setExpiryDateInput] = React.useState("");
  const [entryDateInput, setEntryDateInput] = React.useState("");
  const [isScannerOpen, setIsScannerOpen] = React.useState(false);
  const [isTauri, setIsTauri] = React.useState(false);
  const [showUpgradeOverlay, setShowUpgradeOverlay] = React.useState(false);

  // Variant Builder State
  const [variantAttributes, setVariantAttributes] = React.useState<{ name: string; values: string }[]>([{ name: 'Size', values: 'S, M, L' }]);
  const [variantMatrix, setVariantMatrix] = React.useState<{ combo: string; sku: string; price: number; stock: number; costPrice?: number; imageUrl?: string }[]>([]);

  React.useEffect(() => {
    setIsTauri(typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__);
  }, []);

    const userProfile = currentUserProfile;

  React.useEffect(() => {
    if (userProfile) {
      const hasPermission = userProfile.permissions?.manage_inventory ?? (userProfile.role === 'admin' || userProfile.role === 'manager');
      if (!hasPermission) {
        toast({ variant: 'destructive', title: t('inventory.permissionDeniedTitle'), description: t('inventory.permissionAddProducts') });
        router.push('/inventory');
      }
    }
  }, [userProfile, router, toast, t]);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      description: "",
      price: undefined,
      costPrice: undefined,
      stock: undefined,
      sku: "",
      category: "",
      expiryDate: undefined,
      categoryType: "product",
      type: "single",
      baseUnit: "Piece",
      uomConversions: [],
      components: [],
    },
  });

  // Update variant matrix when attributes or base price changes
  React.useEffect(() => {
    const basePrice = form.getValues('price') || 0;
    const baseCost = form.getValues('costPrice') || undefined;
    const baseStock = form.getValues('stock') || 0;
    const baseSku = form.getValues('sku') || '';
    
    // Simple matrix generation based on comma separated values
    const validAttrs = variantAttributes.filter(a => a.name.trim() && a.values.trim());
    
    if (validAttrs.length === 0) {
      setVariantMatrix([]);
      return;
    }

    // Generate cartesian product of values
    const generateCombos = (attrs: { name: string; values: string }[]) => {
      let combos: string[][] = [[]];
      for (const attr of attrs) {
        const vals = attr.values.split(',').map(v => v.trim()).filter(Boolean);
        const nextCombos: string[][] = [];
        for (const val of vals) {
          for (const combo of combos) {
            nextCombos.push([...combo, val]);
          }
        }
        combos = nextCombos;
      }
      return combos.map(c => c.join(' / '));
    };

    const newCombos = generateCombos(validAttrs);
    
    setVariantMatrix(prev => {
      return newCombos.map(combo => {
        const existing = prev.find(p => p.combo === combo);
        return existing || {
          combo,
          sku: baseSku ? `${baseSku}-${combo.replace(/[^a-zA-Z0-9]/g, '')}` : '',
          price: basePrice,
          costPrice: baseCost,
          stock: baseStock,
          imageUrl: undefined
        };
      });
    });
  }, [variantAttributes, form.watch('price'), form.watch('costPrice'), form.watch('stock'), form.watch('sku')]);

  const { fields: uomFields, append: appendUom, remove: removeUom } = useFieldArray({
    control: form.control,
    name: "uomConversions"
  });

  const { fields: componentFields, append: appendComponent, remove: removeComponent } = useFieldArray({
    control: form.control,
    name: "components"
  });

  const productType = form.watch("type");
  const categoryType = form.watch("categoryType");

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleNativeImageUpload = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const { readFile } = await import('@tauri-apps/plugin-fs');
      
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Image',
          extensions: ['png', 'jpg', 'jpeg', 'webp']
        }]
      });

      if (selected && !Array.isArray(selected)) {
        const fileData = await readFile(selected);
        const fileName = selected.split(/[\\/]/).pop() || 'product.png';
        const ext = fileName.split('.').pop()?.toLowerCase();
        const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
        
        const blob = new Blob([fileData], { type: mimeType });
        const file = new File([blob], fileName, { type: mimeType });
        processImageFile(file);
      }
    } catch (err) {
      console.error('Native upload failed:', err);
    }
  };

  const processImageFile = (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      toast({
        variant: 'destructive',
        title: t('inventory.imageTooLargeTitle'),
        description: t('inventory.imageTooLargeBody'),
      });
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const [isNewCategoryModalOpen, setIsNewCategoryModalOpen] = React.useState(false);
  const [newCategoryName, setNewCategoryName] = React.useState("");
  const [isAddingCategory, setIsAddingCategory] = React.useState(false);

  const handleAddCategory = async () => {
    if (!newCategoryName.trim() || !business || !firestore) return;
    setIsAddingCategory(true);
    try {
      const updatedCategories = [...(business.settings?.productCategories || []), newCategoryName.trim()];
      await updateDoc(doc(firestore, 'businessInstances', business.id), {
        'settings.productCategories': updatedCategories
      });
      form.setValue('category', newCategoryName.trim());
      setNewCategoryName("");
      toast({ title: t('inventory.categoryCreatedTitle'), description: t('inventory.categoryCreatedBody', { name: newCategoryName.trim() }), variant: 'success' });
    } catch (err) {
      toast({ title: t('common.error'), description: t('inventory.categoryCreateFailed'), variant: 'destructive' });
    } finally {
      setIsAddingCategory(false);
    }
  };

  const handleDeleteCategory = async (catToDelete: string) => {
    if (!business || !firestore) return;
    try {
      const updatedCategories = (business.settings?.productCategories || []).filter(c => c !== catToDelete);
      await updateDoc(doc(firestore, 'businessInstances', business.id), {
        'settings.productCategories': updatedCategories
      });
      if (form.getValues('category') === catToDelete) {
        form.setValue('category', '');
      }
      toast({ title: t('inventory.categoryDeletedTitle'), description: t('inventory.categoryDeletedBody', { name: catToDelete }), variant: 'success' });
    } catch (err) {
      toast({ title: t('common.error'), description: t('inventory.categoryDeleteFailed'), variant: 'destructive' });
    }
  };

  const handleBarcodeScanned = (barcode: string) => {
    form.setValue('sku', barcode);
    setIsScannerOpen(false);
  };

  // Helper to parse date string DD/MM/YY or DD/MM/YYYY
  const parseDateString = (dateStr: string): Date | undefined => {
    if (!dateStr) return undefined;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return undefined;

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Months are 0-indexed
    let year = parseInt(parts[2], 10);

    // Handle 2 digit year
    if (year < 100) {
      year += 2000;
    }

    const date = new Date(year, month, day);
    if (isNaN(date.getTime())) return undefined;
    return date;
  };

  const onSubmit = async (values: ProductFormValues) => {
    if (isSaving || isSubmitting.current) return;
    isSubmitting.current = true;
    setIsSaving(true);

    if (!userProfile || !firestore || !business || !products) {
      toast({ variant: 'destructive', title: t('common.error'), description: t('inventory.sessionMissing') });
      isSubmitting.current = false;
      setIsSaving(false);
      return;
    }

    const hasInventoryPermission = userProfile.permissions?.manage_inventory ?? (userProfile.role === 'admin' || userProfile.role === 'manager');
    if (!hasInventoryPermission) {
      toast({ variant: 'destructive', title: t('inventory.permissionDeniedTitle'), description: t('inventory.permissionAddProducts') });
      isSubmitting.current = false;
      setIsSaving(false);
      router.push('/inventory');
      return;
    }

    if (isCoreFeatureBlocked(business)) {
      setShowUpgradeOverlay(true);
      isSubmitting.current = false;
      setIsSaving(false);
      return;
    }

    const currentPlan = effectivePlan(business);
    const limit = productLimit(business);

    if (limit !== Infinity && products.length >= limit) {
      toast({
        variant: 'destructive',
        title: t('inventory.productLimitTitle'),
        description: t('inventory.productLimitBody', { limit, plan: currentPlan }),
      });
      isSubmitting.current = false;
      setIsSaving(false);
      return;
    }

    // Optimistic Add via Context (handles background upload)
    try {
      // Parse expiry date manually if provided
      if (expiryDateInput) {
        const parsedDate = parseDateString(expiryDateInput);
        if (parsedDate) {
          values.expiryDate = parsedDate;
        } else {
          toast({ variant: "destructive", title: t('inventory.invalidDateTitle'), description: t('inventory.invalidDateBody') });
          isSubmitting.current = false;
          setIsSaving(false);
          return;
        }
      }

      // Parse backdate entry date if provided
      let customCreatedAt: Date | undefined;
      if (entryDateInput) {
        const parsedEntry = new Date(entryDateInput);
        if (!isNaN(parsedEntry.getTime())) {
          customCreatedAt = parsedEntry;
        }
      }

      // 1. Prepare data
      const newProductId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();

      const industryConfig = getIndustryConfig(business?.settings?.industry);
      const rawSerials = values.serialNumbersInput
        ? values.serialNumbersInput.split(/[\n,]+/).map(s => s.trim()).filter(Boolean)
        : [];
      
      const { serialNumbersInput: _, ...pureValues } = values;

      const dataToSave = {
        ...pureValues,
        id: newProductId,
        businessId: userProfile.businessId,
        isSerializable: rawSerials.length > 0 || !!values.isSerializable || !!industryConfig.hasSerialNumbers,
        serialNumbers: rawSerials,
        ...(customCreatedAt ? { createdAt: customCreatedAt } : {}),
      };

      // Remove undefined values
      const cleanData = Object.fromEntries(Object.entries(dataToSave).filter(([_, v]) => v !== undefined));

      if (values.type === 'variant') {
        // Parent Product
        const parentData = {
          ...cleanData,
          stock: 0,
        };
        addProductWithImage(parentData, imageFile);

        // Child Variants
        variantMatrix.forEach(variant => {
          const childId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString() + Math.random();
          const childData = {
            ...cleanData,
            id: childId,
            type: 'single', // child is effectively a single item
            parentId: newProductId,
            variantName: 'Variant',
            variantValue: variant.combo,
            sku: variant.sku,
            price: variant.price,
            costPrice: variant.costPrice,
            stock: variant.stock,
            name: `${cleanData.name} - ${variant.combo}`,
            ...(variant.imageUrl ? { imageUrl: variant.imageUrl } : {})
          };
          addToQueue({
            type: 'add-product',
            payload: { ...childData, createdAt: Date.now(), updatedAt: Date.now() }
          }, t('inventory.queueAddedVariant', { name: childData.name }));
        });
      } else {
        // 2. Call context function (Fast/Sync initial queueing)
        addProductWithImage({
          ...cleanData,
          stock: cleanData.stock ?? 0,
        }, imageFile);
      }

      // 3. Log Audit Event (Non-blocking)
      logAuditEvent(firestore, business.id, userProfile, {
        action: 'product.create',
        entity: { type: 'Product', id: newProductId, name: values.name },
        details: { price: values.price, stock: values.stock || 0, sku: values.sku }
      }).catch(err => console.warn("Audit log background failed:", err));

      // 4. Navigate immediately
      toast({ title: t('inventory.productSavedTitle'), description: t('inventory.productSavedBody', { name: values.name }) });
      
      // We intentionally do NOT reset `isSubmitting` and `isSaving` to false here.
      // Resetting them would allow double-clicks to trigger another submission 
      // while the Next.js router is still transitioning to the new page.

      router.push('/inventory');

    } catch (error: any) {
      console.error("Failed to prepare product:", error);
      toast({ variant: 'destructive', title: t('inventory.saveFailedTitle'), description: error.message || t('inventory.saveFailedBody') });
      isSubmitting.current = false;
      setIsSaving(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid flex-1 auto-rows-max gap-4 w-full max-w-full px-1.5 sm:px-0 overflow-x-hidden">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <Button variant="outline" size="icon" className="h-7 w-7" asChild>
            <Link href="/inventory">
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">{t('common.back')}</span>
            </Link>
          </Button>
          <h1 className="flex-1 min-w-0 text-xl font-semibold tracking-tight break-words leading-normal md:leading-relaxed">
            {categoryType === 'service' ? t('inventory.addNewService') : t('inventory.addNewProduct')}
          </h1>
          <div className="hidden items-center gap-2 md:ml-auto md:flex">
            <Button variant="outline" size="default" type="button" onClick={() => router.push('/inventory')}>
              {t('common.discard')}
            </Button>
            <Button size="default" type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {categoryType === 'service' ? t('inventory.saveService') : t('inventory.saveProduct')}
            </Button>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-[1fr_250px] lg:grid-cols-3 lg:gap-8">
          <div className="grid auto-rows-max items-start gap-4 lg:col-span-2 lg:gap-8">
            <Card>
              <CardHeader>
                <CardTitle>{categoryType === 'service' ? t('inventory.serviceDetails') : t('inventory.productDetails')}</CardTitle>
                <CardDescription>
                  {categoryType === 'service' ? t('inventory.serviceDetailsHint') : t('inventory.productDetailsHint')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('common.name')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('inventory.namePlaceholder')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('common.description')}</FormLabel>
                        <FormControl>
                          <Textarea placeholder={t('inventory.descriptionPlaceholder')} className="min-h-32" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {categoryType === 'product' && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('inventory.inventoryConfig')}</CardTitle>
                  <CardDescription>{t('inventory.inventoryConfigHint')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>{t('inventory.productType')}</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex flex-col sm:flex-row gap-4"
                          >
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="single" />
                              </FormControl>
                              <FormLabel className="font-normal">{t('inventory.standardItem')}</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="variant" />
                              </FormControl>
                              <FormLabel className="font-normal flex items-center gap-1.5">
                                {t('inventory.variant')}
                                <TooltipProvider>
                                  <Tooltip delayDuration={300}>
                                    <TooltipTrigger asChild>
                                      <Info className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-[250px]">
                                      <p>{t('inventory.variantTooltip')}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormDescription>
                          {productType === 'variant' ? t('inventory.variantTypeHint') : t('inventory.singleTypeHint')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Separator />

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <FormLabel className="flex items-center gap-1.5">
                        {t('inventory.uomTitle')}
                        <TooltipProvider>
                          <Tooltip delayDuration={300}>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[250px]">
                              <p>{t('inventory.uomTooltip')}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </FormLabel>
                      <Button type="button" variant="outline" size="sm" onClick={() => appendUom({ unitName: "", multiplier: 1 })}>
                        <Plus className="h-4 w-4 mr-2" /> {t('inventory.addUom')}
                      </Button>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="baseUnit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">{t('inventory.baseUnit')}</FormLabel>
                            <FormControl>
                              <Input placeholder={t('inventory.baseUnitPlaceholder')} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {uomFields.map((field, index) => (
                      <div key={field.id} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end p-3 border rounded-lg bg-muted/30">
                        <FormField
                          control={form.control}
                          name={`uomConversions.${index}.unitName`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">{t('inventory.unitName')}</FormLabel>
                              <FormControl><Input placeholder={t('inventory.unitNamePlaceholder')} {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`uomConversions.${index}.multiplier`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">{t('inventory.uomMultiplier')}</FormLabel>
                              <FormControl><Input type="number" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex gap-2">
                          <FormField
                            control={form.control}
                            name={`uomConversions.${index}.price`}
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel className="text-xs">{t('inventory.priceOptional')}</FormLabel>
                                <FormControl><Input type="number" placeholder={t('inventory.priceOverride')} {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeUom(index)} className="text-destructive"><Trash className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>

                    {productType === 'variant' && (
                      <>
                        <Separator />
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <FormLabel>{t('inventory.variantAttributes')}</FormLabel>
                            <Button type="button" variant="outline" size="sm" onClick={() => setVariantAttributes([...variantAttributes, { name: '', values: '' }])}>
                              <Plus className="h-4 w-4 mr-2" /> {t('inventory.addAttribute')}
                            </Button>
                          </div>
                          <FormDescription>{t('inventory.variantAttributesHint')}</FormDescription>

                          {variantAttributes.map((attr, index) => (
                            <div key={index} className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end p-3 border rounded-lg bg-muted/30">
                              <div className="sm:col-span-2">
                                <Label className="text-xs">{t('inventory.attributeName')}</Label>
                                <Input
                                  placeholder={t('inventory.attributeNamePlaceholder')}
                                  value={attr.name}
                                  onChange={(e) => {
                                    const newAttrs = [...variantAttributes];
                                    newAttrs[index].name = e.target.value;
                                    setVariantAttributes(newAttrs);
                                  }}
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <Label className="text-xs">{t('inventory.attributeValues')}</Label>
                                <Input
                                  placeholder={t('inventory.attributeValuesPlaceholder')}
                                  value={attr.values}
                                  onChange={(e) => {
                                    const newAttrs = [...variantAttributes];
                                    newAttrs[index].values = e.target.value;
                                    setVariantAttributes(newAttrs);
                                  }}
                                />
                              </div>
                              <Button type="button" variant="ghost" size="icon" onClick={() => setVariantAttributes(variantAttributes.filter((_, i) => i !== index))} className="text-destructive"><Trash className="h-4 w-4" /></Button>
                            </div>
                          ))}

                          {variantMatrix.length > 0 && (
                            <div className="mt-4">
                              <Label className="mb-2 block font-semibold text-base">{t('inventory.variantMatrixTitle')}</Label>
                              <div className="border rounded-xl overflow-hidden shadow-sm bg-card">
                                <table className="w-full text-sm text-left">
                                  <thead className="bg-muted/80 text-muted-foreground uppercase text-[10px] tracking-wider">
                                    <tr>
                                      <th className="px-3 py-3 w-20">{t('inventory.colPhoto')}</th>
                                      <th className="px-3 py-3">{t('inventory.colVariantOption')}</th>
                                      <th className="px-3 py-3 w-28">{t('inventory.sku')}</th>
                                      <th className="px-3 py-3 w-24">{t('common.price')}</th>
                                      <th className="px-3 py-3 w-24">{t('inventory.colCost')}</th>
                                      <th className="px-3 py-3 w-20">{t('inventory.stock')}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {variantMatrix.map((v, i) => (
                                      <tr key={i} className="border-t hover:bg-muted/30 transition-colors">
                                        <td className="px-3 py-3">
                                          <div className="relative group">
                                            {v.imageUrl ? (
                                              <div className="relative h-12 w-12 rounded-lg overflow-hidden border border-border">
                                                <img src={v.imageUrl} alt={v.combo} className="h-full w-full object-cover" />
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const newM = [...variantMatrix];
                                                    newM[i].imageUrl = undefined;
                                                    setVariantMatrix(newM);
                                                  }}
                                                  className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold"
                                                >
                                                  {t('common.remove')}
                                                </button>
                                              </div>
                                            ) : (
                                              <label className="h-12 w-12 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary flex flex-col items-center justify-center cursor-pointer bg-muted/20 hover:bg-primary/5 transition-all text-muted-foreground hover:text-primary">
                                                <Upload className="h-4 w-4" />
                                                <span className="text-[9px] font-medium mt-0.5">{t('common.upload')}</span>
                                                <input
                                                  type="file"
                                                  accept="image/*"
                                                  className="hidden"
                                                  onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                      const reader = new FileReader();
                                                      reader.onloadend = () => {
                                                        const newM = [...variantMatrix];
                                                        newM[i].imageUrl = reader.result as string;
                                                        setVariantMatrix(newM);
                                                      };
                                                      reader.readAsDataURL(file);
                                                    }
                                                  }}
                                                />
                                              </label>
                                            )}
                                          </div>
                                        </td>
                                        <td className="px-3 py-3 font-semibold text-foreground">{v.combo}</td>
                                        <td className="px-3 py-3">
                                          <Input className="h-9" value={v.sku} onChange={(e) => {
                                            const newM = [...variantMatrix]; newM[i].sku = e.target.value; setVariantMatrix(newM);
                                          }} />
                                        </td>
                                        <td className="px-3 py-3">
                                          <Input className="h-9" type="number" value={v.price} onChange={(e) => {
                                            const newM = [...variantMatrix]; newM[i].price = parseFloat(e.target.value) || 0; setVariantMatrix(newM);
                                          }} />
                                        </td>
                                        <td className="px-3 py-3">
                                          <Input className="h-9" type="number" value={v.costPrice || ''} onChange={(e) => {
                                            const newM = [...variantMatrix]; newM[i].costPrice = parseFloat(e.target.value) || 0; setVariantMatrix(newM);
                                          }} />
                                        </td>
                                        <td className="px-3 py-3">
                                          <Input className="h-9" type="number" value={v.stock} onChange={(e) => {
                                            const newM = [...variantMatrix]; newM[i].stock = parseInt(e.target.value) || 0; setVariantMatrix(newM);
                                          }} />
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader>
                <CardTitle>{categoryType === 'product' ? t('inventory.pricingAndStockTitle') : t('inventory.pricingTitle')}</CardTitle>
                <CardDescription>
                  {categoryType === 'service' ? t('inventory.pricingServiceHint') : t('inventory.pricingProductHint')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-4">
                  {categoryType === 'product' && (
                    <FormField
                      control={form.control}
                      name="sku"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('inventory.barcodeSku')}</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input placeholder={t('inventory.skuPlaceholder')} {...field} />
                            </FormControl>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => setIsScannerOpen(true)}
                              className="shrink-0"
                            >
                              <QrCode className="h-4 w-4" />
                            </Button>
                          </div>
                          <FormDescription>
                            {t('inventory.barcodeHint')} <Link href="/support#how-barcodes-work" className="text-primary underline">{t('common.learnMore')}</Link>.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  {categoryType === 'product' && (
                    <FormField
                      control={form.control}
                      name="expiryDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col pt-2">
                          <FormLabel>{t('inventory.expiryDate')}</FormLabel>
                          <FormControl>
                            <Input
                                type="date"
                                value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    field.onChange(val ? new Date(val) : undefined);
                                }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  {categoryType === 'product' && (
                    <FormField
                      control={form.control}
                      name="stock"
                      render={({ field }) => {
                        const currentStock = 0; // It's a new product, so current stock is always 0
                        const newTotal = typeof field.value === 'number' ? field.value : parseInt(field.value || '0', 10);
                        const addedAmount = newTotal;

                        return (
                          <FormItem className="sm:col-span-2 md:col-span-4">
                            <FormLabel>{t('inventory.stock')}</FormLabel>
                            
                            {/* Visual Math UI similar to Quick Restock */}
                            {typeof field.value !== 'undefined' && field.value !== '' && (
                                <div className="flex items-center justify-between px-4 py-3 bg-muted rounded-lg mb-4">
                                    <div className="text-center">
                                        <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Current</p>
                                        <p className="text-xl font-bold">0</p>
                                    </div>
                                    <div className="text-xl font-light text-muted-foreground">+</div>
                                    <div className="text-center">
                                        <p className="text-xs text-primary mb-1 uppercase tracking-wider font-semibold">Adding</p>
                                        <p className="text-xl font-bold text-primary">{addedAmount > 0 ? `+${addedAmount}` : addedAmount}</p>
                                    </div>
                                    <div className="text-xl font-light text-muted-foreground">=</div>
                                    <div className="text-center">
                                        <p className="text-xs text-green-600 mb-1 uppercase tracking-wider font-semibold">New Total</p>
                                        <p className="text-xl font-bold text-green-600">{newTotal}</p>
                                    </div>
                                </div>
                            )}

                            <FormControl>
                              <Input 
                                  type="number" 
                                  placeholder="25" 
                                  {...field} 
                                  value={field.value ?? ''} 
                                  onChange={(e) => {
                                      // Update the total stock
                                      const val = e.target.value;
                                      field.onChange(val === '' ? undefined : parseInt(val, 10));
                                  }}
                              />
                            </FormControl>
                            <FormDescription className="text-xs">
                                Enter initial stock quantity.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )
                      }}
                    />
                  )}
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('common.price')}</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="349.99" {...field} value={field.value ?? ''} />
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
                        <FormLabel className="flex items-center gap-1.5">
                          {t('inventory.costPrice')}
                          <TooltipProvider>
                            <Tooltip delayDuration={300}>
                              <TooltipTrigger asChild>
                                <Info className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[250px]">
                                <p>{t('inventory.costPriceTooltip')}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="250.00" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                  {categoryType === 'product' && (
                    <div className="space-y-2">
                      <FormLabel>{t('inventory.expiryDate')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('inventory.expiryPlaceholder')}
                          value={expiryDateInput}
                          onChange={(e) => setExpiryDateInput(e.target.value)}
                          maxLength={10}
                        />
                      </FormControl>
                      <p className="text-[0.8rem] text-muted-foreground">{t('inventory.expiryFormatHint')}</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <FormLabel className="flex items-center justify-between text-xs font-semibold">
                      <span>Entry Date (Backdate)</span>
                      <span className="text-[11px] text-muted-foreground font-normal">Optional</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        value={entryDateInput}
                        onChange={(e) => setEntryDateInput(e.target.value)}
                      />
                    </FormControl>
                    <p className="text-[0.8rem] text-muted-foreground">Pick a past date if recording items brought in on previous days.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {categoryType === 'product' && (industryConfig.hasSerialNumbers || form.watch('isSerializable')) && (
              <Card className="border-blue-500/20 bg-blue-50/5 dark:bg-blue-950/10">
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      📱 Electronics IMEI & Serial Numbers
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {industryConfig.label}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Track unique serial numbers or IMEIs for electronics, appliances, and high-value devices.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="serialNumbersInput"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">IMEI / Serial Numbers (One per line or comma-separated)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="e.g. 354890123456789&#10;354890123456790"
                            className="min-h-24 text-xs font-mono"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className="text-[11px] text-muted-foreground">
                          Cashiers will scan or select the exact IMEI at POS checkout, which is printed directly on the receipt.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            )}

            {categoryType === 'product' && (
              <Card>
                <CardHeader>
                  <CardTitle>Product Type & Variants</CardTitle>
                  <CardDescription>Does this item come in multiple sizes, colors, or options?</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="grid grid-cols-2 gap-4"
                      >
                        <Label
                          htmlFor="type-single"
                          className={cn(
                            "flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer",
                            field.value === 'single' && "border-primary bg-primary/5"
                          )}
                        >
                          <RadioGroupItem value="single" id="type-single" className="sr-only" />
                          <span className="font-semibold text-sm">Single Product</span>
                          <span className="text-xs text-muted-foreground text-center mt-1">Standard standalone inventory item</span>
                        </Label>

                        <Label
                          htmlFor="type-variant"
                          className={cn(
                            "flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer",
                            field.value === 'variant' && "border-primary bg-primary/5"
                          )}
                        >
                          <RadioGroupItem value="variant" id="type-variant" className="sr-only" />
                          <span className="font-semibold text-sm">Has Variants</span>
                          <span className="text-xs text-muted-foreground text-center mt-1">Options like Size, Color, Flavor</span>
                        </Label>
                      </RadioGroup>
                    )}
                  />

                  {form.watch('type') === 'variant' && (
                    <div className="space-y-4 pt-4 border-t">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold">Variant Options</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setVariantAttributes(prev => [...prev, { name: '', values: '' }])}
                        >
                          <Plus className="h-4 w-4 mr-1" /> Add Option
                        </Button>
                      </div>

                      {variantAttributes.map((attr, idx) => (
                        <div key={idx} className="flex gap-2 items-start">
                          <Input
                            placeholder="Option Name (e.g. Size)"
                            value={attr.name}
                            onChange={(e) => {
                              const updated = [...variantAttributes];
                              updated[idx].name = e.target.value;
                              setVariantAttributes(updated);
                            }}
                            className="w-1/3"
                          />
                          <Input
                            placeholder="Values separated by commas (e.g. S, M, L, XL)"
                            value={attr.values}
                            onChange={(e) => {
                              const updated = [...variantAttributes];
                              updated[idx].values = e.target.value;
                              setVariantAttributes(updated);
                            }}
                            className="flex-1"
                          />
                          {variantAttributes.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setVariantAttributes(prev => prev.filter((_, i) => i !== idx))}
                              className="text-destructive"
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}

                      {variantMatrix.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Generated Variants ({variantMatrix.length})
                          </Label>
                          <div className="border rounded-md divide-y divide-border overflow-hidden">
                            {variantMatrix.map((item, index) => (
                              <div key={index} className="p-3 bg-muted/30 grid grid-cols-1 md:grid-cols-4 gap-2 items-center text-xs">
                                <span className="font-semibold text-sm">{item.combo}</span>
                                <div className="flex flex-col">
                                  <span className="text-muted-foreground">SKU</span>
                                  <Input
                                    size={1}
                                    className="h-7 text-xs"
                                    value={item.sku}
                                    onChange={(e) => {
                                      const updated = [...variantMatrix];
                                      updated[index].sku = e.target.value;
                                      setVariantMatrix(updated);
                                    }}
                                  />
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-muted-foreground">Price</span>
                                  <Input
                                    type="number"
                                    className="h-7 text-xs"
                                    value={item.price}
                                    onChange={(e) => {
                                      const updated = [...variantMatrix];
                                      updated[index].price = parseFloat(e.target.value) || 0;
                                      setVariantMatrix(updated);
                                    }}
                                  />
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-muted-foreground">Stock</span>
                                  <Input
                                    type="number"
                                    className="h-7 text-xs"
                                    value={item.stock}
                                    onChange={(e) => {
                                      const updated = [...variantMatrix];
                                      updated[index].stock = parseInt(e.target.value) || 0;
                                      setVariantMatrix(updated);
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
          <div className="grid auto-rows-max items-start gap-4 lg:gap-8">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{categoryType === 'service' ? t('inventory.serviceCategory') : t('inventory.productCategory')}</CardTitle>
                  {typeof window !== 'undefined' && isNewCategoryModalOpen && createPortal(
                    <div 
                      className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px] transition-opacity animate-in fade-in-0" 
                      onClick={() => setIsNewCategoryModalOpen(false)} 
                    />,
                    document.body
                  )}
                  <Dialog open={isNewCategoryModalOpen} onOpenChange={setIsNewCategoryModalOpen} modal={false}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" type="button" className="h-7 text-xs">
                        <Plus className="h-3 w-3 mr-1" /> {t('inventory.manageCategories')}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[480px]">
                      <DialogHeader>
                        <DialogTitle>{t('inventory.manageCategories')}</DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                          {t('inventory.manageCategoriesHint')}
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-3 py-2 border-b pb-4">
                        <Label className="text-xs font-semibold">{t('inventory.addNewCategory')}</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder={t('inventory.newCategoryPlaceholder')}
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddCategory();
                              }
                            }}
                          />
                          <Button type="button" onClick={handleAddCategory} disabled={!newCategoryName.trim() || isAddingCategory} className="shrink-0">
                            {isAddingCategory ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                            {t('common.add')}
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-3 pt-2">
                        <Label className="text-xs font-semibold">{t('inventory.existingCategories')}</Label>
                        <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                          {business?.settings?.productCategories && business.settings.productCategories.length > 0 ? (
                            business.settings.productCategories.map((cat: string) => (
                              <div key={cat} className="flex items-center justify-between p-2 rounded-md bg-muted/50 border text-sm">
                                <span className="font-medium">{cat}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => handleDeleteCategory(cat)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">{t('inventory.deleteCategoryAria', { name: cat })}</span>
                                </Button>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground italic py-2">{t('inventory.noCategoriesYet')}</p>
                          )}
                        </div>
                      </div>

                      <DialogFooter className="pt-2">
                        <Button type="button" variant="outline" onClick={() => setIsNewCategoryModalOpen(false)}>{t('common.done')}</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="mt-4 space-y-4 px-2">
                  <FormField
                    control={form.control}
                    name="categoryType"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs">{t('common.type')}</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex gap-4"
                          >
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="product" />
                              </FormControl>
                              <FormLabel className="font-normal text-xs">{t('inventory.typeProduct')}</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="service" />
                              </FormControl>
                              <FormLabel className="font-normal text-xs">{t('inventory.typeService')}</FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="outline" className="w-full justify-between font-normal h-10 px-3 bg-background border-input">
                            {field.value || t('inventory.selectCategory')}
                            <ChevronDown className="h-4 w-4 opacity-50" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]">
                          {business?.settings?.productCategories && business.settings.productCategories.length > 0 ? (
                            business.settings.productCategories.map((cat: string) => (
                              <DropdownMenuItem key={cat} onClick={() => field.onChange(cat)}>{cat}</DropdownMenuItem>
                            ))
                          ) : (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                              {t('inventory.noCategoriesDefined')}
                              <Button variant="link" asChild className="p-0 h-auto ml-1">
                                <Link href="/settings">{t('inventory.createOneNow')}</Link>
                              </Button>
                            </div>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>{categoryType === 'service' ? t('inventory.serviceImage') : t('inventory.productImage')}</CardTitle>
                <CardDescription>
                  {categoryType === 'service' ? t('inventory.serviceImageHint') : t('inventory.productImageHint')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  <div
                    className="w-full aspect-square rounded-md border-2 border-dashed border-muted-foreground/50 flex items-center justify-center relative overflow-hidden group hover:border-primary/50 transition-colors"
                    onClick={() => isTauri && handleNativeImageUpload()}
                  >
                    {imagePreview ? (
                      <Image src={imagePreview} alt={t('inventory.productPreviewAlt')} fill style={{ objectFit: "cover" }} />
                    ) : (
                      <div className="text-center text-muted-foreground">
                        <Upload className="mx-auto h-8 w-8" />
                        <p className="mt-2 text-sm">{t('inventory.clickToUpload')}</p>
                      </div>
                    )}
                    {!isTauri && (
                      <Input
                        id="file-upload"
                        type="file"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        accept="image/png, image/jpeg, image/gif"
                        onChange={handleImageChange}
                      />
                    )}
                    {isTauri && (
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
                        <span className="text-white text-xs font-bold">{t('inventory.pickImage')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 w-full px-4 md:hidden">
          <Button variant="outline" size="default" type="button" onClick={() => router.push('/inventory')}>
            {t('common.discard')}
          </Button>
          <Button size="default" type="submit" disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {categoryType === 'service' ? t('inventory.saveService') : t('inventory.saveProduct')}
          </Button>
        </div>
      </form>
      <BarcodeScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={(code) => {
          form.setValue('sku', code);
          setIsScannerOpen(false);
          toast({
            title: t('inventory.barcodeScannedTitle'),
            description: t('inventory.barcodeScannedBody', { code }),
          });
        }}
      />
      <UpgradeOverlay open={showUpgradeOverlay} onOpenChange={setShowUpgradeOverlay} />
    </Form>
  );
}
