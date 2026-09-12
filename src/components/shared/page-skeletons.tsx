/**
 * Shape-matched loading skeletons.
 *
 * These exist because the app used to have exactly **one** skeleton —
 * `src/app/(app)/loading.tsx`, a route-group fallback shared by all thirty
 * routes under `(app)`. It drew a four-up stat grid over five full-width bars,
 * which is the shape of almost none of them: the POS is a product grid, Receipts
 * is one card holding a table, Settings is a two-column split. So every
 * navigation flashed a layout that had nothing to do with the page arriving,
 * and the content then jumped into a different shape. A skeleton whose job is to
 * predict the page cannot be generic.
 *
 * Two rules for anything added here, both learned the hard way:
 *
 * 1. **No page padding.** `(app)/layout.tsx` renders `<main>` with
 *    `p-4 sm:p-6` already (except on `/ai-insights`, the one full-bleed route).
 *    The old universal skeleton wrapped itself in `p-4 sm:p-6` too, so it sat
 *    inset by double the real gutter and everything shifted left on arrival.
 *    Use `SkeletonPage` for the vertical rhythm and let `main` do the gutters.
 *
 * 2. **Mirror the real component's box, not an approximation of it.** The
 *    numbers here are copied from the components they stand in for —
 *    `page-title.tsx`, `summary-card.tsx`, `ui/button.tsx` (`h-10` default,
 *    `h-9` for `sm`), `ui/tabs.tsx` (`h-10` list), `ui/card.tsx` (`p-6`
 *    header/content). If one of those changes its height, change it here too.
 *
 * Deliberately free of hooks and of `'use client'`: every consumer is a
 * `loading.tsx`, which Next renders as a server component. `Skeleton` itself is
 * a bare `div`, so it is safe there.
 */

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/* Page wrapper                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Vertical rhythm and the busy signal. Supplies **no horizontal padding** —
 * see rule 1 above.
 *
 * `role="status"` + `aria-busy` without a label is intentional: a `loading.tsx`
 * is a server component and cannot reach `useI18n`, so any text here would ship
 * as untranslated English in an eleven-language app. The busy state is the part
 * assistive tech actually needs; the bars themselves say nothing worth reading.
 */
export function SkeletonPage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      className={cn('space-y-6 animate-in fade-in duration-150', className)}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Headers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Mirrors `src/components/shared/page-title.tsx`:
 * `mb-6 flex flex-col sm:flex-row … justify-between gap-4`, an
 * `text-2xl sm:text-3xl` heading (32 / 36px line box → `h-8 sm:h-9`) and an
 * optional `mt-1 text-sm` subtitle (`h-4`).
 *
 * `actions` is how many buttons sit in the right-hand slot; they render at the
 * default button height (`h-10`) because that is what `PageTitle` children are.
 */
