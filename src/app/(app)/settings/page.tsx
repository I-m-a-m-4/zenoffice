'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import PageTitle from '@/components/shared/page-title';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from "@/hooks/use-toast";
import { doc, updateDoc, serverTimestamp, deleteDoc, collection, onSnapshot, query, orderBy, Timestamp, addDoc } from "firebase/firestore";
import { Briefcase, Percent, Loader2, RefreshCw, Trash2, Globe, Landmark, Upload, Building, CreditCard, Banknote, ShieldQuestion, Palette, Truck, Package, Plus, MapPin, Award, Bell, Monitor, Smartphone, Tablet, Shield, ShieldCheck, LogOut, Star, Download, Info, Gauge, ShoppingCart } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from '@/components/ui/textarea';
import { useFirestore } from '@/firebase';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import FeatureGate from '@/components/shared/feature-gate';
import { BusinessInstance, UserProfile } from '@/types';
import { ALL_CURRENCIES, CURRENCY_SYMBOLS } from '@/lib/constants';
import { Combobox } from '@/components/ui/combobox';

const CURRENCY_COUNTRY_CODES: Record<string, string> = {
    USD: 'us', EUR: 'eu', GBP: 'gb', NGN: 'ng', PKR: 'pk', MUR: 'mu', GHS: 'gh', KES: 'ke', ZAR: 'za',
    CAD: 'ca', AUD: 'au', INR: 'in', AED: 'ae', SAR: 'sa', JPY: 'jp', CNY: 'cn', BRL: 'br', CHF: 'ch',
    AFN: 'af', ALL: 'al', AMD: 'am', ANG: 'an', AOA: 'ao', ARS: 'ar', AWG: 'aw', AZN: 'az', BAM: 'ba',
    BBD: 'bb', BDT: 'bd', BGN: 'bg', BHD: 'bh', BIF: 'bi', BMD: 'bm', BND: 'bn', BOB: 'bo', BSD: 'bs',
    BTN: 'bt', BWP: 'bw', BYN: 'by', BZD: 'bz', CDF: 'cd', CLP: 'cl', COP: 'co', CRC: 'cr', CUP: 'cu',
    CVE: 'cv', CZK: 'cz', DJF: 'dj', DKK: 'dk', DOP: 'do', DZD: 'dz', EGP: 'eg', ERN: 'er', ETB: 'et',
    FJD: 'fj', FKP: 'fk', GEL: 'ge', GIP: 'gi', GMD: 'gm', GNF: 'gn', GTQ: 'gt', GYD: 'gy', HKD: 'hk',
    HNL: 'hn', HRK: 'hr', HTG: 'ht', HUF: 'hu', IDR: 'id', ILS: 'il', IQD: 'iq', IRR: 'ir', ISK: 'is',
    JMD: 'jm', JOD: 'jo', KGS: 'kg', KHR: 'kh', KMF: 'km', KPW: 'kp', KRW: 'kr', KWD: 'kw', KYD: 'ky',
    KZT: 'kz', LAK: 'la', LBP: 'lb', LKR: 'lk', LRD: 'lr', LSL: 'ls', LYD: 'ly', MAD: 'ma', MDL: 'md',
    MGA: 'mg', MKD: 'mk', MMK: 'mm', MNT: 'mn', MOP: 'mo', MRU: 'mr', MUR: 'mu', MVR: 'mv', MWK: 'mw',
    MXN: 'mx', MYR: 'my', MZN: 'mz', NAD: 'na', NOK: 'no', NPR: 'np', NZD: 'nz', OMR: 'om', PAB: 'pa',
    PEN: 'pe', PGK: 'pg', PHP: 'ph', PLN: 'pl', PYG: 'py', QAR: 'qa', RON: 'ro', RSD: 'rs', RUB: 'ru',
    RWF: 'rw', SGD: 'sg', SHP: 'sh', SLL: 'sl', SOS: 'so', SRD: 'sr', SSP: 'ss', STN: 'st', SYP: 'sy',
    SZL: 'sz', THB: 'th', TJS: 'tj', TMT: 'tm', TND: 'tn', TOP: 'to', TRY: 'tr', TTD: 'tt', TWD: 'tw',
    TZS: 'tz', UAH: 'ua', UGX: 'ug', UYU: 'uy', UZS: 'uz', VES: 've', VND: 'vn', VUV: 'vu', WST: 'ws',
    XAF: 'cm', XCD: 'ag', XOF: 'sn', XPF: 'pf', YER: 'ye', ZMW: 'zm', ZWL: 'zw'
};
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getAuth, signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { usePOS } from '@/context/pos-context';
import { Separator } from '@/components/ui/separator';
import { SettingsBodySkeleton } from './skeleton';
import { ThemeSwitcher } from '@/components/settings/theme-switcher';
import { LanguageSwitcher } from '@/components/settings/language-switcher';
import { useI18n } from '@/context/i18n-context';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { PhoneInput } from '@/components/ui/phone-input';

const NIGERIAN_BANKS = [
    { label: "Access Bank", value: "044" },
    { label: "Citibank", value: "023" },
    { label: "Ecobank Nigeria", value: "050" },
    { label: "Fidelity Bank", value: "070" },
    { label: "First Bank of Nigeria", value: "011" },
    { label: "First City Monument Bank", value: "214" },
    { label: "Globus Bank", value: "00103" },
    { label: "Guaranty Trust Bank", value: "058" },
    { label: "Heritage Bank", value: "030" },
    { label: "Jaiz Bank", value: "301" },
    { label: "Keystone Bank", value: "082" },
    { label: "Kuda Bank", value: "50211" },
    { label: "Opay", value: "999992" },
    { label: "Palmpay", value: "999991" },
    { label: "Parallex Bank", value: "526" },
    { label: "Paystack", value: "12345" },
    { label: "Polaris Bank", value: "076" },
    { label: "Providus Bank", value: "101" },
    { label: "Stanbic IBTC Bank", value: "221" },
    { label: "Standard Chartered Bank", value: "068" },
    { label: "Sterling Bank", value: "232" },
    { label: "Suntrust Bank", value: "100" },
    { label: "TAJBank", value: "302" },
    { label: "Titan Trust Bank", value: "102" },
    { label: "Union Bank of Nigeria", value: "032" },
    { label: "United Bank for Africa", value: "033" },
    { label: "Unity Bank", value: "215" },
    { label: "Wema Bank", value: "035" },
    { label: "Zenith Bank", value: "057" },
];


const months = [
    'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'
];

const industries = [
    'Retail & E-commerce', 'Fashion & Apparel', 'Electronics', 'Food & Beverage', 'Health & Beauty', 'Home & Furniture', 'Other'
];

const GLOBAL_COUNTRIES = [
    "Nigeria",
    "United States",
    "United Kingdom",
    "Canada",
    "Australia",
    "Germany",
    "France",
    "South Africa",
    "Kenya",
    "Ghana",
    "United Arab Emirates",
    "Saudi Arabia",
    "India",
    "Switzerland"
];

function SettingsPageSkeleton() {
    return <SettingsBodySkeleton />;
}

import { useFCM } from '@/hooks/use-fcm';
import { apiBase, openStoreReview } from '@/lib/platform';

