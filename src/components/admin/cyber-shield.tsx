'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
    CardFooter,
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { 
    ShieldAlert, 
    ShieldCheck, 
    Lock, 
    Zap, 
    Fingerprint, 
    Terminal, 
    AlertCircle,
    Activity,
    Shield,
    XCircle,
    UserMinus,
    Search,
    RefreshCw,
    Smartphone,
    CheckCircle2,
    Eye,
    Globe,
    Trash2,
    Database,
    Users,
    Package,
    Cpu,
    Radio,
    ArrowRight,
    Server,
    Signal,
    Crosshair,
    Radar
} from 'lucide-react';
import { deleteBusinessUsersAuth, revokeUserSessions } from '@/actions/admin-actions';
import { idToken } from '@/lib/id-token';
import {
    detectEntitlementAbuse,
    detectIdentityAnomalies,
    detectDataIntegrityAnomalies,
    detectPostureIssues,
    healthScore,
    postureLevel,
    type Threat,
    type Severity,
} from '@/lib/threat-rules';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { 
    multiFactor,
    PhoneAuthProvider,
    PhoneMultiFactorGenerator,
    RecaptchaVerifier
} from 'firebase/auth';
import { 
    getCountFromServer,
    collectionGroup, 
    query, 
    orderBy, 
    limit, 
    getDocs,
    getDoc,
    collection,
    doc,
    updateDoc,
    addDoc,
    deleteDoc,
    writeBatch,
    where,
    serverTimestamp
} from 'firebase/firestore';
import { format, formatDistanceToNow, subHours, subMinutes } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// --- Sub-components for Situation Awareness ---

const ScanningEffect = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-5">
        <motion.div 
            initial={{ y: "-100%" }}
            animate={{ y: "200%" }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="h-1/2 w-full bg-gradient-to-b from-transparent via-primary/30 to-transparent"
        />
    </div>
);