export function SkeletonPageHeader({
  subtitle = true,
  actions = 0,
  titleWidth = 'w-48',
  className,
}: {
  subtitle?: boolean;
  actions?: number;
  titleWidth?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4',
        className
      )}
    >
      <div className="w-full sm:w-auto">
        <Skeleton className={cn('h-8 sm:h-9', titleWidth)} />
        {subtitle && <Skeleton className="mt-2 h-4 w-64 max-w-full" />}
      </div>
      {actions > 0 && (
        <div className="flex items-center gap-2 shrink-0">
          {Array.from({ length: actions }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-28" />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * For the pages that use a raw `<h1>` instead of `PageTitle` — usually
 * `text-3xl font-bold` with an icon beside it (Notifications, Invoices,
 * Inventory ▸ Debts, Settings ▸ Branches).
 */
export function SkeletonHeading({
  icon = false,
  subtitle = true,
  actions = 0,
  titleWidth = 'w-56',
  className,
}: {
  icon?: boolean;
  subtitle?: boolean;
  actions?: number;
  titleWidth?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4',
        className
      )}
    >
      <div className="w-full sm:w-auto">
        <div className="flex items-center gap-3">
          {icon && <Skeleton className="h-8 w-8 rounded-lg shrink-0" />}
          <Skeleton className={cn('h-8 sm:h-9', titleWidth)} />
        </div>
        {subtitle && <Skeleton className="mt-2 h-4 w-72 max-w-full" />}
      </div>
      {actions > 0 && (
        <div className="flex items-center gap-2 shrink-0">
          {Array.from({ length: actions }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-28" />
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Stat cards                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Mirrors `src/components/dashboard/summary-card.tsx`: a `shadow-md` card whose
 * header is `flex flex-row items-center justify-between space-y-0 pb-2` with a
 * `text-sm` label and an `h-5 w-5` icon, over a `text-3xl font-bold` value and
 * an optional `text-xs mt-1` note.
 *
 * `cols` takes the calling page's own grid classes so the count and the
 * breakpoints match what arrives — Reports really does go to seven across,
 * Inventory ▸ Debts stops at four.
 */
export function SkeletonStatCards({
  count = 4,
  cols = 'grid-cols-2 md:grid-cols-4',
  note = true,
  className,
}: {
  count?: number;
  cols?: string;
  note?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-4', cols, className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border bg-card shadow-sm p-6 flex flex-col justify-between"
        >
          <div className="flex flex-row items-center justify-between pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-5 rounded" />
          </div>
          <Skeleton className="h-8 w-28" />
          {note && <Skeleton className="mt-2 h-3 w-20" />}
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tables                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The commonest shape in the app: a single `Card` whose header carries a title,
 * a description and a filter row, over a table.
 *
 * `toolbar` draws the search box plus filters that most of these headers hold
 * (`w-full sm:w-64` input at `h-10`, matching Receipts and Customers).
 */
export function SkeletonTableCard({
  rows = 6,
  cols = 5,
  title = true,
  toolbar = true,
  toolbarItems = 2,
  className,
}: {
  rows?: number;
  cols?: number;
  title?: boolean;
  toolbar?: boolean;
  toolbarItems?: number;
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg border bg-card shadow-sm', className)}>
      {(title || toolbar) && (
        <div className="p-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          {title && (
            <div className="space-y-1.5">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-56 max-w-full" />
            </div>
          )}
          {toolbar && (
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-10 w-full sm:w-64" />
              {Array.from({ length: Math.max(0, toolbarItems - 1) }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-32" />
              ))}
            </div>
          )}
        </div>
      )}
      <div className={cn('px-6 pb-6', !title && !toolbar && 'pt-6')}>
        {/* Header row: `TableHead` is `h-12 px-4`, so the divider sits under a 48px band. */}
        <div className="flex items-center gap-4 h-12 border-b">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton
              key={i}
              className={cn('h-4 flex-1', i === 0 && 'max-w-[120px]')}
            />
          ))}
        </div>
        {/* Body rows: `TableCell` is `p-4`, giving a ~53px row. */}
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 h-[53px] border-b last:border-0">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton
                key={c}
                className={cn('h-4 flex-1', c === 0 && 'max-w-[120px]')}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Table rows only — for a page that already has its own card and header. */
export function SkeletonTableRows({
  rows = 6,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 h-[53px] border-b last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn('h-4 flex-1', c === 0 && 'max-w-[120px]')} />
          ))}
        </div>
      ))}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Tabs                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Mirrors `ui/tabs.tsx`'s `TabsList`: `inline-flex h-10 … rounded-md bg-muted p-1`.
 * The three pages with tabs (Inventory, Reports, Settings) all stretch the list
 * to full width with a `grid-cols-N`, so `count` sets the columns.
 */
export function SkeletonTabsBar({
  count = 3,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn('grid h-10 w-full items-center gap-1 rounded-md bg-muted p-1', className)}
      style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-8 w-full rounded-sm', i === 0 ? 'bg-background' : 'bg-muted-foreground/10')}
        />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Product grid (POS + Inventory grid view)                                   */
/* -------------------------------------------------------------------------- */

/**
 * Mirrors `ProductCardSkeleton` in
 * `src/app/(app)/sales/pos/select-products/page.tsx` so the route-transition
 * skeleton and the in-page one are the same picture — the POS is the page where
 * a mismatch is most visible, because the in-page skeleton now stays up until
 * the catalogue actually loads.
 */
export function SkeletonProductGrid({
  count = 9,
  cols = 'grid-cols-2 sm:grid-cols-3',
  className,
}: {
  count?: number;
  cols?: string;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-4', cols, className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <Skeleton className="w-full h-32 rounded-none" />
          <div className="p-2 h-20">
            <Skeleton className="h-5 w-3/4" />
          </div>
          <div className="p-2 flex justify-between items-center">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-7 w-7 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Charts, forms, lists                                                       */
/* -------------------------------------------------------------------------- */

/** A card holding a chart. `height` should match the real chart's container. */
export function SkeletonChartCard({
  height = 'h-[300px]',
  legend = true,
  className,
}: {
  height?: string;
  legend?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg border bg-card shadow-sm p-6 space-y-4', className)}>
      <div className="space-y-1.5">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-56 max-w-full" />
      </div>
      <Skeleton className={cn('w-full rounded-md', height)} />
      {legend && (
        <div className="flex flex-wrap items-center gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A card of labelled inputs. `columns` mirrors the form's own grid — the
 * inventory forms are `sm:grid-cols-2`, most settings sections are one column.
 * Inputs are `h-10`, matching `ui/input.tsx`.
 */
export function SkeletonFormCard({
  fields = 4,
  columns = 1,
  footer = false,
  title = true,
  className,
}: {
  fields?: number;
  columns?: number;
  footer?: boolean;
  title?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg border bg-card shadow-sm', className)}>
      {title && (
        <div className="p-6 space-y-1.5">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
      )}
      <div
        className={cn('grid gap-4 px-6', title ? 'pb-6' : 'py-6')}
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
      {footer && (
        <div className="flex items-center justify-end gap-2 px-6 pb-6">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-28" />
        </div>
      )}
    </div>
  );
}

/**
 * A card holding a vertical list of rows — activity feeds, notification lists,
 * branch lists, the "recent" panels on the dashboard.
 */
export function SkeletonListCard({
  rows = 5,
  avatar = true,
  title = true,
  className,
}: {
  rows?: number;
  avatar?: boolean;
  title?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg border bg-card shadow-sm', className)}>
      {title && (
        <div className="p-6 space-y-1.5">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56 max-w-full" />
        </div>
      )}
      <div className={cn('px-6 space-y-4', title ? 'pb-6' : 'py-6')}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            {avatar && <Skeleton className="h-10 w-10 rounded-full shrink-0" />}
            <div className="flex-1 space-y-2 min-w-0">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
            <Skeleton className="h-4 w-16 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * A sticky search-and-filter bar, as used above the Inventory and Customers
 * tables. Kept separate from `SkeletonTableCard` because on those pages the bar
 * sits *outside* the card.
 */
export function SkeletonToolbar({
  filters = 2,
  actions = 1,
  className,
}: {
  filters?: number;
  actions?: number;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col sm:flex-row items-center gap-2', className)}>
      <Skeleton className="h-10 w-full sm:flex-1 sm:max-w-sm" />
      <div className="flex items-center gap-2 w-full sm:w-auto">
        {Array.from({ length: filters }).map((_, i) => (
          <Skeleton key={i} className="h-10 flex-1 sm:w-36" />
        ))}
        {Array.from({ length: actions }).map((_, i) => (
          <Skeleton key={`a${i}`} className="h-10 w-10 sm:w-28 shrink-0" />
        ))}
      </div>
    </div>
  );
}

/** A row of plain cards — badge grids, plan cards, use-case tiles. */
export function SkeletonCardGrid({
  count = 6,
  cols = 'grid-cols-2 md:grid-cols-3',
  height = 'h-32',
  className,
}: {
  count?: number;
  cols?: string;
  height?: string;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-4', cols, className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={cn('w-full rounded-lg', height)} />
      ))}
    </div>
  );
}
