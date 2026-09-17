








};

export type UserRole = 'admin' | 'manager' | 'vendor_operator';

export interface UserProfile {
    onboardingStep?: number;
    id: string;
    businessId: string;
    name: string;
    email: string;
    phone?: string;
    role: UserRole;
    createdAt?: any;
    surveyCompleted?: boolean;
    /**
     * 'suspended' is written by the Cyber Shield hard-kill
     * (src/components/admin/cyber-shield.tsx) and is filtered on there, so it
     * belongs in the union even though nothing else sets it — it was missing,
     * which made every status filter silently miss suspended accounts.
     */
    status?: 'active' | 'inactive' | 'suspended' | 'deleted';
    /** Set alongside status:'suspended' by the hard-kill, for provenance. */
    suspendedAt?: any;
    suspendedBy?: string;
    lastSeen?: any;
    permissions?: Record<string, boolean>;
    platformsUsed?: string[];
    totalUsageSeconds?: number; // cumulative app usage in seconds (tracked by useSessionTracker)
    pagesVisited?: number; // cumulative page views (tracked by UserActivityTracker)
    pageViews?: Record<string, number>; // per-route view counts; keys normalised by routeKey()
    /**
     * Product-intelligence counters, all written by `UserActivityTracker` on its
     * existing heartbeat so they cost no extra Firestore writes.
     * See src/lib/product-telemetry.ts for the collector and the event registry.
     *
     * `featureUsage` is keyed by a declared event in `FEATURE_EVENTS` — a key that
     * is not in that registry is dropped rather than stored, because the registry
     * is what lets the admin board show a feature nobody uses as the zero it is.
     * `pageDwell` is on-screen time only (the clock stops on tab-hide), and
     * `pagePerf` times client-side route transitions, never the initial hard load.
     */
    featureUsage?: Record<string, number>;
    pageDwell?: Record<string, { ms: number; n: number }>;
    pagePerf?: Record<string, { ms: number; n: number }>;
    lastPage?: string; // most recent route this user opened
    appVersion?: string; // Latest app version used by the user
    deviceType?: string; // 'Desktop App' | 'Mobile App' | 'Mobile' | 'Web' - written by UserActivityTracker
    userAgent?: string;
    country?: string; // Resolved at sign-in by UserActivityTracker; absent when lookup failed
    ip?: string; // Last known public IP, for the admin login-location column
    /**
     * The app language this user actually reads Zeneva in — a LocaleCode ('en',
     * 'fr', ...), written by UserActivityTracker on the existing heartbeat.
     * Distinct from the browser language on the session doc: that one is what
     * the device is set to, this one is what the user chose.
     */
    language?: string;
    /**
     * The invitation code this account was created from, written once at signup
     * for invited members only (absent for self-registered owners).
     *
     * This is not decorative: firestore.rules needs it. `create` on a user
     * document has to prove the caller is entitled to the `businessId` they are
     * claiming, and for an invited member that proof is the invitation itself.
     * Rules cannot query a collection, so the document id has to be recorded
     * here for the rule to `get()` it and match email, businessId and role.
     */
    invitationCode?: string;
    /**
     * How this account was initially authenticated — 'google' for Continue with
     * Google, 'email' for email/password. Written once at signup; absent on
     * accounts created before this field was introduced.
     */
    authProvider?: 'google' | 'email';
    /**
     * True once this address has opted out of marketing email, written by
     * `src/app/api/unsubscribe/route.ts` when the recipient confirms the
     * unsubscribe link in a campaign footer.
     *
     * Set on *every* account sharing the address, because someone unsubscribes an
     * inbox rather than a row. Only gates marketing: essential account mail
     * (receipts, resets, security) is not a subscription and ignores this flag.
     * `sendEmail` re-checks it server-side, since a campaign's recipient list is
     * built once and goes stale the moment somebody unsubscribes mid-run.
     */
    marketingOptOut?: boolean;
    marketingOptOutAt?: any;
    /**
     * Which lifecycle ("drip") notifications this account has already been
     * sent, as `{ [stageId]: Timestamp }` — see
     * src/lib/lifecycle-notifications.ts.
     *
     * This lives on the user document rather than in localStorage on purpose.
     * The flag that says "already sent" has to be as durable as the thing it
     * guards: kept per-browser, a second device, a cleared cache or a
     * reinstalled desktop app all read it as empty and resent every message,
     * which is what produced the duplicate storm in the notification centre.
     *
     * The timestamps are also what enforces spacing — the scheduler holds back
     * anything due within LIFECYCLE_MIN_GAP_DAYS of the most recent entry, so a
     * schedule that has gone stale drips instead of emptying at once.
     */
    lifecycleNotifications?: Record<string, any>;
}
















