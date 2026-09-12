

'use client';

import * as React from 'react';
import PageTitle from '@/components/shared/page-title';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Loader2, Copy, Eye, Palette, Upload, Search, Package, Check, Twitter, Instagram, Facebook, Phone, Trash2, RefreshCcw, Banknote, CreditCard, ChevronRight, ChevronLeft, SlidersHorizontal, Share2, MapPin, Clock, Mail, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { usePOS } from '@/context/pos-context';
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc, collection, query, where, getDocs, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import Image from 'next/image';
import FeatureGate from '@/components/shared/feature-gate';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import StoreFooter from '@/components/store/footer';
import { AppConfig } from '@/lib/config';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { apiBase } from '@/lib/platform';

const colorPresets = [
    { name: 'Orange (Default)', value: '22 90% 55%' },
    { name: 'Blue', value: '221 83% 53%' },
    { name: 'Green', value: '142 76% 36%' },
    { name: 'Purple', value: '262 83% 58%' },
    { name: 'Red', value: '0 84% 60%' },
];

function StoreLinkPreview({
    title,
    description,
    imageUrl,
    url,
}: {
    title: string;
    description: string;
    imageUrl?: string | null;
    url: string;
}) {
    const displayUrl = url.replace(/^https?:\/\//, '').replace(/\/$/, '');

    return (
        <div className="mt-4 w-full max-w-sm rounded-lg border bg-slate-50 shadow-sm overflow-hidden">
            {imageUrl && (
                <div className="aspect-video bg-muted relative">
                    <Image src={imageUrl} alt="Link preview image" fill className="object-cover" />
                </div>
            )}
            <div className="p-3 bg-slate-100/50">
                <p className="font-semibold text-sm truncate text-slate-800">{title}</p>
                <p className="text-xs text-slate-600 line-clamp-2">{description}</p>
                <p className="text-xs text-slate-500/80 truncate mt-1">{displayUrl}</p>
            </div>
        </div>
    );
}

function StorefrontPreview({ settings, bannerPreview, business }: { settings: any, bannerPreview: string | null, business: any }) {
    const { products } = usePOS();
    const storeStyle = {
        '--primary': settings.primaryColor || colorPresets[0].value,
    } as React.CSSProperties;

    const gridClass = {
        3: 'lg:grid-cols-3',
        4: 'lg:grid-cols-4',
        5: 'lg:grid-cols-5',
    }[settings.desktopColumns || 4];

    const previewProducts = React.useMemo(() => {
        if (!products) return [];
        let prods = [...products];

        if (settings.hideOutOfStock) {
            prods = prods.filter(p => p.stock && p.stock > 0);
        }

        prods.sort((a, b) => a.name.localeCompare(b.name));

        // Limit the number of products shown in the preview without duplicating them
        const desiredCount = (settings.desktopColumns || 4) * 5;
        return prods.slice(0, desiredCount);

    }, [products, settings.hideOutOfStock, settings.desktopColumns]);

    const hasProducts = previewProducts.length > 0;

    return (
        <div style={storeStyle} className="w-full bg-background border rounded-lg overflow-hidden flex flex-col">
            <header className="h-[20rem] bg-muted flex items-center justify-center relative">
                {(bannerPreview || settings.bannerImageUrl) ? (
                    <Image src={bannerPreview || settings.bannerImageUrl} alt="Banner Preview" fill className="object-cover" />
                ) : (
                    <div className="text-muted-foreground">Banner Image</div>
                )}
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center p-4">
                    <h1 className="text-3xl font-bold text-white text-center">{settings.headline || "Your Store Headline"}</h1>
                </div>
            </header>
            <div className="p-4 bg-background/80 backdrop-blur-sm rounded-lg -mt-16 mx-4 relative z-10 shadow-lg border">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                            placeholder="Search products..."
                            className="pl-10 h-12 text-base"
                            disabled
                        />
                    </div>
                    <Select defaultValue="all" disabled>
                        <SelectTrigger className="h-12 text-base w-full sm:w-48">
                            <SelectValue placeholder="All Categories" />
                        </SelectTrigger>
                    </Select>
                </div>
                <div className="flex items-center justify-between mt-4 flex-wrap gap-4 border-t pt-4">
                    <div className="flex items-center space-x-2">
                        {/* This switch is intentionally left in the preview but removed from the live site */}
                    </div>
                    <Select defaultValue="default" disabled>
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <SlidersHorizontal className="h-4 w-4 mr-2" />
                            <SelectValue placeholder="Sort by..." />
                        </SelectTrigger>
                    </Select>
                </div>
            </div>
            <main className={cn("flex-1 p-4 pt-8", !hasProducts && "min-h-[400px]")}>
                <h2 className="text-2xl font-bold mb-4">Our Products</h2>
                {hasProducts ? (
                    <div className={cn("grid grid-cols-2 md:grid-cols-3 gap-4", gridClass)}>
                        {previewProducts.map((p, i) => (
                            <div key={`${p.id}-${i}`} className="border rounded-md overflow-hidden">
                                <div className="w-full h-24 bg-muted relative">
                                    {p.imageUrl && <Image src={p.imageUrl.includes(',') ? p.imageUrl.split(',')[0].trim() : p.imageUrl} alt={p.name} fill className="object-cover" />}
                                </div>
                                <div className="p-2">
                                    <p className="text-xs font-medium truncate">{p.name}</p>
                                    <div className="flex justify-between items-center mt-1">
                                        <p className="text-xs text-primary font-semibold">₦{p.price}</p>
                                        <Button size="sm" className="h-6 px-2 text-xs">Buy</Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">No products to display.</div>
                )}

            </main>







            <StoreFooter business={{ ...business, settings: { ...business?.settings, publicStore: settings } }} />
        </div>
    )
}

function StorefrontCustomizationPage() {
    const { business, triggerConfetti } = usePOS();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [storeSettings, setStoreSettings] = React.useState({
        enabled: false,
        headline: '',
        slug: '',
        description: '',
        bannerImageUrl: '',
        desktopColumns: 4,
        footerText: '',
        socialTwitter: '',
        socialInstagram: '',
        socialFacebook: '',
        socialWhatsapp: '',
        hideOutOfStock: false,
        officeLocations: '',
        contactPhone: '',
        contactEmail: '',
        businessHours: '',
        googleMapsLink: '',
    });

    const [color, setColor] = React.useState({ h: 22, s: 90, l: 55 });
    const [isSaving, setIsSaving] = React.useState(false);
    const [imageFile, setImageFile] = React.useState<File | null>(null);
    const [imagePreview, setImagePreview] = React.useState<string | null>(null);
    const [isCopied, setIsCopied] = React.useState(false);
    const [hasSavedOnce, setHasSavedOnce] = React.useState(false);

    // Bank Details Modal State
    const [banks, setBanks] = React.useState<{ name: string; code: string; active: boolean }[]>([]);
    const [isBankModalOpen, setIsBankModalOpen] = React.useState(false);
    const [bankDetails, setBankDetails] = React.useState({
        bankName: '',
        bankCode: '',
        accountNumber: '',
        accountName: ''
    });
    const [isResolving, setIsResolving] = React.useState(false);
    const [resolveError, setResolveError] = React.useState('');
    const [isSavingBankDetails, setIsSavingBankDetails] = React.useState(false);

    React.useEffect(() => {
        const fetchBanks = async () => {
            try {
                const res = await fetch(`${apiBase()}/api/paystack/banks`);
                if (res.ok) {
                    const data = await res.json();
                    setBanks(data.sort((a: any, b: any) => a.name.localeCompare(b.name)));
                }
            } catch (error) {
                console.error("Failed to fetch banks", error);
            }
        };
        fetchBanks();
    }, []);

    React.useEffect(() => {
        const resolveAccount = async () => {
            if (bankDetails.bankCode && bankDetails.accountNumber.length === 10) {
                setIsResolving(true);
                setResolveError('');
                setBankDetails(prev => ({ ...prev, accountName: '' })); // Clear previous name
                try {
                    const res = await fetch(`${apiBase()}/api/paystack/resolve-account`, {
                        method: 'POST',
                        body: JSON.stringify({ account_number: bankDetails.accountNumber, bank_code: bankDetails.bankCode })
                    });
                    const data = await res.json();
                    if (data.status) {
                        setBankDetails(prev => ({ ...prev, accountName: data.data.account_name }));
                    } else {
                        setResolveError('Could not verify account. Please check details.');
                    }
                } catch (error) {
                    setResolveError('Error verifying account.');
                } finally {
                    setIsResolving(false);
                }
            }
        };

        const timer = setTimeout(resolveAccount, 500); // Debounce
        return () => clearTimeout(timer);
    }, [bankDetails.bankCode, bankDetails.accountNumber]);

    React.useEffect(() => {
        if (business?.settings) {
            setStoreSettings(prev => ({ ...prev, ...(business.settings?.publicStore || {}) }));

            if (business.settings.primaryColor) {
                const parts = business.settings.primaryColor.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
                if (parts) {
                    setColor({ h: parseInt(parts[1], 10), s: parseInt(parts[2], 10), l: parseInt(parts[3], 10) });
                }
            }
        }
    }, [business]);

    const handleSettingsChange = (field: keyof typeof storeSettings, value: any) => {
        if (field === 'slug') {
            value = value.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/\s+/g, '-');
        }
        setStoreSettings(prev => ({ ...prev, [field]: value }));
    };

    const handleToggleStore = async (checked: boolean) => {
        if (!business?.id || !firestore) return;

        if (checked) { // Only check when enabling
            const hasBankDetails = business?.settings?.paymentBankName && business?.settings?.paymentBankAccountId;
            const hasPaystack = business?.settings?.paystackSubaccount;

            if (!hasBankDetails && !hasPaystack) {
                // Show modal instead of error toast
                setIsBankModalOpen(true);
                return; // Prevent toggle until details are saved
            }
        }

        // Update local state immediately for responsiveness
        setStoreSettings(prev => ({ ...prev, enabled: checked }));

        try {
            const businessDocRef = doc(firestore, 'businessInstances', business.id);
            await updateDoc(businessDocRef, {
                'settings.publicStore.enabled': checked
            });
            toast({
                variant: 'success',
                title: `Store ${checked ? 'Enabled' : 'Disabled'}`,
                description: `Your public store is now ${checked ? 'live' : 'offline'}.`,
            });
            if (checked && !hasSavedOnce) {
                triggerConfetti();
                setHasSavedOnce(true);
            }
        } catch (e: any) {
            // Revert UI on failure
            setStoreSettings(prev => ({ ...prev, enabled: !checked }));
            toast({
                variant: 'destructive',
                title: 'Update Failed',
                description: 'Could not update your store status.',
            });
        }
    };

    const handleSaveBankDetails = async () => {
        if (!business?.id || !firestore) return;

        if (!bankDetails.bankCode || !bankDetails.accountNumber || !bankDetails.accountName) {
            toast({
                variant: 'destructive',
                title: 'Missing Information',
                description: 'Please ensure account details are verified.',
            });
            return;
        }

        setIsSavingBankDetails(true);

        try {
            const businessDocRef = doc(firestore, 'businessInstances', business.id);

            // 1. Create Paystack Subaccount
            let subaccountCode = business?.settings?.paystackSubaccount;

            if (!subaccountCode) {
                const subRes = await fetch(`${apiBase()}/api/paystack/create-subaccount`, {
                    method: 'POST',
                    body: JSON.stringify({
                        business_name: business.name,
                        bank_code: bankDetails.bankCode,
                        account_number: bankDetails.accountNumber
                    })
                });
                const subData = await subRes.json();
                if (subData.subaccount_code) {
                    subaccountCode = subData.subaccount_code;
                } else {
                    throw new Error("Could not create payment subaccount.");
                }
            }

            // 2. Save Bank Details & Enable Store
            await updateDoc(businessDocRef, {
                'settings.paymentBankName': bankDetails.bankName,
                'settings.paymentBankCode': bankDetails.bankCode,
                'settings.paymentBankAccountId': bankDetails.accountNumber,
                'settings.paymentAccountName': bankDetails.accountName,
                'settings.paystackSubaccount': subaccountCode,
                'settings.publicStore.enabled': true
            });

            // Update local state
            setStoreSettings(prev => ({ ...prev, enabled: true }));
            setIsBankModalOpen(false);
            triggerConfetti();
            setHasSavedOnce(true);

            toast({
                variant: 'success',
                title: 'Store Enabled!',
                description: 'Bank details saved and store is now live.',
            });

        } catch (error: any) {
            console.error("Error saving bank details:", error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Could not save details. Please try again.',
            });
        } finally {
            setIsSavingBankDetails(false);
        }
    };

    const handleColorChange = (part: 'h' | 's' | 'l', value: number[]) => {
        setColor(prev => ({ ...prev, [part]: value[0] }));
    };

    const setPresetColor = (presetValue: string) => {
        const parts = presetValue.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
        if (parts) {
            setColor({ h: parseInt(parts[1], 10), s: parseInt(parts[2], 10), l: parseInt(parts[3], 10) });
        }
    };

    const handleResetColor = () => {
        const defaultColor = { h: 22, s: 90, l: 55 };
        setColor(defaultColor);
        toast({ title: 'Color Reset', description: 'Primary color has been reset to the default orange.' });
    }

    const primaryColor = `${color.h} ${color.s}% ${color.l}%`;

    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.size > MAX_FILE_SIZE) {
                toast({
                    variant: 'destructive',
                    title: 'Image Too Large',
                    description: 'Please select an image smaller than 5MB.',
                });
                event.target.value = '';
                return;
            }
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleDeleteImage = () => {
        setImageFile(null);
        setImagePreview(null);
        handleSettingsChange('bannerImageUrl', '');
    }

    const storePath = storeSettings.slug || business?.id;

    const publicStoreUrl = React.useMemo(() => {
        if (typeof window === 'undefined') return '';
        const origin = window.location.origin;
        const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
        
        // If running in Tauri desktop app, always show the production URL
        if (isTauri) {
            return `https://${storePath}.zeneva.space`;
        }

        // Check if local web development (localhost) and not Tauri localhost
        if (origin.includes('localhost') && !origin.includes('tauri')) {
            return `${origin}/store/${storePath}`;
        }
        // Production: Use subdomain
        return `https://${storePath}.zeneva.space`;
    }, [storePath]);

    const handleCopyLink = () => {
        navigator.clipboard.writeText(publicStoreUrl).then(() => {
            toast({ title: 'Link Copied', description: 'Your public store link has been copied.', variant: 'success' });
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);

            // Track storefront click/copy in Firestore
            if (business?.id && firestore) {
                addDoc(collection(firestore, 'storefront_shares'), {
                    businessId: business.id,
                    businessName: business.name,
                    timestamp: serverTimestamp(),
                    type: 'copy',
                    url: publicStoreUrl
                }).catch(e => console.error("Failed to log storefront share:", e));
            }
        });
    };

    const handleShareLink = async () => {
        if (!business || !firestore) return;
        const shareData = {
            title: storeSettings.headline || business.name,
            text: storeSettings.description || `Check out ${business.name}'s store!`,
            url: publicStoreUrl,
        };

        // Track share button click in Firestore
        addDoc(collection(firestore, 'storefront_shares'), {
            businessId: business.id,
            businessName: business.name,
            timestamp: serverTimestamp(),
            type: 'share',
            url: publicStoreUrl
        }).catch(e => console.error("Failed to log storefront share:", e));

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                if ((err as DOMException).name !== 'AbortError') {
                    handleCopyLink();
                }
            }
        } else {
            handleCopyLink();
        }
    };

    const handleSave = async () => {
        if (!business?.id || !firestore) return;
        setIsSaving(true);

        let finalSettings = { ...storeSettings };

        try {
            if (storeSettings.slug && storeSettings.slug !== business.settings?.publicStore?.slug) {
                const q = query(collection(firestore, 'businessInstances'), where('settings.publicStore.slug', '==', storeSettings.slug), limit(1));
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    toast({ variant: 'destructive', title: 'Slug Already Taken', description: 'Please choose a unique slug for your store.' });
                    setIsSaving(false);
                    return;
                }
            }

            if (imageFile) {
                const formData = new FormData();
                formData.append('file', imageFile);
                try {
                    const response = await fetch(`/api/upload`, { method: 'POST', body: formData });
                    const result = await response.json();
                    if (!response.ok || !result.url) {
                        throw new Error(result.error || 'Image upload failed.');
                    }
                    finalSettings.bannerImageUrl = result.url;
                } catch (error: any) {
                    throw new Error(error.message || 'Image upload failed.');
                }
            }

            const businessDocRef = doc(firestore, 'businessInstances', business.id);
            await updateDoc(businessDocRef, {
                'settings.publicStore': finalSettings,
                'settings.primaryColor': primaryColor,
            });
            toast({ variant: 'success', title: 'Storefront Updated', description: 'Your public store settings have been saved.' });

        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: e.message || 'Could not update your settings.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-8">
            <PageTitle title="Storefront Customization" subtitle="Customize the look and feel of your public online store." />

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] xl:grid-cols-[450px_1fr] gap-8 items-start">
                <div className="lg:sticky lg:top-6 space-y-6">
                    <Accordion type="multiple" defaultValue={['general']} className="w-full space-y-4">
                        <AccordionItem value="general" className="border-none">
                            <Card>
                                <AccordionTrigger className="p-6 w-full text-left [&[data-state=open]>div]:pb-4">
                                    <div className="space-y-1.5">
                                        <CardTitle>General Settings</CardTitle>
                                        <CardDescription>Enable your store, set the URL, and write your headline.</CardDescription>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="p-6 pt-0">
                                    <div className="space-y-4">
                                        <div className="flex items-center space-x-2"><Switch id="enableStore" checked={storeSettings.enabled} onCheckedChange={handleToggleStore} /><Label htmlFor="enableStore" className="text-base">Enable Public Store</Label></div>
                                        {storeSettings.enabled && (
                                            <div className="space-y-4 pt-4 border-t">
                                                <div><Label htmlFor="storeSlug">Subdomain</Label><Input id="storeSlug" value={storeSettings.slug} onChange={e => handleSettingsChange('slug', e.target.value)} className="mt-1" placeholder="e.g., my-zeneva-shop" /></div>
                                                <div>
                                                    <Label htmlFor="storeLink">Your Store Link</Label>
                                                    <div className="flex gap-2 mt-1">
                                                        <Input id="storeLink" value={publicStoreUrl} readOnly />
                                                        <Button type="button" variant="secondary" size="icon" onClick={handleShareLink} aria-label="Share store link">
                                                            <Share2 className="h-4 w-4" />
                                                        </Button>
                                                        <Button type="button" variant="ghost" size="icon" onClick={handleCopyLink} aria-label="Copy store link">
                                                            {isCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                                        </Button>
                                                    </div>
                                                    <StoreLinkPreview
                                                        title={storeSettings.headline || business?.name || 'Your Store'}
                                                        description={storeSettings.description || 'Check out my awesome products!'}
                                                        imageUrl={business?.settings?.logoUrl || imagePreview || storeSettings.bannerImageUrl}
                                                        url={publicStoreUrl}
                                                    />
                                                </div>
                                                <div><Label htmlFor="storeHeadline">Store Headline</Label><Input id="storeHeadline" value={storeSettings.headline} onChange={e => handleSettingsChange('headline', e.target.value)} className="mt-1" placeholder={`Welcome to ${business?.name}`} /></div>
                                                <div><Label htmlFor="storeDescription">Store Description (for footer & link previews)</Label><Textarea id="storeDescription" value={storeSettings.description} onChange={e => handleSettingsChange('description', e.target.value)} className="mt-1" placeholder="A short description of your business." /></div>
                                                <div>
                                                    <Label>Banner Image</Label>
                                                    <div className="mt-1 flex items-start gap-2">
                                                        <div className="w-full aspect-video rounded-md border-2 border-dashed border-muted-foreground/50 flex items-center justify-center relative overflow-hidden">
                                                            {(imagePreview || storeSettings.bannerImageUrl) ? (
                                                                <Image src={imagePreview || storeSettings.bannerImageUrl!} alt="Banner preview" fill style={{ objectFit: "cover" }} />
                                                            ) : (
                                                                <div className="text-center text-muted-foreground">
                                                                    <Upload className="mx-auto h-8 w-8" />
                                                                    <p className="mt-2 text-sm">Click to upload</p>
                                                                </div>
                                                            )}
                                                            <Input
                                                                id="banner-upload"
                                                                type="file"
                                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                                accept="image/png, image/jpeg, image/gif"
                                                                onChange={handleImageChange}
                                                            />
                                                        </div>
                                                        {(imagePreview || storeSettings.bannerImageUrl) && (
                                                            <Button type="button" variant="destructive" size="icon" onClick={handleDeleteImage} className="flex-shrink-0"><Trash2 className="h-4 w-4" /></Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </AccordionContent>
                            </Card>
                        </AccordionItem>
                        <AccordionItem value="theme" className="border-none">
                            <Card>
                                <AccordionTrigger className="p-6 w-full text-left [&[data-state=open]>div]:pb-4">
                                    <div className="space-y-1.5">
                                        <CardTitle>Theme & Appearance</CardTitle>
                                        <CardDescription>Customize colors, layout, and more.</CardDescription>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="p-6 pt-0">
                                    <div className="space-y-4">
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <Label htmlFor="primaryColor" className="flex items-center gap-2"><Palette /> Primary Color</Label>
                                                <Button variant="ghost" size="sm" onClick={handleResetColor}><RefreshCcw className="h-3 w-3 mr-1" />Reset</Button>
                                            </div>
                                            <div className="space-y-3">
                                                <div><Label className="text-xs text-muted-foreground">Hue</Label><Slider value={[color.h]} onValueChange={(v) => handleColorChange('h', v)} max={360} step={1} /></div>
                                                <div><Label className="text-xs text-muted-foreground">Saturation</Label><Slider value={[color.s]} onValueChange={(v) => handleColorChange('s', v)} max={100} step={1} /></div>
                                                <div><Label className="text-xs text-muted-foreground">Lightness</Label><Slider value={[color.l]} onValueChange={(v) => handleColorChange('l', v)} max={100} step={1} /></div>
                                            </div>
                                            <div className="mt-4 p-2 border rounded-md" style={{ backgroundColor: `hsl(${primaryColor})` }}><p className="text-sm font-mono text-center" style={{ color: color.l > 50 ? 'black' : 'white' }}>{primaryColor}</p></div>
                                        </div>
                                        <div>
                                            <Label>Color Presets</Label>
                                            <div className="grid grid-cols-5 gap-2 mt-2">
                                                {colorPresets.map(preset => (
                                                    <button key={preset.name} onClick={() => setPresetColor(preset.value)} title={preset.name} className={cn("h-10 w-full rounded-md border-2 transition-all", primaryColor === preset.value ? 'border-ring' : 'border-transparent')}>
                                                        <div className="h-full w-full rounded" style={{ backgroundColor: `hsl(${preset.value})` }}></div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <Label htmlFor="desktopColumns">Product Columns (Desktop)</Label>
                                            <DropdownMenu modal={false}>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="outline" className="w-full justify-between font-normal bg-background mt-1">
                                                        <span>{storeSettings.desktopColumns || 4} Columns</span>
                                                        <ChevronDown className="h-4 w-4 opacity-50 ml-2" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent className="w-full min-w-[200px]">
                                                    <DropdownMenuItem onClick={() => handleSettingsChange('desktopColumns', 3)}>3 Columns</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleSettingsChange('desktopColumns', 4)}>4 Columns</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleSettingsChange('desktopColumns', 5)}>5 Columns</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Switch id="hideOutOfStock" checked={storeSettings.hideOutOfStock} onCheckedChange={(checked) => handleSettingsChange('hideOutOfStock', checked)} />
                                            <Label htmlFor="hideOutOfStock">Hide out-of-stock products by default</Label>
                                        </div>
                                        <div>
                                            <Label htmlFor="footerText">Footer Text</Label>
                                            <Textarea id="footerText" value={storeSettings.footerText} onChange={e => handleSettingsChange('footerText', e.target.value)} placeholder={`© ${new Date().getFullYear()} ${business?.name}. All rights reserved.`} />
                                        </div>
                                    </div>
                                </AccordionContent>
                            </Card>
                        </AccordionItem>
                        <AccordionItem value="contact" className="border-none">
                            <Card>
                                <AccordionTrigger className="p-6 w-full text-left [&[data-state=open]>div]:pb-4">
                                    <div className="space-y-1.5">
                                        <CardTitle>Location & Contact</CardTitle>
                                        <CardDescription>Add your physical locations and contact details.</CardDescription>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="p-6 pt-0">
                                    <div className="space-y-4">
                                        <div><Label htmlFor="officeLocations">Office Locations</Label><Textarea id="officeLocations" value={storeSettings.officeLocations} onChange={e => handleSettingsChange('officeLocations', e.target.value)} placeholder="e.g., Head Office: 123 Commerce St, Lagos&#10;Branch: 456 Trade Ave, Abuja" className="min-h-[100px]" /></div>
                                        <div><Label htmlFor="contactPhone">Contact Phone(s)</Label><Input id="contactPhone" value={storeSettings.contactPhone} onChange={e => handleSettingsChange('contactPhone', e.target.value)} placeholder="08012345678, 09012345678" /></div>
                                        <div><Label htmlFor="contactEmail">Contact Email</Label><Input id="contactEmail" type="email" value={storeSettings.contactEmail} onChange={e => handleSettingsChange('contactEmail', e.target.value)} placeholder="support@mystore.com" /></div>
                                        <div><Label htmlFor="businessHours">Business Hours</Label><Input id="businessHours" value={storeSettings.businessHours} onChange={e => handleSettingsChange('businessHours', e.target.value)} placeholder="9:00 AM – 6:00 PM (Monday – Saturday)" /></div>
                                        <div><Label htmlFor="googleMapsLink">Google Maps Link</Label><Input id="googleMapsLink" value={storeSettings.googleMapsLink} onChange={e => handleSettingsChange('googleMapsLink', e.target.value)} placeholder="https://maps.app.goo.gl/..." /></div>
                                    </div>
                                </AccordionContent>
                            </Card>
                        </AccordionItem>
                        <AccordionItem value="social" className="border-none">
                            <Card>
                                <AccordionTrigger className="p-6 w-full text-left [&[data-state=open]>div]:pb-4">
                                    <div className="space-y-1.5">
                                        <CardTitle>Social Links</CardTitle>
                                        <CardDescription>Add links to your social media profiles.</CardDescription>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="p-6 pt-0">
                                    <div className="space-y-4">
                                        <div><Label htmlFor="twitter">Twitter Username</Label><Input id="twitter" value={storeSettings.socialTwitter} onChange={e => handleSettingsChange('socialTwitter', e.target.value)} placeholder="yourhandle" /></div>
                                        <div><Label htmlFor="instagram">Instagram Username</Label><Input id="instagram" value={storeSettings.socialInstagram} onChange={e => handleSettingsChange('socialInstagram', e.target.value)} placeholder="yourhandle" /></div>
                                        <div><Label htmlFor="facebook">Facebook Profile/Page</Label><Input id="facebook" value={storeSettings.socialFacebook} onChange={e => handleSettingsChange('socialFacebook', e.target.value)} placeholder="yourprofile" /></div>
                                        <div><Label htmlFor="whatsapp">WhatsApp Number</Label><Input id="whatsapp" value={storeSettings.socialWhatsapp} onChange={e => handleSettingsChange('socialWhatsapp', e.target.value)} placeholder="2348012345678" /></div>
                                    </div>
                                </AccordionContent>
                            </Card>
                        </AccordionItem>
                    </Accordion>
                    <Button onClick={handleSave} disabled={isSaving} size="lg" className="w-full">
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </div>
                <div>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Eye /> Live Preview</CardTitle>
                            <CardDescription>This is how your store will look to customers.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <StorefrontPreview settings={{ ...storeSettings, primaryColor }} bannerPreview={imagePreview} business={business} />
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Dialog open={isBankModalOpen} onOpenChange={setIsBankModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Enable Online Payments</DialogTitle>
                        <DialogDescription>
                            To activate your public store, you need to provide bank details so customers can pay you via bank transfer.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="p-3 bg-blue-50 text-blue-800 rounded-md text-sm border border-blue-100 mb-4">
                            Provide bank details for "Bank Transfer" payments at checkout. This will also create a Paystack Subaccount for card payments.
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="bankName">Bank Name</Label>
                            <DropdownMenu modal={false}>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="w-full justify-between font-normal bg-background mt-1">
                                        <span>{bankDetails.bankName || "Select a bank"}</span>
                                        <ChevronDown className="h-4 w-4 opacity-50 ml-2" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-full max-h-60 overflow-y-auto">
                                    {banks.map(bank => (
                                        <DropdownMenuItem key={bank.code} onClick={() => setBankDetails(prev => ({ ...prev, bankCode: bank.code, bankName: bank.name }))}>
                                            {bank.name}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="accountNumber">Account Number</Label>
                            <Input
                                id="accountNumber"
                                placeholder="0123456789"
                                maxLength={10}
                                value={bankDetails.accountNumber}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, ''); // Only numbers
                                    setBankDetails(prev => ({ ...prev, accountNumber: val }))
                                }}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="accountName">Verified Account Name</Label>
                            <div className="relative">
                                <Input
                                    id="accountName"
                                    value={bankDetails.accountName}
                                    readOnly
                                    className={cn("bg-muted", resolveError && "border-destructive")}
                                    placeholder="Account name will appear here..."
                                />
                                {isResolving && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                    </div>
                                )}
                            </div>
                            {resolveError && <p className="text-xs text-destructive">{resolveError}</p>}
                            {bankDetails.accountName && <p className="text-xs text-green-600 flex items-center gap-1"><Check className="h-3 w-3" /> Verified</p>}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsBankModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveBankDetails} disabled={isSavingBankDetails}>
                            {isSavingBankDetails && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save & Enable Store
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}


export default function StorefrontPage() {
    return <StorefrontCustomizationPage />
}