const RadarPulse = () => (
    <div className="relative w-16 h-16 flex items-center justify-center">
        <motion.div 
            animate={{ scale: [1, 2], opacity: [0.3, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 bg-primary/20 rounded-full"
        />
        <div className="relative z-10 p-2 bg-background rounded-full border border-primary/10 shadow-sm">
            <Radar className="h-6 w-6 text-primary animate-spin-slow" />
        </div>
    </div>
);

const SecurityMetric = ({ label, value, subValue, icon: Icon, colorClass, borderClass, onClick }: any) => (
    <Card 
        className={cn("relative overflow-hidden group hover:shadow-md transition-all border-border/50", borderClass)}
        onClick={onClick}
    >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
                {label}
            </CardTitle>
            <Icon className={cn("h-4 w-4", colorClass)} />
        </CardHeader>
        <CardContent>
            <div className={cn("text-2xl font-bold", colorClass)}>
                {value}
            </div>
            {subValue && (
                <p className="text-xs text-muted-foreground mt-1">
                    {subValue}
                </p>
            )}
        </CardContent>
    </Card>
);
export default function CyberShield({ allBusinesses, allUsers, isLoadingBusinesses }: { allBusinesses: any[] | null, allUsers: any[] | null, isLoadingBusinesses: boolean }) {
    const { firestore, auth, user: authUser } = useFirebase();
    const { toast } = useToast();
    const [isRevoking, setIsRevoking] = useState<string | null>(null);
    const [searchBusiness, setSearchBusiness] = useState('');

    // Entity Termination State
    const [isDestructionModalOpen, setIsDestructionModalOpen] = useState(false);
    const [destructionEmail, setDestructionEmail] = useState('');
    const [destructionId, setDestructionId] = useState('');
    const [targetStats, setTargetStats] = useState<{ products: number; customers: number; sizeKB: number } | null>(null);
    const [isLoadingStats, setIsLoadingStats] = useState(false);

    // Sales Wipe State
    const [isWipeSalesModalOpen, setIsWipeSalesModalOpen] = useState(false);
    const [wipeSalesId, setWipeSalesId] = useState('');
    const [wipeSalesName, setWipeSalesName] = useState('');
    const [hasConfirmedWipe, setHasConfirmedWipe] = useState(false);

    const fetchTargetStats = async (businessId: string) => {
        if (!firestore) return;
        setIsLoadingStats(true);
        setTargetStats(null);
        try {
            const collections = ['products', 'customers', 'receipts', 'purchases', 'expenses', 'inventory_logs'];
            let totalDocs = 0;
            let productCount = 0;
            let customerCount = 0;

            for (const collName of collections) {
                const q = query(collection(firestore, collName), where("businessId", "==", businessId));
                const snapshot = await getCountFromServer(q);
                const count = snapshot.data().count;
                totalDocs += count;
                if (collName === 'products') productCount = count;
                if (collName === 'customers') customerCount = count;
            }

            // Rough estimate: 0.8KB per document
            const sizeKB = Math.max(1, Math.round(totalDocs * 0.8));
            
            setTargetStats({
                products: productCount,
                customers: customerCount,
                sizeKB
            });
        } catch (err) {
            console.error("Footprint scan failed:", err);
        } finally {
            setIsLoadingStats(false);
        }
    };
    const [hasConfirmedDestruction, setHasConfirmedDestruction] = useState(false);
    const [isDestroying, setIsDestroying] = useState(false);
    const [destructionProgress, setDestructionProgress] = useState(0);
    const [destructionStatus, setDestructionStatus] = useState('');
    /** Firestore purged but the Firebase Auth accounts survived — they can still sign in. */
    const [authCleanupSkipped, setAuthCleanupSkipped] = useState(false);


    // MFA Enrollment State
    const [isMfaModalOpen, setIsMfaModalOpen] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [verificationId, setVerificationId] = useState<string | null>(null);
    const [mfaStep, setMfaStep] = useState<'phone' | 'code'>('phone');
    const [isEnrolling, setIsEnrolling] = useState(false);
    const recaptchaRef = useRef<any>(null);

    // Fetch REAL system state
    // Users are now passed as props

    const adminCount = useMemo(() => allUsers?.filter(u => u.role === 'admin' || u.role === 'manager').length || 0, [allUsers]);

    const mfaStatus = useMemo(() => {
        if (!authUser) return { enabled: false, color: 'text-rose-600', bg: 'bg-rose-600' };
        const enrolled = (authUser as any).multiFactor?.enrolledFactors?.length > 0;
        return {
            enabled: enrolled,
            color: enrolled ? 'text-emerald-600' : 'text-rose-600',
            bg: enrolled ? 'bg-emerald-600' : 'bg-rose-600',
            label: enrolled ? 'Secure' : 'Unprotected'
        };
    }, [authUser]);

    // Termination logs remain local to CyberShield

    const logsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'terminationLogs'), orderBy('terminatedAt', 'desc'), limit(10)) : null, [firestore]);
    const { data: terminationLogs } = useCollection<any>(logsQuery);

    // Receipt feed for the integrity rules (R3). Capped at 200 and ordered
    // newest-first: tampering shows up in fresh writes, and an unbounded read
    // across every tenant is a bill, not a feature. `receipts` is top-level, so
    // this is a plain ordered query on the default single-field index — no
    // composite index required.
    const receiptsQuery = useMemoFirebase(
        () => firestore
            ? query(collection(firestore, 'receipts'), orderBy('createdAt', 'desc'), limit(200))
            : null,
        [firestore],
    );
    const { data: recentReceipts } = useCollection<any>(receiptsQuery);

    const filteredBusinesses = useMemo(() => {
        if (!allBusinesses) return [];
        let result = allBusinesses.filter(b => {
            const searchLower = searchBusiness.trim().toLowerCase();
            if (!searchLower) return true;
            return (
                (b.name || '').toLowerCase().includes(searchLower) || 
                (b.email || '').toLowerCase().includes(searchLower) ||
                (b.id || '').toLowerCase().includes(searchLower) ||
                (b.settings?.email || '').toLowerCase().includes(searchLower)
            );
        });

        // Sort by createdAt descending (newest first)
        return [...result].sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
            return dateB - dateA;
        });
    }, [allBusinesses, searchBusiness]);

    const [directLookupId, setDirectLookupId] = useState('');
    const handleDirectLookup = async () => {
        const lookupId = directLookupId.trim();
        if (!lookupId || !allBusinesses) return;
        
        // 1. Try to find by business fields directly (ID, Email, Settings Email)
        let target = allBusinesses.find(b => 
            b.id === lookupId || 
            (b.email || '').toLowerCase() === lookupId.toLowerCase() ||
            (b.settings?.email || '').toLowerCase() === lookupId.toLowerCase()
        );

        // 2. Fallback: Find by Owner Email (searching across users)
        if (!target && allUsers) {
            const ownerMatch = allUsers.find(u => (u.email || '').toLowerCase() === lookupId.toLowerCase());
            if (ownerMatch && ownerMatch.businessId) {
                target = allBusinesses.find(b => b.id === ownerMatch.businessId);
            }
        }

        if (target) {
            setDestructionEmail(target.email || target.settings?.email || lookupId);
            setDestructionId(target.id);
            setIsDestructionModalOpen(true);
            fetchTargetStats(target.id);
            setDirectLookupId('');
        } else {
            toast({ variant: 'destructive', title: "Lookup Failed", description: "No entity or owner found with that identifier." });
        }
    };

    const handleSendCode = async () => {
        if (!auth || !authUser || !phoneNumber) return;
        setIsEnrolling(true);
        try {
            if (!recaptchaRef.current) {
                recaptchaRef.current = new RecaptchaVerifier(auth, 'recaptcha-admin-container', {
                    'size': 'invisible'
                });
            }
            const session = await multiFactor(authUser).getSession();
            const phoneInfoOptions = { phoneNumber, session };
            const phoneAuthProvider = new PhoneAuthProvider(auth);
            const vId = await phoneAuthProvider.verifyPhoneNumber(phoneInfoOptions, recaptchaRef.current);
            setVerificationId(vId);
            setMfaStep('code');
            toast({ title: "Verification Initiated", description: "SMS gateway triggered." });
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Shield Breach", description: error.message });
        } finally {
            setIsEnrolling(false);
        }
    };

    const handleVerifyAndEnroll = async () => {
        if (!authUser || !verificationId || !verificationCode) return;
        setIsEnrolling(true);
        try {
            const cred = PhoneAuthProvider.credential(verificationId, verificationCode);
            const assertion = PhoneMultiFactorGenerator.assertion(cred);
            await multiFactor(authUser).enroll(assertion, "Primary Hardware Node");
            setIsMfaModalOpen(false);
            toast({ title: "Lockdown Protocol Active", description: "Account tethered to hardware factor." });
            setTimeout(() => window.location.reload(), 1500);
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Core Rejection", description: "Verification signature invalid." });
        } finally {
            setIsEnrolling(false);
        }
    };

    const handleDeleteLog = async (logId: string) => {
        if (!firestore || !window.confirm('Are you sure you want to PERMANENTLY remove this record from the archive?')) return;
        try {
            await deleteDoc(doc(firestore, 'terminationLogs', logId));
            toast({ title: "Log Purged", description: "Termination record has been removed from the archive." });
        } catch (err) {
            toast({ variant: "destructive", title: "Action Failed", description: "Failed to remove the log record." });
        }
    };

    const handleHardKill = async (userId: string, userName: string) => {
        if (!firestore || !window.confirm(`TERMINATE access for ${userName}? This will sever all active neural links.`)) return;
        setIsRevoking(userId);
        try {
            const userRef = doc(firestore, 'users', userId);
            await updateDoc(userRef, { 
                status: 'suspended',
                suspendedAt: serverTimestamp(),
                suspendedBy: 'SOC_PRIME'
            });
            toast({ title: "Target Neutered", description: "System access revoked. Node offline.", className: "bg-red-600 text-white border-none" });
        } catch (err) {
            toast({ variant: "destructive", title: "Kill Command Failed", description: "Security override insufficient." });
        } finally {
            setIsRevoking(null);
        }
    };

    const [isWipingSales, setIsWipingSales] = useState<string | null>(null);
    const handleWipeSales = async () => {
        if (!firestore || !wipeSalesId) return;
        if (!hasConfirmedWipe) {
            toast({ variant: 'destructive', title: "Confirmation Required", description: "Please acknowledge the destructive nature of this action." });
            return;
        }
        
        setIsWipingSales(wipeSalesId);
        setIsWipeSalesModalOpen(false);
        toast({ title: "Wipe Started", description: `Purging sales documents for ${wipeSalesName}...` });
        
        try {
            const receiptsRef = collection(firestore, 'receipts');
            const q = query(receiptsRef, where("businessId", "==", wipeSalesId));
            const snap = await getDocs(q);

            if (!snap.empty) {
                const chunks = [];
                for (let i = 0; i < snap.docs.length; i += 450) {
                    chunks.push(snap.docs.slice(i, i + 450));
                }
                for (const chunk of chunks) {
                    const batch = writeBatch(firestore);
                    chunk.forEach(d => batch.delete(d.ref));
                    await batch.commit();
                }
                toast({ 
                    title: "Wipe Complete", 
                    description: `Successfully deleted ${snap.docs.length} receipts for "${wipeSalesName}".`,
                    className: "bg-black text-emerald-500 border-emerald-500/50 font-mono"
                });
            } else {
                toast({ title: "Wipe Complete", description: `No receipts found for "${wipeSalesName}".` });
            }
        } catch (error: any) {
            console.error("Sales wipe failed:", error);
            toast({ 
                variant: 'destructive', 
                title: "Wipe Aborted", 
                description: error.message || "Unknown error during sales wipe." 
            });
        } finally {
            setIsWipingSales(null);
            setHasConfirmedWipe(false);
            setWipeSalesId('');
            setWipeSalesName('');
        }
    };

    const handleEntityTermination = async () => {
        if (!firestore || !authUser) return;
        
        const targetEmail = (destructionEmail || "").trim();
        
        if (!hasConfirmedDestruction) {
            toast({ variant: 'destructive', title: "Confirmation Required", description: "Please acknowledge the destructive nature of this action." });
            return;
        }

        if (!destructionId) {
            toast({ variant: 'destructive', title: "Target Missing", description: "No entity selected for termination." });
            return;
        }

        setIsDestroying(true);
        setDestructionProgress(5);
        setDestructionStatus('Locating entity in grid...');
        // Reset per-run, or one failed cleanup would flag every later purge.
        setAuthCleanupSkipped(false);
        // Local mirror: React state set later in this same async run is not readable
        // from this closure, so the completion branch has to consult the local.
        let authSkipped = false;

        try {
            // 1. Target the business instance directly
            const businessRef = doc(firestore, 'businessInstances', destructionId);
            const businessSnap = await getDoc(businessRef);

            if (!businessSnap.exists()) {
                throw new Error("Entity not found in current grid. Node ID may be invalid.");
            }

            const businessId = businessSnap.id;
            const businessData = businessSnap.data();

            setDestructionProgress(15);
            setDestructionStatus(`Target Locked: ${businessData.name || 'Unnamed'}. Initializing wipe...`);

            // Collections to purge
            const collectionsToPurge = [
                'products',
                'receipts',
                'customers',
                'purchases',
                'expenses',
                'suppliers',
                'inventory_logs',
                'notifications', // Top level notifications if any
            ];

            let completedSteps = 0;
            const totalSteps = collectionsToPurge.length + 4; // + users + sub-business + audit + final

            // 1. Purge standard top-level collections
            for (const collName of collectionsToPurge) {
                setDestructionStatus(`Purging ${collName} nodes...`);
                const collRef = collection(firestore, collName);
                const q = query(collRef, where("businessId", "==", businessId));
                const snap = await getDocs(q);

                if (!snap.empty) {
                    const chunks = [];
                    for (let i = 0; i < snap.docs.length; i += 450) {
                        chunks.push(snap.docs.slice(i, i + 450));
                    }
                    for (const chunk of chunks) {
                        const batch = writeBatch(firestore);
                        chunk.forEach(d => batch.delete(d.ref));
                        await batch.commit();
                    }
                }
                completedSteps++;
                setDestructionProgress(15 + (completedSteps / totalSteps) * 80);
            }

            // 2. Purge Users and their subcollections
            setDestructionStatus('Purging user identities and sub-nodes...');
            const usersRef = collection(firestore, 'users');
            const usersQuery = query(usersRef, where("businessId", "==", businessId));
            const usersSnap = await getDocs(usersQuery);

            if (!usersSnap.empty) {
                const uids = usersSnap.docs.map(d => d.id);
                setDestructionStatus('Deauthorizing user identities (Auth Cleanup)...');
                try {
                    await deleteBusinessUsersAuth(uids, await idToken());
                } catch (authErr) {
                    // Deliberately continues: a Firestore user with no Auth record is a
                    // normal state, so a failure here must not abort the purge. But it
                    // must not be silent either — in the Tauri app this call is a stub
                    // that always throws, which would otherwise leave orphaned Auth
                    // accounts that can still sign in, with nothing on screen saying so.
                    console.error("Auth deauthorization partial failure:", authErr);
                    authSkipped = true;
                    setAuthCleanupSkipped(true);
                }

                for (const userDoc of usersSnap.docs) {
                    const userId = userDoc.id;
                    // Purge user notifications
                    const userNotifsRef = collection(firestore, 'users', userId, 'notifications');
                    const notifsSnap = await getDocs(userNotifsRef);
                    if (!notifsSnap.empty) {
                        const batch = writeBatch(firestore);
                        notifsSnap.forEach(d => batch.delete(d.ref));
                        await batch.commit();
                    }
                    // Delete user doc
                    await deleteDoc(userDoc.ref);
                }
            }
            completedSteps++;
            setDestructionProgress(15 + (completedSteps / totalSteps) * 80);

            // 3. Purge Business Subcollections (Stats, OnlineOrders, AuditLogs)
            setDestructionStatus('Sanitizing business sub-architectures...');
            const subCollections = ['stats', 'onlineOrders', 'auditLogs', 'expenses', 'suppliers'];
            for (const sub of subCollections) {
                const subRef = collection(firestore, 'businessInstances', businessId, sub);
                const subSnap = await getDocs(subRef);
                if (!subSnap.empty) {
                    const chunks = [];
                    for (let i = 0; i < subSnap.docs.length; i += 450) {
                        chunks.push(subSnap.docs.slice(i, i + 450));
                    }
                    for (const chunk of chunks) {
                        const batch = writeBatch(firestore);
                        chunk.forEach(d => batch.delete(d.ref));
                        await batch.commit();
                    }
                }
            }
            completedSteps++;
            setDestructionProgress(15 + (completedSteps / totalSteps) * 80);

            // Finally, delete the business document
            setDestructionStatus('Finalizing sanitization...');
            await deleteDoc(doc(firestore, 'businessInstances', businessId));
            
            setDestructionProgress(95);
            setDestructionStatus('Recording termination in permanent logs...');
            try {
                await addDoc(collection(firestore, 'terminationLogs'), {
                    businessId: businessId,
                    name: businessData.name || 'Unnamed',
                    email: businessData.email || destructionEmail || "N/A",
                    terminatedAt: serverTimestamp(),
                    terminatedBy: authUser?.email,
                    stats: targetStats || { products: 0, customers: 0, sizeKB: 0 }
                });
            } catch (logErr) {
                console.error("Failed to write termination log:", logErr);
            }

            setDestructionProgress(100);
            setDestructionStatus(authSkipped ? 'Entity Terminated — Auth accounts remain' : 'Entity Terminated');

            toast(authSkipped
                ? {
                    variant: 'destructive',
                    title: "Purged, but Auth accounts survived",
                    description: "Firestore data is gone, but the Firebase Auth logins could not be deleted and can still sign in. Finish this from the web admin panel at zeneva.space.",
                    duration: 12000,
                }
                : {
                    title: "Destruction Complete",
                    description: "Business and all associated nodes have been scrubbed from the grid.",
                    className: "bg-black text-emerald-500 border-emerald-500/50 font-mono"
                });

            // Log the destruction to a special global log if possible
            try {
                await updateDoc(doc(firestore, 'system_stats', 'global'), {
                    lastDestruction: serverTimestamp(),
                    lastDestroyedEmail: destructionEmail
                });
            } catch (e) {
                // Ignore if system_stats doesn't exist or permissions fail
            }

            setTimeout(() => {
                setIsDestructionModalOpen(false);
                setDestructionEmail('');
                setDestructionId('');
                setHasConfirmedDestruction(false);
                setIsDestroying(false);
                setDestructionProgress(0);
            }, 2000);

        } catch (error: any) {
            console.warn("Termination aborted (handled):", error.message);
            toast({ 
                variant: 'destructive', 
                title: "Termination Aborted", 
                description: error.message || "Unknown error during purge." 
            });
            setIsDestroying(false);
            setDestructionProgress(0);
        }
    };

    // ── Live threat detection ────────────────────────────────────────────────
    //
    // The old score was theatre: three hard-coded numbers keyed off a suspended
    // count, so the board read "OPTIMAL 94%" while an account sat on a
    // self-issued lifetime plan. Everything below is derived from the data the
    // admin panel has already loaded, so a real finding moves the number.
    //
    // Product and staff counts are the one thing the props do not carry. They
    // are counted with aggregation queries (`getCountFromServer`), billed at one
    // read per query rather than one per document, and only for businesses on a
    // capped plan — the owner pays for every read (see MEMORY).

    const [capCounts, setCapCounts] = useState<{
        products: Record<string, number>;
        staff: Record<string, number>;
        paidBusinessIds: Set<string> | null;
        scannedAt: Date | null;
    }>({ products: {}, staff: {}, paidBusinessIds: null, scannedAt: null });
    const [isScanning, setIsScanning] = useState(false);
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());

    const staffCounts = useMemo(() => {
        // Derivable from props at no cost.
        const counts: Record<string, number> = {};
        for (const u of allUsers || []) {
            if (!u.businessId) continue;
            counts[u.businessId] = (counts[u.businessId] || 0) + 1;
        }
        return counts;
    }, [allUsers]);

    const runDeepScan = async () => {
        if (!firestore || !allBusinesses) return;
        setIsScanning(true);
        try {
            const products: Record<string, number> = {};
            // Only capped plans can be over a cap, so Business/lifetime tenants
            // are skipped entirely rather than counted and discarded.
            const capped = allBusinesses.filter(b => {
                if (b.accessLevel === 'lifetime') return false;
                return b.plan !== 'business';
            });

            for (const b of capped) {
                try {
                    const snap = await getCountFromServer(
                        query(collection(firestore, 'products'), where('businessId', '==', b.id)),
                    );
                    products[b.id] = snap.data().count;
                } catch {
                    // A single failed count must not abort the whole sweep.
                }
            }

            // Every business with a payment on record. One full read of
            // `purchases` per scan, which is small and only on demand — it is
            // what lets R1 tell a real customer from a self-written plan field.
            const paidBusinessIds = new Set<string>();
            try {
                const purchaseSnap = await getDocs(collection(firestore, 'purchases'));
                purchaseSnap.forEach(d => {
                    const bid = d.data()?.businessId;
                    if (bid) paidBusinessIds.add(bid);
                });
            } catch {
                // Leave the set empty rather than failing the scan; the rule
                // below would then over-report, so bail out of it instead.
            }

            setCapCounts({
                products,
                staff: staffCounts,
                paidBusinessIds: paidBusinessIds.size > 0 ? paidBusinessIds : null,
                scannedAt: new Date(),
            });
            toast({
                title: 'Deep scan complete',
                description: `${capped.length} capped ${capped.length === 1 ? 'entity' : 'entities'} checked against plan limits.`,
            });
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Scan failed', description: err?.message || 'Unknown error.' });
        } finally {
            setIsScanning(false);
        }
    };

    const threats = useMemo<Threat[]>(() => {
        const found: Threat[] = [
            ...detectEntitlementAbuse(allBusinesses || [], capCounts.products, staffCounts, capCounts.paidBusinessIds),
            ...detectIdentityAnomalies(allUsers || [], allBusinesses || []),
            ...detectDataIntegrityAnomalies(recentReceipts || []),
            ...detectPostureIssues({
                mfaEnabled: mfaStatus.enabled,
                suspendedCount: allUsers?.filter(u => u.status === 'suspended').length || 0,
                totalUsers: allUsers?.length || 0,
            }),
        ];
        const order: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        return found
            .filter(t => !dismissed.has(t.id))
            .sort((a, b) => order[a.severity] - order[b.severity]);
    }, [allBusinesses, allUsers, recentReceipts, capCounts, staffCounts, mfaStatus.enabled, dismissed]);

    const criticalCount = threats.filter(t => t.severity === 'critical').length;

    const securityMatrix = useMemo(() => {
        const score = healthScore(threats);
        const { level, tone } = postureLevel(score);
        const color =
            tone === 'ok' ? 'text-emerald-600'
            : tone === 'medium' ? 'text-amber-600'
            : 'text-rose-600';
        return { level, score, color };
    }, [threats]);

    const handleRevokeSessions = async (userId: string, who: string) => {
        if (!window.confirm(`Revoke every active session for ${who}? They will be signed out on all devices.`)) return;
        setIsRevoking(userId);
        try {
            await revokeUserSessions(userId, await idToken());
            toast({ title: 'Sessions revoked', description: `${who} has been signed out everywhere.` });
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Revoke failed', description: err?.message || 'Unknown error.' });
        } finally {
            setIsRevoking(null);
        }
    };

    return (
        <div className="space-y-6 relative overflow-hidden">
            {/* Subtle Grid Background */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
            
            <div id="recaptcha-admin-container"></div>
            
            {/* Top Bar - Security Overview Header */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 relative z-10 border-b pb-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <h1 className="text-base font-bold tracking-tight text-foreground/90">Cyber Shield Security</h1>
                    </div>
                    <p className="text-[11px] font-medium text-muted-foreground">
                        Platform Security Monitoring & Management Hub | {allBusinesses?.length || 0} Entities Tracked
                    </p>
                </div>
                
                <div className="flex items-center gap-6">
                    <div className="flex flex-col items-end">
                        <span className="text-[9px] font-bold text-muted-foreground mb-1">Link Integrity</span>
                        <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className={cn("h-3 w-1 rounded-sm", i <= 4 ? "bg-emerald-500/40" : "bg-muted")} />
                            ))}
                        </div>
                    </div>
                    <div className="flex flex-col items-end border-l pl-6">
                        <span className="text-[9px] font-bold text-muted-foreground mb-1">Network Uptime</span>
                        <span className="text-xs font-bold font-mono">99.9%</span>
                    </div>
                </div>
            </div>

            {/* Main Situational Display */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 relative z-10">
                
                {/* Health Core */}
                <Card className="lg:col-span-1 border-border/50 relative overflow-hidden flex flex-col items-center justify-center p-8 bg-white/50 backdrop-blur-sm">
                    <ScanningEffect />
                    <RadarPulse />
                    <div className="mt-6 text-center">
                        <p className="text-[10px] font-bold text-muted-foreground mb-1">System Health</p>
                        <div className={cn("text-5xl font-bold tracking-tighter", securityMatrix.color)}>
                            {securityMatrix.score}%
                        </div>
                        <Badge variant="secondary" className="mt-3 font-bold text-[10px] tracking-tight">
                            {securityMatrix.level}
                        </Badge>
                    </div>
                    <div className="w-full space-y-2 mt-8">
                        <div className="flex justify-between text-[9px] font-bold text-muted-foreground">
                            <span>Threat Density</span>
                            <span>
                                {threats.length === 0
                                    ? 'Clear'
                                    : `${threats.length} open${criticalCount > 0 ? ` · ${criticalCount} critical` : ''}`}
                            </span>
                        </div>
                        <Progress
                            value={100 - securityMatrix.score}
                            className="h-1 bg-muted"
                            indicatorClassName={cn(
                                criticalCount > 0 ? 'bg-rose-600'
                                : threats.length > 0 ? 'bg-amber-500'
                                : 'bg-emerald-600',
                            )}
                        />
                    </div>
                </Card>

                {/* Surveillance Metrics Grid */}
                <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <SecurityMetric 
                        label="Surface Nodes" 
                        value={`${adminCount} Admins`}
                        subValue="Verified entry protocols active"
                        icon={Cpu}
                        colorClass="text-blue-600"
                    />
                    <SecurityMetric 
                        label="Encryption" 
                        value="AES-256"
                        subValue="End-to-end verified"
                        icon={Lock}
                        colorClass="text-purple-600"
                    />
                    <SecurityMetric 
                        label="Identity State" 
                        value={mfaStatus.label}
                        subValue={mfaStatus.enabled ? "Secure Link: Active" : "Action Required"}
                        icon={Fingerprint}
                        colorClass={mfaStatus.color}
                        borderClass={!mfaStatus.enabled ? "border-rose-500/20 shadow-rose-100 shadow-sm animate-pulse cursor-pointer" : ""}
                        onClick={() => !mfaStatus.enabled && setIsMfaModalOpen(true)}
                    />
                    
                    {/* Live Threat Board — real findings, not a status animation */}
                    <Card className="md:col-span-3 border-border/50 bg-white/50 backdrop-blur-sm">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 border-b">
                            <div className="flex items-center gap-2">
                                <Crosshair className={cn(
                                    "h-3.5 w-3.5",
                                    criticalCount > 0 ? "text-rose-600 animate-pulse" : "text-emerald-500",
                                )} />
                                <span className="text-[11px] font-bold text-foreground/90">Threat Board</span>
                                {threats.length > 0 && (
                                    <Badge variant={criticalCount > 0 ? 'destructive' : 'outline'} className="h-4 px-1.5 text-[9px] font-bold">
                                        {threats.length}
                                    </Badge>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {capCounts.scannedAt && (
                                    <span className="text-[9px] text-muted-foreground font-medium">
                                        Plan limits checked {formatDistanceToNow(capCounts.scannedAt, { addSuffix: true })}
                                    </span>
                                )}
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-[10px] font-bold"
                                    onClick={runDeepScan}
                                    disabled={isScanning || !allBusinesses}
                                >
                                    {isScanning
                                        ? <><RefreshCw className="h-3 w-3 mr-1.5 animate-spin" />Scanning</>
                                        : <><Radar className="h-3 w-3 mr-1.5" />Deep scan</>}
                                </Button>
                            </div>
                        </div>

                        {threats.length === 0 ? (
                            <div className="flex items-center gap-3 p-6">
                                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                                <div>
                                    <p className="text-xs font-bold text-foreground/90">No anomalies detected</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                        Entitlements, roles and recent sales all consistent.
                                        {!capCounts.scannedAt && ' Run a deep scan to include plan-limit checks.'}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="max-h-[340px] overflow-y-auto divide-y">
                                {threats.map(t => (
                                    <div key={t.id} className="p-3 hover:bg-muted/40 transition-colors">
                                        <div className="flex items-start gap-3">
                                            <Badge
                                                variant={t.severity === 'critical' ? 'destructive' : 'outline'}
                                                className={cn(
                                                    "h-4 px-1.5 text-[8px] font-bold uppercase shrink-0 mt-0.5",
                                                    t.severity === 'high' && "border-orange-500/40 text-orange-700 bg-orange-50",
                                                    t.severity === 'medium' && "border-amber-500/40 text-amber-700 bg-amber-50",
                                                    t.severity === 'low' && "border-border text-muted-foreground",
                                                )}
                                            >
                                                {t.severity}
                                            </Badge>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-baseline gap-2 flex-wrap">
                                                    <p className="text-[11px] font-bold text-foreground/90">{t.title}</p>
                                                    <span className="text-[9px] font-mono text-muted-foreground/60">{t.rule}</span>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground mt-0.5">{t.detail}</p>
                                                <p className="text-[10px] text-foreground/70 mt-1">
                                                    <span className="font-bold">{t.subject}</span>
                                                    {t.businessId && (
                                                        <span className="font-mono text-muted-foreground/50 ml-1.5">
                                                            {t.businessId.slice(0, 8)}
                                                        </span>
                                                    )}
                                                </p>
                                                <p className="text-[10px] text-primary/80 mt-1.5 flex items-start gap-1">
                                                    <ArrowRight className="h-2.5 w-2.5 mt-0.5 shrink-0" />
                                                    {t.action}
                                                </p>
                                            </div>
                                            <div className="flex flex-col gap-1 shrink-0">
                                                {t.rule === 'R2 Identity' && t.subjectId !== 'platform' && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-6 px-2 text-[9px] font-bold"
                                                        disabled={isRevoking === t.subjectId}
                                                        onClick={() => handleRevokeSessions(t.subjectId, t.subject)}
                                                    >
                                                        {isRevoking === t.subjectId
                                                            ? <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                                                            : 'Revoke'}
                                                    </Button>
                                                )}
                                                {t.id === 'pos-mfa' && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-6 px-2 text-[9px] font-bold"
                                                        onClick={() => setIsMfaModalOpen(true)}
                                                    >
                                                        Enrol
                                                    </Button>
                                                )}
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-6 px-2 text-[9px] text-muted-foreground"
                                                    onClick={() => setDismissed(prev => new Set(prev).add(t.id))}
                                                    title="Hide until reload"
                                                >
                                                    Dismiss
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>
            </div>

            {/* Direct Entity Lookup (Internal Tool) */}
            <Card className="border-emerald-500/20 bg-emerald-50/10 backdrop-blur-sm border-dashed mb-6">
                <CardContent className="p-4 flex flex-col md:flex-row items-center gap-4">
                    <div className="flex items-center gap-2 text-emerald-700">
                        <Terminal className="h-4 w-4" />
                        <span className="text-xs font-bold uppercase tracking-tight">Direct Entity Terminal</span>
                    </div>
                    <div className="flex-1 flex gap-2 w-full">
                        <Input 
                            placeholder="Enter Business ID or Owner Email (e.g. bim.ex4@gmail.com)..." 
                            value={directLookupId}
                            onChange={(e) => setDirectLookupId(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleDirectLookup()}
                            className="h-9 text-xs font-mono bg-white/50"
                        />
                        <Button size="sm" onClick={handleDirectLookup} className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700">
                            Lock Target
                        </Button>
                        <Button 
                            variant="outline" 
                            size="sm"
                            className="h-9 border-emerald-500/20 hover:bg-emerald-100 text-emerald-700 shrink-0"
                            onClick={() => window.location.reload()}
                            title="Hard Refresh Sync"
                        >
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Business Intelligence Unit */}
            <Card className="border-primary/20 bg-white/40 backdrop-blur-md shadow-xl overflow-hidden relative z-10 group/biu">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-right from-transparent via-primary/20 to-transparent" />
                
                <CardHeader className="bg-muted/30 border-b p-6 relative">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <CardTitle className="text-sm flex items-center gap-2 font-bold tracking-tighter text-primary">
                                <Server className="h-4 w-4 animate-pulse" />
                                Business Intelligence Unit
                            </CardTitle>
                            <CardDescription className="text-xs font-medium text-muted-foreground opacity-70">
                            Entity Management & Security Verification
                        </CardDescription>
                        </div>
                        <div className="relative w-full md:w-80 group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-blue-500/20 rounded-lg blur opacity-25 group-focus-within:opacity-100 transition duration-1000" />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input 
                                placeholder="Search entities by name or email..." 
                                value={searchBusiness}
                                onChange={(e) => setSearchBusiness(e.target.value)}
                                className="relative pl-9 h-10 text-xs bg-white/80 border-border/50 focus:bg-white transition-all font-bold placeholder:text-muted-foreground/40"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/10">
                                <TableRow className="hover:bg-transparent border-border/50">
                                        <TableHead className="text-xs font-medium">Entity Name</TableHead>
                                        <TableHead className="text-xs font-medium">Email Address</TableHead>
                                        <TableHead className="text-xs font-medium">Communication Link</TableHead>
                                        <TableHead className="text-xs font-medium">Node ID</TableHead>
                                        <TableHead className="text-xs font-medium text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoadingBusinesses ? (
                                    [...Array(6)].map((_, i) => (
                                        <TableRow key={i} className="border-border/50"><TableCell colSpan={5}><div className="h-10 w-full bg-muted/20 animate-pulse rounded" /></TableCell></TableRow>
                                    ))
                                ) : filteredBusinesses.length === 0 ? (
                                    <TableRow className="border-border/50">
                                        <TableCell colSpan={5} className="h-48 text-center">
                                            <div className="flex flex-col items-center justify-center space-y-3 opacity-50">
                                                <div className="p-3 bg-muted rounded-full">
                                                    <Server className="h-6 w-6 text-muted-foreground" />
                                                </div>
                                                <p className="text-[10px] font-bold text-muted-foreground">
                                                    No entities detected in this sector
                                                </p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredBusinesses.map((business) => (
                                        <TableRow key={business.id} className="hover:bg-muted/5 border-border/50 group transition-colors">
                                            <TableCell className="font-bold text-[11px] tracking-tight text-foreground/80 py-4">
                                                {business.name || 'Unnamed Entity'}
                                            </TableCell>
                                            <TableCell className="text-[11px] font-medium text-muted-foreground">
                                                {business.email || 'N/A'}
                                            </TableCell>
                                            <TableCell className="text-[11px] font-medium text-muted-foreground/60">
                                                {business.settings?.phone || 'N/A'}
                                            </TableCell>
                                            <TableCell className="font-mono text-[9px] text-muted-foreground/40">
                                                {business.id}
                                            </TableCell>
                                            <TableCell className="text-right px-6 flex items-center justify-end gap-2">
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="h-8 text-[9px] font-bold text-amber-600 hover:text-white hover:bg-amber-600 border border-amber-600/20 hover:border-amber-600 transition-all rounded-md"
                                                    onClick={() => {
                                                        setWipeSalesId(business.id);
                                                        setWipeSalesName(business.name || "Unnamed Entity");
                                                        setHasConfirmedWipe(false);
                                                        setIsWipeSalesModalOpen(true);
                                                    }}
                                                    disabled={isWipingSales === business.id}
                                                >
                                                    {isWipingSales === business.id ? (
                                                        <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                                                    ) : (
                                                        <Database className="h-3 w-3 mr-2" />
                                                    )}
                                                    Wipe Sales
                                                </Button>
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="h-8 text-[9px] font-bold text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-600/20 hover:border-rose-600 transition-all rounded-md"
                                                    onClick={() => {
                                                        setDestructionEmail(business.email || "");
                                                        setDestructionId(business.id);
                                                        setIsDestructionModalOpen(true);
                                                        fetchTargetStats(business.id);
                                                    }}
                                                >
                                                    <Trash2 className="h-3 w-3 mr-2" />
                                                    Prepare Termination
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                <CardFooter className="bg-muted/20 border-t py-3 p-6 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                            <Server className="h-3 w-3 text-muted-foreground/40" />
                            <span className="text-[9px] font-bold text-muted-foreground">Administrative Infrastructure</span>
                        </div>
                        <div className="h-3 w-px bg-border/50" />
                        <span className="text-[9px] font-bold text-muted-foreground/60">
                            {filteredBusinesses.length} Nodes Identified
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                        <span className="text-[9px] font-bold text-primary">Direct Link Active</span>
                    </div>
                </CardFooter>
            </Card>

            {/* Terminated Entities Log */}
            <Card className="border-rose-500/10 bg-white/40 backdrop-blur-md shadow-lg overflow-hidden mt-8">
                <CardHeader className="bg-rose-50/30 border-b p-4">
                    <CardTitle className="text-xs flex items-center gap-2 font-bold text-rose-600 uppercase tracking-widest">
                        <Trash2 className="h-3 w-3" />
                        Termination Archive
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent border-border/50">
                                    <TableHead className="text-[10px] font-bold">Purged Entity</TableHead>
                                    <TableHead className="text-[10px] font-bold">Email Signature</TableHead>
                                    <TableHead className="text-[10px] font-bold">Termination Date</TableHead>
                                    <TableHead className="text-[10px] font-bold">Scrubbed Data</TableHead>
                                    <TableHead className="text-[10px] font-bold text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {!terminationLogs || terminationLogs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-20 text-center text-[10px] text-muted-foreground font-bold italic">
                                            No recent purges recorded in this sector
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    terminationLogs.map((log: any) => (
                                        <TableRow key={log.id} className="border-border/50 group hover:bg-rose-50/30 transition-colors">
                                            <TableCell className="text-[10px] font-bold text-rose-950/70">{log.name}</TableCell>
                                            <TableCell className="text-[10px] font-medium text-muted-foreground/60">{log.email}</TableCell>
                                            <TableCell className="text-[10px] font-mono text-muted-foreground/40">
                                                {log.terminatedAt?.toDate ? format(log.terminatedAt.toDate(), 'MMM dd, HH:mm') : 'Pending...'}
                                            </TableCell>
                                            <TableCell className="text-[10px] font-bold text-rose-600/50">
                                                {log.stats?.products}P / {log.stats?.customers}C
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-6 w-6 text-muted-foreground hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100"
                                                    onClick={() => handleDeleteLog(log.id)}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Termination Confirmation Dialog */}
            <Dialog open={isDestructionModalOpen} onOpenChange={(open) => !isDestroying && setIsDestructionModalOpen(open)}>
                <DialogContent className="sm:max-w-[500px] border-rose-500/50 bg-background shadow-2xl shadow-rose-500/10">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3 text-rose-600 text-xl font-bold tracking-tighter">
                            <ShieldAlert className="h-6 w-6 animate-pulse" />
                            Confirm Entity Termination
                        </DialogTitle>
                        <DialogDescription className="text-xs font-bold text-muted-foreground mt-2 border-b pb-4">
                            You are about to permanently delete a business and all its data.
                        </DialogDescription>
                        
                        {targetStats && (
                            <div className="grid grid-cols-3 gap-2 mt-4">
                                <div className="bg-rose-50/50 border border-rose-100 rounded p-2 text-center">
                                    <Package className="h-3 w-3 text-rose-500 mx-auto mb-1" />
                                    <p className="text-[9px] font-bold text-rose-900">{targetStats.products}</p>
                                    <p className="text-[8px] text-rose-600 uppercase font-bold">Products</p>
                                </div>
                                <div className="bg-rose-50/50 border border-rose-100 rounded p-2 text-center">
                                    <Users className="h-3 w-3 text-rose-500 mx-auto mb-1" />
                                    <p className="text-[9px] font-bold text-rose-900">{targetStats.customers}</p>
                                    <p className="text-[8px] text-rose-600 uppercase font-bold">Customers</p>
                                </div>
                                <div className="bg-rose-50/50 border border-rose-100 rounded p-2 text-center">
                                    <Database className="h-3 w-3 text-rose-500 mx-auto mb-1" />
                                    <p className="text-[9px] font-bold text-rose-900">{targetStats.sizeKB > 1024 ? `${(targetStats.sizeKB/1024).toFixed(1)}MB` : `${targetStats.sizeKB}KB`}</p>
                                    <p className="text-[8px] text-rose-600 uppercase font-bold">Data Size</p>
                                </div>
                            </div>
                        )}
                        {isLoadingStats && (
                            <div className="flex items-center justify-center gap-2 mt-4 py-2 border border-dashed border-rose-200 rounded">
                                <RefreshCw className="h-3 w-3 text-rose-500 animate-spin" />
                                <span className="text-[9px] font-bold text-rose-500 uppercase tracking-widest">Scanning Entity Footprint...</span>
                            </div>
                        )}
                    </DialogHeader>

                    {isDestroying ? (
                        <div className="py-12 flex flex-col items-center justify-center space-y-6">
                            <div className="relative w-24 h-24">
                                <motion.div 
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                    className="absolute inset-0 border-4 border-rose-500/20 border-t-rose-600 rounded-full"
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Trash2 className="h-10 w-10 text-rose-600" />
                                </div>
                            </div>
                            <div className="w-full max-w-xs space-y-2">
                                <Progress value={destructionProgress} className="h-2 bg-rose-500/10" indicatorClassName="bg-rose-600" />
                                <p className="text-[10px] font-bold font-mono text-center text-rose-600 animate-pulse">
                                    {destructionStatus}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6 py-4">
                            <div className="p-4 bg-rose-50 border border-rose-100 rounded-lg flex gap-3 items-start">
                                <AlertCircle className="h-5 w-5 text-rose-600 mt-0.5 shrink-0" />
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-rose-700 tracking-tight">Destructive Action Warning</p>
                                    <p className="text-[11px] text-rose-600 leading-relaxed font-medium">
                                        This will purge the business record and ALL related data across the platform. All session tokens will be invalidated immediately.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">



                                <div className="flex items-center space-x-2 pt-2">
                                    <input 
                                        type="checkbox" 
                                        id="confirm" 
                                        checked={hasConfirmedDestruction}
                                        onChange={(e) => setHasConfirmedDestruction(e.target.checked)}
                                        className="h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                                    />
                                    <label htmlFor="confirm" className="text-[11px] font-bold text-muted-foreground leading-none">
                                        I confirm that I am authorized to permanently purge this entity and all its data.
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="border-t pt-4">
                        <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setIsDestructionModalOpen(false)}
                            disabled={isDestroying}
                            className="font-bold text-[10px]"
                        >
                            Abort Protocol
                        </Button>
                        {!isDestroying && (
                            <Button 
                                variant="destructive" 
                                size="sm"
                                disabled={!hasConfirmedDestruction}
                                onClick={handleEntityTermination}
                                className="bg-rose-600 hover:bg-rose-700 font-bold text-[10px] px-8 shadow-lg shadow-rose-500/20"
                            >
                                <Zap className="h-3.5 w-3.5 mr-2" />
                                Execute Termination
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Sales Wipe Confirmation Dialog */}
            <Dialog open={isWipeSalesModalOpen} onOpenChange={(open) => !isWipingSales && setIsWipeSalesModalOpen(open)}>
                <DialogContent className="sm:max-w-[500px] border-amber-500/50 bg-background shadow-2xl shadow-amber-500/10">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3 text-amber-600 text-xl font-bold tracking-tighter">
                            <ShieldAlert className="h-6 w-6 animate-pulse" />
                            Confirm Sales Wipe
                        </DialogTitle>
                        <DialogDescription className="text-xs font-bold text-muted-foreground mt-2 border-b pb-4">
                            You are about to permanently delete all sales and receipt records for <span className="text-amber-600 font-bold">"{wipeSalesName}"</span>.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg flex gap-3 items-start">
                            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                            <div className="space-y-1">
                                <p className="text-xs font-bold text-amber-700 tracking-tight">Warning: Irreversible Action</p>
                                <p className="text-[11px] text-amber-600 leading-relaxed font-medium">
                                    This will delete all receipts/sales documents from the database for this business. This will reset their Gross GMV to ₦0. Other business data (products, customers, settings) will not be modified.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center space-x-2 pt-2">
                                <input 
                                    type="checkbox" 
                                    id="confirmWipe" 
                                    checked={hasConfirmedWipe}
                                    onChange={(e) => setHasConfirmedWipe(e.target.checked)}
                                    className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                                />
                                <label htmlFor="confirmWipe" className="text-[11px] font-bold text-muted-foreground leading-none">
                                    I confirm that I want to permanently delete all sales history for "{wipeSalesName}".
                                </label>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="border-t pt-4">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setIsWipeSalesModalOpen(false)}
                            className="font-bold text-[10px]"
                        >
                            Cancel
                        </Button>
                        <Button 
                            variant="destructive" 
                            size="sm" 
                            disabled={!hasConfirmedWipe} 
                            onClick={handleWipeSales}
                            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] px-8 shadow-lg shadow-amber-500/20"
                        >
                            Wipe All Sales
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* MFA Enrollment Overlay */}
            <AnimatePresence>
                {isMfaModalOpen && (
                    <Dialog open={isMfaModalOpen} onOpenChange={setIsMfaModalOpen}>
                        <DialogContent className="sm:max-w-[400px] overflow-hidden p-0 border-border/50">
                            <div className="p-6">
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-3 text-xl font-bold tracking-tight">
                                        <div className="p-2 bg-primary/10 rounded-lg">
                                            <Lock className="h-5 w-5 text-primary" />
                                        </div>
                                        Secure Identity Link
                                    </DialogTitle>
                                    <DialogDescription className="text-muted-foreground text-xs font-medium mt-2">
                                        Protect your admin account with hardware verification.
                                    </DialogDescription>
                                </DialogHeader>
                                
                                <div className="space-y-6 py-8">
                                    {mfaStep === 'phone' ? (
                                        <div className="space-y-3">
                                            <Label htmlFor="phone" className="text-[10px] font-bold text-muted-foreground">Admin Phone Number</Label>
                                            <div className="relative">
                                                <Input 
                                                    id="phone" 
                                                    placeholder="+234..." 
                                                    value={phoneNumber} 
                                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                                    className="h-12 font-bold text-lg focus:ring-primary transition-all"
                                                />
                                                <Smartphone className="absolute right-3 top-3 h-6 w-6 text-muted-foreground/20" />
                                            </div>
                                        </div>
                                    ) : (
                                        <motion.div 
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="text-center"
                                        >
                                            <div className="flex justify-center mb-6">
                                                <div className="bg-muted p-4 rounded-full border relative">
                                                    <Radio className="h-8 w-8 text-primary" />
                                                </div>
                                            </div>
                                            <Label className="text-[10px] font-bold text-primary">Verification Required</Label>
                                            <p className="text-xs text-muted-foreground mt-2 font-medium">Enter the 6-digit code sent to your device</p>
                                            <Input 
                                                className="mt-6 text-center text-4xl font-bold h-20 focus:ring-emerald-500" 
                                                maxLength={6} 
                                                autoFocus
                                                value={verificationCode}
                                                onChange={(e) => setVerificationCode(e.target.value)}
                                            />
                                        </motion.div>
                                    )}
                                </div>

                                <DialogFooter className="flex-col sm:flex-row gap-3">
                                    <Button 
                                        variant="ghost" 
                                        onClick={() => setIsMfaModalOpen(false)} 
                                        disabled={isEnrolling}
                                        className="font-bold text-[10px]"
                                    >
                                        Abort
                                    </Button>
                                    {mfaStep === 'phone' ? (
                                        <Button 
                                            onClick={handleSendCode} 
                                            disabled={isEnrolling || !phoneNumber}
                                            className="flex-1 bg-primary font-bold text-[11px] h-12 shadow-md"
                                        >
                                            {isEnrolling ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Signal className="h-4 w-4 mr-2" />}
                                            Link Account
                                        </Button>
                                    ) : (
                                        <Button 
                                            onClick={handleVerifyAndEnroll} 
                                            disabled={isEnrolling || verificationCode.length < 6}
                                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 font-bold text-[11px] h-12 shadow-md text-white border-none"
                                        >
                                            {isEnrolling ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Crosshair className="h-4 w-4 mr-2" />}
                                            Confirm Identity
                                        </Button>
                                    )}
                                </DialogFooter>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </AnimatePresence>
        </div>
    );
}