// --- New AI Analysis Types ---




















export interface BlogHeadline {
    headline: string;
    difficulty: 'low' | 'med' | 'high';
    searchVolume: string;
}

export interface ContentPlanner {
    blogFocus: string;
    headlines: BlogHeadline[];
}

/**
 * Content Strategy AI flow contract.
 *
 * These live here rather than in `src/ai/flows/content-strategy-flow.ts` because
 * `scripts/prepare-tauri.mjs` clears `src/ai` for the static-export build and
 * replaces that module with a client-safe stub. The admin component still needs
 * the types to compile, so they cannot live in the file that gets stubbed.
 * The flow re-exports them, so existing `@/ai/flows/...` type imports keep working.
 */
export interface ContentStrategyPlatformStats {
    totalUsers?: number;
    totalBusinesses?: number;
    totalProducts?: number;
    totalReceipts?: number;
    platformGmv?: number;
    averageSalesPerDay?: number;
    platformAOV?: number;
    topLocation?: string;
    topIndustries?: string[];
}

export interface ContentStrategyInput {
    theme: string;
    platform: string;
    persona: string;
    seedKnowledge?: string;
    platformStats?: ContentStrategyPlatformStats;
}

export interface ContentSectionOutline {
    heading: string;
    talkingPoints: string[];
}

export interface ContentStrategyOutput {
    title: string;
    seoKeywords: string[];
    introduction: string;
    outline: ContentSectionOutline[];
    ctaText: string;
    backlinkOpportunities: string[];
    marketingPitch: string;
}

export interface BusinessAnalysisOutput {
    smartStockRecommendations?: SmartStockRecommendation[];
    demandHeatmap?: DemandHeatmap;
    revenueOpportunities?: RevenueOpportunity[];
    smartMerchandising?: SmartMerchandising[];
    irresistibleOffers?: IrresistibleOffer[];
    slowMovingInventory?: SlowMovingInventory[];
    businessHealth?: BusinessHealth;
    customerSegments?: CustomerSegment[];
    pricingRecommendations?: PricingRecommendation[];
    contentPlanner?: ContentPlanner;
    createdAt?: any;
}


export interface Branch {
    id: string;
    businessId: string;
    name: string;
    address?: string;
    isPrimary: boolean;
    isActive: boolean;
    createdAt: any;
}

export interface BusinessInstance {
    id: string;
    name: string;
    address?: string;
    ownerId: string;
    createdAt: any; // Firestore Timestamp
    trialExpiresAt?: any; // Firestore Timestamp
    plan?: 'starter' | 'pro' | 'business';
    accessLevel?: 'lifetime';
    status?: 'active' | 'deleted';
    deletedAt?: any;

    /**
     * ── AI metering. Document root, not `settings` ──────────────────────────
     *
     * These lived under `settings` in this interface for a long time while every
     * reader and writer in the codebase used them at the root — `src/app/api/chat/route.ts`
     * reads `businessData.aiUsageCount` and writes `aiBonusCredits` at the top level, and
     * `entitlementFieldsLocked()` in `firestore.rules` locks them there by name. The type
     * was simply wrong, and the cost of that is silent: a field declared at the wrong
     * depth reads `undefined` for ever, so a quota check passes and a credit grant
     * evaporates without an error anywhere.
     *
     * All of these are **owner-locked in the rules** — a tenant cannot write them, only
     * the Admin SDK can. That is what makes them safe to bill against.
     */

    /** Month the counter belongs to, as `YYYY-MM`. Not a day — the cap is monthly. */
    aiUsageCurrentDate?: string;
    /** Turns used inside `aiUsageCurrentDate`. Reset by comparing the month, never cleared. */
    aiUsageCount?: number;
    /**
     * Purchased and granted credit balance, spent once the monthly allowance runs out.
     * Non-expiring and never reset. The name is historic — it predates credits being
     * something you can buy, and renaming it would mean migrating every live balance,
     * the rules entry and the admin board for no user-visible gain.
     */
    aiBonusCredits?: number;
    /** Lifetime per-tool call counts, keyed by tool name. Predates the daily rollups. */
    aiToolUsageCounts?: Record<string, number>;

    /** Set by the subscription grant. Locked in the rules alongside `plan`. */
    subscriptionReference?: string;
    isVerified?: boolean;
    featureOverrides?: Record<string, boolean>;

