/**
 * Loss-prevention forensics for a single business.
 *
 * This is the engine behind the audit log's "Run forensic scan" button and
 * behind Zen AI's `runLossPreventionScan` tool. Both call `runForensicScan`;
 * they differ only in how they gather the evidence (client cache vs. Admin SDK).
 *
 * ── Three rules everything here follows ────────────────────────────────────
 *
 * 1. **No model, no network, no clock of its own.** Every conclusion is
 *    arithmetic over rows the caller already loaded, and `now` is an input.
 *    An owner is being told a named member of staff may be stealing from them;
 *    that accusation has to be reproducible from the same data tomorrow, and it
 *    must never depend on a language model's mood. This is also why it is a
 *    plain module and not an AI flow: `src/ai/flows/audit-log-analysis-flow.ts`
 *    is a stub returning `anomalies: []`, and the page's old inline scan had two
 *    rules over the 50 most recent log rows.
 *
 * 2. **Peers, not magic numbers.** "More than 5 voids is suspicious" is wrong in
 *    both directions — wrong for a kiosk doing 12 sales a day and wrong for a
 *    supermarket doing 900. Almost every detector here compares one member of
 *    staff against the median of their colleagues over the same window, with a
 *    minimum volume so a cashier's first shift cannot look like a crime wave.
 *    Where no peer group exists (a one-person shop, or everyone below the volume
 *    floor) the detector says so in `coverage` instead of guessing.
 *
 * 3. **A gap is reported, never hidden.** Several patterns are only detectable
 *    if the app wrote the right audit detail at the time — a void log needs the
 *    original sale's timestamp to be timed, a price-swap needs price edits to be
 *    logged. Rows that predate that logging come back as a `CoverageGap`, not as
 *    a clean bill of health. Silence has to mean "checked and clear", or the
 *    report is worse than no report.
 *
 * ── What it cannot see ──────────────────────────────────────────────────────
 *
 * Cash that never reached the POS at all. Nothing in a database can find an item
 * handed over without being rung up; that is what a camera and a stocktake are
 * for. What this does find is the *paper trail people leave when they try to
 * make the system agree with the shortfall* — the void, the discount, the
 * write-off, the price edit and the timestamp.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Public shapes
// ─────────────────────────────────────────────────────────────────────────────

export type Severity = 'critical' | 'high' | 'medium' | 'low';

/**
 * How much weight to put on a finding.
 *
 * - `confirmed` — the data says this happened. A sale dated in the future is not
 *   an interpretation.
 * - `strong` — a pattern that has few innocent explanations, and the innocent
 *   ones are named in `why` so the owner can rule them out.
 * - `signal` — worth a look, commonly benign. Never presented as an accusation.
 */
export type Confidence = 'confirmed' | 'strong' | 'signal';

export type FindingGroup =
  | 'voids'
  | 'discounts'
  | 'cash'
  | 'stock'
  | 'timing'
  | 'integrity'
  | 'access';

export type Evidence =
  | { kind: 'receipt'; id: string; label: string; amount?: number; at?: number }
  | { kind: 'log'; id: string; label: string; at?: number }
  | { kind: 'product'; id: string; label: string; amount?: number }
  | { kind: 'staff'; id: string; label: string }
  | { kind: 'note'; label: string };

export type Finding = {
  /** Stable across scans of the same data, so the UI can key on it. */
  id: string;
  /** Detector code, e.g. "V2". Shown so a finding can be talked about. */
  code: string;
  group: FindingGroup;
  severity: Severity;
  confidence: Confidence;
  title: string;
  /** What was actually observed, with the numbers in it. */
  what: string;
  /** How the scam works, and the innocent explanation to rule out first. */
  why: string;
  /** The next physical step for the owner. Never "investigate further". */
  action: string;
  /** Money plausibly at risk. 0 when the pattern has no direct cash value. */
  exposure: number;
  suspects: { id: string; name: string; role?: string }[];
  evidence: Evidence[];
  relatedLogIds: string[];
  relatedReceiptIds: string[];
  /** The one number that carries the finding, plus the peer figure it beat. */
  metric?: {
    label: string;
    value: number;
    peer?: number | null;
    format: 'currency' | 'number' | 'percent';
  };
};

export type StaffMetric = {
  label: string;
  value: number;
  /** Median of this person's colleagues. Null when there was no peer group. */
  peer: number | null;
  format: 'currency' | 'number' | 'percent';
  flagged: boolean;
  hint: string;
};

export type StaffRisk = {
  id: string;
  name: string;
  role?: string;
  /** 0–100 where 100 is the highest concern. Opposite direction to `score`. */
  risk: number;
  band: 'clear' | 'watch' | 'elevated' | 'critical';
  findingCount: number;
  exposure: number;
  sales: number;
  revenue: number;
  metrics: StaffMetric[];
  /** Short phrases for the card, most important first. */
  reasons: string[];
};

export type CoverageGap = {
  code: string;
  title: string;
  detail: string;
  /** What the owner (or the app) has to change for this check to run. */
  fix: string;
};

export type ShrinkageItem = {
  productId: string;
  name: string;
  unitsRemoved: number;
  valueRemoved: number;
  adjustments: number;
  actors: string[];
};

export type ForensicReport = {
  generatedAt: number;
  /** Days of history the evidence actually covered. */
  windowDays: number;
  /** 0–100 where 100 is clean. */
  score: number;
  level: { label: string; tone: Severity | 'ok' };
  headline: string;
  /** Sum of `exposure` across findings, de-duplicated per receipt/log. */
  exposure: number;
  currency: string;
  findings: Finding[];
  watchlist: StaffRisk[];
  shrinkage: ShrinkageItem[];
  coverage: CoverageGap[];
  scanned: {
    receipts: number;
    auditLogs: number;
    products: number;
    staff: number;
    voids: number;
    stockAdjustments: number;
    priceEdits: number;
    oldestRecord: number | null;
    newestRecord: number | null;
  };
  /** Detectors that produced a verdict, and the total attempted. */
  checksRun: number;
  checksTotal: number;
};

export type ForensicInput = {
  receipts: any[];
  auditLogs: any[];
  products: any[];
  users: any[];
  customers?: any[] | null;
  settings?: {
    operatingHours?: {
      enabled?: boolean;
      openTime?: string;
      closeTime?: string;
      preventSalesOutsideHours?: boolean;
    } | null;
    timezone?: string | null;
  } | null;
  currency?: string;
  /** Owner's user id. Owner actions are held to a lower bar — it is their shop. */
  ownerId?: string | null;
  /** How far back the caller's evidence reaches. Defaults to what the rows show. */
  windowDays?: number;
  /** Injected so a scan is reproducible. Defaults to `Date.now()`. */
  now?: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Primitives
// ─────────────────────────────────────────────────────────────────────────────

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

export const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 34,
  high: 16,
  medium: 6,
  low: 2,
};

/**
 * Anything Firestore or JSON might hand over as a date → millis, or 0.
 *
 * Deliberately duplicated from `safeToDate`/`toMillis` rather than imported:
 * this module is imported by both the client page and the Admin-SDK route, and
 * the two runtimes disagree on which Timestamp class is in scope. `_seconds` is
 * the Admin SDK's shape after a JSON round trip.
 */
function ms(value: any): number {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') {
    try {
      return value.toMillis();
    } catch {
      return 0;
    }
  }
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  if (typeof value?._seconds === 'number') return value._seconds * 1000;
  return 0;
}

const num = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const pct = (part: number, whole: number) => (whole > 0 ? round2((part / whole) * 100) : 0);

/** Only paid sales are money. Legacy rows carry no status; the app reads those as paid. */
const isPaid = (r: any) => (r?.status ?? 'paid') === 'paid';

/** Services share the products collection and carry stock 0 because the field is shared. */
const isServiceItem = (p: any) =>
  p?.categoryType === 'service' ||
  String(p?.category ?? '').toLowerCase() === 'service' ||
  String(p?.category ?? '').toLowerCase() === 'services';

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : round2((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * The hour of day a timestamp fell on, in the shop's own timezone.
 *
 * The client runs on the till itself so its local hours are already the shop's.
 * The server does not, and Node defaults to UTC — which in Lagos would move a
 * 9am stock edit to 8am and in Auckland move it to the previous evening, turning
 * an ordinary morning into an "after hours" finding. `Intl` with the configured
 * timezone is the only way to get this right from either side.
 */
function hourInZone(at: number, timeZone?: string | null): number {
  if (!timeZone) return new Date(at).getHours();
  try {
    const hour = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      hour12: false,
    }).format(new Date(at));
    const parsed = Number(hour);
    return Number.isFinite(parsed) ? parsed % 24 : new Date(at).getHours();
  } catch {
    return new Date(at).getHours();
  }
}

/** "09:30" → 9.5. Null when unparseable, so callers can skip rather than assume. */
function parseClock(value?: string | null): number | null {
  if (!value || typeof value !== 'string') return null;
  const [h, m] = value.split(':');
  const hours = Number(h);
  const mins = Number(m ?? 0);
  if (!Number.isFinite(hours)) return null;
  return hours + (Number.isFinite(mins) ? mins / 60 : 0);
}

const dayKey = (at: number) => new Date(at).toISOString().slice(0, 10);

/**
 * Median of everyone except the subject.
 *
 * Excluding the subject matters most in the small teams this app is built for:
 * with three cashiers, a thief's own numbers drag the median far enough toward
 * themselves to hide behind it.
 */