function SettingsPageContent() {
    const { business, currentUserProfile, triggerRefresh, addToQueue, mutateBusiness } = usePOS();
    const hasLifetimeAccess = business?.accessLevel === 'lifetime';
    const isOwnerOrAdmin = currentUserProfile && (
        currentUserProfile.role === 'admin' ||
        currentUserProfile.role === 'owner' ||
        business?.ownerId === currentUserProfile.id
    );

    const { permission, requestPermission, unsubscribe, fcmToken, isLoading: isFcmLoading } = useFCM();
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();
    const { t } = useI18n();

    // General state
    const [isSaving, setIsSaving] = React.useState<Record<string, boolean>>({});
    const [isVerifying, setIsVerifying] = React.useState(false);
    const [bvn, setBvn] = React.useState('');
    const [isVerifyingBvn, setIsVerifyingBvn] = React.useState(false);

    // Form fields state
    const [businessName, setBusinessName] = React.useState('');
    const [businessAddress, setBusinessAddress] = React.useState('');
    const [businessPhone, setBusinessPhone] = React.useState('');
    const [businessEmail, setBusinessEmail] = React.useState('');
    const [logoFile, setLogoFile] = React.useState<File | null>(null);
    const [logoPreview, setLogoPreview] = React.useState<string | null>(null);
    const [isTauri, setIsTauri] = React.useState(false);
    const [isMobile, setIsMobile] = React.useState(false);
    const [currentVersion, setCurrentVersion] = React.useState<string>('0.3.5');
    const [isCheckingUpdates, setIsCheckingUpdates] = React.useState(false);
    const isNative = isTauri; // Derived from isTauri state

    React.useEffect(() => {
        const checkTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;
        setIsTauri(!!checkTauri);
        setIsMobile(!!checkTauri && /android|iphone|ipad|ipod/i.test(navigator.userAgent));

        if (checkTauri) {
            import('@tauri-apps/api/app').then(app => {
                app.getVersion().then(setCurrentVersion);
            });
        }
    }, []);

    const [currency, setCurrency] = React.useState('NGN');
    const [timezone, setTimezone] = React.useState(() => {
        try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Lagos';
        } catch {
            return 'Africa/Lagos';
        }
    });
    const [defaultTaxRate, setDefaultTaxRate] = React.useState('0');
    const [paymentBankCode, setPaymentBankCode] = React.useState('');
    const [paymentBankAccountId, setPaymentBankAccountId] = React.useState('');
    const [paymentAccountName, setPaymentAccountName] = React.useState('');
    const [paymentInstructions, setPaymentInstructions] = React.useState('');
    const [isActivatingTerminal, setIsActivatingTerminal] = React.useState(false);
    const [isDeactivatingTerminal, setIsDeactivatingTerminal] = React.useState(false);

    const [ipCountry, setIpCountry] = React.useState<string | null>(null);

    React.useEffect(() => {
        const checkIp = () => {
            const cached = sessionStorage.getItem('zeneva_ip_country');
            if (cached) setIpCountry(cached);
            else setTimeout(checkIp, 1000);
        };
        checkIp();
    }, []);

    // Loyalty state
    const [loyaltyEnabled, setLoyaltyEnabled] = React.useState(false);
    const [pointsPerUnit, setPointsPerUnit] = React.useState('1');

    // Business rating opt-in. A Switch is binary and the stored flag has three
    // states, so `undefined` (never asked) hydrates to off here — the switch being
    // visible *is* the asking, and saving it therefore records a real decision
    // either way. See the field note in `src/types.ts`.
    const [ratingEnabled, setRatingEnabled] = React.useState(false);

    const [industry, setIndustry] = React.useState('');
    const [country, setCountry] = React.useState('Nigeria');
    const [state, setState] = React.useState('');
    const [fiscalYearStart, setFiscalYearStart] = React.useState('January');

    const [shippingOptions, setShippingOptions] = React.useState<{ name: string, price: number, type: 'delivery' | 'pickup', location?: string | null }[]>([]);
    const [newShippingOption, setNewShippingOption] = React.useState({ name: '', price: '', type: 'delivery' as 'delivery' | 'pickup', location: '' });

    const [productCategories, setProductCategories] = React.useState<string[]>([]);
    const [newCategory, setNewCategory] = React.useState('');

    // Operating Hours state
    const [operatingHoursEnabled, setOperatingHoursEnabled] = React.useState(false);
    const [openTime, setOpenTime] = React.useState('08:00');
    const [closeTime, setCloseTime] = React.useState('18:00');
    const [preventSalesOutsideHours, setPreventSalesOutsideHours] = React.useState(false);

    // POS Settings
    const [allowPosPriceOverride, setAllowPosPriceOverride] = React.useState(false);
    const [allowCashierExpenseLogging, setAllowCashierExpenseLogging] = React.useState(false);
    const [allowManagerCostPriceView, setAllowManagerCostPriceView] = React.useState(false);
    const [requireAdminApprovalForVoids, setRequireAdminApprovalForVoids] = React.useState(false);

    // Effect to populate form fields when business data loads
    React.useEffect(() => {
        if (business?.settings) {
            setBusinessName((business.name || '').replace(/\s+Business$/i, ''));
            setBusinessAddress(business.address || '');
            setBusinessPhone(business.settings?.phone || '');
            setBusinessEmail(business.settings?.email || '');
            setLogoPreview(business.settings?.logoUrl || null);

            setCurrency(business.settings?.currency || 'NGN');
            let localTimezone = 'Africa/Lagos';
            try {
                localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Lagos';
            } catch { }
            setTimezone(business.settings?.timezone || localTimezone);
            setDefaultTaxRate(String(business.settings?.defaultTaxRate || 0));
            setPaymentBankCode(business.settings?.paymentBankCode || '');
            setPaymentBankAccountId(business.settings?.paymentBankAccountId || '');
            setPaymentAccountName(business.settings?.paymentAccountName || '');
            setPaymentInstructions(business.settings?.paymentInstructions || '');

            setLoyaltyEnabled(business.settings.loyaltyProgramEnabled || false);
            setPointsPerUnit(String(business.settings.pointsPerUnit || 1));
            setRatingEnabled(business.settings?.ratingEnabled === true);

            setIndustry(business.settings?.industry || '');
            setCountry(business.settings?.country || 'Nigeria');
            setState(business.settings?.state || '');
            setFiscalYearStart(business.settings?.fiscalYearStart || 'January');
            setShippingOptions(business.settings?.publicStore?.shippingOptions || []);
            setProductCategories(business.settings?.productCategories || []);

            // Operating Hours
            setOperatingHoursEnabled(business.settings?.operatingHours?.enabled || false);
            setOpenTime(business.settings?.operatingHours?.openTime || '08:00');
            setCloseTime(business.settings?.operatingHours?.closeTime || '18:00');
            setPreventSalesOutsideHours(business.settings?.operatingHours?.preventSalesOutsideHours || false);

            setAllowPosPriceOverride(business.settings?.allowPosPriceOverride || false);
            setAllowCashierExpenseLogging(business.settings?.allowCashierExpenseLogging || false);
            setAllowManagerCostPriceView(business.settings?.allowManagerCostPriceView || false);
            setRequireAdminApprovalForVoids(business.settings?.requireAdminApprovalForVoids || false);
        }
    }, [business]);

    const [isExporting, setIsExporting] = React.useState(false);

    const handleExportData = async () => {
        if (!currentUserProfile?.email) {
            toast({
                title: t('settings.dataExportError', { defaultValue: 'Export Failed' }),
                description: t('settings.noEmailFound', { defaultValue: 'No email address found for your profile.' }),
                variant: 'destructive'
            });
            return;
        }

        try {
            setIsExporting(true);
            const data = {
                userProfile: currentUserProfile,
                businessDetails: business ? {
                    id: business.id,
                    name: business.name,
                    address: business.address,
                    settings: business.settings
                } : null,
                exportDate: new Date().toISOString(),
                exportReason: 'GDPR Right to Portability'
            };

            const response = await fetch('/api/export-data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: currentUserProfile.email,
                    data
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to send export email');
            }

            toast({
                title: t('settings.dataExportSuccess', { defaultValue: 'Data Exported Successfully' }),
                description: t('settings.dataExportEmailSent', { defaultValue: 'Your GDPR data payload has been emailed to you.' }),
                variant: 'success'
            });
        } catch (err) {
            console.error('Failed to export data:', err);
            toast({
                title: t('settings.dataExportError', { defaultValue: 'Export Failed' }),
                description: t('settings.dataExportErrorDesc', { defaultValue: 'There was an error generating your data export.' }),
                variant: 'destructive'
            });
        } finally {
            setIsExporting(false);
        }
    };


    // Sessions state
    const [sessions, setSessions] = React.useState<any[]>([]);
    const [isRevoking, setIsRevoking] = React.useState<Record<string, boolean>>({});
    const [showAllSessions, setShowAllSessions] = React.useState(false);

    React.useEffect(() => {
        if (!currentUserProfile?.id || !firestore) return;

        const sessionsRef = collection(firestore, 'users', currentUserProfile.id, 'sessions');
        const q = query(sessionsRef, orderBy('lastSeen', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const sessionsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setSessions(sessionsData);
        }, (error) => {
            console.error("Error listening to sessions:", error);
        });

        return () => unsubscribe();
    }, [currentUserProfile?.id, firestore]);

    const handleRevokeSession = async (sessionId: string) => {
        if (!currentUserProfile?.id) return;
        setIsRevoking(prev => ({ ...prev, [sessionId]: true }));
        try {
            const sessionRef = doc(firestore, 'users', currentUserProfile.id, 'sessions', sessionId);
            await updateDoc(sessionRef, { revoked: true });
            toast({
                variant: 'success',
                title: t('settings.toastAccessRevoked'),
                description: t('settings.toastAccessRevokedBody')
            });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: t('settings.toastRevokeFailed'),
                description: t('settings.toastRevokeFailedBody')
            });
        } finally {
            setIsRevoking(prev => ({ ...prev, [sessionId]: false }));
        }
    };

    const getDeviceIcon = (userAgent: string) => {
        const ua = userAgent.toLowerCase();
        if (ua.includes('mobi')) return <Smartphone className="h-4 w-4" />;
        if (ua.includes('tablet') || ua.includes('ipad')) return <Tablet className="h-4 w-4" />;
        return <Monitor className="h-4 w-4" />;
    };

    // Returns a stable, language-independent device key. Grouping in
    // `processedSessions` keys off this, so it must NOT be translated —
    // `formatUA` renders the label for display instead.
    const deviceKind = (userAgent: string) => {
        if (userAgent.includes('Windows')) return 'windows';
        if (userAgent.includes('Mac OS')) return 'mac';
        if (userAgent.includes('iPhone')) return 'iphone';
        if (userAgent.includes('Android')) return 'android';
        if (userAgent.includes('Linux')) return 'linux';
        return 'unknown';
    };

    const formatUA = (userAgent: string) => {
        switch (deviceKind(userAgent)) {
            case 'windows': return t('settings.deviceWindows');
            case 'mac': return t('settings.deviceMac');
            case 'iphone': return t('settings.deviceIphone');
            case 'android': return t('settings.deviceAndroid');
            case 'linux': return t('settings.deviceLinux');
            default: return t('settings.deviceUnknown');
        }
    };

    React.useEffect(() => {
        setPaymentAccountName('');
    }, [paymentBankAccountId, paymentBankCode]);


    const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            processLogoFile(file);
        }
    };

    const handleNativeLogoUpload = async () => {
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
                const fileName = selected.split(/[\\/]/).pop() || 'logo.png';
                // Detect mime type from extension
                const ext = fileName.split('.').pop()?.toLowerCase();
                const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

                const blob = new Blob([fileData], { type: mimeType });
                const file = new File([blob], fileName, { type: mimeType });
                processLogoFile(file);
            }
        } catch (err) {
            console.error('Native upload failed:', err);
        }
    };

    const processLogoFile = (file: File) => {
        if (file.size > 2 * 1024 * 1024) { // 2MB
            toast({ variant: 'destructive', title: t('settings.toastImageTooLarge'), description: t('settings.toastImageTooLargeBody') });
            return;
        }
        setLogoFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setLogoPreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    const handleVerifyAccount = async () => {
        if (!paymentBankAccountId || !paymentBankCode) {
            toast({ variant: 'destructive', title: t('settings.toastMissingDetails'), description: t('settings.toastMissingDetailsBody') });
            return;
        }
        setIsVerifying(true);
        setPaymentAccountName('');
        try {
            const response = await fetch(`${apiBase()}/api/paystack/resolve-account`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ account_number: paymentBankAccountId, bank_code: paymentBankCode })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Could not verify account.');
            }

            setPaymentAccountName(result.data.account_name);
            toast({
                variant: 'success',
                title: t('settings.toastAccountVerified'),
                description: t('settings.toastAccountVerifiedBody', { name: result.data.account_name })
            });

        } catch (error: any) {
            toast({ variant: "destructive", title: t('settings.toastVerificationFailed'), description: error.message });
        } finally {
            setIsVerifying(false);
        }
    };

    const handleActivateTerminal = async () => {
        if (!paymentBankAccountId || !paymentBankCode) {
            toast({ variant: "destructive", title: t('settings.toastActivationError'), description: t('settings.toastActivationErrorBody') });
            return;
        }
        const effectivePhone = businessPhone || business?.settings?.phone || '';
        if (!effectivePhone) {
            toast({ variant: "destructive", title: t('settings.toastPhoneRequired'), description: t('settings.toastPhoneRequiredBody') });
            return;
        }
        setIsActivatingTerminal(true);
        try {
            const response = await fetch('/api/paystack/activate-terminal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    businessId: business.id,
                    businessName: businessName,
                    email: currentUserProfile?.email || '',
                    phone: effectivePhone,
                    bankCode: paymentBankCode,
                    accountNumber: paymentBankAccountId
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Paystack terminal activation failed.');
            }

            const terminalUpdates = {
                "settings.terminalBankName": result.bankName,
                "settings.terminalAccountNumber": result.accountNumber,
                "settings.terminalAccountName": result.accountName,
                "settings.paystackSubaccountCode": result.subaccountCode
            };

            await handleSettingsSubmit('financials', {
                "settings.currency": currency,
                "settings.timezone": timezone,
                "settings.defaultTaxRate": parseFloat(defaultTaxRate) || 0,
                "settings.paymentBankCode": paymentBankCode,
                "settings.paymentBankName": NIGERIAN_BANKS.find(b => b.value === paymentBankCode)?.label || paymentBankCode || '',
                "settings.paymentBankAccountId": paymentBankAccountId,
                "settings.paymentAccountName": paymentAccountName,
                "settings.paymentInstructions": paymentInstructions,
                ...terminalUpdates
            });

            toast({
                variant: 'success',
                title: t('settings.toastTerminalActivated'),
                description: t('settings.toastTerminalActivatedBody', { bank: result.bankName, account: result.accountNumber })
            });
        } catch (error: any) {
            toast({ variant: "destructive", title: t('settings.toastActivationFailed'), description: error.message });
        } finally {
            setIsActivatingTerminal(false);
        }
    };

    const handleVerifyBvn = async () => {
        if (!bvn || bvn.length !== 11) {
            toast({ variant: "destructive", title: t('settings.toastInvalidBvn'), description: t('settings.toastInvalidBvnBody') });
            return;
        }

        setIsVerifyingBvn(true);
        try {
            const storeEmail = currentUserProfile?.email || `terminal-${business?.id?.substring(0, 8)}@zeneva.space`;
            const response = await fetch('/api/paystack/verify-customer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    businessId: business?.id,
                    bvn: bvn,
                    email: storeEmail
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Verification failed.');
            }

            await handleSettingsSubmit('compliance', {
                "settings.kycStatus": "verified",
                "settings.bvnProvided": true
            });

            toast({
                variant: 'success',
                title: t('settings.toastVerificationSuccessful'),
                description: t('settings.toastVerificationSuccessfulBody')
            });
            setBvn('');
        } catch (error: any) {
            toast({ variant: "destructive", title: t('settings.toastVerificationFailed'), description: error.message });
        } finally {
            setIsVerifyingBvn(false);
        }
    };

    const handleDeactivateTerminal = async () => {
        setIsDeactivatingTerminal(true);
        try {
            await handleSettingsSubmit('financials', {
                "settings.currency": currency,
                "settings.timezone": timezone,
                "settings.defaultTaxRate": parseFloat(defaultTaxRate) || 0,
                "settings.paymentBankCode": paymentBankCode,
                "settings.paymentBankName": NIGERIAN_BANKS.find(b => b.value === paymentBankCode)?.label || paymentBankCode || '',
                "settings.paymentBankAccountId": paymentBankAccountId,
                "settings.paymentAccountName": paymentAccountName,
                "settings.paymentInstructions": paymentInstructions,
                "settings.terminalBankName": null,
                "settings.terminalAccountNumber": null,
                "settings.terminalAccountName": null,
                "settings.paystackSubaccountCode": null
            });

            toast({
                variant: 'success',
                title: t('settings.toastTerminalDeactivated'),
                description: t('settings.toastTerminalDeactivatedBody')
            });
        } catch (error: any) {
            toast({ variant: "destructive", title: t('settings.toastDeactivationFailed'), description: error.message });
        } finally {
            setIsDeactivatingTerminal(false);
        }
    };

    const handleCheckUpdates = async () => {
        if (!isTauri) return;
        setIsCheckingUpdates(true);
        try {
            const { check } = await import('@tauri-apps/plugin-updater');
            const update = await check();
            if (update) {
                toast({
                    title: t('settings.toastUpdateAvailable'),
                    description: t('settings.toastUpdateAvailableBody', { version: update.version }),
                });
                // The TauriUpdater component in the root layout will handle the UI for downloading/restarting
            } else {
                toast({
                    title: t('settings.toastUpToDate'),
                    description: t('settings.toastUpToDateBody'),
                });
            }
        } catch (error) {
            console.error('Update check failed:', error);
            toast({
                variant: 'destructive',
                title: t('settings.toastUpdateFailed'),
                description: error instanceof Error ? error.message : t('settings.toastUpdateFailedBody'),
            });
        } finally {
            setIsCheckingUpdates(false);
        }
    };

    /**
     * `formName` is the internal save-slot id ('operating-hours', 'kyc'…), not
     * copy. Mapping it to a translated label keeps the queued/saved toast in the
     * chosen language instead of capitalising the raw id.
     */
    const sectionLabel = (formName: string) => {
        switch (formName) {
            case 'profile': return t('settings.sectionProfile');
            case 'loyalty': return t('settings.sectionLoyalty');
            case 'categories': return t('settings.sectionCategories');
            case 'financials': return t('settings.sectionFinancials');
            case 'shipping': return t('settings.sectionShipping');
            case 'organization': return t('settings.sectionOrganization');
            case 'operating-hours': return t('settings.sectionOperatingHours');
            case 'compliance': return t('settings.sectionCompliance');
            default: return formName.charAt(0).toUpperCase() + formName.slice(1);
        }
    };

    const handleSettingsSubmit = async (formName: string, dataToSave: Record<string, any>) => {
        if (!business?.id || !businessName) return;
        setIsSaving(prev => ({ ...prev, [formName]: true }));

        let finalData = { ...dataToSave };

        // Auto-add pending shipping option if present
        if (formName === 'shipping' && newShippingOption.name) {
            const name = newShippingOption.name.trim();
            const price = parseFloat(newShippingOption.price);
            const type = newShippingOption.type;
            const location = newShippingOption.location.trim();

            if (name && !isNaN(price) && price >= 0) {
                if (type === 'delivery' || (type === 'pickup' && location)) {
                    const newOption = { name, price, type, location: type === 'pickup' ? location : null };
                    const updatedOptions = [...shippingOptions, newOption];
                    finalData['settings.publicStore.shippingOptions'] = updatedOptions;
                    setShippingOptions(updatedOptions); // Update local state immediately
                    setNewShippingOption({ name: '', price: '', type: 'delivery', location: '' }); // Clear input
                }
            }
        }

        try {
            const performOptimisticUpdate = () => {
                if (mutateBusiness) {
                    mutateBusiness((prev: any) => {
                        if (!prev) return null;
                        const updated = { ...prev };
                        Object.keys(finalData).forEach(key => {
                            if (key.includes('.')) {
                                const parts = key.split('.');
                                let curr: any = updated;
                                for (let i = 0; i < parts.length - 1; i++) {
                                    curr[parts[i]] = { ...curr[parts[i]] };
                                    curr = curr[parts[i]];
                                }
                                curr[parts[parts.length - 1]] = finalData[key];
                            } else {
                                (updated as any)[key] = finalData[key];
                            }
                        });
                        return updated;
                    });
                }
            };

            if (isTauri) {
                // Use offline queue for desktop
                addToQueue({
                    type: 'update-settings',
                    payload: finalData,
                }, `Update ${formName} settings`);

                toast({
                    variant: "success",
                    title: t('settings.toastQueued', { section: sectionLabel(formName) }),
                    description: t('settings.toastQueuedBody')
                });

                performOptimisticUpdate();
            } else {
                // Web behavior
                const businessDocRef = doc(firestore, 'businessInstances', business.id);
                await updateDoc(businessDocRef, finalData);
                toast({ variant: "success", title: t('settings.toastSaved', { section: sectionLabel(formName) }), description: t('settings.toastSavedBody') });

                performOptimisticUpdate();

                // Force a re-fetch of business data to update all industry-specific UI components
                triggerRefresh();
            }
        } catch (error) {
            toast({ variant: "destructive", title: t('settings.toastSaveFailed'), description: t('settings.toastSaveFailedBody') });
        } finally {
            setIsSaving(prev => ({ ...prev, [formName]: false }));
        }
    };

    /**
     * The switcher already shows its own translated confirmation toast, so this
     * takes the same dual save path as handleSettingsSubmit without the second
     * generic toast on top of it.
     */
    const handleLanguagePersist = React.useCallback((localeCode: string) => {
        if (!business?.id) return;
        const finalData = { 'settings.language': localeCode };

        const performOptimisticUpdate = () => {
            if (!mutateBusiness) return;
            mutateBusiness((prev: any) => {
                if (!prev) return null;
                return { ...prev, settings: { ...prev.settings, language: localeCode } };
            });
        };

        try {
            if (isTauri) {
                addToQueue({ type: 'update-settings', payload: finalData }, 'Update language setting');
                performOptimisticUpdate();
            } else {
                void updateDoc(doc(firestore, 'businessInstances', business.id), finalData)
                    .then(performOptimisticUpdate)
                    .catch(() => {
                        toast({ variant: 'destructive', title: t('settings.toastSaveFailed'), description: t('settings.toastLanguageFailedBody') });
                    });
            }
        } catch {
            toast({ variant: 'destructive', title: t('settings.toastSaveFailed'), description: t('settings.toastLanguageFailedBody') });
        }
    }, [business?.id, isTauri, mutateBusiness, addToQueue, firestore, toast]);

    const handleSendTestNotification = async () => {
        if (!currentUserProfile?.id) return;
        try {
            await addDoc(collection(firestore, `users/${currentUserProfile.id}/notifications`), {
                title: t('settings.testNotificationTitle'),
                body: t('settings.testNotificationBody'),
                createdAt: serverTimestamp(),
                read: false,
                type: 'system'
            });
            toast({ title: t('settings.toastTestSent'), description: t('settings.toastTestSentBody') });
        } catch (error) {
            console.error("Error sending test notification:", error);
            toast({ variant: "destructive", title: t('settings.toastTestFailed'), description: t('settings.toastTestFailedBody') });
        }
    };

    const handleAddShippingOption = () => {
        const name = newShippingOption.name.trim();
        const price = parseFloat(newShippingOption.price);
        const type = newShippingOption.type;
        const location = newShippingOption.location.trim();

        if (name && !isNaN(price) && price >= 0) {
            if (type === 'pickup' && !location) {
                toast({ variant: 'destructive', title: t('settings.toastLocationRequired'), description: t('settings.toastLocationRequiredBody') });
                return;
            }
            setShippingOptions([...shippingOptions, { name, price, type, location: type === 'pickup' ? location : null }]);
            setNewShippingOption({ name: '', price: '', type: 'delivery', location: '' });
        } else {
            toast({ variant: 'destructive', title: t('settings.toastInvalidOption'), description: t('settings.toastInvalidOptionBody') });
        }
    };

    const handleDeleteShippingOption = (index: number) => {
        setShippingOptions(shippingOptions.filter((_, i) => i !== index));
    };

    const handleAddCategory = () => {
        const cat = newCategory.trim();
        if (cat && !productCategories.includes(cat)) {
            setProductCategories([...productCategories, cat]);
            setNewCategory('');
        }
    }

    const handleDeleteCategory = (catToDelete: string) => {
        setProductCategories(productCategories.filter(c => c !== catToDelete));
    }

    const processedSessions = React.useMemo(() => {
        const groups = new Map<string, any>();

        sessions.forEach(session => {
            const deviceType = deviceKind(session.userAgent || 'Unknown');
            const platform = session.deviceInfo?.platform || 'Unknown OS';
            // Group by device type and platform more aggressively
            const key = `${deviceType}-${platform}`.toLowerCase();

            const currentSessionIdKey = `zeneva_session_id_${currentUserProfile?.id}`;
            const currentSessionId = typeof window !== 'undefined' ? sessionStorage.getItem(currentSessionIdKey) : null;
            const isCurrent = session.id === currentSessionId;

            // Priority: 1. Current Session, 2. Latest active session for that device
            if (isCurrent || !groups.has(key)) {
                groups.set(key, session);
            }
        });

        return Array.from(groups.values()).sort((a, b) => {
            const currentSessionIdKey = `zeneva_session_id_${currentUserProfile?.id}`;
            const currentSessionId = typeof window !== 'undefined' ? sessionStorage.getItem(currentSessionIdKey) : null;
            if (a.id === currentSessionId) return -1;
            if (b.id === currentSessionId) return 1;
            return (b.lastSeen?.seconds || 0) - (a.lastSeen?.seconds || 0);
        });
    }, [sessions, currentUserProfile?.id]);

    return (
        <div className="space-y-6">
            <PageTitle title={t('settings.title')} subtitle={t('settings.pageSubtitle')} />

            <Tabs defaultValue="general" className="space-y-6">
                <TabsList className="w-full flex-wrap justify-start h-auto bg-transparent p-0 gap-2 mb-4 border-b pb-4">
                    <TabsTrigger value="general" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border bg-muted/50 rounded-md px-4 py-2">{t('settings.tabGeneral')}</TabsTrigger>
                    <TabsTrigger value="storefront" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border bg-muted/50 rounded-md px-4 py-2">{t('settings.tabStorefront')}</TabsTrigger>
                    <TabsTrigger value="financials" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border bg-muted/50 rounded-md px-4 py-2">{t('settings.tabFinancialsBilling')}</TabsTrigger>
                    <TabsTrigger value="system" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border bg-muted/50 rounded-md px-4 py-2">{t('settings.tabSystemSecurity')}</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-6 mt-0">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5 text-primary" />{t('settings.profileTitle')}</CardTitle>
                            <CardDescription>{t('settings.profileDescription')}</CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className='md:col-span-2 space-y-4'>
                                    <div><Label htmlFor="businessName">{t('settings.businessName')}</Label><Input id="businessName" value={businessName} onChange={e => setBusinessName(e.target.value)} /></div>
                                    <div><Label htmlFor="businessAddress">{t('settings.businessAddress')}</Label><Textarea id="businessAddress" value={businessAddress} onChange={e => setBusinessAddress(e.target.value)} /></div>
                                    <div className="grid sm:grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="businessPhone">{t('settings.businessPhone')}</Label>
                                            {/* `country` is the shop's own settings.country, hydrated
                                            from the business doc. Without it the selector falls
                                            back to the first pinned entry - Nigeria - so a Ghanaian
                                            shop saw +234 and saved Nigerian numbers. */}
                                            <PhoneInput
                                                id="businessPhone"
                                                value={businessPhone}
                                                onChange={setBusinessPhone}
                                                defaultCountry={country}
                                                className="mt-1"
                                            />
                                        </div>
                                        <div><Label htmlFor="businessEmail">{t('settings.businessEmail')}</Label><Input id="businessEmail" type="email" value={businessEmail} onChange={e => setBusinessEmail(e.target.value)} /></div>
                                    </div>
                                </div>
                                <div>
                                    <Label>{t('settings.businessLogo')}</Label>
                                    <div
                                        className="mt-1 w-full aspect-square rounded-md border-2 border-dashed flex items-center justify-center relative overflow-hidden group hover:border-primary/50 transition-colors"
                                        onClick={() => isTauri && handleNativeLogoUpload()}
                                    >
                                        {logoPreview ? <Image src={logoPreview} alt={t('settings.logoPreviewAlt')} fill className="object-cover" /> : <Upload className="h-8 w-8 text-muted-foreground" />}
                                        {!isTauri && (
                                            <Input id="logo-upload" type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept="image/*" onChange={handleLogoChange} />
                                        )}
                                        {isTauri && (
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
                                                <span className="text-white text-xs font-bold">{t('settings.pickImage')}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button type="button" onClick={() => handleSettingsSubmit('profile', { name: businessName, address: businessAddress, "settings.phone": businessPhone, "settings.email": businessEmail })} disabled={isSaving["profile"]}>
                                {isSaving["profile"] && <Loader2 className="me-2 h-4 w-4 animate-spin" />}{t('settings.saveProfile')}
                            </Button>
                        </CardFooter>
                    </Card>



                    {isOwnerOrAdmin && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Building className="h-5 w-5 text-primary" />{t('settings.branchesTitle')}</CardTitle>
                                <CardDescription>{t('settings.branchesDescription')}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg bg-muted/20">
                                    <div className="space-y-1 mb-4 sm:mb-0">
                                        <h4 className="font-semibold text-sm">{t('settings.branchesHeading')}</h4>
                                        <p className="text-sm text-muted-foreground">{t('settings.branchesBody')}</p>
                                    </div>
                                    <Button asChild>
                                        <Link href="/settings/branches">{t('settings.manageBranches')}</Link>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {isOwnerOrAdmin && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Gauge className="h-5 w-5 text-primary" />Business Rating</CardTitle>
                                <CardDescription>
                                    A score out of 100 built from your own sales, with the biggest money opportunity it can find. Off unless you ask for it.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5 pe-4">
                                        <Label htmlFor="rating-switch" className="text-base">Show my business rating</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Turning this off hides the score everywhere &mdash; the top bar, the dashboard, Reports, the badges on Achievements, and Zen AI. Nothing is deleted, and your streak keeps counting, so switching it back on picks up where you left off.
                                        </p>
                                    </div>
                                    <Switch id="rating-switch" checked={ratingEnabled} onCheckedChange={setRatingEnabled} />
                                </div>
                            </CardContent>
                            <CardFooter>
                                {/* Dotted field path, as everywhere on this page: it merges into the
                                existing `settings` map instead of replacing it. */}
                                <Button type="button" onClick={() => handleSettingsSubmit('rating', { 'settings.ratingEnabled': ratingEnabled })} disabled={isSaving["rating"]}>
                                    {isSaving["rating"] && <Loader2 className="me-2 h-4 w-4 animate-spin" />}Save Rating Preference
                                </Button>
                            </CardFooter>
                        </Card>
                    )}

                    <Card className="border-border/15 dark:border-border/25 shadow-none hover:shadow-sm transition-shadow">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Star className="h-5 w-5 text-primary fill-primary" />{t('settings.reviewTitle')}</CardTitle>
                            <CardDescription>{t('settings.reviewDescription')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {/* Deliberately a button, not an anchor. The href used to carry
                            the `ms-windows-store:` / `market:` deep link, but both
                            onClick branches called preventDefault() and then
                            window.open() — which is a no-op inside the Tauri webview,
                            so this did nothing at all on desktop and Android.
                            openStoreReview goes through plugin:shell|open. */}
                            <button
                                type="button"
                                onClick={() => { void openStoreReview((isTauri && !isMobile) ? 'microsoft' : 'play'); }}
                                className="inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background border border-primary text-primary bg-background hover:bg-primary hover:text-white h-10 py-2 px-4 w-full"
                            >
                                <Star className="me-2 h-4 w-4" />
                                {(isTauri && !isMobile) ? "Rate Zeneva on Microsoft Store" : "Rate Zeneva on Playstore"}
                            </button>
                        </CardContent>
                    </Card>

                    <Card className="border-border/15 dark:border-border/25 shadow-none hover:shadow-sm transition-shadow">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5 text-primary" />{t('settings.appearanceTitle')}</CardTitle>
                            <CardDescription>{t('settings.appearanceSubtitle')}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <ThemeSwitcher />
                            <LanguageSwitcher onPersist={handleLanguagePersist} />
                        </CardContent>
                    </Card>

                </TabsContent>

                <TabsContent value="storefront" className="space-y-6 mt-0">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Award className="h-5 w-5 text-primary" />{t('settings.loyaltyTitle')}</CardTitle>
                            <CardDescription>{t('settings.loyaltyDescription')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <Label htmlFor="loyalty-switch" className="text-base">{t('settings.loyaltyEnable')}</Label>
                                        <p className="text-sm text-muted-foreground">{t('settings.loyaltyEnableDescription')}</p>
                                    </div>
                                    <Switch id="loyalty-switch" checked={loyaltyEnabled} onCheckedChange={setLoyaltyEnabled} />
                                </div>
                                {loyaltyEnabled && (
                                    <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t">
                                        <div>
                                            <Label htmlFor="points-per-unit" className="flex items-center gap-1.5">
                                                {t('settings.pointsPerUnit')}
                                                <TooltipProvider>
                                                    <Tooltip delayDuration={300}>
                                                        <TooltipTrigger asChild>
                                                            <Info className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors cursor-help" />
                                                        </TooltipTrigger>
                                                        <TooltipContent className="max-w-[250px]">
                                                            <p>The number of points a customer earns per single unit of currency spent.</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </Label>
                                            <Input
                                                id="points-per-unit"
                                                type="number"
                                                value={pointsPerUnit}
                                                onChange={e => setPointsPerUnit(e.target.value)}
                                                placeholder={t('settings.pointsPerUnitPlaceholder')}
                                            />
                                            <p className="text-xs text-muted-foreground mt-1">{t('settings.pointsPerUnitHint')}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button type="button" onClick={() => handleSettingsSubmit('loyalty', { 'settings.loyaltyProgramEnabled': loyaltyEnabled, 'settings.pointsPerUnit': parseFloat(pointsPerUnit) || 0 })} disabled={isSaving["loyalty"]}>
                                {isSaving["loyalty"] && <Loader2 className="me-2 h-4 w-4 animate-spin" />}{t('settings.saveLoyalty')}
                            </Button>
                        </CardFooter>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-primary" />{t('settings.categoriesTitle')}</CardTitle>
                            <CardDescription>{t('settings.categoriesDescription')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {productCategories.map((cat, index) => (
                                    <div key={index} className="flex items-center justify-between gap-2 p-3 border rounded-md bg-muted/50">
                                        <p className="font-medium">{cat}</p>
                                        <Button variant="ghost" size="icon" onClick={() => handleDeleteCategory(cat)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                ))}
                                <div className="flex items-end gap-2 pt-4 border-t">
                                    <div className="flex-1"><Label>{t('settings.newCategory')}</Label><Input placeholder={t('settings.newCategoryPlaceholder')} value={newCategory} onChange={e => setNewCategory(e.target.value)} /></div>
                                    <Button type="button" onClick={handleAddCategory}><Plus className="h-4 w-4 me-2" />{t('settings.addCategory')}</Button>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button type="button" onClick={() => handleSettingsSubmit('categories', { 'settings.productCategories': productCategories })} disabled={isSaving["categories"]}>
                                {isSaving["categories"] && <Loader2 className="me-2 h-4 w-4 animate-spin" />}{t('settings.saveCategories')}
                            </Button>
                        </CardFooter>
                    </Card>


                </TabsContent>

                <TabsContent value="financials" className="space-y-6 mt-0">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" />{t('settings.financialsTitle')}</CardTitle>
                            <CardDescription>{t('settings.financialsDescription')}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid md:grid-cols-3 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <Label>{t('settings.currency')}</Label>
                                    <Combobox
                                        options={ALL_CURRENCIES.map(curr => ({
                                            value: curr.value,
                                            label: curr.label
                                        }))}
                                        value={currency}
                                        onChange={(val) => setCurrency(val)}
                                        placeholder={t('settings.selectCurrency')}
                                        searchPlaceholder={t('settings.searchCurrency')}
                                        renderSelected={(opt) => (
                                            <div className="flex items-center gap-2">
                                                <img
                                                    src={`https://flagcdn.com/16x12/${CURRENCY_COUNTRY_CODES[opt.value] || 'un'}.png`}
                                                    alt=""
                                                    className="w-4 h-3 object-cover rounded-sm shrink-0"
                                                />
                                                <span>{opt.value}</span>
                                            </div>
                                        )}
                                        renderItem={(opt) => (
                                            <div className="flex items-center gap-2 w-full">
                                                <img
                                                    src={`https://flagcdn.com/16x12/${CURRENCY_COUNTRY_CODES[opt.value] || 'un'}.png`}
                                                    alt=""
                                                    className="w-4 h-3 object-cover rounded-sm shrink-0"
                                                />
                                                <span className="truncate">{opt.label}</span>
                                            </div>
                                        )}
                                        triggerClassName="w-full justify-between font-normal bg-background hover:bg-accent border border-input h-10 px-3 py-2 text-sm rounded-md"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label>{t('settings.timezone')}</Label>
                                    <Combobox
                                        options={typeof Intl !== 'undefined' && Intl.supportedValuesOf
                                            ? Intl.supportedValuesOf('timeZone').map(tz => ({ value: tz, label: tz }))
                                            : [{ value: 'Africa/Lagos', label: 'Africa/Lagos' }]}
                                        value={timezone}
                                        onChange={(val) => setTimezone(val)}
                                        placeholder={t('settings.selectTimezone')}
                                        searchPlaceholder={t('settings.searchTimezone')}
                                        triggerClassName="w-full justify-between font-normal bg-background hover:bg-accent border border-input h-10 px-3 py-2 text-sm rounded-md"
                                    />
                                </div>
                                <div>
                                    <Label className="flex items-center gap-1.5 mb-2">
                                        {t('settings.defaultTaxRate')}
                                        <TooltipProvider>
                                            <Tooltip delayDuration={300}>
                                                <TooltipTrigger asChild>
                                                    <Info className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors cursor-help" />
                                                </TooltipTrigger>
                                                <TooltipContent className="max-w-[250px]">
                                                    <p>The standard tax rate percentage applied to sales. Set to 0 if tax is not applicable.</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </Label>
                                    <Input type="number" value={defaultTaxRate} onChange={e => setDefaultTaxRate(e.target.value)} />
                                </div>
                            </div>
                            {(ipCountry === 'Nigeria' || currency === 'NGN') && (
                                <>
                                    <Separator />
                                    <FeatureGate
                                        requiredPlan="business"
                                        currentPlan={business?.plan}
                                        hasLifetimeAccess={hasLifetimeAccess}
                                        featureName={t('settings.terminalGateName')}
                                        featureDescription={t('settings.terminalGateDescription')}
                                        variant="rich"
                                    >
                                        <div>
                                            <h4 className="font-semibold text-lg flex items-center gap-2 mb-2"><Banknote className="h-5 w-5 text-muted-foreground" />{t('settings.bankTransferTitle')}</h4>
                                            <p className="text-sm text-muted-foreground mb-4">
                                                {t('settings.bankTransferBody')}
                                                {currency === 'NGN' && ` ${t('settings.bankTransferSubaccountNote')}`}
                                            </p>
                                            <div className="space-y-4">
                                                <div className={cn("grid gap-4 items-end", currency === 'NGN' ? "grid-cols-1 sm:grid-cols-[2fr_1fr]" : "grid-cols-1")}>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                                                        <div>
                                                            <Label>{t('settings.bankName')}</Label>
                                                            {currency === 'NGN' ? (
                                                                <DropdownMenu modal={false}>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <Button variant="outline" className="w-full justify-between font-normal bg-background hover:bg-accent border border-input h-10 px-3 py-2 text-sm rounded-md">
                                                                            <span>{NIGERIAN_BANKS.find(b => b.value === paymentBankCode)?.label || t('settings.selectBank')}</span>
                                                                            <ChevronDown className="h-4 w-4 opacity-50 ms-2" />
                                                                        </Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-60 overflow-y-auto bg-popover text-popover-foreground shadow-md rounded-md border p-1 z-50">
                                                                        {NIGERIAN_BANKS.map(b => (
                                                                            <DropdownMenuItem key={b.value} onClick={() => setPaymentBankCode(b.value)} className="cursor-pointer">
                                                                                {b.label}
                                                                            </DropdownMenuItem>
                                                                        ))}
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            ) : (
                                                                <Input
                                                                    value={paymentBankCode}
                                                                    onChange={e => setPaymentBankCode(e.target.value)}
                                                                    placeholder={t('settings.bankNamePlaceholder')}
                                                                />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <Label>{currency === 'NGN' ? t('settings.accountNumber') : t('settings.accountNumberIban')}</Label>
                                                            <Input
                                                                value={paymentBankAccountId}
                                                                onChange={e => setPaymentBankAccountId(e.target.value)}
                                                                placeholder={currency === 'NGN' ? t('settings.accountNumberPlaceholder') : t('settings.ibanPlaceholder')}
                                                            />
                                                        </div>
                                                    </div>
                                                    {currency === 'NGN' ? (
                                                        <Button type="button" onClick={handleVerifyAccount} disabled={isVerifying} className="w-full">
                                                            {isVerifying && <Loader2 className="me-2 h-4 w-4 animate-spin" />}{t('settings.verifyAccount')}
                                                        </Button>
                                                    ) : (
                                                        <div className="w-full">
                                                            <Label>{t('settings.accountName')}</Label>
                                                            <Input
                                                                value={paymentAccountName}
                                                                onChange={e => setPaymentAccountName(e.target.value)}
                                                                placeholder={t('settings.accountNamePlaceholder')}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                                {currency === 'NGN' && paymentAccountName && (
                                                    <div>
                                                        <Label>{t('settings.resolvedAccountName')}</Label>
                                                        <Input value={paymentAccountName} readOnly className="bg-muted font-bold text-emerald-600" />
                                                    </div>
                                                )}
                                                <div>
                                                    <Label htmlFor="paymentInstructions">{t('settings.paymentInstructions')}</Label>
                                                    <Textarea
                                                        id="paymentInstructions"
                                                        placeholder={t('settings.paymentInstructionsPlaceholder')}
                                                        value={paymentInstructions}
                                                        onChange={e => setPaymentInstructions(e.target.value)}
                                                        className="h-20"
                                                    />
                                                    <p className="text-xs text-muted-foreground mt-1">{t('settings.paymentInstructionsHint')}</p>
                                                </div>
                                                {currency === 'NGN' && ipCountry === 'Nigeria' && (
                                                    business?.settings?.terminalAccountNumber ? (
                                                        <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-500/5 space-y-2 mt-4 animate-fadeIn">
                                                            <div className="flex items-center justify-between">
                                                                <h5 className="font-semibold text-emerald-800 text-sm flex items-center gap-1.5">
                                                                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                                                                    {t('settings.terminalActiveTitle')}
                                                                </h5>
                                                                <Badge className="bg-emerald-500 hover:bg-emerald-600 border-none text-white text-[10px]">{t('settings.terminalActiveBadge')}</Badge>
                                                            </div>
                                                            <p className="text-xs text-muted-foreground">{t('settings.terminalActiveBody')}</p>
                                                            <div className="grid grid-cols-2 gap-4 text-xs pt-2 font-mono border-b border-emerald-100/30 pb-2">
                                                                <div>
                                                                    <span className="text-slate-400 block">{t('settings.bankName')}</span>
                                                                    <span className="font-bold text-slate-800">{business.settings.terminalBankName || 'Wema Bank'}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-slate-400 block">{t('settings.accountNumber')}</span>
                                                                    <span className="font-bold text-slate-800">{business.settings.terminalAccountNumber}</span>
                                                                </div>
                                                                <div className="col-span-2">
                                                                    <span className="text-slate-400 block">{t('settings.accountName')}</span>
                                                                    <span className="font-bold text-slate-800">{business.settings.terminalAccountName || `Zeneva - ${business.name}`}</span>
                                                                </div>
                                                            </div>
                                                            <div className="pt-2 flex items-center justify-between border-t border-emerald-100/10">
                                                                <div className="text-[11px] text-emerald-600 leading-relaxed">
                                                                    {t('settings.terminalLiveMode')}
                                                                </div>
                                                                <Button
                                                                    type="button"
                                                                    variant="destructive"
                                                                    size="sm"
                                                                    onClick={handleDeactivateTerminal}
                                                                    disabled={isDeactivatingTerminal}
                                                                    className="text-xs h-7 px-3 flex items-center gap-1.5"
                                                                >
                                                                    {isDeactivatingTerminal ? (
                                                                        <>
                                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                                            {t('settings.terminalDeactivating')}
                                                                        </>
                                                                    ) : (
                                                                        t('settings.terminalDeactivate')
                                                                    )}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        business?.settings?.paymentBankAccountId && (
                                                            <div className="p-4 rounded-xl border border-orange-100 bg-orange-500/5 space-y-3 mt-4">
                                                                <div>
                                                                    <h5 className="font-semibold text-orange-800 text-sm flex items-center gap-1.5">
                                                                        <Banknote className="h-4 w-4 text-orange-600" />
                                                                        {t('settings.terminalActivateTitle')}
                                                                    </h5>
                                                                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                                                        {t('settings.terminalActivateBody')}
                                                                    </p>
                                                                </div>
                                                                {!(businessPhone || business?.settings?.phone) && (
                                                                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
                                                                        <span className="text-base mt-0.5">⚠️</span>
                                                                        <div className="text-xs leading-relaxed">
                                                                            {t('settings.terminalPhoneWarning')}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                <div className="flex flex-col gap-2 bg-muted/30 p-3 rounded-lg border border-dashed text-xs text-muted-foreground my-3">
                                                                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                                                                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                                                        {t('settings.feesTitle')}
                                                                    </div>
                                                                    <p>{t('settings.feesZeneva')}</p>
                                                                    <p>{t('settings.feesPaystack')}</p>
                                                                </div>
                                                                <Button
                                                                    type="button"
                                                                    onClick={handleActivateTerminal}
                                                                    disabled={isActivatingTerminal}
                                                                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium text-xs py-1.5 h-8 flex items-center justify-center gap-2"
                                                                >
                                                                    {isActivatingTerminal ? (
                                                                        <>
                                                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                            {t('settings.terminalActivating')}
                                                                        </>
                                                                    ) : (
                                                                        t('settings.terminalActivateTitle')
                                                                    )}
                                                                </Button>
                                                            </div>
                                                        )
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    </FeatureGate>
                                </>
                            )}
                        </CardContent>
                        <CardFooter>
                            <Button type="button" onClick={() => handleSettingsSubmit('financials', { "settings.currency": currency, "settings.timezone": timezone, "settings.defaultTaxRate": parseFloat(defaultTaxRate) || 0, "settings.paymentBankCode": paymentBankCode, 'settings.paymentBankName': NIGERIAN_BANKS.find(b => b.value === paymentBankCode)?.label || paymentBankCode || '', "settings.paymentBankAccountId": paymentBankAccountId, "settings.paymentAccountName": paymentAccountName, "settings.paymentInstructions": paymentInstructions })} disabled={isSaving["financials"]}>
                                {isSaving["financials"] && <Loader2 className="me-2 h-4 w-4 animate-spin" />}{t('settings.saveFinancials')}
                            </Button>
                        </CardFooter>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5 text-primary" />{t('settings.shippingTitle')}</CardTitle>
                            <CardDescription>{t('settings.shippingDescription')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {shippingOptions.map((option, index) => (
                                    <div key={index} className="flex items-center justify-between gap-2 p-3 border rounded-md bg-muted/50">
                                        <div>
                                            <p className="font-medium">{option.name}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {option.type === 'pickup' ? t('settings.shippingPickupAt', { location: option.location }) : t('settings.shippingDelivery')} - ₦{option.price.toLocaleString()}
                                            </p>
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={() => handleDeleteShippingOption(index)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                ))}
                                <div className="pt-4 border-t space-y-4">
                                    <Label>{t('settings.shippingAddNew')}</Label>
                                    <RadioGroup value={newShippingOption.type} onValueChange={(value: 'delivery' | 'pickup') => setNewShippingOption({ ...newShippingOption, type: value })} className="flex space-x-4">
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="delivery" id="delivery" />
                                            <Label htmlFor="delivery">{t('settings.shippingDelivery')}</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="pickup" id="pickup" />
                                            <Label htmlFor="pickup">{t('settings.shippingInStorePickup')}</Label>
                                        </div>
                                    </RadioGroup>
                                    <div className="flex items-end gap-2">
                                        <div className="flex-1"><Label>{t('settings.shippingOptionName')}</Label><Input placeholder={t('settings.shippingOptionNamePlaceholder')} value={newShippingOption.name} onChange={e => setNewShippingOption({ ...newShippingOption, name: e.target.value })} /></div>
                                        <div className="w-32"><Label>{t('common.price')}</Label><Input type="number" placeholder={t('settings.shippingPricePlaceholder')} value={newShippingOption.price} onChange={e => setNewShippingOption({ ...newShippingOption, price: e.target.value })} /></div>
                                    </div>
                                    {newShippingOption.type === 'pickup' && (
                                        <div className="space-y-2">
                                            <Label htmlFor="pickup-location">{t('settings.shippingPickupLocation')}</Label>
                                            <Input id="pickup-location" placeholder={t('settings.shippingPickupLocationPlaceholder')} value={newShippingOption.location} onChange={e => setNewShippingOption({ ...newShippingOption, location: e.target.value })} />
                                        </div>
                                    )}
                                    <Button type="button" onClick={handleAddShippingOption} className="w-full sm:w-auto"><Plus className="h-4 w-4 me-2" />{t('settings.shippingAddOption')}</Button>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button type="button" onClick={() => handleSettingsSubmit('shipping', { 'settings.publicStore.shippingOptions': shippingOptions })} disabled={isSaving["shipping"]}>
                                {isSaving["shipping"] && <Loader2 className="me-2 h-4 w-4 animate-spin" />}{t('settings.saveShipping')}
                            </Button>
                        </CardFooter>
                    </Card>

                </TabsContent>

                <TabsContent value="system" className="space-y-6 mt-0">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Building className="h-5 w-5 text-primary" />{t('settings.organizationTitle')}</CardTitle>
                            <CardDescription>{t('settings.organizationDescription')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div>
                                    <Label>{t('settings.industry')}</Label>
                                    <DropdownMenu modal={false}>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" className="w-full justify-between font-normal bg-background hover:bg-accent border border-input h-10 px-3 py-2 text-sm rounded-md">
                                                <span>{industry || t('settings.selectIndustry')}</span>
                                                <ChevronDown className="h-4 w-4 opacity-50 ms-2" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-60 overflow-y-auto bg-popover text-popover-foreground shadow-md rounded-md border p-1 z-50">
                                            {industries.map(i => (
                                                <DropdownMenuItem key={i} onClick={() => setIndustry(i)} className="cursor-pointer">
                                                    {i}
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                                <div>
                                    <Label>{t('settings.country')}</Label>
                                    <DropdownMenu modal={false}>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" className="w-full justify-between font-normal bg-background hover:bg-accent border border-input h-10 px-3 py-2 text-sm rounded-md">
                                                <span>{country || t('settings.selectCountry')}</span>
                                                <ChevronDown className="h-4 w-4 opacity-50 ms-2" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-60 overflow-y-auto bg-popover text-popover-foreground shadow-md rounded-md border p-1 z-50">
                                            {GLOBAL_COUNTRIES.map(c => (
                                                <DropdownMenuItem key={c} onClick={() => setCountry(c)} className="cursor-pointer">
                                                    {c}
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                                <div><Label>{t('settings.stateProvince')}</Label><Input value={state} onChange={e => setState(e.target.value)} /></div>
                                <div>
                                    <Label>{t('settings.fiscalYearStart')}</Label>
                                    <DropdownMenu modal={false}>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" className="w-full justify-between font-normal bg-background hover:bg-accent border border-input h-10 px-3 py-2 text-sm rounded-md">
                                                <span>{fiscalYearStart || t('settings.selectMonth')}</span>
                                                <ChevronDown className="h-4 w-4 opacity-50 ms-2" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-60 overflow-y-auto bg-popover text-popover-foreground shadow-md rounded-md border p-1 z-50">
                                            {months.map(m => (
                                                <DropdownMenuItem key={m} onClick={() => setFiscalYearStart(m)} className="cursor-pointer">
                                                    {m}
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button type="button" onClick={() => handleSettingsSubmit('organization', { 'settings.industry': industry, 'settings.state': state, 'settings.country': country, 'settings.fiscalYearStart': fiscalYearStart })} disabled={isSaving["organization"]}>
                                {isSaving["organization"] && <Loader2 className="me-2 h-4 w-4 animate-spin" />}{t('settings.saveOrganization')}
                            </Button>
                        </CardFooter>
                    </Card>


                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" />{t('settings.securityTitle')}</CardTitle>
                            <CardDescription>{t('settings.securityDescription')}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4">
                                {processedSessions.length === 0 ? (
                                    <div className="text-center py-6 text-muted-foreground">
                                        {t('settings.noSessions')}
                                    </div>
                                ) : (
                                    <>
                                        <div className="grid gap-4">
                                            {(showAllSessions ? processedSessions : processedSessions.slice(0, 3)).map((session) => {
                                                const currentSessionIdKey = `zeneva_session_id_${currentUserProfile?.id}`;
                                                const currentSessionId = typeof window !== 'undefined' ? sessionStorage.getItem(currentSessionIdKey) : null;
                                                const isCurrent = session.id === currentSessionId;

                                                return (
                                                    <div key={session.id} className={cn(
                                                        "flex items-center justify-between p-4 rounded-lg border transition-colors",
                                                        session.revoked ? "opacity-50 grayscale" : "bg-card",
                                                        isCurrent && "border-primary ring-1 ring-primary/20 shadow-sm"
                                                    )}>
                                                        <div className="flex items-center gap-4">
                                                            <div className={cn(
                                                                "p-2 rounded-full",
                                                                isCurrent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                                                            )}>
                                                                {getDeviceIcon(session.userAgent || '')}
                                                            </div>
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-medium">{formatUA(session.userAgent || 'Unknown')}</span>
                                                                    {isCurrent && <Badge variant="default" className="text-[10px] h-4 px-1">{t('settings.thisDevice')}</Badge>}
                                                                    {session.revoked && <Badge variant="destructive" className="text-[10px] h-4 px-1">{t('settings.revoked')}</Badge>}
                                                                </div>
                                                                <div className="text-xs text-muted-foreground flex flex-col sm:flex-row sm:items-center sm:gap-2">
                                                                    <span>{session.deviceInfo?.platform || t('settings.unknownOs')}</span>
                                                                    <span className="hidden sm:inline opacity-30">•</span>
                                                                    <span>{t('settings.lastActive', { when: session.lastSeen instanceof Timestamp ? formatDistanceToNow(session.lastSeen.toDate(), { addSuffix: true }) : t('settings.justNow') })}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {!session.revoked && !isCurrent && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="text-muted-foreground hover:text-destructive"
                                                                disabled={isRevoking[session.id]}
                                                                onClick={() => handleRevokeSession(session.id)}
                                                            >
                                                                {isRevoking[session.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                                                            </Button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {processedSessions.length > 3 && (
                                            <Button
                                                variant="outline"
                                                className="w-full mt-2 border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-200"
                                                onClick={() => setShowAllSessions(!showAllSessions)}
                                            >
                                                {showAllSessions ? (
                                                    <>{t('settings.showLess')}</>
                                                ) : (
                                                    <>{t('settings.showMore', { n: processedSessions.length - 3 })}</>
                                                )}
                                            </Button>
                                        )}
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Privacy & Data</CardTitle>
                            <CardDescription>Manage your data and privacy preferences.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-lg border p-4 gap-4">
                                <div className="space-y-0.5">
                                    <Label className="text-base text-stone-900">Data Export</Label>
                                    <p className="text-sm text-muted-foreground">Download a copy of your personal and business data.</p>
                                </div>
                                <Button onClick={handleExportData} disabled={isExporting} variant="outline" className="shrink-0 gap-2">
                                    {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                    {isExporting ? 'Sending Email...' : 'Export Data'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" />{t('settings.hoursTitle')}</CardTitle>
                            <CardDescription>{t('settings.hoursDescription')}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <Label className="text-base text-stone-900">{t('settings.hoursEnable')}</Label>
                                    <p className="text-sm text-muted-foreground">{t('settings.hoursEnableDescription')}</p>
                                </div>
                                <Switch checked={operatingHoursEnabled} onCheckedChange={setOperatingHoursEnabled} />
                            </div>

                            {operatingHoursEnabled && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label htmlFor="openTime">{t('settings.openingTime')}</Label>
                                            <Input
                                                id="openTime"
                                                type="time"
                                                value={openTime}
                                                onChange={e => setOpenTime(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="closeTime">{t('settings.closingTime')}</Label>
                                            <Input
                                                id="closeTime"
                                                type="time"
                                                value={closeTime}
                                                onChange={e => setCloseTime(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between rounded-lg border p-4 bg-orange-50/50 border-orange-100">
                                        <div className="space-y-0.5 pe-8">
                                            <Label className="text-base text-orange-900">{t('settings.hoursStrict')}</Label>
                                            <p className="text-sm text-orange-700/70">
                                                {t('settings.hoursStrictDescription')}
                                            </p>
                                        </div>
                                        <Switch checked={preventSalesOutsideHours} onCheckedChange={setPreventSalesOutsideHours} />
                                    </div>
                                </div>
                            )}
                        </CardContent>
                        <CardFooter>
                            <Button
                                type="button"
                                onClick={() => handleSettingsSubmit('operating-hours', {
                                    'settings.operatingHours': {
                                        enabled: operatingHoursEnabled,
                                        openTime,
                                        closeTime,
                                        preventSalesOutsideHours
                                    }
                                })}
                                disabled={isSaving["operating-hours"]}
                            >
                                {isSaving["operating-hours"] && <Loader2 className="me-2 h-4 w-4 animate-spin" />}{t('settings.saveHours')}
                            </Button>
                        </CardFooter>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Paintbrush className="h-5 w-5 text-primary" />Personalization</CardTitle>
                            <CardDescription>Personalize point of sale rules and checkout behavior.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <Label className="text-base text-stone-900">Allow Price Override at Checkout</Label>
                                    <p className="text-sm text-muted-foreground">When enabled, cashiers can click on a product price in the cart to negotiate and manually change the price for that specific sale.</p>
                                </div>
                                <Switch checked={allowPosPriceOverride} onCheckedChange={setAllowPosPriceOverride} />
                            </div>
                            
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <Label className="text-base text-stone-900">Allow Managers to View Cost Prices</Label>
                                    <p className="text-sm text-muted-foreground">When enabled, Managers can see inventory cost prices and calculate profit. If disabled, they only see selling prices.</p>
                                </div>
                                <Switch checked={allowManagerCostPriceView} onCheckedChange={setAllowManagerCostPriceView} />
                            </div>

                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <Label className="text-base text-stone-900">Require Admin Approval for Voids & Returns</Label>
                                    <p className="text-sm text-muted-foreground">When enabled, Cashiers and Managers cannot void sales or process returns without an Admin PIN.</p>
                                </div>
                                <Switch checked={requireAdminApprovalForVoids} onCheckedChange={setRequireAdminApprovalForVoids} />
                            </div>

                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <Label className="text-base text-stone-900">Allow Cashiers to Log Expenses</Label>
                                    <p className="text-sm text-muted-foreground">When enabled, Cashiers can log small daily operational expenses. When disabled, only Managers and Admins can.</p>
                                </div>
                                <Switch checked={allowCashierExpenseLogging} onCheckedChange={setAllowCashierExpenseLogging} />
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button
                                type="button"
                                onClick={() => handleSettingsSubmit('pos', {
                                    'settings.allowPosPriceOverride': allowPosPriceOverride,
                                    'settings.allowCashierExpenseLogging': allowCashierExpenseLogging,
                                    'settings.allowManagerCostPriceView': allowManagerCostPriceView,
                                    'settings.requireAdminApprovalForVoids': requireAdminApprovalForVoids
                                })}
                                disabled={isSaving["pos"]}
                            >
                                {isSaving["pos"] && <Loader2 className="me-2 h-4 w-4 animate-spin" />}{t('common.save')}
                            </Button>
                        </CardFooter>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" />{t('settings.kycTitle')}</CardTitle>
                            <CardDescription>{t('settings.kycDescription')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                                    <div className={`p-2 rounded-full ${business?.settings?.kycStatus === 'verified' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                        <ShieldCheck className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm">{business?.settings?.kycStatus === 'verified' ? t('settings.kycStatusVerified') : t('settings.kycStatusUnverified')}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {business?.settings?.kycStatus === 'verified'
                                                ? t('settings.kycVerifiedBody')
                                                : t('settings.kycUnverifiedBody')}
                                        </p>
                                    </div>
                                </div>

                                {business?.settings?.kycStatus !== 'verified' && (
                                    <div className="space-y-2 pt-2">
                                        <Label htmlFor="bvn">{t('settings.bvnLabel')}</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                id="bvn"
                                                type="text"
                                                maxLength={11}
                                                placeholder={t('settings.bvnPlaceholder')}
                                                value={bvn}
                                                onChange={(e) => setBvn(e.target.value.replace(/\D/g, ''))}
                                            />
                                            <Button
                                                type="button"
                                                onClick={handleVerifyBvn}
                                                disabled={isVerifyingBvn || bvn.length !== 11}
                                            >
                                                {isVerifyingBvn ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : null}
                                                {t('settings.verifyBvn')}
                                            </Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {t('settings.bvnHint')}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {isNative && (
                        <Card className="border-border/15 dark:border-border/25 shadow-none hover:shadow-sm transition-shadow">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Monitor className="h-5 w-5 text-primary" />
                                    {t('settings.updatesTitle')}
                                </CardTitle>
                                <CardDescription>
                                    {t('settings.updatesDescription')}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between p-4 rounded-lg border bg-background">
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium">{t('settings.currentVersion')}</p>
                                        <p className="text-2xl font-bold text-primary">v{currentVersion}</p>
                                    </div>
                                    <Button
                                        onClick={handleCheckUpdates}
                                        disabled={isCheckingUpdates}
                                        variant="outline"
                                        className="border-primary text-primary hover:bg-primary hover:text-white"
                                    >
                                        {isCheckingUpdates ? (
                                            <Loader2 className="me-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <RefreshCw className="me-2 h-4 w-4" />
                                        )}
                                        {t('settings.checkUpdates')}
                                    </Button>
                                </div>
                            </CardContent>
                            <CardFooter>
                                <p className="text-xs text-muted-foreground italic">
                                    {t('settings.updatesNote')}
                                </p>
                            </CardFooter>
                        </Card>
                    )}

                </TabsContent>
            </Tabs>
        </div>
    );
}


export default function SettingsPage() {
    const { isLoading: isPosLoading, business } = usePOS();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted || (isPosLoading && !business)) {
        return <SettingsPageSkeleton />;
    }
    return <SettingsPageContent />;
}