    settings?: {
        phone?: string;
        email?: string;
        currency?: string;
        timezone?: string;
        defaultTaxRate?: number;
        primaryColor?: string;
        logoUrl?: string;
        paymentBankAccountId?: string;
        paymentBankName?: string;
        paymentAccountName?: string;
        paymentBankCode?: string;
        paymentInstructions?: string;
        paystackSubaccount?: string;
        usdToNgnRate?: number;
        vendorPolicyEnabled?: boolean;
        vendorPolicyText?: string;
        loyaltyProgramEnabled?: boolean;
        pointsPerUnit?: number;
        loyaltyPointsForReward?: number;
        loyaltyRewardDiscountPercentage?: number;
        productCategories?: string[];
        multiBranchEnabled?: boolean;

        /**
         * Whether the owner has opted in to the business rating.
         *
         * **Three states, and the difference matters.** `undefined` means they have never
         * been asked, and only that state shows the invitation card in Reports. `false`
         * means they were asked and said no, so nothing about the rating may appear
         * anywhere again — re-offering it is the exact thing the opt-in exists to prevent.
         * `true` means every surface behaves as it always did.
         *
         * Distinct from `score === null`, which means "not enough data to score yet".
         * Collapsing the two makes "why is my score blank" unanswerable.
         */
        ratingEnabled?: boolean;
        aiTroubleshootSuggestions?: AISuggestions;
        businessAnalysis?: BusinessAnalysisOutput;
        publicStore?: {
            enabled?: boolean;
            headline?: string;
            slug?: string;
            bannerImageUrl?: string;
            desktopColumns?: 3 | 4 | 5;
            footerText?: string;
            description?: string;
            socialTwitter?: string;
            socialInstagram?: string;
            socialFacebook?: string;
            socialWhatsapp?: string;
            hideOutOfStock?: boolean;
            officeLocations?: string;
            contactPhone?: string;
            contactEmail?: string;
            businessHours?: string;
            googleMapsLink?: string;
            shippingOptions?: { name: string; price: number; type: 'delivery' | 'pickup'; location?: string; }[];
        },
        industry?: string;
        language?: string;
        inventoryStartDate?: any;
        fiscalYearStart?: string;
        state?: string;
        country?: string;
        operatingHours?: {
            enabled: boolean;
            openTime: string; // HH:mm
            closeTime: string; // HH:mm
            preventSalesOutsideHours: boolean;
        };
        allowPosPriceOverride?: boolean;
        allowCashierExpenseLogging?: boolean;
        allowManagerCostPriceView?: boolean;
        requireAdminApprovalForVoids?: boolean;
    };
}

export interface Invitation {
    id: string;
    businessId: string;
    email: string;
    name: string;
    role: 'manager' | 'vendor_operator';
    createdAt: any; // Firestore timestamp
    branchId?: string;
}

/**
 * A payment made *to* Zeneva. Two kinds live in this one collection.
 *
 * The declared types used to be narrower than what the writers actually write:
 * `plan` was `'Pro' | 'Business'` while `activateSubscription` writes a lowercase
 * `PlanId`, and `currency` was `'NGN'` only while the Dodo rail writes `'USD'` —
 * so a reader that narrowed on either was reasoning about a shape that does not
 * exist in the collection.
 *
 * `kind` is the discriminator, and anything computing a *rate* must respect it: a
 * credit pack is bought once. `src/lib/platform-revenue.ts` holds the helpers, and
 * a missing `kind` means `'subscription'` — every row written before packs existed.
 */
export interface Purchase {
    id: string;
    /** Absent on Dodo rows: a webhook is authenticated by signature, not by a user. */
    userId?: string;
    businessId: string;
    /**
     * Free text, not a `PlanId`. Subscriptions write the plan id; credit packs
     * write something readable like `"1000 AI credits"` so a table cell is not
     * blank. Match it the way `purchasePlanMonthlyNgn` does, and only for
     * subscription rows.
     */
    plan: string;
    /**
     * Missing on every row written before AI credit packs shipped, and on every row
     * written since they were scrapped — nothing writes `'credits'` any more.
     * `purchaseKind` reads a missing value as `'subscription'`, which is what those
     * rows are.
     */
    kind?: 'subscription' | 'credits';
    /** Historical credit rows only — the pack that was bought. Never written now. */
    packId?: string;
    /** Historical credit rows only — credits granted by that purchase. */
    credits?: number;
    amount: number;
    currency: 'NGN' | 'USD';
    timestamp: any; // Firestore Timestamp
    reference?: string;
    gateway?: 'paystack' | 'dodopayments';
    /** True when a server action verified the charge with the gateway itself. */
    verifiedServerSide?: boolean;
    userProfile?: UserProfile; // For admin dashboard display
}