function peerMedian<T>(rows: T[], subject: T, value: (row: T) => number): number | null {
  const peers = rows.filter((r) => r !== subject).map(value);
  if (peers.length < 2) return null;
  return median(peers);
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregation
// ─────────────────────────────────────────────────────────────────────────────

type StaffAgg = {
  id: string;
  name: string;
  role?: string;
  status?: string;
  isOwner: boolean;

  sales: number;
  revenue: number;

  cashSales: number;
  cashRevenue: number;

  discountedSales: number;
  discountValue: number;

  noReceiptSales: number;
  noCustomerSales: number;
  noCustomerRevenue: number;

  offHoursSales: number;
  offlineSales: number;
  backdatedSales: number;

  belowCostLines: number;
  belowCostLoss: number;

  overrideLines: number;
  overrideLoss: number;

  voids: number;
  voidValue: number;
  selfVoids: number;
  selfVoidValue: number;
  fastVoids: number;
  fastVoidValue: number;
  lateVoids: number;

  adjustDown: number;
  unitsRemoved: number;
  valueRemoved: number;
  adjustUp: number;
  unitsAdded: number;

  priceCuts: number;
  costEdits: number;
  deletions: number;
  offHoursEdits: number;

  /** Value of discounts given, per customer id. Feeds the sweethearting check. */
  discountByCustomer: Map<string, number>;
  /** Sale timestamps, ascending. Feeds the cadence check. */
  saleTimes: number[];
  lastActivity: number;
  firstActivity: number;
};

function blankStaff(id: string, name: string, role?: string, status?: string, isOwner = false): StaffAgg {
  return {
    id,
    name,
    role,
    status,
    isOwner,
    sales: 0,
    revenue: 0,
    cashSales: 0,
    cashRevenue: 0,
    discountedSales: 0,
    discountValue: 0,
    noReceiptSales: 0,
    noCustomerSales: 0,
    noCustomerRevenue: 0,
    offHoursSales: 0,
    offlineSales: 0,
    backdatedSales: 0,
    belowCostLines: 0,
    belowCostLoss: 0,
    overrideLines: 0,
    overrideLoss: 0,
    voids: 0,
    voidValue: 0,
    selfVoids: 0,
    selfVoidValue: 0,
    fastVoids: 0,
    fastVoidValue: 0,
    lateVoids: 0,
    adjustDown: 0,
    unitsRemoved: 0,
    valueRemoved: 0,
    adjustUp: 0,
    unitsAdded: 0,
    priceCuts: 0,
    costEdits: 0,
    deletions: 0,
    offHoursEdits: 0,
    discountByCustomer: new Map(),
    saleTimes: [],
    lastActivity: 0,
    firstActivity: 0,
  };
}

type Ctx = {
  now: number;
  windowDays: number;
  currency: string;
  timeZone: string | null;
  ownerId: string | null;

  receipts: any[];
  paid: any[];
  products: any[];
  productById: Map<string, any>;
  customerById: Map<string, any>;
  users: any[];

  logs: any[];
  voidLogs: any[];
  adjustLogs: any[];
  updateLogs: any[];
  deleteLogs: any[];
  accessLogs: any[];
  settingsLogs: any[];

  staff: StaffAgg[];
  staffById: Map<string, StaffAgg>;
  /** Staff with enough sales volume to be compared against each other. */
  sellers: StaffAgg[];

  openHour: number | null;
  closeHour: number | null;
  hoursEnforced: boolean;

  /** Void logs that carry the original sale's timestamp, so gaps are computable. */
  timedVoids: number;
  untimedVoids: number;
  /** Void logs that name who rang the sale up, so self-voids are attributable. */
  attributedVoids: number;

  gaps: CoverageGap[];
};

/** A void log's shape after enrichment. See `logAuditEvent` callers in receipts. */
type VoidRow = {
  log: any;
  id: string;
  at: number;
  total: number;
  voidedBy: string;
  voidedByName: string;
  soldBy: string | null;
  saleAt: number | null;
  receiptNumber: string | null;
  paymentMethod: string | null;
};

function buildContext(input: ForensicInput): Ctx {
  const now = input.now ?? Date.now();
  const currency = input.currency ?? '';
  const timeZone = input.settings?.timezone ?? null;
  const ownerId = input.ownerId ?? null;

  const receipts = (input.receipts ?? []).filter(Boolean);
  const logs = (input.auditLogs ?? []).filter(Boolean);
  const products = (input.products ?? []).filter(Boolean);
  const users = (input.users ?? []).filter(Boolean);

  const productById = new Map<string, any>(products.map((p) => [p.id, p]));
  const customerById = new Map<string, any>((input.customers ?? []).filter(Boolean).map((c: any) => [c.id, c]));

  // Window: what the caller says, else what the rows actually span. A scan that
  // claims 90 days of history when the cache holds 6 makes every rate wrong.
  const stamps = [
    ...receipts.map((r) => ms(r.createdAt)),
    ...logs.map((l) => ms(l.createdAt)),
  ].filter((t) => t > 0 && t <= now + HOUR);
  const oldest = stamps.length ? Math.min(...stamps) : null;
  const newest = stamps.length ? Math.max(...stamps) : null;
  const spanDays = oldest ? Math.max(1, Math.ceil((now - oldest) / DAY)) : 1;
  const windowDays = input.windowDays ?? spanDays;

  const openHour = parseClock(input.settings?.operatingHours?.openTime);
  const closeHour = parseClock(input.settings?.operatingHours?.closeTime);
  const hoursEnforced = !!input.settings?.operatingHours?.preventSalesOutsideHours;

  // ── staff table, seeded from the user directory so a member of staff with
  // zero sales still appears (a cashier who only ever voids is the interesting
  // case, and they would be invisible if the table were built from receipts).
  const staffById = new Map<string, StaffAgg>();
  for (const u of users) {
    if (!u?.id) continue;
    staffById.set(
      u.id,
      blankStaff(u.id, u.name || u.email || u.id, u.role, u.status, ownerId ? u.id === ownerId : u.role === 'admin'),
    );
  }
  const staffFor = (id: string | null | undefined, fallbackName?: string): StaffAgg | null => {
    if (!id) return null;
    let row = staffById.get(id);
    if (!row) {
      row = blankStaff(id, fallbackName || `Unknown user ${String(id).slice(0, 6)}`, undefined, undefined, id === ownerId);
      staffById.set(id, row);
    }
    return row;
  };

  const paid = receipts.filter(isPaid);

  // ── receipts → per-staff aggregates
  for (const r of paid) {
    const at = ms(r.createdAt);
    const row = staffFor(r.createdBy);
    if (!row) continue;

    const total = num(r.total);
    row.sales++;
    row.revenue = round2(row.revenue + total);
    if (at) {
      row.saleTimes.push(at);
      row.lastActivity = Math.max(row.lastActivity, at);
      row.firstActivity = row.firstActivity ? Math.min(row.firstActivity, at) : at;
    }

    if (r.paymentMethod === 'Cash') {
      row.cashSales++;
      row.cashRevenue = round2(row.cashRevenue + total);
    }

    const discount = num(r.discount);
    if (discount > 0) {
      row.discountedSales++;
      row.discountValue = round2(row.discountValue + discount);
      const custId = r.customer?.id ?? '__walkin__';
      row.discountByCustomer.set(custId, round2((row.discountByCustomer.get(custId) ?? 0) + discount));
    }

    if (r.receiptMethod === 'none') row.noReceiptSales++;
    if (!r.customer?.id) {
      row.noCustomerSales++;
      row.noCustomerRevenue = round2(row.noCustomerRevenue + total);
    }
    if (r.flagged?.reason === 'outside_operating_hours') row.offHoursSales++;
    if (r.isOffline) row.offlineSales++;
    if (r.isBackdated) row.backdatedSales++;

    for (const item of r.items ?? []) {
      const qty = num(item?.quantity);
      const price = num(item?.price);
      const cost = num(item?.costPrice);
      if (qty <= 0) continue;

      if (cost > 0 && price < cost) {
        row.belowCostLines++;
        row.belowCostLoss = round2(row.belowCostLoss + (cost - price) * qty);
      }

      // `listPrice` is written by the POS when the cashier typed a price over
      // the shelf price. Absent on rows from before that change — the fallback
      // to the product's *current* price is in D4 and is marked as a signal,
      // because a legitimate repricing since the sale looks identical.
      const listed = num(item?.listPrice);
      if (item?.priceOverridden && listed > 0 && price < listed) {
        row.overrideLines++;
        row.overrideLoss = round2(row.overrideLoss + (listed - price) * qty);
      }
    }
  }

  // ── audit logs → typed buckets
  const action = (l: any) => String(l?.action ?? '');
  const voidLogs = logs.filter((l) => action(l) === 'sale.void');
  const adjustLogs = logs.filter(
    (l) => action(l) === 'product.stock_adjustment' || action(l) === 'stock.adjusted',
  );
  const updateLogs = logs.filter(
    (l) => action(l) === 'product.update' || action(l) === 'product.bulk_update',
  );
  const deleteLogs = logs.filter(
    (l) => action(l) === 'product.delete' || action(l) === 'customer.delete' || action(l) === 'receipt.delete',
  );
  const accessLogs = logs.filter((l) => action(l).startsWith('user.'));
  const settingsLogs = logs.filter((l) => action(l).startsWith('settings.'));

  let timedVoids = 0;
  let untimedVoids = 0;
  let attributedVoids = 0;

  for (const l of voidLogs) {
    const row = staffFor(l.userId, l.userName);
    if (!row) continue;
    const value = num(l.details?.total);
    row.voids++;
    row.voidValue = round2(row.voidValue + value);

    const saleAt = ms(l.details?.saleCreatedAt);
    const voidAt = ms(l.createdAt);
    const soldBy = l.details?.soldBy ?? null;

    if (soldBy) attributedVoids++;
    if (saleAt && voidAt) {
      timedVoids++;
      const gap = voidAt - saleAt;
      if (gap >= 0 && gap <= 15 * MINUTE) {
        row.fastVoids++;
        row.fastVoidValue = round2(row.fastVoidValue + value);
      } else if (gap > 12 * HOUR) {
        row.lateVoids++;
      }
    } else {
      untimedVoids++;
    }

    if (soldBy && soldBy === l.userId) {
      row.selfVoids++;
      row.selfVoidValue = round2(row.selfVoidValue + value);
    }
  }

  for (const l of adjustLogs) {
    const row = staffFor(l.userId, l.userName);
    if (!row) continue;
    const delta = num(l.details?.adjustment ?? num(l.details?.newStock) - num(l.details?.oldStock));
    const product = productById.get(l.entityId);
    const unitCost = num(product?.costPrice) || num(product?.price);
    if (delta < 0) {
      row.adjustDown++;
      row.unitsRemoved += Math.abs(delta);
      row.valueRemoved = round2(row.valueRemoved + Math.abs(delta) * unitCost);
    } else if (delta > 0) {
      row.adjustUp++;
      row.unitsAdded += delta;
    }
  }

  for (const l of updateLogs) {
    const row = staffFor(l.userId, l.userName);
    if (!row) continue;
    const changes = l.details?.changes;
    if (changes && typeof changes === 'object') {
      const price = changes.price;
      const cost = changes.costPrice;
      if (price && num(price.to) < num(price.from)) row.priceCuts++;
      if (cost && num(cost.to) !== num(cost.from)) row.costEdits++;
    }
  }

  for (const l of deleteLogs) {
    const row = staffFor(l.userId, l.userName);
    if (row) row.deletions++;
  }

  // Off-hours *edits* (as opposed to off-hours sales, which the POS flags at the
  // till). Only meaningful once opening times are configured.
  if (openHour !== null && closeHour !== null) {
    for (const l of logs) {
      const at = ms(l.createdAt);
      if (!at) continue;
      const hour = hourInZone(at, timeZone);
      const outside =
        closeHour > openHour ? hour < openHour || hour >= closeHour : hour < openHour && hour >= closeHour;
      if (!outside) continue;
      const row = staffFor(l.userId, l.userName);
      if (row) row.offHoursEdits++;
    }
  }

  for (const l of logs) {
    const at = ms(l.createdAt);
    const row = staffFor(l.userId, l.userName);
    if (row && at) {
      row.lastActivity = Math.max(row.lastActivity, at);
      row.firstActivity = row.firstActivity ? Math.min(row.firstActivity, at) : at;
    }
  }

  const staff = [...staffById.values()];
  for (const s of staff) s.saleTimes.sort((a, b) => a - b);

  // A seller needs a floor of volume before a rate means anything. Six sales is
  // low enough to include a part-timer and high enough that one refund does not
  // read as a 100% void rate.
  const sellers = staff.filter((s) => s.sales >= 6);

  return {
    now,
    windowDays,
    currency,
    timeZone,
    ownerId,
    receipts,
    paid,
    products,
    productById,
    customerById,
    users,
    logs,
    voidLogs,
    adjustLogs,
    updateLogs,
    deleteLogs,
    accessLogs,
    settingsLogs,
    staff,
    staffById,
    sellers,
    openHour,
    closeHour,
    hoursEnforced,
    timedVoids,
    untimedVoids,
    attributedVoids,
    gaps: [],
  };
}

/** Void logs re-read as rows, for the detectors that need the pairing. */
function voidRows(ctx: Ctx): VoidRow[] {
  return ctx.voidLogs.map((l) => ({
    log: l,
    id: l.id ?? `${l.entityId}-${ms(l.createdAt)}`,
    at: ms(l.createdAt),
    total: num(l.details?.total),
    voidedBy: l.userId ?? 'unknown',
    voidedByName: l.userName ?? l.userEmail ?? 'Unknown user',
    soldBy: l.details?.soldBy ?? null,
    saleAt: ms(l.details?.saleCreatedAt) || null,
    receiptNumber: l.details?.receiptNumber ?? null,
    paymentMethod: l.details?.paymentMethod ?? null,
  }));
}

const who = (s: StaffAgg) => ({ id: s.id, name: s.name, role: s.role });
const money = (v: number, currency: string) => `${currency}${Math.round(v).toLocaleString()}`;

// ─────────────────────────────────────────────────────────────────────────────
// Detectors
//
// Each returns findings and may push a CoverageGap. They are listed in
// DETECTORS at the bottom; `checksTotal` is that array's length, so a detector
// cannot be added without the report admitting it exists.
// ─────────────────────────────────────────────────────────────────────────────

type Detector = { code: string; run: (ctx: Ctx) => Finding[] };

/** V1 — a sale rung up and killed by the same hands, minutes later. */
const detectSelfVoids: Detector = {
  code: 'V1',
  run: (ctx) => {
    const rows = voidRows(ctx);
    const out: Finding[] = [];

    if (ctx.voidLogs.length > 0 && ctx.attributedVoids === 0) {
      ctx.gaps.push({
        code: 'V1',
        title: 'Voids cannot be traced back to who made the sale',
        detail: `${ctx.voidLogs.length} void record(s) in this window do not record who originally rang the sale up, so a cashier voiding their own sale cannot be told apart from a manager correcting someone else's.`,
        fix: 'Newer voids capture this automatically. Voids recorded before this update stay unattributable — nothing can backfill them.',
      });
      return out;
    }

    const byStaff = new Map<string, VoidRow[]>();
    for (const r of rows) {
      if (!r.soldBy || r.soldBy !== r.voidedBy) continue;
      // A quick void by the person who sold it is the pattern; a self-void hours
      // later is usually the same person tidying up their own mistake, which V3
      // handles more gently.
      if (r.saleAt && r.at - r.saleAt > 2 * HOUR) continue;
      const list = byStaff.get(r.voidedBy) ?? [];
      list.push(r);
      byStaff.set(r.voidedBy, list);
    }

    for (const [staffId, list] of byStaff) {
      const s = ctx.staffById.get(staffId);
      if (!s || list.length < 2) continue;
      const value = round2(list.reduce((sum, r) => sum + r.total, 0));
      const rate = pct(list.length, Math.max(1, s.sales));

      out.push({
        id: `v1-${staffId}`,
        code: 'V1',
        group: 'voids',
        severity: value > 0 && list.length >= 4 ? 'critical' : 'high',
        confidence: 'strong',
        title: `${s.name} voided their own sales shortly after ringing them up`,
        what: `${list.length} sale(s) worth ${money(value, ctx.currency)} were rung up and then voided by ${s.name} within two hours — ${rate}% of the ${s.sales} sale(s) attributed to them in this window.`,
        why:
          'This is the standard cash-skim: the customer pays, the receipt is voided so nothing is owed to the till, and the cash walks. Stock goes back on the shelf, so a stocktake balances and only the takings are short. The innocent version is a cashier fixing their own mis-key — which normally happens within a minute or two and on small amounts, not repeatedly on round figures.',
        action: `Pull ${s.name}'s shifts for these times against the drawer count for those days. If the drawer balanced on paper every time, the cash was never in it.`,
        exposure: value,
        suspects: [who(s)],
        evidence: list.slice(0, 8).map((r) => ({
          kind: 'log' as const,
          id: r.log.id,
          label: `Voided ${r.receiptNumber ?? 'sale'} — ${money(r.total, ctx.currency)}${
            r.saleAt ? `, ${Math.max(1, Math.round((r.at - r.saleAt) / MINUTE))} min after the sale` : ''
          }`,
          at: r.at,
        })),
        relatedLogIds: list.map((r) => r.log.id).filter(Boolean),
        relatedReceiptIds: [],
        metric: { label: 'Self-voided sales', value: list.length, format: 'number' },
      });
    }
    return out;
  },
};

/** V2 — void volume out of line with the rest of the team. */
const detectVoidRateOutlier: Detector = {
  code: 'V2',
  run: (ctx) => {
    const out: Finding[] = [];
    const voiders = ctx.staff.filter((s) => s.voids > 0);
    if (voiders.length === 0) return out;

    // Rate needs a denominator. Compare voids per 100 sales where the person
    // sells, and raw counts where they only void (a manager-only account).
    const rated = ctx.sellers.filter((s) => s.voids > 0);
    for (const s of rated) {
      const rate = pct(s.voids, s.sales);
      const peer = peerMedian(ctx.sellers, s, (p) => pct(p.voids, p.sales));
      if (peer === null) continue;
      const beatsPeers = rate >= Math.max(peer * 2.5, peer + 4);
      if (!beatsPeers || s.voids < 3) continue;

      out.push({
        id: `v2-${s.id}`,
        code: 'V2',
        group: 'voids',
        severity: rate >= 15 ? 'high' : 'medium',
        confidence: 'strong',
        title: `${s.name} voids far more often than the rest of the team`,
        what: `${s.voids} void(s) across ${s.sales} sale(s) — a rate of ${rate}%, against a team median of ${peer}%. Value voided: ${money(s.voidValue, ctx.currency)}.`,
        why:
          'A void rate several times the team median is the single most reliable till-fraud indicator in retail, because a void is the only way to make a paid sale disappear without leaving a refund trail. Rule out the honest cause first: whoever staffs the returns counter or trains new cashiers will genuinely void more.',
        action: `Ask ${s.name} to route voids through a manager for two weeks. If the rate collapses, the voids were not corrections.`,
        exposure: s.voidValue,
        suspects: [who(s)],
        evidence: [
          { kind: 'staff', id: s.id, label: `${s.name} — ${s.voids} voids, ${s.sales} sales` },
          { kind: 'note', label: `Team median void rate: ${peer}%` },
        ],
        relatedLogIds: ctx.voidLogs.filter((l) => l.userId === s.id).map((l) => l.id).filter(Boolean),
        relatedReceiptIds: [],
        metric: { label: 'Void rate', value: rate, peer, format: 'percent' },
      });
    }

    // A void-only account: no sales of their own, yet voiding other people's.
    for (const s of voiders) {
      if (s.sales > 0 || s.voids < 4 || s.isOwner) continue;
      out.push({
        id: `v2b-${s.id}`,
        code: 'V2',
        group: 'voids',
        severity: 'medium',
        confidence: 'signal',
        title: `${s.name} voids sales but never records any`,
        what: `${s.voids} void(s) worth ${money(s.voidValue, ctx.currency)} from an account with no sales of its own in this window.`,
        why:
          'Expected from a supervisor who only authorises corrections. Worth confirming that is the role, because an account that only ever removes sales is also the cleanest way to run voids for someone else.',
        action: 'Confirm this account is meant to be a supervisor. If not, remove its void permission.',
        exposure: s.voidValue,
        suspects: [who(s)],
        evidence: [{ kind: 'staff', id: s.id, label: `${s.name} — ${s.voids} voids, 0 sales` }],
        relatedLogIds: ctx.voidLogs.filter((l) => l.userId === s.id).map((l) => l.id).filter(Boolean),
        relatedReceiptIds: [],
        metric: { label: 'Voids with no sales', value: s.voids, format: 'number' },
      });
    }
    return out;
  },
};

/** V3 — sales voided long after the shift they belong to. */
const detectLateVoids: Detector = {
  code: 'V3',
  run: (ctx) => {
    const rows = voidRows(ctx).filter((r) => r.saleAt && r.at - (r.saleAt as number) > 12 * HOUR);
    if (rows.length === 0) {
      if (ctx.voidLogs.length > 0 && ctx.timedVoids === 0) {
        ctx.gaps.push({
          code: 'V3',
          title: 'Void timing could not be measured',
          detail: `${ctx.untimedVoids} void record(s) do not carry the original sale's timestamp, so the delay between selling and voiding is unknown.`,
          fix: 'Voids recorded from now on include it. Older records cannot be repaired.',
        });
      }
      return [];
    }

    const byStaff = new Map<string, VoidRow[]>();
    for (const r of rows) {
      const list = byStaff.get(r.voidedBy) ?? [];
      list.push(r);
      byStaff.set(r.voidedBy, list);
    }

    const out: Finding[] = [];
    for (const [staffId, list] of byStaff) {
      const s = ctx.staffById.get(staffId);
      if (!s || list.length < 2) continue;
      const value = round2(list.reduce((sum, r) => sum + r.total, 0));
      const worstDays = Math.max(...list.map((r) => Math.round((r.at - (r.saleAt as number)) / DAY)));

      out.push({
        id: `v3-${staffId}`,
        code: 'V3',
        group: 'voids',
        severity: value > 0 && list.length >= 3 ? 'high' : 'medium',
        confidence: 'strong',
        title: `${s.name} voided sales from previous days`,
        what: `${list.length} sale(s) worth ${money(value, ctx.currency)} were voided more than 12 hours after they were rung up — the oldest ${worstDays} day(s) later.`,
        why:
          "A sale voided the next day cannot be a mis-key correction; the customer left with the goods long ago. It is how a till is made to balance retrospectively once someone knows the day's takings were short. It is also how a genuine returns process looks if returns are recorded as voids rather than refunds — check which of the two this shop does.",
        action:
          'Compare these dates against the daily takings for those days. If the void date is the day the shortfall was noticed rather than the day of the sale, the void is covering the gap.',
        exposure: value,
        suspects: [who(s)],
        evidence: list.slice(0, 8).map((r) => ({
          kind: 'log' as const,
          id: r.log.id,
          label: `${money(r.total, ctx.currency)} voided ${Math.round((r.at - (r.saleAt as number)) / DAY)} day(s) after the sale`,
          at: r.at,
        })),
        relatedLogIds: list.map((r) => r.log.id).filter(Boolean),
        relatedReceiptIds: [],
        metric: { label: 'Back-dated voids', value: list.length, format: 'number' },
      });
    }
    return out;
  },
};

/** D1 — discount generosity out of line with the team. */
const detectDiscountOutlier: Detector = {
  code: 'D1',
  run: (ctx) => {
    const out: Finding[] = [];
    const discounters = ctx.sellers.filter((s) => s.discountValue > 0);
    if (discounters.length === 0) return out;

    for (const s of discounters) {
      const share = pct(s.discountValue, Math.max(1, s.revenue + s.discountValue));
      const peer = peerMedian(ctx.sellers, s, (p) => pct(p.discountValue, Math.max(1, p.revenue + p.discountValue)));
      if (peer === null) continue;
      if (share < Math.max(peer * 2.5, peer + 3) || s.discountedSales < 4) continue;

      out.push({
        id: `d1-${s.id}`,
        code: 'D1',
        group: 'discounts',
        severity: share >= 15 ? 'high' : 'medium',
        confidence: 'strong',
        title: `${s.name} gives away a much larger share of the price than colleagues`,
        what: `${money(s.discountValue, ctx.currency)} discounted across ${s.discountedSales} sale(s) — ${share}% of what those sales would otherwise have taken, against a team median of ${peer}%.`,
        why:
          'A discount is the quietest way to move money: the sale is real, stock reconciles, and the difference is simply never charged. Where the customer pays full price in cash and the discount is keyed anyway, the gap goes in a pocket. The honest explanations are a haggling culture on the shop floor or one person handling all the trade accounts.',
        action: `Cap discounts above a set percentage to manager approval, then re-run this scan next week. Also check whether ${s.name}'s discounted sales are concentrated on a handful of customers.`,
        exposure: s.discountValue,
        suspects: [who(s)],
        evidence: [
          { kind: 'staff', id: s.id, label: `${s.name} — ${money(s.discountValue, ctx.currency)} discounted` },
          { kind: 'note', label: `Team median discount share: ${peer}%` },
        ],
        relatedLogIds: [],
        relatedReceiptIds: ctx.paid
          .filter((r) => r.createdBy === s.id && num(r.discount) > 0)
          .map((r) => r.id),
        metric: { label: 'Discount share of sales', value: share, peer, format: 'percent' },
      });
    }
    return out;
  },
};

/** D2 — "sweethearting": one member of staff discounting for one customer. */
const detectSweethearting: Detector = {
  code: 'D2',
  run: (ctx) => {
    const out: Finding[] = [];
    for (const s of ctx.staff) {
      if (s.discountValue <= 0 || s.discountedSales < 3) continue;
      const entries = [...s.discountByCustomer.entries()]
        .filter(([id]) => id !== '__walkin__')
        .sort((a, b) => b[1] - a[1]);
      if (entries.length === 0) continue;

      const [topId, topValue] = entries[0];
      const share = pct(topValue, s.discountValue);
      if (share < 55 || topValue <= 0) continue;

      const customer = ctx.customerById.get(topId);
      const customerName = customer?.name ?? `Customer ${topId.slice(0, 6)}`;
      const receipts = ctx.paid.filter(
        (r) => r.createdBy === s.id && num(r.discount) > 0 && r.customer?.id === topId,
      );
      if (receipts.length < 3) continue;

      out.push({
        id: `d2-${s.id}-${topId}`,
        code: 'D2',
        group: 'discounts',
        severity: share >= 80 ? 'high' : 'medium',
        confidence: 'strong',
        title: `${s.name}'s discounts nearly all go to one customer`,
        what: `${share}% of the ${money(s.discountValue, ctx.currency)} ${s.name} discounted went to ${customerName} across ${receipts.length} sale(s) — ${money(topValue, ctx.currency)}.`,
        why:
          'Retail calls this sweethearting: staff quietly under-charging a friend, relative or reseller. There is no cash missing from the drawer, so it survives every till reconciliation — it only shows as thin margins. A genuine wholesale or staff-family account looks identical, which is why the account itself is the thing to check, not the person.',
        action: `Confirm ${customerName} has an agreed discount on record. If not, the difference is a gift from the business.`,
        exposure: topValue,
        suspects: [who(s)],
        evidence: [
          { kind: 'staff', id: s.id, label: `${s.name} → ${customerName}` },
          ...receipts.slice(0, 6).map((r) => ({
            kind: 'receipt' as const,
            id: r.id,
            label: `${r.receiptNumber ?? r.id.slice(0, 8)} — ${money(num(r.discount), ctx.currency)} off`,
            amount: num(r.total),
            at: ms(r.createdAt),
          })),
        ],
        relatedLogIds: [],
        relatedReceiptIds: receipts.map((r) => r.id),
        metric: { label: 'Discounts to one customer', value: share, format: 'percent' },
      });
    }
    return out;
  },
};

/** D3 — items sold for less than they cost. */
const detectBelowCost: Detector = {
  code: 'D3',
  run: (ctx) => {
    const priced = ctx.products.filter((p) => num(p.costPrice) > 0).length;
    if (priced === 0) {
      ctx.gaps.push({
        code: 'D3',
        title: 'Selling below cost cannot be detected',
        detail: 'No product carries a cost price, so there is nothing to compare a selling price against.',
        fix: 'Add cost prices in Inventory. This also unlocks margin and profit reporting.',
      });
      return [];
    }

    const out: Finding[] = [];
    for (const s of ctx.staff) {
      if (s.belowCostLines < 2 || s.belowCostLoss <= 0) continue;
      const receipts = ctx.paid.filter(
        (r) =>
          r.createdBy === s.id &&
          (r.items ?? []).some((i: any) => num(i.costPrice) > 0 && num(i.price) < num(i.costPrice)),
      );

      out.push({
        id: `d3-${s.id}`,
        code: 'D3',
        group: 'discounts',
        severity: s.belowCostLoss > 0 && s.belowCostLines >= 5 ? 'high' : 'medium',
        confidence: 'confirmed',
        title: `${s.name} sold items for less than they cost`,
        what: `${s.belowCostLines} line(s) across ${receipts.length} sale(s) went out below cost price, losing ${money(s.belowCostLoss, ctx.currency)} of value.`,
        why:
          'Every one of these sales made the business poorer while still counting as a sale. Deliberate clearance is the innocent case and is normally a whole category at once, not scattered lines. Scattered ones point at a price being typed in at the till.',
        action: 'Open these receipts and check whether the price was typed over. If so, restrict price overrides to managers.',
        exposure: s.belowCostLoss,
        suspects: [who(s)],
        evidence: receipts.slice(0, 6).map((r) => ({
          kind: 'receipt' as const,
          id: r.id,
          label: `${r.receiptNumber ?? r.id.slice(0, 8)} — ${money(num(r.total), ctx.currency)}`,
          amount: num(r.total),
          at: ms(r.createdAt),
        })),
        relatedLogIds: [],
        relatedReceiptIds: receipts.map((r) => r.id),
        metric: { label: 'Value lost below cost', value: s.belowCostLoss, format: 'currency' },
      });
    }
    return out;
  },
};

/** D4 — prices typed over the shelf price at the till. */
const detectPriceOverrides: Detector = {
  code: 'D4',
  run: (ctx) => {
    const recorded = ctx.paid.some((r) => (r.items ?? []).some((i: any) => i?.priceOverridden !== undefined));
    const out: Finding[] = [];

    if (!recorded) {
      // Fall back to comparing against the product's *current* price. A
      // legitimate repricing since the sale is indistinguishable from an
      // override, so this can only ever be a signal — and it is stated as one.
      const suspicious = new Map<string, { lines: number; loss: number; receipts: string[] }>();
      for (const r of ctx.paid) {
        if (!r.createdBy) continue;
        for (const item of r.items ?? []) {
          const product = ctx.productById.get(item?.productId);
          const listed = num(product?.price);
          const paidPrice = num(item?.price);
          const qty = num(item?.quantity);
          if (listed <= 0 || qty <= 0 || paidPrice >= listed * 0.8) continue;
          const row = suspicious.get(r.createdBy) ?? { lines: 0, loss: 0, receipts: [] };
          row.lines++;
          row.loss = round2(row.loss + (listed - paidPrice) * qty);
          if (row.receipts.length < 6) row.receipts.push(r.id);
          suspicious.set(r.createdBy, row);
        }
      }
      for (const [staffId, row] of suspicious) {
        const s = ctx.staffById.get(staffId);
        if (!s || row.lines < 5) continue;
        out.push({
          id: `d4-fallback-${staffId}`,
          code: 'D4',
          group: 'discounts',
          severity: 'low',
          confidence: 'signal',
          title: `${s.name} sold items well under their current shelf price`,
          what: `${row.lines} line(s) went out at 20% or more below the price the product carries today — a difference of ${money(row.loss, ctx.currency)}.`,
          why:
            'This shop has no record of whether prices were typed over at the till, so this compares against the price each product carries **now**. A price that was legitimately raised after the sale looks exactly the same. Treat it as a prompt to check, not a finding.',
          action: 'Open a couple of these receipts and confirm the price matched the shelf on the day.',
          exposure: 0,
          suspects: [who(s)],
          evidence: row.receipts.map((id) => ({ kind: 'receipt' as const, id, label: `Receipt ${id.slice(0, 8)}` })),
          relatedLogIds: [],
          relatedReceiptIds: row.receipts,
          metric: { label: 'Lines under shelf price', value: row.lines, format: 'number' },
        });
      }
      ctx.gaps.push({
        code: 'D4',
        title: 'Price overrides at the till are not recorded on older sales',
        detail:
          'Sales recorded before this update do not say whether the cashier typed a price over the shelf price, so override abuse can only be inferred by comparing against current prices.',
        fix: 'New sales record it exactly. Re-run this scan in a week for a precise answer.',
      });
      return out;
    }

    for (const s of ctx.staff) {
      if (s.overrideLines < 3 || s.overrideLoss <= 0) continue;
      const peer = peerMedian(ctx.sellers, s, (p) => p.overrideLoss);
      const receipts = ctx.paid.filter(
        (r) => r.createdBy === s.id && (r.items ?? []).some((i: any) => i?.priceOverridden),
      );

      out.push({
        id: `d4-${s.id}`,
        code: 'D4',
        group: 'discounts',
        severity: s.overrideLines >= 8 ? 'high' : 'medium',
        confidence: 'confirmed',
        title: `${s.name} typed prices over the shelf price`,
        what: `${s.overrideLines} line(s) across ${receipts.length} sale(s) were sold at a price entered by hand, ${money(s.overrideLoss, ctx.currency)} below the listed price${
          peer !== null ? ` (team median: ${money(peer, ctx.currency)})` : ''
        }.`,
        why:
          'A manual price is the most direct way to under-charge without a discount showing on the receipt total. The customer can pay the full shelf price in cash while the till records less. Haggling and damaged-stock sales are the honest reasons, and both should be rare.',
        action: 'Turn price overrides into a manager-approved action, or require a reason at the till.',
        exposure: s.overrideLoss,
        suspects: [who(s)],
        evidence: receipts.slice(0, 6).map((r) => ({
          kind: 'receipt' as const,
          id: r.id,
          label: `${r.receiptNumber ?? r.id.slice(0, 8)} — ${money(num(r.total), ctx.currency)}`,
          amount: num(r.total),
          at: ms(r.createdAt),
        })),
        relatedLogIds: [],
        relatedReceiptIds: receipts.map((r) => r.id),
        metric: { label: 'Value given away by overrides', value: s.overrideLoss, peer, format: 'currency' },
      });
    }
    return out;
  },
};

/** C1 — one person's takings are disproportionately cash. */
const detectCashConcentration: Detector = {
  code: 'C1',
  run: (ctx) => {
    if (ctx.sellers.length < 3) return [];
    const out: Finding[] = [];
    for (const s of ctx.sellers) {
      const share = pct(s.cashRevenue, Math.max(1, s.revenue));
      const peer = peerMedian(ctx.sellers, s, (p) => pct(p.cashRevenue, Math.max(1, p.revenue)));
      if (peer === null || peer >= 85) continue; // a cash-only shop has nothing to compare
      if (share < Math.max(peer + 25, 50) || s.cashSales < 8) continue;

      out.push({
        id: `c1-${s.id}`,
        code: 'C1',
        group: 'cash',
        severity: 'medium',
        confidence: 'signal',
        title: `${s.name} takes noticeably more cash than colleagues`,
        what: `${share}% of ${s.name}'s ${money(s.revenue, ctx.currency)} came in as cash, against a team median of ${peer}%.`,
        why:
          'Cash is the only tender that can go missing without a bank record. Staff who steer customers to cash — "the card machine is slow today" — create the conditions for every other pattern in this report. On its own it proves nothing; alongside a void or discount flag for the same person it matters a great deal.',
        action: 'Check whether the card terminal was actually out of service on these shifts.',
        exposure: 0,
        suspects: [who(s)],
        evidence: [
          { kind: 'staff', id: s.id, label: `${s.name} — ${share}% cash` },
          { kind: 'note', label: `Team median: ${peer}% cash` },
        ],
        relatedLogIds: [],
        relatedReceiptIds: [],
        metric: { label: 'Cash share of takings', value: share, peer, format: 'percent' },
      });
    }
    return out;
  },
};

/** C2 — sales completed with no receipt handed over. */
const detectReceiptSuppression: Detector = {
  code: 'C2',
  run: (ctx) => {
    const anyReceiptData = ctx.paid.some((r) => r.receiptMethod);
    if (!anyReceiptData) {
      ctx.gaps.push({
        code: 'C2',
        title: 'Receipt delivery is not recorded on these sales',
        detail: 'None of the sales in this window record whether a receipt was printed or emailed.',
        fix: 'Newer sales record it. Nothing to change on your side.',
      });
      return [];
    }
    if (ctx.sellers.length < 3) return [];

    const out: Finding[] = [];
    for (const s of ctx.sellers) {
      const share = pct(s.noReceiptSales, Math.max(1, s.sales));
      const peer = peerMedian(ctx.sellers, s, (p) => pct(p.noReceiptSales, Math.max(1, p.sales)));
      if (peer === null || peer >= 80) continue;
      if (share < Math.max(peer + 30, 55) || s.noReceiptSales < 10) continue;

      out.push({
        id: `c2-${s.id}`,
        code: 'C2',
        group: 'cash',
        severity: 'medium',
        confidence: 'signal',
        title: `${s.name} rarely gives the customer a receipt`,
        what: `${s.noReceiptSales} of ${s.sales} sale(s) — ${share}% — ended with no receipt printed or emailed, against a team median of ${peer}%.`,
        why:
          'A customer holding a receipt is a second copy of the record; without one, the sale can be voided afterwards and no-one can contradict it. Receipt suppression usually appears just before void abuse does, which makes it an early warning rather than a loss in itself.',
        action: 'Make printing the default on the till, and spot-check that customers leave with one.',
        exposure: 0,
        suspects: [who(s)],
        evidence: [
          { kind: 'staff', id: s.id, label: `${s.name} — ${share}% with no receipt` },
          { kind: 'note', label: `Team median: ${peer}%` },
        ],
        relatedLogIds: [],
        relatedReceiptIds: [],
        metric: { label: 'Sales with no receipt', value: share, peer, format: 'percent' },
      });
    }
    return out;
  },
};

/** C3 — sales rung at nothing, to open the drawer or clear a basket. */
const detectZeroValueSales: Detector = {
  code: 'C3',
  run: (ctx) => {
    const zeros = ctx.paid.filter((r) => num(r.total) <= 0 && (r.items ?? []).length > 0);
    if (zeros.length < 2) return [];

    const byStaff = new Map<string, any[]>();
    for (const r of zeros) {
      const key = r.createdBy ?? 'unknown';
      byStaff.set(key, [...(byStaff.get(key) ?? []), r]);
    }

    const out: Finding[] = [];
    for (const [staffId, rows] of byStaff) {
      const s = ctx.staffById.get(staffId);
      const name = s?.name ?? 'An unidentified account';
      const goodsValue = round2(
        rows.reduce(
          (sum, r) =>
            sum +
            (r.items ?? []).reduce(
              (inner: number, i: any) => inner + num(i.costPrice || i.price) * num(i.quantity),
              0,
            ),
          0,
        ),
      );

      out.push({
        id: `c3-${staffId}`,
        code: 'C3',
        group: 'cash',
        severity: goodsValue > 0 ? 'high' : 'medium',
        confidence: 'confirmed',
        title: `${name} recorded sales that charged nothing`,
        what: `${rows.length} sale(s) with items on them totalled zero or less. The goods involved were worth about ${money(goodsValue, ctx.currency)}.`,
        why:
          'Stock left the shelf and no money was recorded against it. A zero sale is also the classic way to make the cash drawer open without a transaction. A 100% staff discount or a written-off damaged item can look like this — but those should be recorded as an adjustment, not a sale.',
        action: 'Open these sales and establish what left the shop and who authorised it.',
        exposure: goodsValue,
        suspects: s ? [who(s)] : [],
        evidence: rows.slice(0, 6).map((r) => ({
          kind: 'receipt' as const,
          id: r.id,
          label: `${r.receiptNumber ?? r.id.slice(0, 8)} — ${(r.items ?? []).length} item(s), ${money(num(r.total), ctx.currency)}`,
          at: ms(r.createdAt),
        })),
        relatedLogIds: [],
        relatedReceiptIds: rows.map((r) => r.id),
        metric: { label: 'Zero-value sales', value: rows.length, format: 'number' },
      });
    }
    return out;
  },
};

/** T1 — sales rung outside the shop's own trading hours. */
const detectOffHoursSales: Detector = {
  code: 'T1',
  run: (ctx) => {
    if (!ctx.openHour && !ctx.closeHour) {
      ctx.gaps.push({
        code: 'T1',
        title: 'Trading hours are not set',
        detail: 'Without opening and closing times, a sale at 3am cannot be told apart from one at 3pm.',
        fix: 'Set your operating hours in Settings. Sales outside them are then flagged at the till automatically.',
      });
      return [];
    }

    const flagged = ctx.paid.filter((r) => r.flagged?.reason === 'outside_operating_hours');
    if (flagged.length === 0) return [];

    const byStaff = new Map<string, any[]>();
    for (const r of flagged) {
      const key = r.createdBy ?? 'unknown';
      byStaff.set(key, [...(byStaff.get(key) ?? []), r]);
    }

    const out: Finding[] = [];
    for (const [staffId, rows] of byStaff) {
      const s = ctx.staffById.get(staffId);
      const name = s?.name ?? 'An unidentified account';
      const value = round2(rows.reduce((sum, r) => sum + num(r.total), 0));
      if (rows.length < 2) continue;

      out.push({
        id: `t1-${staffId}`,
        code: 'T1',
        group: 'timing',
        severity: rows.length >= 6 ? 'high' : 'medium',
        confidence: 'confirmed',
        title: `${name} rang up sales outside trading hours`,
        what: `${rows.length} sale(s) worth ${money(value, ctx.currency)} were recorded when the shop was closed.`,
        why:
          'Trading with the shutters down means no other member of staff and no customer is present to corroborate the record. It is also how a shift is reconstructed after the fact — entering the day\'s "missing" sales late at night so the totals agree. Late deliveries and genuine overtime are the honest reasons, and both should be recognisable to you.',
        action: ctx.hoursEnforced
          ? 'Sales outside hours are already blocked at the till, so these were recorded with the setting off, or from a device with the wrong clock. Check both.'
          : 'Turn on "prevent sales outside hours" in Settings so this is blocked rather than merely noted.',
        exposure: 0,
        suspects: s ? [who(s)] : [],
        evidence: rows.slice(0, 6).map((r) => ({
          kind: 'receipt' as const,
          id: r.id,
          label: `${r.receiptNumber ?? r.id.slice(0, 8)} — ${money(num(r.total), ctx.currency)}`,
          amount: num(r.total),
          at: ms(r.createdAt),
        })),
        relatedLogIds: [],
        relatedReceiptIds: rows.map((r) => r.id),
        metric: { label: 'Sales while closed', value: rows.length, format: 'number' },
      });
    }
    return out;
  },
};

/** T2 — stock and price edits made when nobody is meant to be in the shop. */
const detectOffHoursEdits: Detector = {
  code: 'T2',
  run: (ctx) => {
    if (ctx.openHour === null || ctx.closeHour === null) return [];
    const out: Finding[] = [];

    for (const s of ctx.staff) {
      // Owners work whenever they like; the point of this check is staff.
      if (s.isOwner || s.offHoursEdits < 4) continue;
      const sensitive = ctx.logs.filter((l) => l.userId === s.id);
      const rows = ctx.logs.filter((l) => {
        if (l.userId !== s.id) return false;
        const at = ms(l.createdAt);
        if (!at) return false;
        const hour = hourInZone(at, ctx.timeZone);
        return ctx.closeHour! > ctx.openHour!
          ? hour < ctx.openHour! || hour >= ctx.closeHour!
          : hour < ctx.openHour! && hour >= ctx.closeHour!;
      });
      const stockRows = rows.filter(
        (l) => String(l.action ?? '').startsWith('product.') || String(l.action ?? '').startsWith('stock.'),
      );
      if (stockRows.length < 3) continue;

      out.push({
        id: `t2-${s.id}`,
        code: 'T2',
        group: 'timing',
        severity: 'medium',
        confidence: 'strong',
        title: `${s.name} edits stock and prices while the shop is closed`,
        what: `${stockRows.length} stock or product change(s) were made outside trading hours, out of ${sensitive.length} recorded action(s) by this account.`,
        why:
          'Changes made when no-one else is present are the ones nobody can question. Correcting a count the morning of a stocktake is normal; repeatedly adjusting stock at night is how a shortfall is written off quietly.',
        action: `Ask ${s.name} what these changes were for, and compare them against any stocktake sheets for those dates.`,
        exposure: 0,
        suspects: [who(s)],
        evidence: stockRows.slice(0, 6).map((l) => ({
          kind: 'log' as const,
          id: l.id,
          label: `${l.action} — ${l.details?.entityName ?? l.entityId ?? ''} at ${String(
            hourInZone(ms(l.createdAt), ctx.timeZone),
          ).padStart(2, '0')}:00`,
          at: ms(l.createdAt),
        })),
        relatedLogIds: stockRows.map((l) => l.id).filter(Boolean),
        relatedReceiptIds: [],
        metric: { label: 'Out-of-hours stock edits', value: stockRows.length, format: 'number' },
      });
    }
    return out;
  },
};

/** T3 — sales entered against a date the person chose. */
const detectBackdating: Detector = {
  code: 'T3',
  run: (ctx) => {
    const out: Finding[] = [];
    const logs = ctx.logs.filter((l) => String(l.action ?? '') === 'sale.backdated');
    const byStaff = new Map<string, any[]>();

    for (const l of logs) {
      const key = l.userId ?? 'unknown';
      byStaff.set(key, [...(byStaff.get(key) ?? []), l]);
    }
    // Receipts carry the flag too, and survive even if the log write failed.
    for (const r of ctx.paid.filter((r) => r.isBackdated)) {
      const key = r.createdBy ?? 'unknown';
      if (byStaff.has(key)) continue;
      byStaff.set(key, []);
    }

    for (const [staffId, rows] of byStaff) {
      const s = ctx.staffById.get(staffId);
      const receipts = ctx.paid.filter((r) => r.isBackdated && r.createdBy === staffId);
      const count = Math.max(rows.length, receipts.length);
      if (count < 2) continue;
      const value = round2(
        rows.reduce((sum, l) => sum + num(l.details?.total), 0) ||
          receipts.reduce((sum, r) => sum + num(r.total), 0),
      );
      const name = s?.name ?? 'An unidentified account';
      const isOwner = s?.isOwner ?? false;

      out.push({
        id: `t3-${staffId}`,
        code: 'T3',
        group: 'timing',
        severity: isOwner ? 'low' : count >= 5 ? 'high' : 'medium',
        confidence: 'confirmed',
        title: `${name} recorded sales against a chosen date`,
        what: `${count} sale(s)${value > 0 ? ` worth ${money(value, ctx.currency)}` : ''} were entered with a hand-picked date rather than the time they were rung up.`,
        why: isOwner
          ? 'Expected from an owner catching up after an outage or a busy day. Listed for completeness because backdating moves revenue between days, so it changes what every daily report says.'
          : 'Backdating decides which day the money belongs to. It is the tool for making a short day look whole using a later day\'s takings, and for hiding a sale in a period nobody reviews any more. Recovering sales after an outage is the honest reason — that produces a cluster on one date, not a scatter.',
        action: isOwner
          ? 'No action needed unless the dates surprise you.'
          : `Restrict backdating to owner and manager roles, and check these dates against the takings ${name} reported for them.`,
        exposure: 0,
        suspects: s ? [who(s)] : [],
        evidence: [
          ...rows.slice(0, 4).map((l) => ({
            kind: 'log' as const,
            id: l.id,
            label: `Dated ${String(l.details?.backdatedTo ?? '').slice(0, 10)}, entered ${String(
              l.details?.recordedAt ?? '',
            ).slice(0, 10)}`,
            at: ms(l.createdAt),
          })),
          ...receipts.slice(0, 4).map((r) => ({
            kind: 'receipt' as const,
            id: r.id,
            label: `${r.receiptNumber ?? r.id.slice(0, 8)} — ${money(num(r.total), ctx.currency)}`,
            at: ms(r.createdAt),
          })),
        ],
        relatedLogIds: rows.map((l) => l.id).filter(Boolean),
        relatedReceiptIds: receipts.map((r) => r.id),
        metric: { label: 'Backdated sales', value: count, format: 'number' },
      });
    }
    return out;
  },
};

/** T4 — one till doing its business while disconnected. */
const detectOfflineConcentration: Detector = {
  code: 'T4',
  run: (ctx) => {
    if (ctx.sellers.length < 3) return [];
    const out: Finding[] = [];
    for (const s of ctx.sellers) {
      const share = pct(s.offlineSales, Math.max(1, s.sales));
      const peer = peerMedian(ctx.sellers, s, (p) => pct(p.offlineSales, Math.max(1, p.sales)));
      if (peer === null) continue;
      if (share < Math.max(peer + 35, 45) || s.offlineSales < 10) continue;

      out.push({
        id: `t4-${s.id}`,
        code: 'T4',
        group: 'timing',
        severity: 'low',
        confidence: 'signal',
        title: `${s.name}'s sales are recorded offline far more than anyone else's`,
        what: `${s.offlineSales} of ${s.sales} sale(s) — ${share}% — were recorded with no connection, against a team median of ${peer}%.`,
        why:
          'Offline sales are queued on the device and land later, so for a while they are only in one place. Working offline deliberately widens the window in which a sale can be dropped before anyone sees it. Poor signal in one part of the shop is the usual and entirely innocent explanation.',
        action: 'Check the network where this till sits. If the signal is fine, ask why the device is offline.',
        exposure: 0,
        suspects: [who(s)],
        evidence: [
          { kind: 'staff', id: s.id, label: `${s.name} — ${share}% offline` },
          { kind: 'note', label: `Team median: ${peer}%` },
        ],
        relatedLogIds: [],
        relatedReceiptIds: [],
        metric: { label: 'Offline sales', value: share, peer, format: 'percent' },
      });
    }
    return out;
  },
};

/** T5 — sales fired faster than a human can serve. */
const detectImpossibleCadence: Detector = {
  code: 'T5',
  run: (ctx) => {
    const out: Finding[] = [];
    for (const s of ctx.staff) {
      if (s.saleTimes.length < 5) continue;
      let burst = 0;
      const examples: number[] = [];
      const days = new Set<string>();
      for (let i = 1; i < s.saleTimes.length; i++) {
        const gap = s.saleTimes[i] - s.saleTimes[i - 1];
        // `gap > 0` is load-bearing, not defensive. Several receipts committed in
        // one batch — an offline queue flushing after an outage — all carry the
        // *same* server timestamp, so they sit at a gap of exactly zero. Counting
        // those made every cashier who had ever worked offline look like they
        // were generating sales, which is the one thing this check must not do.
        if (gap > 0 && gap < 5000) {
          burst++;
          days.add(dayKey(s.saleTimes[i]));
          if (examples.length < 5) examples.push(s.saleTimes[i]);
        }
      }
      if (burst < 4) continue;

      // Confined to one day it is almost always a sync artefact; spread across
      // several it is a habit, and a habit is a person.
      const oneDay = days.size <= 1;

      out.push({
        id: `t5-${s.id}`,
        code: 'T5',
        group: 'integrity',
        severity: oneDay ? 'low' : 'medium',
        confidence: oneDay ? 'signal' : 'strong',
        title: `${s.name} recorded sales faster than they could be served`,
        what: `${burst} sale(s) landed less than five seconds after the previous one on the same account, across ${days.size} day(s).${
          oneDay
            ? ' All on a single day, which is what a batch of offline sales looks like when it finally syncs.'
            : ' Spread across several days, so a one-off sync after an outage does not explain it.'
        }`,
        why:
          'Nobody serves a customer, takes payment and starts again inside five seconds. Sales appearing at that rate are either being generated rather than made — padding a commission, a target or a takings figure — or they are a queue of offline sales landing at once, which is harmless and shows up on one date only.',
        action: oneDay
          ? 'Check whether this device was offline that day. If it was, nothing to do.'
          : 'These are not a sync artefact. Compare the count of sales against what was physically sold on those days.',
        exposure: 0,
        suspects: [who(s)],
        evidence: examples.map((at) => ({
          kind: 'note' as const,
          label: `Burst at ${new Date(at).toISOString().replace('T', ' ').slice(0, 19)}`,
        })),
        relatedLogIds: [],
        relatedReceiptIds: [],
        metric: { label: 'Sub-5-second gaps', value: burst, format: 'number' },
      });
    }
    return out;
  },
};

/** S1 — stock written down, which is shrinkage by another name. */
const detectWriteOffOutlier: Detector = {
  code: 'S1',
  run: (ctx) => {
    const adjusters = ctx.staff.filter((s) => s.adjustDown > 0);
    if (adjusters.length === 0) return [];

    const out: Finding[] = [];
    for (const s of adjusters) {
      if (s.adjustDown < 3) continue;
      const peer = peerMedian(adjusters, s, (p) => p.valueRemoved);
      const beatsPeers = peer !== null && s.valueRemoved >= Math.max(peer * 3, peer + 1);
      const largeAlone = peer === null && s.adjustDown >= 6;
      if (!beatsPeers && !largeAlone) continue;

      const rows = ctx.adjustLogs.filter((l) => l.userId === s.id && num(l.details?.adjustment) < 0);

      out.push({
        id: `s1-${s.id}`,
        code: 'S1',
        group: 'stock',
        severity: s.valueRemoved > 0 && s.adjustDown >= 8 ? 'high' : 'medium',
        confidence: 'strong',
        title: `${s.name} writes off much more stock than colleagues`,
        what: `${s.adjustDown} downward adjustment(s) removed ${Math.round(s.unitsRemoved)} unit(s) worth about ${money(s.valueRemoved, ctx.currency)}${
          peer !== null ? `, against a team median of ${money(peer, ctx.currency)}` : ''
        }.`,
        why:
          'A downward adjustment tells the system stock is gone without a sale. That is exactly what has to happen after goods walk out, and it is the last step in almost every inventory theft: take the item, then correct the count so the shelf and the system agree. Damages, expiry and a genuine mis-count are the honest reasons and normally carry a stated reason.',
        action: `Ask ${s.name} for the physical evidence behind the largest of these — the damaged goods, the expiry bin, the stocktake sheet. Require a reason on every adjustment from now on.`,
        exposure: s.valueRemoved,
        suspects: [who(s)],
        evidence: rows.slice(0, 8).map((l) => ({
          kind: 'log' as const,
          id: l.id,
          label: `${l.details?.entityName ?? l.entityId} — ${num(l.details?.adjustment)} unit(s)${
            l.details?.reason ? ` (${l.details.reason})` : ' (no reason given)'
          }`,
          at: ms(l.createdAt),
        })),
        relatedLogIds: rows.map((l) => l.id).filter(Boolean),
        relatedReceiptIds: [],
        metric: { label: 'Value written off', value: s.valueRemoved, peer, format: 'currency' },
      });
    }
    return out;
  },
};

/** S2 — the same product written down again and again. */
const detectRepeatAdjustments: Detector = {
  code: 'S2',
  run: (ctx) => {
    const byProduct = new Map<string, any[]>();
    for (const l of ctx.adjustLogs) {
      if (num(l.details?.adjustment) >= 0) continue;
      const key = l.entityId;
      if (!key) continue;
      byProduct.set(key, [...(byProduct.get(key) ?? []), l]);
    }

    const out: Finding[] = [];
    for (const [productId, rows] of byProduct) {
      if (rows.length < 3) continue;
      const product = ctx.productById.get(productId);
      const name = product?.name ?? rows[0].details?.entityName ?? productId;
      const unitCost = num(product?.costPrice) || num(product?.price);
      const units = rows.reduce((sum, l) => sum + Math.abs(num(l.details?.adjustment)), 0);
      const value = round2(units * unitCost);
      const actors = [...new Set(rows.map((l) => l.userName ?? l.userId).filter(Boolean))];
      const suspects = [...new Set(rows.map((l) => l.userId).filter(Boolean))]
        .map((id) => ctx.staffById.get(id as string))
        .filter(Boolean)
        .map((s) => who(s as StaffAgg));

      out.push({
        id: `s2-${productId}`,
        code: 'S2',
        group: 'stock',
        severity: rows.length >= 6 ? 'high' : 'medium',
        confidence: 'strong',
        title: `${name} keeps losing stock to adjustments`,
        what: `${rows.length} separate downward adjustment(s) removed ${Math.round(units)} unit(s) of ${name}${
          value > 0 ? `, worth about ${money(value, ctx.currency)}` : ''
        }. Made by: ${actors.join(', ') || 'unknown'}.`,
        why:
          'One bad count is a mistake. The same item corrected downward again and again means the count and the shelf keep disagreeing in the same direction — which is what steady, small-scale removal looks like. Fragile or perishable goods do this honestly; a phone accessory does not.',
        action: `Count ${name} today, then again in a week without telling anyone the count is happening. If it drops again with no sales, the loss is physical.`,
        exposure: value,
        suspects,
        evidence: rows.slice(0, 8).map((l) => ({
          kind: 'log' as const,
          id: l.id,
          label: `${num(l.details?.adjustment)} unit(s) by ${l.userName ?? 'unknown'}${
            l.details?.reason ? ` — ${l.details.reason}` : ''
          }`,
          at: ms(l.createdAt),
        })),
        relatedLogIds: rows.map((l) => l.id).filter(Boolean),
        relatedReceiptIds: [],
        metric: { label: 'Downward adjustments', value: rows.length, format: 'number' },
      });
    }
    return out.sort((a, b) => b.exposure - a.exposure).slice(0, 6);
  },
};

/** S3 — one adjustment large enough to matter on its own. */
const detectLargeWriteOff: Detector = {
  code: 'S3',
  run: (ctx) => {
    // Scale the threshold to the shop: 2% of the window's takings, floored so a
    // brand-new account with no sales still gets a sane number.
    const revenue = ctx.paid.reduce((sum, r) => sum + num(r.total), 0);
    const threshold = Math.max(revenue * 0.02, 5000);
    const out: Finding[] = [];

    for (const l of ctx.adjustLogs) {
      const delta = num(l.details?.adjustment);
      if (delta >= 0) continue;
      const product = ctx.productById.get(l.entityId);
      const unitCost = num(product?.costPrice) || num(product?.price);
      const value = round2(Math.abs(delta) * unitCost);
      if (value < threshold) continue;

      const s = ctx.staffById.get(l.userId);
      out.push({
        id: `s3-${l.id ?? l.entityId}-${ms(l.createdAt)}`,
        code: 'S3',
        group: 'stock',
        severity: value >= threshold * 3 ? 'high' : 'medium',
        confidence: 'confirmed',
        title: `A single write-off removed ${money(value, ctx.currency)} of stock`,
        what: `${l.userName ?? 'An unidentified account'} reduced ${
          product?.name ?? l.details?.entityName ?? l.entityId
        } by ${Math.abs(delta)} unit(s)${l.details?.reason ? ` — reason given: "${l.details.reason}"` : ' with no reason given'}.`,
        why:
          'A write-off of this size against this shop\'s turnover is a material loss whichever way it happened. Either the goods are genuinely gone, in which case it needs an insurance or supplier claim, or the count was wrong, in which case the count before it was wrong too.',
        action: 'Establish which of the two it was, in writing, today. A write-off this size should never be a single tap.',
        exposure: value,
        suspects: s ? [who(s)] : [],
        evidence: [
          { kind: 'log', id: l.id, label: `${Math.abs(delta)} unit(s) removed`, at: ms(l.createdAt) },
          ...(product ? [{ kind: 'product' as const, id: product.id, label: product.name, amount: value }] : []),
        ],
        relatedLogIds: [l.id].filter(Boolean),
        relatedReceiptIds: [],
        metric: { label: 'Value removed', value, format: 'currency' },
      });
    }
    return out.sort((a, b) => b.exposure - a.exposure).slice(0, 5);
  },
};

/** S4 — stock written down within minutes of selling the same item. */
const detectAdjustAroundSale: Detector = {
  code: 'S4',
  run: (ctx) => {
    const out: Finding[] = [];
    const salesByProduct = new Map<string, { at: number; receipt: any }[]>();
    for (const r of ctx.paid) {
      const at = ms(r.createdAt);
      if (!at) continue;
      for (const item of r.items ?? []) {
        if (!item?.productId) continue;
        salesByProduct.set(item.productId, [
          ...(salesByProduct.get(item.productId) ?? []),
          { at, receipt: r },
        ]);
      }
    }

    const hits: { log: any; receipt: any; gapMin: number; value: number }[] = [];
    for (const l of ctx.adjustLogs) {
      const delta = num(l.details?.adjustment);
      if (delta >= 0) continue;
      const at = ms(l.createdAt);
      if (!at) continue;
      const sales = salesByProduct.get(l.entityId) ?? [];
      const near = sales.find((s) => Math.abs(s.at - at) <= 20 * MINUTE);
      if (!near) continue;
      const product = ctx.productById.get(l.entityId);
      const unitCost = num(product?.costPrice) || num(product?.price);
      hits.push({
        log: l,
        receipt: near.receipt,
        gapMin: Math.max(1, Math.round(Math.abs(near.at - at) / MINUTE)),
        value: round2(Math.abs(delta) * unitCost),
      });
    }
    if (hits.length < 2) return out;

    const byStaff = new Map<string, typeof hits>();
    for (const h of hits) {
      const key = h.log.userId ?? 'unknown';
      byStaff.set(key, [...(byStaff.get(key) ?? []), h]);
    }

    for (const [staffId, rows] of byStaff) {
      if (rows.length < 2) continue;
      const s = ctx.staffById.get(staffId);
      const value = round2(rows.reduce((sum, r) => sum + r.value, 0));

      out.push({
        id: `s4-${staffId}`,
        code: 'S4',
        group: 'stock',
        severity: 'high',
        confidence: 'strong',
        title: `${s?.name ?? 'An unidentified account'} adjusted stock down minutes either side of selling it`,
        what: `${rows.length} adjustment(s) worth about ${money(value, ctx.currency)} landed within 20 minutes of a sale of the same product — the closest ${Math.min(
          ...rows.map((r) => r.gapMin),
        )} minute(s) apart.`,
        why:
          'The sale already reduced the count. Reducing it again immediately means the shelf is short by twice what was sold, and the second unit left without being paid for. This is the pattern behind "one for the customer, one for me". A cashier fixing a count they had just noticed was wrong is the honest version, and it does not repeat.',
        action: 'Count these specific products now. The pattern predicts the shelf is short of the system, not over.',
        exposure: value,
        suspects: s ? [who(s)] : [],
        evidence: rows.slice(0, 6).map((r) => ({
          kind: 'log' as const,
          id: r.log.id,
          label: `${r.log.details?.entityName ?? r.log.entityId} — ${num(
            r.log.details?.adjustment,
          )} unit(s), ${r.gapMin} min from sale ${r.receipt.receiptNumber ?? r.receipt.id.slice(0, 8)}`,
          at: ms(r.log.createdAt),
        })),
        relatedLogIds: rows.map((r) => r.log.id).filter(Boolean),
        relatedReceiptIds: rows.map((r) => r.receipt.id),
        metric: { label: 'Adjustments beside a sale', value: rows.length, format: 'number' },
      });
    }
    return out;
  },
};

/** S5 — counts below zero, which only happens when stock left unrecorded. */
const detectNegativeStock: Detector = {
  code: 'S5',
  run: (ctx) => {
    const negatives = ctx.products.filter((p) => !isServiceItem(p) && num(p.stock) < 0);
    if (negatives.length === 0) return [];

    const value = round2(
      negatives.reduce((sum, p) => sum + Math.abs(num(p.stock)) * (num(p.costPrice) || num(p.price)), 0),
    );

    return [
      {
        id: 's5-negative-stock',
        code: 'S5',
        group: 'stock',
        severity: negatives.length >= 5 ? 'high' : 'medium',
        confidence: 'confirmed',
        title: `${negatives.length} product(s) show a negative stock count`,
        what: `The system believes it has less than nothing of ${negatives
          .slice(0, 4)
          .map((p) => p.name)
          .join(', ')}${negatives.length > 4 ? ` and ${negatives.length - 4} more` : ''} — about ${money(
          value,
          ctx.currency,
        )} of goods sold that were never recorded as received.`,
        why:
          'A count can only go below zero if more was sold than the system knew existed. Either deliveries are not being entered, or stock was removed from the count by an adjustment and then sold anyway. Both make every stock figure and every profit figure downstream wrong.',
        action: 'Enter the missing deliveries for these items, then recount them. Until then their margins are fiction.',
        exposure: value,
        suspects: [],
        evidence: negatives.slice(0, 8).map((p) => ({
          kind: 'product' as const,
          id: p.id,
          label: `${p.name} — ${num(p.stock)} in stock`,
          amount: Math.abs(num(p.stock)) * (num(p.costPrice) || num(p.price)),
        })),
        relatedLogIds: [],
        relatedReceiptIds: [],
        metric: { label: 'Products below zero', value: negatives.length, format: 'number' },
      },
    ];
  },
};

/** S6 — products deleted while they still had stock on the shelf. */
const detectDeleteWithStock: Detector = {
  code: 'S6',
  run: (ctx) => {
    const rows = ctx.deleteLogs.filter(
      (l) => String(l.action ?? '') === 'product.delete' && num(l.details?.stockAtDeletion) > 0,
    );
    if (rows.length === 0) {
      const anyDeletes = ctx.logs.some((l) => String(l.action ?? '') === 'product.delete');
      if (!anyDeletes) {
        ctx.gaps.push({
          code: 'S6',
          title: 'Product deletions are only recorded on newer versions',
          detail:
            'A product deleted while it still had stock erases the shortage along with the item. No deletion records were found in this window, which may mean none happened — or that they predate this logging.',
          fix: 'Deletions from now on record the stock that was on hand at the time.',
        });
      }
      return [];
    }

    const out: Finding[] = [];
    const byStaff = new Map<string, any[]>();
    for (const l of rows) byStaff.set(l.userId ?? 'unknown', [...(byStaff.get(l.userId ?? 'unknown') ?? []), l]);

    for (const [staffId, logs] of byStaff) {
      const s = ctx.staffById.get(staffId);
      const value = round2(
        logs.reduce((sum, l) => sum + num(l.details?.stockAtDeletion) * num(l.details?.costPrice || l.details?.price), 0),
      );
      out.push({
        id: `s6-${staffId}`,
        code: 'S6',
        group: 'stock',
        severity: 'high',
        confidence: 'confirmed',
        title: `${s?.name ?? 'An unidentified account'} deleted products that still had stock`,
        what: `${logs.length} product(s) were deleted while the system still showed stock on hand${
          value > 0 ? `, worth about ${money(value, ctx.currency)}` : ''
        }: ${logs.slice(0, 4).map((l) => `${l.details?.entityName ?? l.entityId} (${num(l.details?.stockAtDeletion)})`).join(', ')}.`,
        why:
          'Deleting a product removes the item and its outstanding count in one action, so a shortage disappears without ever being written off. It is the cleanest way to erase missing stock, because there is no adjustment left behind to question. Tidying up a line that was genuinely discontinued is the innocent case — and that is normally done once the count is already zero.',
        action: 'Establish where the stock for these lines physically went before accepting the deletion.',
        exposure: value,
        suspects: s ? [who(s)] : [],
        evidence: logs.slice(0, 6).map((l) => ({
          kind: 'log' as const,
          id: l.id,
          label: `${l.details?.entityName ?? l.entityId} deleted with ${num(l.details?.stockAtDeletion)} in stock`,
          at: ms(l.createdAt),
        })),
        relatedLogIds: logs.map((l) => l.id).filter(Boolean),
        relatedReceiptIds: [],
        metric: { label: 'Deleted with stock', value: logs.length, format: 'number' },
      });
    }
    return out;
  },
};

/** S7 — the price-swap: cut the price, sell, put it back. */
const detectPriceSwap: Detector = {
  code: 'S7',
  run: (ctx) => {
    const priceEdits = ctx.updateLogs.filter((l) => l.details?.changes?.price);
    if (priceEdits.length === 0) {
      ctx.gaps.push({
        code: 'S7',
        title: 'Price changes are only recorded on newer versions',
        detail:
          'The price-swap — drop a price, sell the item, put the price back — can only be detected if both edits are recorded. No price-change records were found in this window.',
        fix: 'Price and cost edits from now on record the old and new value. Re-run this scan in a week.',
      });
      return [];
    }

    // Pair a cut with a restore on the same product within 24h, and look for a
    // sale in between.
    const byProduct = new Map<string, any[]>();
    for (const l of priceEdits) byProduct.set(l.entityId, [...(byProduct.get(l.entityId) ?? []), l]);

    const out: Finding[] = [];
    for (const [productId, edits] of byProduct) {
      const sorted = edits.sort((a, b) => ms(a.createdAt) - ms(b.createdAt));
      for (let i = 0; i < sorted.length - 1; i++) {
        const cut = sorted[i];
        const from = num(cut.details.changes.price.from);
        const to = num(cut.details.changes.price.to);
        if (!(from > to && to >= 0)) continue;

        const restore = sorted
          .slice(i + 1)
          .find(
            (l) =>
              ms(l.createdAt) - ms(cut.createdAt) <= DAY &&
              num(l.details.changes.price.to) >= from * 0.98,
          );
        if (!restore) continue;

        const window: [number, number] = [ms(cut.createdAt), ms(restore.createdAt)];
        const salesInside = ctx.paid.filter((r) => {
          const at = ms(r.createdAt);
          if (at < window[0] || at > window[1]) return false;
          return (r.items ?? []).some((it: any) => it?.productId === productId);
        });
        if (salesInside.length === 0) continue;

        const product = ctx.productById.get(productId);
        const units = salesInside.reduce(
          (sum, r) =>
            sum +
            (r.items ?? [])
              .filter((it: any) => it?.productId === productId)
              .reduce((inner: number, it: any) => inner + num(it.quantity), 0),
          0,
        );
        const loss = round2((from - to) * units);
        const editor = ctx.staffById.get(cut.userId);
        const sellers = [...new Set(salesInside.map((r) => r.createdBy).filter(Boolean))]
          .map((id) => ctx.staffById.get(id as string))
          .filter(Boolean) as StaffAgg[];

        out.push({
          id: `s7-${productId}-${window[0]}`,
          code: 'S7',
          group: 'stock',
          severity: 'critical',
          confidence: 'strong',
          title: `${product?.name ?? cut.details?.entityName ?? productId} was cheapened, sold, then put back`,
          what: `${editor?.name ?? 'Someone'} cut the price from ${money(from, ctx.currency)} to ${money(
            to,
            ctx.currency,
          )}, ${units} unit(s) sold across ${salesInside.length} sale(s) in the ${Math.max(
            1,
            Math.round((window[1] - window[0]) / MINUTE),
          )} minutes that followed, then the price was restored to ${money(
            num(restore.details.changes.price.to),
            ctx.currency,
          )}. Difference: ${money(loss, ctx.currency)}.`,
          why:
            'This is the price-swap, and it has almost no innocent explanation. A genuine promotion is announced, lasts longer than a few minutes and is not reversed the moment a sale goes through. The point of restoring the price is that the shelf, the catalogue and every later report all agree — only the receipt in the middle is cheap. Whoever paid may well have handed over the full price.',
          action: `Compare the receipt total against what the customer actually paid. Then remove price-edit permission from ${
            editor?.name ?? 'this account'
          } until it is explained.`,
          exposure: loss,
          suspects: [...(editor ? [who(editor)] : []), ...sellers.filter((s) => s.id !== editor?.id).map(who)],
          evidence: [
            { kind: 'log', id: cut.id, label: `Price cut to ${money(to, ctx.currency)}`, at: window[0] },
            ...salesInside.slice(0, 4).map((r) => ({
              kind: 'receipt' as const,
              id: r.id,
              label: `Sold at the reduced price — ${r.receiptNumber ?? r.id.slice(0, 8)}`,
              amount: num(r.total),
              at: ms(r.createdAt),
            })),
            { kind: 'log', id: restore.id, label: `Price restored to ${money(from, ctx.currency)}`, at: window[1] },
          ],
          relatedLogIds: [cut.id, restore.id].filter(Boolean),
          relatedReceiptIds: salesInside.map((r) => r.id),
          metric: { label: 'Value moved by the swap', value: loss, format: 'currency' },
        });
      }
    }
    return out.slice(0, 6);
  },
};

/** S8 — cost prices edited, which is how a margin is made to look normal. */
const detectCostEdits: Detector = {
  code: 'S8',
  run: (ctx) => {
    const edits = ctx.updateLogs.filter((l) => l.details?.changes?.costPrice);
    if (edits.length === 0) return [];

    const byStaff = new Map<string, any[]>();
    for (const l of edits) byStaff.set(l.userId ?? 'unknown', [...(byStaff.get(l.userId ?? 'unknown') ?? []), l]);

    const out: Finding[] = [];
    for (const [staffId, logs] of byStaff) {
      const s = ctx.staffById.get(staffId);
      if (s?.isOwner) continue;
      const raised = logs.filter((l) => num(l.details.changes.costPrice.to) > num(l.details.changes.costPrice.from));
      if (raised.length < 3) continue;

      out.push({
        id: `s8-${staffId}`,
        code: 'S8',
        group: 'stock',
        severity: 'medium',
        confidence: 'strong',
        title: `${s?.name ?? 'An unidentified account'} raised the recorded cost of stock`,
        what: `${raised.length} product(s) had their cost price increased by this account, out of ${logs.length} cost edit(s) in total.`,
        why:
          'Cost price is the denominator of every margin and profit figure in the app. Raising it makes a thin margin look normal, which conceals under-charging and price-swaps in exactly the reports an owner would use to notice them. Recording a genuine supplier price rise is the honest reason — that should match an invoice.',
        action: 'Match each of these against a supplier invoice. Restrict cost price editing to whoever buys the stock.',
        exposure: 0,
        suspects: s ? [who(s)] : [],
        evidence: raised.slice(0, 6).map((l) => ({
          kind: 'log' as const,
          id: l.id,
          label: `${l.details?.entityName ?? l.entityId}: cost ${money(
            num(l.details.changes.costPrice.from),
            ctx.currency,
          )} → ${money(num(l.details.changes.costPrice.to), ctx.currency)}`,
          at: ms(l.createdAt),
        })),
        relatedLogIds: raised.map((l) => l.id).filter(Boolean),
        relatedReceiptIds: [],
        metric: { label: 'Cost prices raised', value: raised.length, format: 'number' },
      });
    }
    return out;
  },
};

/** I1 — receipts whose own arithmetic does not add up. */
const detectReceiptArithmetic: Detector = {
  code: 'I1',
  run: (ctx) => {
    const broken: any[] = [];
    for (const r of ctx.paid) {
      const items = r.items ?? [];
      if (items.length === 0) continue;
      const lines = items.reduce((sum: number, i: any) => sum + num(i.price) * num(i.quantity), 0);
      if (lines <= 0) continue;
      const expected = lines + num(r.tax) - num(r.discount);
      const total = num(r.total);
      const drift = Math.abs(expected - total);
      // 2% or 100 minor units of slack absorbs rounding and legacy tax handling.
      if (drift / lines > 0.02 && drift > 100) broken.push({ r, expected, total, drift });
    }
    if (broken.length === 0) return [];

    const drift = round2(broken.reduce((sum, b) => sum + b.drift, 0));
    return [
      {
        id: 'i1-arithmetic',
        code: 'I1',
        group: 'integrity',
        severity: broken.length >= 5 ? 'high' : 'medium',
        confidence: 'confirmed',
        title: `${broken.length} sale(s) do not add up`,
        what: `Line items, tax and discount disagree with the recorded total by ${money(drift, ctx.currency)} in total across ${broken.length} sale(s).`,
        why:
          'The till computes the total from the lines, so a receipt that disagrees with its own lines was not produced by the till as shipped. Either it was written by something else, or it was edited after the fact. Legacy sales from before a tax-handling change can also drift, which shows as a consistent small percentage rather than scattered amounts.',
        action: 'Open the largest of these and check whether the difference is a consistent tax percentage or an arbitrary amount.',
        exposure: drift,
        suspects: [
          ...new Set(broken.map((b) => b.r.createdBy).filter(Boolean)),
        ]
          .map((id) => ctx.staffById.get(id as string))
          .filter(Boolean)
          .map((s) => who(s as StaffAgg)),
        evidence: broken.slice(0, 6).map((b) => ({
          kind: 'receipt' as const,
          id: b.r.id,
          label: `${b.r.receiptNumber ?? b.r.id.slice(0, 8)} — lines suggest ${money(
            b.expected,
            ctx.currency,
          )}, recorded ${money(b.total, ctx.currency)}`,
          amount: b.total,
          at: ms(b.r.createdAt),
        })),
        relatedLogIds: [],
        relatedReceiptIds: broken.map((b) => b.r.id),
        metric: { label: 'Unexplained difference', value: drift, format: 'currency' },
      },
    ];
  },
};

/** I2 — sales dated ahead of the clock. */
const detectFutureDated: Detector = {
  code: 'I2',
  run: (ctx) => {
    const future = ctx.paid.filter((r) => {
      const at = ms(r.createdAt);
      return at > ctx.now + HOUR;
    });
    if (future.length === 0) return [];
    const value = round2(future.reduce((sum, r) => sum + num(r.total), 0));

    return [
      {
        id: 'i2-future',
        code: 'I2',
        group: 'integrity',
        severity: 'medium',
        confidence: 'confirmed',
        title: `${future.length} sale(s) are dated in the future`,
        what: `${money(value, ctx.currency)} of sales carry a date later than now — the furthest ${new Date(
          Math.max(...future.map((r) => ms(r.createdAt))),
        )
          .toISOString()
          .slice(0, 10)}.`,
        why:
          'A future-dated sale is invisible in every "last 7 days" or "this month" report until its date arrives, so it is a way to park revenue where nobody is looking. The far more common cause is simply a till with the wrong date, which quietly corrupts every report in the app.',
        action: 'Check the date and time on each device that records sales. If the clocks are right, these dates were chosen.',
        exposure: 0,
        suspects: [...new Set(future.map((r) => r.createdBy).filter(Boolean))]
          .map((id) => ctx.staffById.get(id as string))
          .filter(Boolean)
          .map((s) => who(s as StaffAgg)),
        evidence: future.slice(0, 6).map((r) => ({
          kind: 'receipt' as const,
          id: r.id,
          label: `${r.receiptNumber ?? r.id.slice(0, 8)} — dated ${new Date(ms(r.createdAt)).toISOString().slice(0, 10)}`,
          amount: num(r.total),
          at: ms(r.createdAt),
        })),
        relatedLogIds: [],
        relatedReceiptIds: future.map((r) => r.id),
        metric: { label: 'Future-dated sales', value: future.length, format: 'number' },
      },
    ];
  },
};

/** I3 — sales with nobody's name on them. */
const detectUnattributedSales: Detector = {
  code: 'I3',
  run: (ctx) => {
    const orphans = ctx.paid.filter((r) => !r.createdBy);
    if (orphans.length === 0) return [];
    const share = pct(orphans.length, Math.max(1, ctx.paid.length));
    if (share < 5 && orphans.length < 5) return [];
    const value = round2(orphans.reduce((sum, r) => sum + num(r.total), 0));

    return [
      {
        id: 'i3-unattributed',
        code: 'I3',
        group: 'integrity',
        severity: share >= 25 ? 'high' : 'medium',
        confidence: 'confirmed',
        title: `${orphans.length} sale(s) are not attributed to anyone`,
        what: `${money(value, ctx.currency)} — ${share}% of sales in this window — carry no record of who rang them up.`,
        why:
          'Accountability is the whole mechanism behind every other check in this report. Sales with no name on them cannot be compared between staff, so a person working only through that path is invisible to all of it. Sales recorded before user tracking existed, or through a shared login, will look like this.',
        action:
          'Give every member of staff their own login. A shared account means no member of staff can ever be cleared, either.',
        exposure: 0,
        suspects: [],
        evidence: orphans.slice(0, 6).map((r) => ({
          kind: 'receipt' as const,
          id: r.id,
          label: `${r.receiptNumber ?? r.id.slice(0, 8)} — ${money(num(r.total), ctx.currency)}`,
          amount: num(r.total),
          at: ms(r.createdAt),
        })),
        relatedLogIds: [],
        relatedReceiptIds: orphans.map((r) => r.id),
        metric: { label: 'Sales with no operator', value: share, format: 'percent' },
      },
    ];
  },
};

/** A1 — staff accounts switched off, and accounts acting after being switched off. */
const detectAccessChanges: Detector = {
  code: 'A1',
  run: (ctx) => {
    const out: Finding[] = [];
    const deactivations = ctx.accessLogs.filter(
      (l) => String(l.action ?? '') === 'user.update_status' && l.details?.newStatus === 'inactive',
    );

    if (deactivations.length > 0) {
      const targets = deactivations.map((l) => l.details?.entityName ?? l.entityId).filter(Boolean);
      const privileged = deactivations.filter((l) => {
        const target = ctx.staffById.get(l.entityId);
        return target?.role === 'admin' || target?.role === 'manager';
      });

      out.push({
        id: 'a1-deactivations',
        code: 'A1',
        group: 'access',
        severity: privileged.length > 0 ? 'high' : 'low',
        confidence: 'confirmed',
        title: `${deactivations.length} staff account(s) were switched off`,
        what: `${targets.slice(0, 5).join(', ')}${targets.length > 5 ? ` and ${targets.length - 5} more` : ''} were deactivated${
          privileged.length > 0 ? `, including ${privileged.length} manager or admin account(s)` : ''
        }.`,
        why:
          privileged.length > 0
            ? 'Deactivating a manager or admin removes the one person who could have reviewed what happens next. Where that is not a deliberate offboarding, it is the first move in locking the owner out of their own oversight.'
            : 'Routine when someone leaves. Listed so that a deactivation you did not authorise is visible rather than buried.',
        action: 'Confirm each of these was your decision.',
        exposure: 0,
        suspects: [...new Set(deactivations.map((l) => l.userId).filter(Boolean))]
          .map((id) => ctx.staffById.get(id as string))
          .filter(Boolean)
          .map((s) => who(s as StaffAgg)),
        evidence: deactivations.slice(0, 6).map((l) => ({
          kind: 'log' as const,
          id: l.id,
          label: `${l.details?.entityName ?? l.entityId} deactivated by ${l.userName ?? 'unknown'}`,
          at: ms(l.createdAt),
        })),
        relatedLogIds: deactivations.map((l) => l.id).filter(Boolean),
        relatedReceiptIds: [],
        metric: { label: 'Accounts deactivated', value: deactivations.length, format: 'number' },
      });
    }

    // An account that is switched off but still transacting.
    for (const s of ctx.staff) {
      if (s.status !== 'inactive' && s.status !== 'suspended') continue;
      if (s.sales === 0 && s.voids === 0 && s.adjustDown === 0) continue;
      out.push({
        id: `a1b-${s.id}`,
        code: 'A1',
        group: 'access',
        severity: 'critical',
        confidence: 'confirmed',
        title: `${s.name} is switched off but still recording activity`,
        what: `This account is marked "${s.status}" yet shows ${s.sales} sale(s), ${s.voids} void(s) and ${s.adjustDown} stock reduction(s) in this window.`,
        why:
          'A disabled account that is still writing means the session outlived the disabling — the app blocks the login, not the token already in someone\'s pocket. Anything done through it is unattributable to a current employee, which makes it the ideal account to work through.',
        action: `Force a sign-out on ${s.name} now, and change any password that account may share with another.`,
        exposure: round2(s.voidValue + s.valueRemoved),
        suspects: [who(s)],
        evidence: [{ kind: 'staff', id: s.id, label: `${s.name} — status "${s.status}"` }],
        relatedLogIds: ctx.logs.filter((l) => l.userId === s.id).map((l) => l.id).filter(Boolean),
        relatedReceiptIds: ctx.paid.filter((r) => r.createdBy === s.id).map((r) => r.id),
        metric: { label: 'Actions after being disabled', value: s.sales + s.voids + s.adjustDown, format: 'number' },
      });
    }
    return out;
  },
};

/** A2 — the controls that would catch all of the above, switched off. */
const detectWeakControls: Detector = {
  code: 'A2',
  run: (ctx) => {
    const out: Finding[] = [];
    const offHours = ctx.paid.filter((r) => r.flagged?.reason === 'outside_operating_hours').length;

    if (ctx.openHour !== null && !ctx.hoursEnforced && offHours > 0) {
      out.push({
        id: 'a2-hours',
        code: 'A2',
        group: 'access',
        severity: 'medium',
        confidence: 'confirmed',
        title: 'Trading hours are set but not enforced',
        what: `Opening times are configured, "prevent sales outside hours" is off, and ${offHours} sale(s) have already been recorded while closed.`,
        why:
          'A control that only notes a breach depends on somebody reading the note. This is the one setting that turns out-of-hours trading from something you find later into something that cannot happen.',
        action: 'Settings → Operating hours → turn on "prevent sales outside hours".',
        exposure: 0,
        suspects: [],
        evidence: [{ kind: 'note', label: `${offHours} sale(s) already recorded outside hours` }],
        relatedLogIds: [],
        relatedReceiptIds: [],
        metric: { label: 'Unblocked out-of-hours sales', value: offHours, format: 'number' },
      });
    }

    // One non-owner holding every sensitive action is a single point of failure
    // and a single point of opportunity.
    const sensitive = ctx.staff
      .map((s) => ({ s, weight: s.voids + s.adjustDown + s.deletions }))
      .filter((r) => r.weight > 0);
    const totalWeight = sensitive.reduce((sum, r) => sum + r.weight, 0);
    if (totalWeight >= 10 && ctx.staff.filter((s) => s.sales > 0).length >= 3) {
      const top = sensitive.sort((a, b) => b.weight - a.weight)[0];
      const share = pct(top.weight, totalWeight);
      if (share >= 80 && !top.s.isOwner) {
        out.push({
          id: `a2b-${top.s.id}`,
          code: 'A2',
          group: 'access',
          severity: 'medium',
          confidence: 'signal',
          title: `${top.s.name} performs almost every sensitive action in the business`,
          what: `${share}% of all voids, write-offs and deletions in this window — ${top.weight} of ${totalWeight} — were done by one non-owner account.`,
          why:
            'Where one person can both create a discrepancy and clear it, no separation of duties exists and nothing they do is checked by anyone. This is a structural weakness rather than an accusation: the same concentration would make it impossible to clear them of suspicion either.',
          action: 'Split these permissions across at least two people, or keep voids and write-offs for yourself.',
          exposure: 0,
          suspects: [who(top.s)],
          evidence: [{ kind: 'staff', id: top.s.id, label: `${top.s.name} — ${top.weight} sensitive actions` }],
          relatedLogIds: [],
          relatedReceiptIds: [],
          metric: { label: 'Share of sensitive actions', value: share, format: 'percent' },
        });
      }
    }
    return out;
  },
};

const DETECTORS: Detector[] = [
  detectSelfVoids,
  detectVoidRateOutlier,
  detectLateVoids,
  detectDiscountOutlier,
  detectSweethearting,
  detectBelowCost,
  detectPriceOverrides,
  detectCashConcentration,
  detectReceiptSuppression,
  detectZeroValueSales,
  detectOffHoursSales,
  detectOffHoursEdits,
  detectBackdating,
  detectOfflineConcentration,
  detectImpossibleCadence,
  detectWriteOffOutlier,
  detectRepeatAdjustments,
  detectLargeWriteOff,
  detectAdjustAroundSale,
  detectNegativeStock,
  detectDeleteWithStock,
  detectPriceSwap,
  detectCostEdits,
  detectReceiptArithmetic,
  detectFutureDated,
  detectUnattributedSales,
  detectAccessChanges,
  detectWeakControls,
];

export const DETECTOR_COUNT = DETECTORS.length;

// ─────────────────────────────────────────────────────────────────────────────
// Scoring and assembly
// ─────────────────────────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const CONFIDENCE_WEIGHT: Record<Confidence, number> = { confirmed: 1, strong: 0.85, signal: 0.45 };

function scoreOf(findings: Finding[]): number {
  const penalty = findings.reduce(
    (sum, f) => sum + SEVERITY_WEIGHT[f.severity] * CONFIDENCE_WEIGHT[f.confidence],
    0,
  );
  return Math.max(3, Math.round(100 - Math.min(97, penalty)));
}

function levelOf(score: number): { label: string; tone: Severity | 'ok' } {
  if (score >= 92) return { label: 'CLEAN', tone: 'ok' };
  if (score >= 75) return { label: 'MINOR CONCERNS', tone: 'low' };
  if (score >= 55) return { label: 'NEEDS REVIEW', tone: 'medium' };
  if (score >= 32) return { label: 'HIGH RISK', tone: 'high' };
  return { label: 'CRITICAL', tone: 'critical' };
}

/** Per-staff risk, built from the findings that named them plus their raw rates. */
function buildWatchlist(ctx: Ctx, findings: Finding[]): StaffRisk[] {
  const out: StaffRisk[] = [];

  for (const s of ctx.staff) {
    const mine = findings.filter((f) => f.suspects.some((p) => p.id === s.id));
    const hasActivity = s.sales > 0 || s.voids > 0 || s.adjustDown > 0 || s.deletions > 0;
    if (!hasActivity && mine.length === 0) continue;

    const penalty = mine.reduce(
      (sum, f) => sum + SEVERITY_WEIGHT[f.severity] * CONFIDENCE_WEIGHT[f.confidence],
      0,
    );
    const risk = Math.min(100, Math.round(penalty));
    const exposure = round2(mine.reduce((sum, f) => sum + f.exposure, 0));

    const voidRate = pct(s.voids, Math.max(1, s.sales));
    const discountShare = pct(s.discountValue, Math.max(1, s.revenue + s.discountValue));
    const cashShare = pct(s.cashRevenue, Math.max(1, s.revenue));
    const noReceipt = pct(s.noReceiptSales, Math.max(1, s.sales));

    const metrics: StaffMetric[] = [
      {
        label: 'Void rate',
        value: voidRate,
        peer: peerMedian(ctx.sellers, s, (p) => pct(p.voids, Math.max(1, p.sales))),
        format: 'percent',
        flagged: mine.some((f) => f.group === 'voids'),
        hint: 'Share of this person’s sales that were later cancelled.',
      },
      {
        label: 'Discount share',
        value: discountShare,
        peer: peerMedian(ctx.sellers, s, (p) => pct(p.discountValue, Math.max(1, p.revenue + p.discountValue))),
        format: 'percent',
        flagged: mine.some((f) => f.group === 'discounts'),
        hint: 'Share of the full price that was given away.',
      },
      {
        label: 'Cash share',
        value: cashShare,
        peer: peerMedian(ctx.sellers, s, (p) => pct(p.cashRevenue, Math.max(1, p.revenue))),
        format: 'percent',
        flagged: mine.some((f) => f.group === 'cash'),
        hint: 'Cash is the only tender that can go missing without a record.',
      },
      {
        label: 'Stock written off',
        value: s.valueRemoved,
        peer: peerMedian(
          ctx.staff.filter((p) => p.adjustDown > 0),
          s,
          (p) => p.valueRemoved,
        ),
        format: 'currency',
        flagged: mine.some((f) => f.group === 'stock'),
        hint: 'Value of stock this person told the system was gone without a sale.',
      },
      {
        label: 'No receipt given',
        value: noReceipt,
        peer: peerMedian(ctx.sellers, s, (p) => pct(p.noReceiptSales, Math.max(1, p.sales))),
        format: 'percent',
        flagged: mine.some((f) => f.code === 'C2'),
        hint: 'A customer without a receipt cannot contradict a later void.',
      },
    ];

    const reasons = mine
      .slice()
      .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
      .slice(0, 4)
      .map((f) => f.title.replace(new RegExp(`^${s.name}('s)?\\s+`, 'i'), '').replace(/^./, (c) => c.toUpperCase()));

    out.push({
      id: s.id,
      name: s.name,
      role: s.role,
      risk,
      band: risk >= 60 ? 'critical' : risk >= 30 ? 'elevated' : risk >= 10 ? 'watch' : 'clear',
      findingCount: mine.length,
      exposure,
      sales: s.sales,
      revenue: s.revenue,
      metrics,
      reasons,
    });
  }

  return out.sort((a, b) => b.risk - a.risk || b.exposure - a.exposure);
}

/** The products bleeding the most value through adjustments, ranked. */
function buildShrinkage(ctx: Ctx): ShrinkageItem[] {
  const byProduct = new Map<string, ShrinkageItem>();
  for (const l of ctx.adjustLogs) {
    const delta = num(l.details?.adjustment);
    if (delta >= 0 || !l.entityId) continue;
    const product = ctx.productById.get(l.entityId);
    const unitCost = num(product?.costPrice) || num(product?.price);
    const row =
      byProduct.get(l.entityId) ??
      ({
        productId: l.entityId,
        name: product?.name ?? l.details?.entityName ?? l.entityId,
        unitsRemoved: 0,
        valueRemoved: 0,
        adjustments: 0,
        actors: [],
      } as ShrinkageItem);
    row.unitsRemoved += Math.abs(delta);
    row.valueRemoved = round2(row.valueRemoved + Math.abs(delta) * unitCost);
    row.adjustments++;
    const actor = l.userName ?? l.userId;
    if (actor && !row.actors.includes(actor)) row.actors.push(actor);
    byProduct.set(l.entityId, row);
  }
  return [...byProduct.values()]
    .sort((a, b) => b.valueRemoved - a.valueRemoved || b.unitsRemoved - a.unitsRemoved)
    .slice(0, 8);
}

function headlineFor(findings: Finding[], watchlist: StaffRisk[], exposure: number, currency: string): string {
  if (findings.length === 0) {
    return 'Nothing in this window matches a known loss pattern. That is a clean result for the checks that could run, not a guarantee — read the coverage notes for what could not be checked.';
  }
  const critical = findings.filter((f) => f.severity === 'critical').length;
  const high = findings.filter((f) => f.severity === 'high').length;
  const named = watchlist.filter((w) => w.band === 'critical' || w.band === 'elevated');

  const parts: string[] = [];
  if (critical > 0)
    parts.push(
      `${critical} of ${findings.length} finding${findings.length === 1 ? '' : 's'} need${
        critical === 1 ? 's' : ''
      } attention today`,
    );
  else if (high > 0) parts.push(`${high} serious finding${high === 1 ? '' : 's'}`);
  else parts.push(`${findings.length} thing${findings.length === 1 ? '' : 's'} worth a look`);

  if (exposure > 0) parts.push(`about ${money(exposure, currency)} of value involved`);
  if (named.length > 0) {
    parts.push(
      named.length === 1
        ? `${named[0].name} accounts for most of it`
        : `${named.length} people carry most of it`,
    );
  }
  return `${parts.join(', ')}.`;
}

/**
 * Run every detector over one business's evidence.
 *
 * Never throws: a detector that blows up on unexpected data is recorded as a
 * coverage gap and the rest of the scan continues. A report that half-ran and
 * says so is far more useful to an owner than an error toast.
 */
export function runForensicScan(input: ForensicInput): ForensicReport {
  const ctx = buildContext(input);
  const findings: Finding[] = [];
  let checksRun = 0;

  for (const detector of DETECTORS) {
    try {
      findings.push(...detector.run(ctx));
      checksRun++;
    } catch (e: any) {
      ctx.gaps.push({
        code: detector.code,
        title: `Check ${detector.code} could not complete`,
        detail: e?.message ? String(e.message) : 'An unexpected data shape stopped this check.',
        fix: 'The rest of the scan is unaffected. Report this if it persists.',
      });
    }
  }

  findings.sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      CONFIDENCE_WEIGHT[b.confidence] - CONFIDENCE_WEIGHT[a.confidence] ||
      b.exposure - a.exposure,
  );

  const watchlist = buildWatchlist(ctx, findings);
  const shrinkage = buildShrinkage(ctx);
  const score = scoreOf(findings);
  const currency = ctx.currency;

  // Exposure is summed per finding, but the same receipt can appear in two
  // findings (a below-cost line inside a discounted sale, say). Counting it
  // twice would inflate the headline number, and an inflated number is the
  // fastest way for an owner to stop trusting the whole report.
  const seenReceipts = new Set<string>();
  const seenLogs = new Set<string>();
  let exposure = 0;
  for (const f of findings) {
    const fresh =
      f.relatedReceiptIds.some((id) => !seenReceipts.has(id)) ||
      f.relatedLogIds.some((id) => !seenLogs.has(id)) ||
      (f.relatedReceiptIds.length === 0 && f.relatedLogIds.length === 0);
    if (fresh) exposure += f.exposure;
    f.relatedReceiptIds.forEach((id) => seenReceipts.add(id));
    f.relatedLogIds.forEach((id) => seenLogs.add(id));
  }
  exposure = round2(exposure);

  const stamps = [
    ...ctx.receipts.map((r) => ms(r.createdAt)),
    ...ctx.logs.map((l) => ms(l.createdAt)),
  ].filter((t) => t > 0);

  // Not enough colleagues to compare anyone against — say so rather than let
  // silence read as innocence.
  if (ctx.sellers.length < 3 && ctx.paid.length > 0) {
    ctx.gaps.push({
      code: 'PEER',
      title: 'Too few staff to compare anyone against',
      detail: `${ctx.sellers.length} account(s) recorded enough sales in this window to be compared. Checks that work by spotting the outlier in a team could not run.`,
      fix: 'This is expected in a small shop. Absolute checks — write-offs, zero-value sales, arithmetic, dates — still ran.',
    });
  }
  if (ctx.logs.length === 0) {
    ctx.gaps.push({
      code: 'LOGS',
      title: 'No audit records in this window',
      detail: 'Voids, write-offs, price changes and deletions are all read from the audit log. Without it, only sales could be examined.',
      fix: 'Audit records are written automatically. An empty log alongside real sales is itself worth asking about.',
    });
  }

  return {
    generatedAt: ctx.now,
    windowDays: ctx.windowDays,
    score,
    level: levelOf(score),
    headline: headlineFor(findings, watchlist, exposure, currency),
    exposure,
    currency,
    findings,
    watchlist,
    shrinkage,
    coverage: ctx.gaps,
    scanned: {
      receipts: ctx.receipts.length,
      auditLogs: ctx.logs.length,
      products: ctx.products.length,
      staff: ctx.staff.filter((s) => s.sales > 0 || s.voids > 0 || s.adjustDown > 0).length,
      voids: ctx.voidLogs.length,
      stockAdjustments: ctx.adjustLogs.length,
      priceEdits: ctx.updateLogs.filter((l) => l.details?.changes?.price).length,
      oldestRecord: stamps.length ? Math.min(...stamps) : null,
      newestRecord: stamps.length ? Math.max(...stamps) : null,
    },
    checksRun,
    checksTotal: DETECTORS.length,
  };
}

