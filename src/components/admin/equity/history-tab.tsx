'use client';

/**
 * Audit trail.
 *
 * Loaded on demand rather than with the rest of the page. The `cap_table`
 * collection is small and bounded, but events accumulate forever — subscribing
 * to them alongside everything else would mean paying to read the entire history
 * of the company every time someone opens the Overview tab.
 *
 * `cap_table_events` is append-only at the rules layer: create is allowed, update
 * and delete are denied outright, to the owner included. Equity records are the
 * kind of thing a dispute turns on, and a history anyone can quietly edit is not
 * evidence of anything.
 */

import * as React from 'react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { History, Loader, RefreshCw } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CAP_TABLE_EVENTS_COLLECTION } from '@/lib/equity/data';
import { toDate } from '@/lib/equity/engine';
import type { EquityEvent } from '@/lib/equity/types';
import { EmptyState, TabSection } from './equity-dialogs';

/** One page of history. Enough to answer "what changed recently" without unbounded reads. */
const PAGE_SIZE = 100;

export function HistoryTab() {
  const firestore = useFirestore();

  const [events, setEvents] = React.useState<EquityEvent[] | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!firestore) return;
    setIsLoading(true);
    setError(null);
    try {
      const snapshot = await getDocs(
        query(
          collection(firestore, CAP_TABLE_EVENTS_COLLECTION),
          orderBy('at', 'desc'),
          limit(PAGE_SIZE),
        ),
      );
      setEvents(
        snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EquityEvent, 'id'>) })),
      );
    } catch (err: any) {
      setError(err?.message || 'Could not load the audit trail.');
    } finally {
      setIsLoading(false);
    }
  }, [firestore]);

  // Fetch once when the tab first mounts. Tabs mount lazily, so this does not
  // run until the user actually opens History.
  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <TabSection
      title="History"
      description={`Every change to the cap table, newest first. Showing up to ${PAGE_SIZE} entries.`}
      action={
        <Button variant="outline" onClick={load} disabled={isLoading} className="gap-2">
          <RefreshCw className={isLoading ? 'size-4 animate-spin' : 'size-4'} />
          Refresh
        </Button>
      }
    >
      {isLoading && events === null ? (
        <div className="flex items-center justify-center py-16">
          <Loader className="size-6 animate-spin text-primary" />
          <span className="ml-3 text-sm text-muted-foreground">Loading history...</span>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm">
          {error}
        </div>
      ) : !events || events.length === 0 ? (
        <EmptyState
          icon={History}
          title="No changes recorded"
          description="Every issuance, transfer, grant and edit will appear here as it happens."
        />
      ) : (
        <ol className="relative space-y-0 border-l pl-6">
          {events.map((e) => {
            const at = toDate(e.at);
            const [entity, verb] = String(e.action ?? '').split('.');
            return (
              <li key={e.id} className="relative pb-6 last:pb-0">
                <span
                  className="absolute -left-[1.9rem] top-1.5 size-2.5 rounded-full border-2 border-background bg-primary"
                  aria-hidden
                />
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <p className="text-sm font-medium">{e.summary}</p>
                  <Badge
                    variant={
                      verb === 'delete' ? 'destructive' : verb === 'create' ? 'default' : 'secondary'
                    }
                    className="text-[10px] capitalize"
                  >
                    {verb ?? 'change'}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {at ? at.toLocaleString() : 'Unknown time'} · {e.actorEmail}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </TabSection>
  );
}