export interface SubscriptionHistory {
    id: string;
    action: string;
    amount: number;
    /**
     * Was declared `'NGN'` only, which was wrong: the Dodo webhook writes
     * `pData.currency || 'USD'` into this collection for both a subscription and a
     * credit pack. A reader that narrowed on the old type printed ₦ against a dollar
     * amount — an $8 pack shown as "₦8".
     */
    currency: 'NGN' | 'USD';
    timestamp: any; // Firestore Timestamp
}

export interface BlogPost {
    id: string;
    title: string;
    slug: string;
    content: string;
    excerpt?: string;
    imageUrl?: string;
    authorId: string;
    authorName: string;
    published: boolean;
    // Optional so a Firestore-authored post can carry the same category the
    // static posts in blog-data.ts use. blog-post-client renders it and the
    // listing page groups on it, so omitting it from the type was a lie.
    category?: string;
    createdAt: any;
    updatedAt: any;
}

// Platform-wide notifications sent by admin
export interface AdminNotification {
    id: string;
    title: string;
    body: string;
    sentBy: string;
    createdAt: any;
    /** Where a tap sends the recipient. Absent means `/support`. */
    link?: string | null;
    /** Set when the alert was aimed at one user; absent or null means everyone. */
    targetEmail?: string | null;
    /** Soft delete: the row stays visible to admins, struck through. */
    deleted?: boolean;
    deletedAt?: any;
}

export interface UserNotification {
    id: string;
    title: string;
    body: string;
    read: boolean;
    createdAt: any;
    isGlobal?: boolean;
    queuedActionId?: string;
}

/**
 * One phone push, recorded at send time so the admin can answer "how many did we
 * send and who opened them".
 *
 * `deviceCount` and `recipientCount` differ on purpose: one person with a phone
 * and a laptop is one recipient and two devices, and conflating them makes the
 * click-through rate wrong in both directions.
 */
export interface PushCampaign {
    id: string;
    title: string;
    body: string;
    /** Deep link the notification opens. `/` when the sender left it blank. */
    link: string;
    /** Which code path sent it — tells a broadcast apart from a payment receipt. */
    source: 'broadcast' | 'alert' | 'test' | 'system';
    audience: 'all' | 'user';
    /** Human label for the audience, e.g. "All devices" or the target's email. */
    audienceLabel?: string | null;
    sentBy?: string | null;
    sentByEmail?: string | null;
    sentAt: any;
    /** Tokens the send was attempted against. */
    deviceCount: number;
    /** Devices FCM accepted. */
    successCount: number;
    failureCount: number;
    /** Distinct users behind those devices. */
    recipientCount: number;
    /** Total opens, incremented by the recipient on click. Re-opens count. */
    clickCount?: number;
    lastClickAt?: any;
}

/**
 * Per-person delivery row under `push_campaigns/{id}/recipients/{userId}`.
 *
 * Name and email are denormalised at send time: the admin board needs to show
 * who clicked without reading a `users` doc per row, and a renamed or deleted
 * account should not rewrite history.
 */
export interface PushRecipient {
    id: string;
    userId: string;
    userName?: string | null;
    userEmail?: string | null;
    deviceCount: number;
    successCount: number;
    failureCount: number;
    sentAt: any;
    /** First open. Absent means this person never opened it. */
    clickedAt?: any;
    lastClickedAt?: any;
    clickCount?: number;
}

export interface SystemBroadcast {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'alert';
    expiresAt: any; // Firestore Timestamp
    createdAt: any; // Firestore Timestamp
    isActive: boolean;
    createdBy: string;
    link?: string;
}



export interface SupportThread {
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    subject: string;
    status: 'open' | 'closed';
    lastMessageAt: any; // Timestamp
    lastMessageSnippet: string;
    isReadByAdmin: boolean;
    createdAt: any;
}

export interface SupportMessage {
    id: string;
    senderId: string;
    senderName: string;
    text: string;
    createdAt: any; // Timestamp
}


export interface PressArticle {
    title: string;
    publication: string;
    logoUrl?: string;
    url: string;
}