/**
 * The report as plain text, for Zen AI to read out in chat.
 *
 * Deliberately terse and number-first. The model is being handed conclusions to
 * relay, not data to interpret — every judgement in here was already made by the
 * detectors above.
 */
export function summariseReport(report: ForensicReport): string {
  const lines: string[] = [];
  lines.push(
    `Loss-prevention scan — score ${report.score}/100 (${report.level.label}), ${report.windowDays} day(s) of history.`,
  );
  lines.push(report.headline);
  lines.push(
    `Examined: ${report.scanned.receipts} sale(s), ${report.scanned.auditLogs} audit record(s), ${report.scanned.products} product(s), ${report.scanned.staff} active staff account(s). ${report.checksRun} of ${report.checksTotal} checks completed.`,
  );

  if (report.findings.length === 0) {
    lines.push('No findings.');
  } else {
    lines.push('');
    lines.push('Findings, most serious first:');
    for (const f of report.findings.slice(0, 12)) {
      lines.push(
        `- [${f.severity.toUpperCase()} / ${f.confidence}] ${f.title}. ${f.what} Why it matters: ${f.why} Do this: ${f.action}`,
      );
    }
  }

  if (report.watchlist.some((w) => w.band !== 'clear')) {
    lines.push('');
    lines.push('Staff to watch:');
    for (const w of report.watchlist.filter((x) => x.band !== 'clear').slice(0, 6)) {
      lines.push(
        `- ${w.name} (${w.role ?? 'staff'}) — risk ${w.risk}/100, ${w.findingCount} finding(s), ${report.currency}${Math.round(
          w.exposure,
        ).toLocaleString()} involved across ${w.sales} sale(s).`,
      );
    }
  }

  if (report.coverage.length > 0) {
    lines.push('');
    lines.push('Could not be checked:');
    for (const gap of report.coverage) lines.push(`- ${gap.title}: ${gap.detail} ${gap.fix}`);
  }

  return lines.join('\n');
}
