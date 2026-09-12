'use client';

/**
 * The one drawing of "there is nothing to show and the shop is not empty".
 *
 * It was two drawings — one in the POS grid, one in the Inventory table — with
 * the same three-way ternary copied into both. That duplication is how the
 * misleading version survived: the copy, the icon and the decision to withhold
 * the Retry button all had to be got right twice, in two files nobody edits
 * together. Both surfaces render this now, so the state has one definition and
 * cannot drift.
 *
 * Two rules live here rather than at the call sites:
 *
 * - **The wording never accuses the account.** See `product-catalog-state.ts`
 *   for why a refusal cannot honestly be reported as a missing permission.
 * - **Retry is always offered.** The old code hid it for a refusal, on the
 *   theory that only the owner could grant access — which left the owner
 *   themselves staring at a dead end on their own shop. A refusal is usually
 *   transient, so the button is the fix in the common case, and it never lies
 *   in the uncommon one.
 */

import { CloudOff, DatabaseBackup, RefreshCw, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/context/i18n-context';
import { cn } from '@/lib/utils';
import {
  catalogUnavailableMessageKey,
  type ProductSyncErrorKind,
} from '@/lib/product-catalog-state';

const ICON_FOR_KIND = {
  network: CloudOff,
  cache: DatabaseBackup,
  access: ShieldAlert,
} as const;

interface CatalogUnavailableProps {
  /** The recorded reason, or `null` when there is none — typically offline. */
  kind: ProductSyncErrorKind | null;
  onRetry: () => void;
  /** Layout for the host surface; the dashed destructive frame is kept. */
  className?: string;
  /** The paragraph's measure — the two hosts want different widths. */
  messageClassName?: string;
}

export function CatalogUnavailable({
  kind,
  onRetry,
  className,
  messageClassName,
}: CatalogUnavailableProps) {
  const { t } = useI18n();
  const Icon = kind ? ICON_FOR_KIND[kind] : CloudOff;

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-destructive/30 bg-destructive/5 rounded-lg min-h-[400px]',
        className,
      )}
    >
      <Icon className="h-16 w-16 text-destructive/40 mb-4" />
      <h3 className="text-xl font-semibold">{t('pos.catalogUnavailableTitle')}</h3>
      <p className={cn('text-muted-foreground mt-2 mb-6 mx-auto max-w-sm', messageClassName)}>
        {t(catalogUnavailableMessageKey(kind))}
      </p>
      <Button size="sm" onClick={onRetry}>
        <RefreshCw className="h-4 w-4 me-2" /> {t('pos.retryLoadingProducts')}
      </Button>
    </div>
  );
}
