'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  Package, DollarSign, Users, Sparkles, CheckCircle2, XCircle,
  AlertTriangle, TrendingUp, ArrowRight, ReceiptText, LayoutGrid, Table2,
  Coins, Calculator,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import Link from 'next/link';
import { CachedImage } from '@/components/shared/cached-image';
import { ForensicReportView } from '@/components/audit/forensic-report';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import { CURRENCY_SYMBOLS } from '@/lib/constants';
import { cn } from '@/lib/utils';

/**
 * Generative UI for Zen AI tool results.
 *
 * Tools in `src/app/api/chat/tools.ts` tag their output with a `type`, and this
 * switches on it. Anything untagged renders nothing — the model narrates it as
 * prose instead. Keep the two in step: a new `type` on the server needs a case
 * here or the result becomes invisible.
 *
 * Product cards intentionally mirror the POS "select products" grid
 * (`src/app/(app)/sales/pos/select-products/page.tsx`) so an item looks the
 * same wherever the owner meets it.
 */

const sym = (currency?: string) => CURRENCY_SYMBOLS[currency ?? 'NGN'] ?? '₦';

function fmtMoney(value: number, currency?: string) {
  return `${sym(currency)}${Number(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function fmtTile(tile: any, currency?: string) {
  if (tile.format === 'currency') return fmtMoney(tile.value, tile.currency ?? currency);
  if (tile.format === 'percent') return `${Number(tile.value ?? 0).toLocaleString()}%`;
  // Some tiles carry a word rather than a figure — a trend direction, a
  // confidence label. Without this they fell through to Number() and rendered
  // as NaN.
  if (tile.format === 'text') return String(tile.value ?? '—');
  return Number(tile.value ?? 0).toLocaleString();
}

// ─────────────────────────────────────────────────────────────────────────────
// Product card — the POS grid card, sized for a chat column
// ─────────────────────────────────────────────────────────────────────────────
function ProductCard({
  product, currency, onPick, confidence,
}: {
  product: any;
  currency?: string;
  onPick?: (product: any) => void;
  confidence?: number;
}) {
  const stock = product.stock ?? 0;
  const threshold = product.lowStockThreshold ?? 5;
  const isService = product.categoryType === 'service';
  // A deleted product carries null stock, which `?? 0` turns into a convincing
  // "Out of stock" badge. It has no stock state at all — suppress all three.
  const deleted = Boolean(product.deleted);
  const negative = !deleted && stock < 0;
  const out = !deleted && !isService && stock <= 0;
  const low = !deleted && !isService && stock > 0 && stock <= threshold;

  const clickable = Boolean(onPick);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'overflow-hidden flex flex-col rounded-xl border-[0.5px] border-border/40 bg-card/40 backdrop-blur-sm',
        clickable && 'cursor-pointer hover:border-primary/40 hover:shadow-md transition-all text-left',
      )}
      onClick={clickable ? () => onPick!(product) : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick!(product); } } : undefined}
    >
      <div className="relative h-24 w-full bg-muted/20 flex items-center justify-center">
        {product.imageUrl ? (
          <CachedImage
            src={product.imageUrl}
            alt={product.name}
            className="max-w-full max-h-full object-contain p-2"
          />
        ) : (
          <div className="text-muted-foreground/40"><Package size={28} /></div>
        )}
        {typeof confidence === 'number' && (
          <span className="absolute top-1.5 right-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-background/80 text-muted-foreground border border-border/50">
            {Math.round(confidence * 100)}% match
          </span>
        )}
      </div>

      <div className="px-3 pt-2 pb-3 flex flex-col gap-1.5 flex-grow">
        <p className="text-xs font-medium leading-snug line-clamp-2 text-foreground">{product.name}</p>

        <div className="flex items-center gap-1 flex-wrap">
          {isService && (
            <span className="text-[10px] px-1.5 py-0 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">Service</span>
          )}
          {/* A best seller can be deleted from the catalogue while its receipts
              survive, so the ranking still has a row for it. Saying so beats
              rendering a real-looking card priced at zero with no stock. */}
          {product.deleted && (
            <span className="text-[10px] px-1.5 py-0 rounded bg-muted text-muted-foreground border border-border/60">No longer in catalogue</span>
          )}
          {negative && (
            <span className="text-[10px] px-1.5 py-0 rounded bg-red-500/10 text-red-500 border border-red-500/20">Negative stock</span>
          )}
          {out && !negative && (
            <span className="text-[10px] px-1.5 py-0 rounded bg-red-500/10 text-red-500 border border-red-500/20">Out of stock</span>
          )}
          {low && (
            <span className="text-[10px] px-1.5 py-0 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">Low</span>
          )}
        </div>

        {!product.deleted && (
          <div className="flex items-end justify-between mt-auto pt-1">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-foreground">{fmtMoney(product.price, currency)}</span>
              {product.baseUnit && <span className="text-[10px] text-muted-foreground">per {product.baseUnit}</span>}
            </div>
            {!isService && (
              <span className={cn(
                'text-[11px] font-medium',
                negative || out ? 'text-red-500' : low ? 'text-amber-600' : 'text-muted-foreground',
              )}>
                {stock} in stock
              </span>
            )}
          </div>
        )}

        {/* The tool-specific half of a PRODUCT_TABLE card: whatever figures made
            this row worth showing — margin, units sold, days left. Generic
            label/value/format so one card serves all five tools. */}
        {Array.isArray(product.stats) && product.stats.length > 0 && (
          <div className="border-t border-border/40 pt-1.5 mt-auto space-y-0.5">
            {product.stats.map((s: any) => (
              <div key={s.label} className="flex items-baseline justify-between gap-2 text-[10px]">
                <span className="text-muted-foreground truncate">{s.label}</span>
                <span className={cn(
                  'font-medium tabular-nums shrink-0',
                  typeof s.value === 'number' && s.value < 0 ? 'text-red-500' : 'text-foreground',
                )}>
                  {s.value == null ? '—' : fmtTile(s, currency)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Extra facts some tools attach — shown only when present. */}
        {(product.daysOfCover != null || product.capitalTiedUp != null || product.daysRemaining != null) && (
          <div className="text-[10px] text-muted-foreground border-t border-border/40 pt-1.5 mt-0.5 space-y-0.5">
            {product.daysOfCover != null && <div>~{product.daysOfCover} days of cover</div>}
            {product.capitalTiedUp != null && <div>{fmtMoney(product.capitalTiedUp, currency)} tied up</div>}
            {product.daysRemaining != null && (
              <div className={product.expired ? 'text-red-500' : undefined}>
                {product.expired ? 'Expired' : `Expires in ${product.daysRemaining} days`}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function ProductGrid({ result, onPick }: { result: any; onPick?: (p: any) => void }) {
  const products = result.products ?? [];
  if (!products.length) {
    return (
      <div className="text-xs text-muted-foreground border border-dashed border-border rounded-lg px-3 py-4 text-center">
        Nothing matched.
      </div>
    );
  }
  const hidden = (result.totalMatches ?? products.length) - products.length;

  return (
    <div className="w-full">
      {result.title && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{result.title}</span>
          <span className="text-[11px] text-muted-foreground">
            {result.totalMatches ?? products.length} item{(result.totalMatches ?? products.length) === 1 ? '' : 's'}
          </span>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {products.map((p: any) => (
          <ProductCard key={p.id} product={p} currency={result.currency} onPick={onPick} />
        ))}
      </div>
      {hidden > 0 && (
        <p className="text-[11px] text-muted-foreground mt-2">+ {hidden} more not shown.</p>
      )}
      {result.totalCapitalTiedUp != null && (
        <p className="text-[11px] text-muted-foreground mt-2">
          Total capital tied up: <strong className="text-foreground">{fmtMoney(result.totalCapitalTiedUp, result.currency)}</strong>
        </p>
      )}
      {/*
        * Counts the rows that are already past their date, not just approaching
        * it. The grid slices to 25, so this cannot be recovered by counting
        * cards — and expired stock still on a shelf is the urgent half of the
        * answer.
        */}
      {result.expiredCount > 0 && (
        <p className="text-[11px] mt-2 flex items-center gap-1.5 text-red-500">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>
            <strong>{result.expiredCount}</strong> of these {result.expiredCount === 1 ? 'has' : 'have'} already expired.
          </span>
        </p>
      )}
      {result.totalValueAtRisk != null && (
        <p className="text-[11px] text-muted-foreground mt-2">
          Value at risk: <strong className="text-foreground">{fmtMoney(result.totalValueAtRisk, result.currency)}</strong>
        </p>
      )}
      {/*
        * PRODUCT_TABLE footers. These used to render only in DataTable, so
        * switching a reorder list or a margin analysis to cards silently dropped
        * its headline figure — the total to spend, the count selling below cost.
        * Card and table view must carry the same conclusions or the toggle
        * changes the answer rather than the layout.
        */}
      {result.estimatedTotalCost != null && (
        <p className="text-[11px] text-muted-foreground mt-2">
          Estimated cost: <strong className="text-foreground">{fmtMoney(result.estimatedTotalCost, result.currency)}</strong>
        </p>
      )}
      {result.sellingAtALoss > 0 && (
        <p className="text-[11px] mt-2 flex items-center gap-1.5 text-red-500">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>
            <strong>{result.sellingAtALoss}</strong> item{result.sellingAtALoss === 1 ? '' : 's'} selling at or below cost.
          </span>
        </p>
      )}
      {result.note && <p className="text-[11px] text-muted-foreground mt-1.5">{result.note}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card / table switch
//
// Five tools answer product questions with figures that suit a table — margin,
// units sold, days to stockout — but the owner asked about a *product*, and a
// product looks like a card everywhere else in Zeneva. So those results ship
// both halves (see productCards() in api/chat/tools.ts) and default to cards,
// with a way back to the table for anyone comparing numbers down a column.
//
// The control is deliberately quiet: two small icons, faded until hovered or
// focused, no label, no border. It is a preference, not a call to action.
// ─────────────────────────────────────────────────────────────────────────────

const RESULT_VIEW_KEY = 'zeneva-zen-result-view';
type ResultView = 'cards' | 'table';

function useResultView(): [ResultView, (v: ResultView) => void] {
  const [view, setView] = React.useState<ResultView>('cards');

  // Read after mount rather than in the initial state: the server render has no
  // localStorage, and a first client render that disagrees with it is a
  // hydration mismatch that throws the whole tree away.
  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(RESULT_VIEW_KEY);
      if (stored === 'table' || stored === 'cards') setView(stored);
    } catch {
      // Private mode or a full quota. Losing a view preference is not worth
      // breaking the result render over — the default stands.
    }
  }, []);

  const choose = React.useCallback((v: ResultView) => {
    setView(v);
    try { window.localStorage.setItem(RESULT_VIEW_KEY, v); } catch { /* see above */ }
  }, []);

  return [view, choose];
}

function ViewToggle({ view, onChange }: { view: ResultView; onChange: (v: ResultView) => void }) {
  const options: Array<{ id: ResultView; Icon: typeof LayoutGrid; label: string }> = [
    { id: 'cards', Icon: LayoutGrid, label: 'Show as cards' },
    { id: 'table', Icon: Table2, label: 'Show as table' },
  ];
  return (
    <div className="flex items-center justify-end mb-1.5">
      <div
        role="group"
        aria-label="Result format"
        className="flex items-center gap-0.5 opacity-30 hover:opacity-100 focus-within:opacity-100 transition-opacity"
      >
        {options.map(({ id, Icon, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            title={label}
            aria-label={label}
            aria-pressed={view === id}
            className={cn(
              'p-1 rounded-md transition-colors',
              view === id
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        ))}
      </div>
    </div>
  );
}

function ProductResultSwitch({ result, onPick }: { result: any; onPick?: (p: any) => void }) {
  const [view, setView] = useResultView();

  const hasCards = Boolean(result.products?.length);
  const hasTable = Boolean(result.rows?.length);

  // With only one half there is nothing to switch between, so no control is
  // offered. PRODUCT_LIST results have no rows; a PRODUCT_TABLE whose products
  // all failed to join the catalogue has no cards.
  if (hasCards && !hasTable) return <ProductGrid result={result} onPick={onPick} />;
  if (!hasCards) return <DataTable result={result} />;

  return (
    <div className="w-full">
      <ViewToggle view={view} onChange={setView} />
      {view === 'table'
        ? <DataTable result={result} />
        : <ProductGrid result={result} onPick={onPick} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function ProductPicker({ result, onPick }: { result: any; onPick?: (p: any) => void }) {
  const candidates = result.candidates ?? [];
  if (!candidates.length) {
    return (
      <div className="flex items-start gap-2 text-xs text-muted-foreground border border-dashed border-border rounded-lg px-3 py-3">
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-px" />
        <span>No product resembling <strong className="text-foreground">"{result.query}"</strong> is in your inventory.</span>
      </div>
    );
  }
  return (
    <div className="w-full rounded-xl border border-border/60 bg-muted/20 p-3">
      <div className="flex items-center gap-1.5 mb-2.5">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold text-foreground">
          Which one did you mean by "{result.query}"?
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {candidates.map((c: any) => (
          <ProductCard
            key={c.id}
            product={c}
            currency={result.currency}
            onPick={onPick ? (p) => onPick({ ...p, isPicker: true }) : undefined}
            confidence={c.confidence}
          />
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground mt-2.5">Tap a product to continue.</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Customer cards — the people behind the figures
//
// A customer lookup used to render nothing at all: `queryCustomer` returned an
// untagged object, so the model paraphrased it and the loyalty balance and
// last-seen date never reached the screen. Ranked and lapsed lists were plain
// tables, which buries the one thing that makes them actionable — how long
// since a regular last came in.
// ─────────────────────────────────────────────────────────────────────────────
function initialsOf(name: string): string {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function daysSince(iso?: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

function CustomerCard({ customer, currency }: { customer: any; currency?: string }) {
  const since = customer.daysAgo ?? daysSince(customer.lastPurchaseDate);
  const points = Number(customer.loyaltyPoints ?? 0);
  // Colour the recency, not the spend: a big spender who stopped coming three
  // months ago is the row the owner needs to act on.
  const tone =
    since == null ? 'text-muted-foreground'
      : since >= 90 ? 'text-red-500'
        : since >= 30 ? 'text-amber-600'
          : 'text-muted-foreground';
  const contact = customer.email || customer.phone || null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 rounded-xl border-[0.5px] border-border/40 bg-card/40 backdrop-blur-sm px-3 py-2.5"
    >
      <div className="relative shrink-0">
        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-semibold">
          {initialsOf(customer.name)}
        </div>
        {customer.rank != null && (
          <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-foreground text-background text-[9px] font-bold flex items-center justify-center">
            {customer.rank}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-foreground truncate">{customer.name ?? 'Unnamed'}</p>
        {contact && <p className="text-[11px] text-muted-foreground truncate">{contact}</p>}
        <div className="flex items-center gap-2 flex-wrap mt-1">
          <span className="text-[11px] text-muted-foreground">
            Spent <strong className="text-foreground">{fmtMoney(customer.totalSpent ?? 0, currency)}</strong>
          </span>
          {points > 0 && (
            <span className="text-[10px] px-1.5 py-0 rounded bg-primary/10 text-primary border border-primary/20">
              {points.toLocaleString()} pts
            </span>
          )}
        </div>
        <p className={cn('text-[11px] mt-0.5', tone)}>
          {since == null ? 'No purchase on record' : since === 0 ? 'Bought today' : `Last bought ${since} day${since === 1 ? '' : 's'} ago`}
        </p>
      </div>
    </motion.div>
  );
}

function CustomerList({ result }: { result: any }) {
  const customers = result.customers ?? [];
  if (!customers.length) {
    return (
      <div className="flex items-start gap-2 text-xs text-muted-foreground border border-dashed border-border rounded-lg px-3 py-3">
        <Users className="w-4 h-4 text-muted-foreground/60 shrink-0 mt-px" />
        <span>{result.emptyText ?? 'No customer matched.'}</span>
      </div>
    );
  }

  return (
    <div className="w-full">
      {result.title && (
        <div className="flex items-center justify-between mb-2 gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{result.title}</span>
          <span className="text-[11px] text-muted-foreground shrink-0">
            {result.totalMatches ?? customers.length}
          </span>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {customers.map((c: any, i: number) => (
          <CustomerCard key={c.id ?? i} customer={c} currency={result.currency} />
        ))}
      </div>
      {/*
        * getAtRiskCustomers sends this deliberately unformatted so the card can
        * apply the business's own currency symbol. Without this block the number
        * was computed server-side and thrown away — and it is the whole point of
        * the lapsed-customer answer: not "12 people left" but what they were worth.
        */}
      {result.revenueAtRisk != null && customers.length > 0 && (
        <p className="text-[11px] text-muted-foreground mt-2">
          Lifetime spend sitting with these customers:{' '}
          <strong className="text-foreground">{fmtMoney(result.revenueAtRisk, result.currency)}</strong>
        </p>
      )}
      {result.footnote && (
        <p className="text-[11px] text-muted-foreground mt-2">{result.footnote}</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function MetricTiles({ result }: { result: any }) {
  const tiles = result.tiles ?? [];
  return (
    <div className="w-full">
      {result.title && (
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{result.title}</div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {tiles.map((t: any, i: number) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="rounded-lg border border-border/50 bg-card/50 px-3 py-2.5"
          >
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">{t.label}</div>
            <div className="text-base font-bold text-foreground mt-0.5 tabular-nums">{fmtTile(t, result.currency)}</div>
            {t.hint && <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{t.hint}</div>}
          </motion.div>
        ))}
      </div>

      {Array.isArray(result.flags) && result.flags.length > 0 && (
        <div className="mt-2 space-y-1">
          {result.flags.map((f: string, i: number) => (
            <div key={i} className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-500">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />{f}
            </div>
          ))}
        </div>
      )}
      {result.caveat && <p className="text-[11px] text-muted-foreground mt-2">{result.caveat}</p>}
      {/*
        * The health check counts negative-stock items in a tile and sends the
        * eight worst by name. Naming them is the difference between "5 problems"
        * and knowing which shelf to go and count — without this the list was
        * computed and discarded.
        */}
      {Array.isArray(result.worstNegative) && result.worstNegative.length > 0 && (
        <div className="mt-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-red-500 font-semibold mb-1">Worst negative stock</div>
          <div className="flex flex-wrap gap-1.5">
            {result.worstNegative.map((p: any, i: number) => (
              <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-background border border-red-500/20">
                {p.name}: <strong className="text-red-500 tabular-nums">{p.stock}</strong>
              </span>
            ))}
          </div>
        </div>
      )}
      {result.totalProducts != null && (
        <p className="text-[11px] text-muted-foreground mt-2">
          Across <strong className="text-foreground">{Number(result.totalProducts).toLocaleString()}</strong> products.
        </p>
      )}
      {result.byPaymentMethod && Object.keys(result.byPaymentMethod).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {Object.entries(result.byPaymentMethod).map(([method, amount]: any) => (
            <span key={method} className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/50">
              {method}: <strong className="text-foreground">{fmtMoney(amount, result.currency)}</strong>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function DataTable({ result }: { result: any }) {
  const rows = result.rows ?? [];
  const columns: string[] = result.columns?.length
    ? result.columns
    : rows.length ? Object.keys(rows[0]) : [];
  if (!rows.length) {
    return (
      <div className="text-xs text-muted-foreground border border-dashed border-border rounded-lg px-3 py-4 text-center">
        {result.title ? `${result.title} — nothing to show.` : 'Nothing to show.'}
      </div>
    );
  }

  const money = (col: string) => /revenue|total|amount|cost|price|spend|value|profit/i.test(col);
  const percent = (col: string) => /margin|%|percent|rate|growth|change/i.test(col);

  return (
    <div className="w-full">
      {result.title && (
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{result.title}</div>
      )}
      {/* Wide tables scroll inside their own box rather than widening the chat. */}
      <div className="overflow-x-auto rounded-lg border border-border/50">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/40">
              {columns.map((c) => (
                <th key={c} className="text-left font-semibold text-muted-foreground px-2.5 py-1.5 whitespace-nowrap">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 25).map((row: any, i: number) => (
              <tr key={i} className="border-t border-border/40">
                {columns.map((c) => {
                  const v = row[c];
                  const display = typeof v === 'number' && money(c)
                    ? fmtMoney(v, result.currency)
                    : typeof v === 'number' && percent(c) ? `${v.toLocaleString()}%`
                    : typeof v === 'number' ? v.toLocaleString()
                    : String(v ?? '—');
                  // In every table these tools produce, a negative number is
                  // bad news — a loss, a shrinking month, stock below zero. It
                  // used to render in the same grey as everything else, which
                  // is how an item selling below cost hides in plain sight.
                  const bad = typeof v === 'number' && v < 0;
                  return (
                    <td
                      key={c}
                      className={cn(
                        'px-2.5 py-1.5 whitespace-nowrap',
                        typeof v === 'number' && 'tabular-nums',
                        bad && 'text-red-500 font-medium',
                      )}
                    >
                      {display}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 25 && <p className="text-[11px] text-muted-foreground mt-1.5">Showing 25 of {rows.length} rows.</p>}
      {result.totalOwed != null && (
        <p className="text-[11px] text-muted-foreground mt-2">
          Total outstanding: <strong className="text-foreground">{fmtMoney(result.totalOwed, result.currency)}</strong>
          {/* Rows slice to 25, so the true invoice count is not recoverable
              from what renders — say it here or it is lost. */}
          {result.count != null && ` across ${Number(result.count).toLocaleString()} invoice${result.count === 1 ? '' : 's'}`}
        </p>
      )}
      {result.estimatedTotalCost != null && (
        <p className="text-[11px] text-muted-foreground mt-2">
          Estimated cost: <strong className="text-foreground">{fmtMoney(result.estimatedTotalCost, result.currency)}</strong>
        </p>
      )}
      {result.sellingAtALoss > 0 && (
        <p className="text-[11px] mt-2 flex items-center gap-1.5 text-red-500">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>
            <strong>{result.sellingAtALoss}</strong> item{result.sellingAtALoss === 1 ? '' : 's'} selling at or below cost.
          </span>
        </p>
      )}
      {result.lifetimeValue != null && (
        <p className="text-[11px] text-muted-foreground mt-2">
          Lifetime value: <strong className="text-foreground">{fmtMoney(result.lifetimeValue, result.currency)}</strong>
        </p>
      )}
      {result.note && <p className="text-[11px] text-muted-foreground mt-1.5">{result.note}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Product detail — one product, shown large, for "what does X look like?"
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single product with its picture at a size worth looking at.
 *
 * The grid card's 96px thumbnail is right for scanning twenty items and wrong
 * for the owner who asked to *see* one. The image is `object-contain` on a
 * neutral field for the same reason as the POS card: product photos arrive at
 * every aspect ratio, and cropping to fill cuts the label off the bottle.
 */
export function ProductDetailCard({ result }: { result: any }) {
  const product = result?.product;
  if (!product) return null;

  const stock = product.stock ?? 0;
  const threshold = product.lowStockThreshold ?? 5;
  const isService = product.categoryType === 'service';
  const negative = stock < 0;
  const out = !isService && stock <= 0;
  const low = !isService && stock > 0 && stock <= threshold;

  const facts: Array<[string, React.ReactNode]> = [];
  if (product.sku) facts.push(['SKU', product.sku]);
  if (product.category) facts.push(['Category', product.category]);
  facts.push(['Price', fmtMoney(product.price, result.currency)]);
  if (product.costPrice != null) facts.push(['Cost', fmtMoney(product.costPrice, result.currency)]);
  if (result.velocity?.margin != null) facts.push(['Margin', `${result.velocity.margin}%`]);
  if (!isService) facts.push(['In stock', `${stock}${product.baseUnit ? ` ${product.baseUnit}` : ''}`]);
  if (result.velocity?.unitsSoldLast30Days != null) {
    facts.push(['Sold (30d)', `${result.velocity.unitsSoldLast30Days}`]);
  }
  if (result.velocity?.daysOfCover != null) facts.push(['Days of cover', `${result.velocity.daysOfCover}`]);
  if (product.expiryDate) facts.push(['Expires', new Date(product.expiryDate).toLocaleDateString()]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-1 rounded-xl border border-border bg-card shadow-sm overflow-hidden w-full max-w-sm"
    >
      <div className="relative h-44 w-full bg-muted/20 flex items-center justify-center">
        {product.imageUrl ? (
          <CachedImage
            src={product.imageUrl}
            alt={product.name}
            className="max-w-full max-h-full object-contain p-3"
          />
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-muted-foreground/40">
            <Package size={40} />
            {/* Say why it is blank — otherwise it reads as a failed load. */}
            <span className="text-[10px] text-muted-foreground">No photo on this product</span>
          </div>
        )}
      </div>

      <div className="p-3.5">
        <h3 className="font-semibold text-sm text-foreground leading-snug">{product.name}</h3>

        <div className="flex items-center gap-1 flex-wrap mt-1.5">
          {isService && (
            <span className="text-[10px] px-1.5 py-0 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">Service</span>
          )}
          {negative && (
            <span className="text-[10px] px-1.5 py-0 rounded bg-red-500/10 text-red-500 border border-red-500/20">Negative stock</span>
          )}
          {out && !negative && (
            <span className="text-[10px] px-1.5 py-0 rounded bg-red-500/10 text-red-500 border border-red-500/20">Out of stock</span>
          )}
          {low && (
            <span className="text-[10px] px-1.5 py-0 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">Low</span>
          )}
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          {facts.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-2 border-b border-border/40 pb-1">
              <dt className="text-muted-foreground shrink-0">{label}</dt>
              <dd className="font-medium text-foreground text-right truncate">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chart card — a trend is far easier to read as a line than as 14 table rows
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Slice colours for pie charts. Zeneva orange leads, then a spread that stays
 * legible in both themes. Categories beyond this list wrap around.
 */
const SLICE_COLORS = ['#ea580c', '#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#64748b'];

/** Abbreviate axis money so `1200000` does not blow out the narrow chat column. */
function abbreviate(value: number, symbol: string): string {
  const v = Number(value) || 0;
  if (Math.abs(v) >= 1_000_000) return `${symbol}${(v / 1_000_000).toFixed(Math.abs(v) >= 10_000_000 ? 0 : 1)}M`;
  if (Math.abs(v) >= 1_000) return `${symbol}${Math.round(v / 1_000).toLocaleString()}k`;
  return `${symbol}${v}`;
}

/**
 * A tool returning `type: 'CHART'` renders here.
 *
 * The tool owns the shape: `chartKind` picks the visual, `xKey` names the
 * category axis, and `series[]` lists the numeric keys to plot with their
 * labels. That keeps one component serving sales trends, peak hours and
 * category splits without a branch per tool.
 *
 * `rows` is still the raw data, so the model can quote a figure in prose while
 * the owner reads the shape off the chart.
 */
export function ChartCard({ result }: { result: any }) {
  const rows: any[] = Array.isArray(result?.rows) ? result.rows : [];
  const series: any[] = Array.isArray(result?.series) && result.series.length
    ? result.series
    : [{ key: 'value', label: 'Value' }];
  const symbol = CURRENCY_SYMBOLS[result?.currency as keyof typeof CURRENCY_SYMBOLS] ?? result?.currency ?? '';
  const kind = result?.chartKind ?? 'line';
  const xKey = result?.xKey ?? 'label';

  // An empty series renders as an axis with nothing on it, which reads as a bug.
  if (!rows.length) {
    return (
      <div className="mt-1 p-4 rounded-xl bg-card border border-border w-full max-w-md">
        <p className="text-xs text-muted-foreground">No data for this period yet.</p>
      </div>
    );
  }

  const config: ChartConfig = Object.fromEntries(
    series.map((s: any, i: number) => [s.key, { label: s.label ?? s.key, color: s.color ?? SLICE_COLORS[i % SLICE_COLORS.length] }]),
  );

  const isMoney = (s: any) => s?.format === 'currency';
  const fmtValue = (v: any, s: any) =>
    isMoney(s) ? fmtMoney(v, result.currency) : Number(v ?? 0).toLocaleString();

  return (
    <div className="mt-1 p-3.5 rounded-xl bg-card border border-border shadow-sm w-full max-w-md">
      {result.title && <h3 className="font-semibold text-sm text-foreground">{result.title}</h3>}
      {result.subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{result.subtitle}</p>}

      <div className="mt-3 h-[190px] w-full">
        <ChartContainer config={config} className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            {kind === 'pie' ? (
              <PieChart>
                <Pie
                  data={rows}
                  dataKey={series[0].key}
                  nameKey={xKey}
                  innerRadius={38}
                  outerRadius={68}
                  paddingAngle={2}
                  strokeWidth={1}
                >
                  {rows.map((_, i) => (
                    <Cell key={i} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip
                  content={<ChartTooltipContent
                    nameKey={xKey}
                    formatter={(v: any) => fmtValue(v, series[0])}
                  />}
                />
              </PieChart>
            ) : kind === 'bar' ? (
              <BarChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.4} />
                <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={6} fontSize={10} interval="preserveStartEnd" />
                <YAxis tickLine={false} axisLine={false} width={44} fontSize={10}
                  tickFormatter={(v) => (isMoney(series[0]) ? abbreviate(Number(v), symbol) : String(v))} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(v: any, n: any) => fmtValue(v, series.find((s) => s.key === n) ?? series[0])} />} />
                {series.map((s: any, i: number) => (
                  <Bar key={s.key} dataKey={s.key} fill={s.color ?? SLICE_COLORS[i % SLICE_COLORS.length]} radius={3} />
                ))}
              </BarChart>
            ) : (
              <LineChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.4} />
                <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={6} fontSize={10} interval="preserveStartEnd" />
                <YAxis tickLine={false} axisLine={false} width={44} fontSize={10}
                  tickFormatter={(v) => (isMoney(series[0]) ? abbreviate(Number(v), symbol) : String(v))} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(v: any, n: any) => fmtValue(v, series.find((s) => s.key === n) ?? series[0])} />} />
                {series.map((s: any, i: number) => (
                  <Line key={s.key} type="monotone" dataKey={s.key} stroke={s.color ?? SLICE_COLORS[i % SLICE_COLORS.length]}
                    strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        </ChartContainer>
      </div>

      {Array.isArray(result.highlights) && result.highlights.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-2 gap-2">
          {result.highlights.slice(0, 4).map((h: any, i: number) => (
            <div key={i}>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{h.label}</p>
              <p className="text-sm font-bold text-foreground tabular-nums">
                {h.format === 'currency' ? fmtMoney(h.value, result.currency) : Number(h.value ?? 0).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {result.note && <p className="text-[11px] text-muted-foreground mt-2.5">{result.note}</p>}

      {/*
        A summary like the daily report answers the question and then raises the
        next one — "show me the receipts behind that". These are the same
        allow-listed hrefs `linkToPage` validates, attached by the tool that
        knows which page backs its figures.
      */}
      {Array.isArray(result.links) && result.links.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {result.links.slice(0, 3).map((l: any, i: number) => (
            <Link
              key={i}
              href={l?.href ?? '/'}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-background hover:bg-accent transition-colors text-[11px] font-medium text-foreground"
            >
              <span className="truncate max-w-[180px]">{l?.label ?? 'Open'}</span>
              <ArrowRight className="w-3 h-3 shrink-0 opacity-60" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Deep link — a tap-through into the app when the owner wants the page
// ─────────────────────────────────────────────────────────────────────────────

/** One app deep-link. `href` is validated server-side against an allow-list. */
export function LinkCard({ link }: { link: any }) {
  const detail = typeof link?.detail === 'string' ? link.detail : null;
  // Set when the model asked for a page that does not exist and the tool walked
  // up to the nearest real one. Saying so is what turns a dead end into an
  // answer — "bulk import isn't its own page, it's here".
  const note = typeof link?.note === 'string' ? link.note : null;

  return (
    <div className="mt-1 w-fit max-w-full">
      {note && (
        <p className="text-[11px] text-muted-foreground mb-1.5 max-w-[320px] leading-relaxed">{note}</p>
      )}
      <Link
        href={link?.href ?? '/'}
        className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity text-xs font-medium w-fit max-w-full"
      >
        <ArrowRight className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">{link?.label ?? 'Open'}</span>
      </Link>
      {detail && (
        <p className="text-[11px] text-muted-foreground mt-1.5 max-w-[320px] leading-relaxed">{detail}</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Walkthrough card — "how do I …", answered as steps rather than a shrug
// ─────────────────────────────────────────────────────────────────────────────
export function WalkthroughCard({ result }: { result: any }) {
  const steps: string[] = Array.isArray(result?.steps) ? result.steps : [];
  const tips: string[] = Array.isArray(result?.tips) ? result.tips : [];
  if (steps.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mt-1 w-full max-w-[460px] rounded-xl border border-border bg-card overflow-hidden"
    >
      <div className="px-4 pt-3.5 pb-3">
        <div className="flex items-start gap-2">
          <div className="w-6 h-6 rounded-md bg-orange-50 flex items-center justify-center shrink-0 mt-px">
            <Sparkles className="w-3.5 h-3.5 text-orange-500" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-foreground leading-snug">{result.title}</h4>
            {result.intro && (
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{result.intro}</p>
            )}
          </div>
        </div>

        <ol className="mt-3 space-y-2">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="w-[18px] h-[18px] rounded-full bg-foreground text-background text-[10px] font-semibold flex items-center justify-center shrink-0 mt-px">
                {i + 1}
              </span>
              <span className="text-xs text-foreground leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>

        {tips.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border space-y-1.5">
            {tips.map((tip, i) => (
              <div key={i} className="flex gap-2">
                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-[3px]" />
                <span className="text-[11px] text-muted-foreground leading-relaxed">{tip}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {result.href && (
        <Link
          href={result.href}
          className="flex items-center justify-between gap-2 px-4 py-2.5 bg-muted/50 hover:bg-muted transition-colors border-t border-border"
        >
          <span className="text-xs font-medium text-foreground truncate">{result.hrefLabel ?? 'Open'}</span>
          <ArrowRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
        </Link>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Proposal card — the only write path, and it needs explicit approval
// ─────────────────────────────────────────────────────────────────────────────
export function ProposalCard({ result, onApprove, onReject }: {
  result: any;
  onApprove: (proposalId: string, action: any) => void;
  onReject: (proposalId: string) => void;
}) {
  if (!result || result.type !== 'PROPOSAL') return null;

  const icons: Record<string, React.ReactNode> = {
    STOCK_ADJUSTMENT: <Package className="w-4 h-4 text-blue-500" />,
    PRICE_CHANGE: <DollarSign className="w-4 h-4 text-purple-500" />,
    LOYALTY_ADJUSTMENT: <Users className="w-4 h-4 text-emerald-500" />,
    THRESHOLD_CHANGE: <TrendingUp className="w-4 h-4 text-amber-500" />,
    RECORD_SALE: <ReceiptText className="w-4 h-4 text-orange-500" />,
    COST_PRICES: <Coins className="w-4 h-4 text-teal-500" />,
    COST_ESTIMATE: <Calculator className="w-4 h-4 text-teal-500" />,
  };
  const labels: Record<string, string> = {
    STOCK_ADJUSTMENT: 'Stock adjustment',
    PRICE_CHANGE: 'Price change',
    LOYALTY_ADJUSTMENT: 'Loyalty points',
    THRESHOLD_CHANGE: 'Low-stock threshold',
    RECORD_SALE: 'Record a sale',
    COST_PRICES: 'Cost prices',
    COST_ESTIMATE: 'Estimate cost prices',
  };

  const isApproved = result.status === 'APPROVED';
  const isRejected = result.status === 'REJECTED';
  const isSale = result.action === 'RECORD_SALE';
  const isCostList = result.action === 'COST_PRICES';
  const isCostEstimate = result.action === 'COST_ESTIMATE';
  const isMoney = result.action === 'PRICE_CHANGE';
  const show = (v: any) => (isMoney ? fmtMoney(v, result.currency) : Number(v ?? 0).toLocaleString());
  const cash = (v: any) => fmtMoney(v, result.currency);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mt-1 p-4 rounded-xl bg-card border border-border shadow-sm w-full max-w-sm"
    >
      <div className="flex items-center gap-2 mb-2.5">
        {icons[result.action] ?? <Sparkles className="w-4 h-4 text-muted-foreground" />}
        <h3 className="font-semibold text-sm text-foreground">{labels[result.action] ?? 'Proposed action'}</h3>
        <span className="ml-auto text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Needs approval</span>
      </div>

      <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{result.reason}</p>

      {isCostList ? (
        /*
         * A cost list is many rows, so it gets the same treatment as a sale: the rows
         * themselves, not a single before/after. Every product name shown here was resolved
         * by the deterministic matcher server-side, never chosen by the model — so the card
         * is showing the owner what will actually be written, which is the only version
         * worth approving.
         */
        <div className="space-y-2 mb-3">
          <div className="max-h-44 overflow-y-auto space-y-1">
            {(result.matched ?? []).map((row: any) => (
              <div key={row.productId} className="flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate">
                  {row.productName}
                  {row.wrote && row.wrote.toLowerCase() !== String(row.productName).toLowerCase() && (
                    <span className="text-muted-foreground"> · you said “{row.wrote}”</span>
                  )}
                </span>
                <span className="shrink-0 font-medium">
                  {row.currentCost > 0 && (
                    <span className="text-muted-foreground line-through me-1">{cash(row.currentCost)}</span>
                  )}
                  {cash(row.newCost)}
                </span>
              </div>
            ))}
          </div>

          {(result.matched ?? []).some((r: any) => r.notBelowPrice) && (
            <p className="text-[11px] text-amber-600 dark:text-amber-500">
              Some of these are not below the selling price — check they are costs, not prices.
            </p>
          )}
          {(result.ambiguous?.length ?? 0) > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {result.ambiguous.length} line{result.ambiguous.length === 1 ? '' : 's'} matched more than
              one product and {result.ambiguous.length === 1 ? 'was' : 'were'} left out — set{' '}
              {result.ambiguous.length === 1 ? 'it' : 'those'} on the Cost prices screen.
            </p>
          )}
          {(result.unmatched?.length ?? 0) > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Not found: {result.unmatched.slice(0, 5).join(', ')}
              {result.unmatched.length > 5 ? ` +${result.unmatched.length - 5} more` : ''}
            </p>
          )}
        </div>
      ) : isCostEstimate ? (
        <div className="space-y-2 mb-3">
          <div className="rounded-lg bg-muted/50 p-2">
            <p className="text-xs font-medium">{result.rule}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {Number(result.count ?? 0).toLocaleString()} products · saved as{' '}
              <strong>estimates</strong> until a waybill replaces them
            </p>
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {(result.sample ?? []).map((row: any, i: number) => (
              <div key={i} className="flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate">{row.productName}</span>
                <span className="shrink-0 font-medium">{cash(row.newCost)}</span>
              </div>
            ))}
          </div>
          {Number(result.skipped ?? 0) > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {Number(result.skipped).toLocaleString()} left alone
              {result.skippedReason ? ` — ${result.skippedReason}` : ''}
            </p>
          )}
        </div>
      ) : isSale ? (
        /*
         * A sale is a receipt, not a single before/after value, so it gets a
         * line-item body. Everything shown here was resolved server-side from
         * the product records — the owner is approving real prices, and the
         * client re-verifies them once more before anything is queued.
         */
        <div className="p-2.5 bg-muted/40 rounded-lg border border-border/50 text-xs mb-3">
          <div className="space-y-1.5">
            {(result.items ?? []).map((line: any, idx: number) => (
              <div key={`${line.productId}-${idx}`} className="flex justify-between gap-3">
                <span className="text-foreground truncate">
                  <span className="text-muted-foreground tabular-nums">{line.quantity}×</span> {line.name}
                </span>
                <span className="font-medium text-foreground tabular-nums shrink-0">{cash(line.lineTotal)}</span>
              </div>
            ))}
          </div>

          <div className="mt-2.5 pt-2.5 border-t border-border/50 space-y-1">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span><span className="tabular-nums">{cash(result.subtotal)}</span>
            </div>
            {Number(result.tax) > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Tax{result.taxRate ? ` (${result.taxRate}%)` : ''}</span>
                <span className="tabular-nums">{cash(result.tax)}</span>
              </div>
            )}
            {Number(result.discount) > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Discount</span><span className="tabular-nums">−{cash(result.discount)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 font-bold text-foreground text-sm">
              <span>Total</span><span className="tabular-nums">{cash(result.total)}</span>
            </div>
          </div>

          <div className="mt-2.5 pt-2.5 border-t border-border/50 space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment</span>
              <span className="font-medium text-foreground">{result.paymentMethod}</span>
            </div>
            {result.customerName && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-medium text-foreground truncate">{result.customerName}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-2.5 bg-muted/40 rounded-lg border border-border/50 text-xs space-y-1.5 mb-3">
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">{result.action === 'LOYALTY_ADJUSTMENT' ? 'Customer' : 'Product'}</span>
          <span className="font-medium text-foreground text-right truncate">{result.productName || result.customerName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Current</span>
          <span className="font-medium text-foreground tabular-nums">{show(result.currentValue)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">New</span>
          <span className="font-bold text-foreground tabular-nums">
            {show(result.newValue)}
            {result.changePercent != null && (
              <span className={cn('ml-1.5 text-[11px] font-normal', Number(result.changePercent) > 0 ? 'text-emerald-500' : 'text-red-500')}>
                ({Number(result.changePercent) > 0 ? '+' : ''}{result.changePercent}%)
              </span>
            )}
            {result.change != null && result.changePercent == null && (
              <span className={cn('ml-1.5 text-[11px] font-normal', result.change > 0 ? 'text-emerald-500' : 'text-red-500')}>
                ({result.change > 0 ? '+' : ''}{result.change})
              </span>
            )}
          </span>
        </div>
        </div>
      )}

      {isApproved ? (
        <div className="flex items-center gap-2 text-emerald-600 text-xs font-medium py-1.5">
          <CheckCircle2 className="w-4 h-4" /> {isSale ? 'Sale recorded.' : 'Applied.'}
        </div>
      ) : isRejected ? (
        <div className="flex items-center gap-2 text-muted-foreground text-xs py-1.5">
          <XCircle className="w-4 h-4" /> Rejected.
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => onApprove(result.proposalId, result)}
            className="flex-1 py-2 bg-foreground text-background hover:opacity-90 rounded-lg font-medium transition-opacity text-xs"
          >
            {isSale ? 'Approve & record' : 'Approve'}
          </button>
          <button
            onClick={() => onReject(result.proposalId)}
            className="flex-1 py-2 bg-transparent border border-border hover:bg-muted text-foreground rounded-lg font-medium transition-colors text-xs"
          >
            Reject
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export function ToolResult({ output, onApprove, onReject, onPick }: {
  output: any;
  onApprove: (proposalId: string, action: any) => void;
  onReject: (proposalId: string) => void;
  onPick?: (product: any) => void;
}) {
  if (!output || typeof output !== 'object') return null;

  if (output.error) {
    return (
      <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs bg-red-500/10 text-red-600 border border-red-500/20 w-fit max-w-full">
        <XCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
        <span className="break-words">{output.error}</span>
      </div>
    );
  }

  switch (output.type) {
    case 'PROPOSAL':
      return <ProposalCard result={output} onApprove={onApprove} onReject={onReject} />;
    case 'CHART':
      return <ChartCard result={output} />;
    case 'PRODUCT_DETAIL':
      return <ProductDetailCard result={output} />;
    case 'LINK':
      return <LinkCard link={output} />;
    case 'WALKTHROUGH':
      return <WalkthroughCard result={output} />;
    case 'PRODUCT_LIST':
      // Routed through the switch so a long list can also be read as a table.
      // With no `rows` on the result the switch renders the grid and hides the
      // control, so this is the same output it always produced.
      return <ProductResultSwitch result={output} onPick={onPick} />;
    case 'PRODUCT_TABLE':
      // Product-shaped answers that also carry table columns. Cards by default.
      return <ProductResultSwitch result={output} onPick={onPick} />;
    case 'PRODUCT_PICKER':
      return <ProductPicker result={output} onPick={onPick} />;
    case 'CUSTOMER_LIST':
      return <CustomerList result={output} />;
    case 'METRICS':
      return <MetricTiles result={output} />;
    case 'TABLE':
      return <DataTable result={output} />;
    case 'LOSS_SCAN':
      // The same report component the audit log page renders, so a scan looks
      // identical whether it was asked for in chat or run from the button.
      // Evidence chips deep-link out rather than opening a dialog here — there
      // is no audit-log table in the chat to open one against.
      return (
        <div className="w-full">
          <ForensicReportView report={output.report} />
          {output.truncated > 0 && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {output.truncated} further finding(s) not shown here — open the Audit Log page for the
              complete report.
            </p>
          )}
        </div>
      );
    default:
      // Untagged results are summarised by the model in prose.
      return null;
  }
}

export { ArrowRight };