export interface AuditLog {
    id: string;
    businessId: string;
    userId: string;
    userName: string;
    userEmail: string;
    userRole?: string;
    action: string; // e.g., 'product.create', 'sale.void'
    entityType: string; // e.g., 'Product', 'Receipt'
    entityId: string;
    details: Record<string, any>; // e.g., { name: 'New Product' } or { changes: [...] }
    createdAt: any; // Firestore Timestamp
    branchId?: string;
}

export interface BusinessStats {
    id: string; // The businessId
    totalCustomers: number;
    totalProducts: number;
    totalRevenue: number;
    totalSales: number;
    totalUnitsSold?: number;
    updatedAt: any;
}

// --- Expenses & Procurement Management ---

export type ExpenseCategory =
    | 'rent'
    | 'utilities'
    | 'salaries'
    | 'logistics'
    | 'marketing'
    | 'maintenance'
    | 'packaging'
    | 'inventory_freight'
    | 'petty_cash'
    | 'taxes'
    | 'miscellaneous';

export type ExpensePaymentMethod = 'cash' | 'bank_transfer' | 'pos_card' | 'personal_funds' | 'other';

export interface Expense {
    id: string;
    businessId: string;
    amount: number;
    category: ExpenseCategory | string;
    paymentMethod: ExpensePaymentMethod;
    description: string;
    date: any; // Timestamp or ISO string
    paidBy?: string; // User display name or ID
    receiptUrl?: string; // Optional bill/receipt reference or URL
    isPaidFromDrawer?: boolean; // Whether cash was deducted from daily till / register
    status?: 'paid' | 'pending';
    branchId?: string;
    createdAt?: any;
    updatedAt?: any;
}

export interface Supplier {
    id: string;
    businessId: string;
    name: string;
    contactPerson?: string;
    email?: string;
    phone: string;
    address?: string;
    paymentTerms?: string; // e.g. "Immediate", "Net 15", "Net 30", "Cash on Delivery"
    notes?: string;
    totalPurchases?: number;
    outstandingBalance?: number; // Total unpaid debt to supplier
    branchId?: string;
    createdAt?: any;
    updatedAt?: any;
}

export interface PurchaseOrderItem {
    productId?: string;
    productName: string;
    sku?: string;
    quantityOrdered: number;
    quantityReceived: number;
    unitCost: number;
    totalCost: number;
}

export type PurchaseOrderStatus = 'draft' | 'ordered' | 'received' | 'cancelled';
export type PurchasePaymentStatus = 'unpaid' | 'partially_paid' | 'paid';

export interface SupplierPurchase {
    id: string;
    businessId: string;
    purchaseNumber: string; // e.g., "PO-1001"
    supplierId: string;
    supplierName: string;
    supplierPhone?: string;
    orderDate: any;
    deliveryDate?: any;
    status: PurchaseOrderStatus;
    paymentStatus: PurchasePaymentStatus;
    paymentMethod?: ExpensePaymentMethod;
    items: PurchaseOrderItem[];
    totalAmount: number;
    amountPaid: number;
    balanceDue: number;
    notes?: string;
    autoUpdateStockOnReceive?: boolean; // Automatically increments product.stock on 'received'
    autoUpdateCostPrice?: boolean; // Updates product.costPrice with unitCost
    branchId?: string;
    createdAt?: any;
    updatedAt?: any;
    createdByName?: string;
    createdById?: string;
}

export type PromoToastColor = 'blue' | 'orange' | 'emerald' | 'purple' | 'amber';
export type PromoToastMode = 'poster' | 'card';
export type PromoToastTargetPlatform = 'all' | 'desktop' | 'web';

export interface PromoToastConfig {
    id: string; // Campaign ID, e.g. "promo-wps-2026-v1"
    enabled: boolean;
    displayMode: PromoToastMode; // 'poster' = full image graphic, 'card' = banner image + copy + button
    imageUrl: string; // custom image designed by admin
    badgeText: string; // e.g. "59% OFF" or "EXCLUSIVE OFFER"
    title: string; // e.g. "Upgrade to Zeneva Pro"
    description: string; // e.g. "Get unlimited stores, offline sync & AI stock insights."
    buttonText: string; // e.g. "Get my OFFER"
    targetUrl: string; // e.g. "/settings?tab=subscription" or checkout link
    themeColor: PromoToastColor; // blue (WPS style), orange (Zeneva), emerald, purple, amber
    targetPlatform: PromoToastTargetPlatform; // all, desktop, web
    cooldownHours: number; // e.g. 24
    autoShowDelaySec: number; // e.g. 3
    updatedAt?: any;
}
