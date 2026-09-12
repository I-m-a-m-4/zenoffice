'use client';

/**
 * "What happened to the people who installed and never signed up."
 *
 * This is the read side of `api/launch`. It answers the question the Microsoft
 * Store funnel raised — 29 installs, 10 launches, 1 signup — which nothing in
 * this codebase could answer before, because every analytics path we had was
 * gated on a signed-in user.
 *
 * Three deliberate choices:
 *
 * - **`getDocs`, not `onSnapshot`.** Firestore cost is a standing constraint, and
 *   a live listener on a collection that grows with every install bills reads
 *   forever for a panel nobody is watching. It loads on open and has a Refresh
 *   button.
 * - **Capped at `MAX_DOCS`.** Newest first, so the cap costs the oldest installs
 *   rather than the current ones — and the cap is *stated on screen*, because a
 *   silently truncated funnel reads as a complete one.
 * - **It says what it cannot know.** Installs that predate this telemetry are not
 *   in here and never will be, and the panel says so rather than presenting its
 *   own start date as the beginning of the story.
 */

import * as React from 'react';
import { format } from 'date-fns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertTriangle,
  DoorOpen,
  Loader2,
  RefreshCw,
  TrendingDown,
  UserPlus,
} from 'lucide-react';
import { useFirestore } from '@/firebase';
import {
  furthestStage,
  launchDate,
  stageLabel,
  summariseLaunches,
  type LaunchDoc,
  type LaunchFunnelSummary,
} from '@/lib/launch-funnel';
import { cn } from '@/lib/utils';

/** Newest-first cap. Stated on screen — see the header note. */
const MAX_DOCS = 500;

function StatCard({
  label,
  value,
  hint,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'good' | 'bad';
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="text-xs flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </CardDescription>
        <CardTitle
          className={cn(
            'text-2xl font-bold',
            tone === 'good' && 'text-green-600',
            tone === 'bad' && 'text-red-600',
          )}
        >
          {value}
        </CardTitle>
        {hint && <p className="text-[11px] text-muted-foreground pt-1">{hint}</p>}
      </CardHeader>
    </Card>
  );
}

function FunnelRow({
  step,
  isWorst,
}: {
  step: LaunchFunnelSummary['steps'][number];
  isWorst: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{step.label}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {step.reached}
          <span className="text-xs"> ({step.reachedPct}%)</span>
        </span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            isWorst ? 'bg-red-500' : 'bg-primary',
          )}
          style={{ width: `${Math.max(step.reachedPct, step.reached > 0 ? 2 : 0)}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
        <span>{step.hint}</span>
        <span className="shrink-0 flex items-center gap-2">
          {step.carryPct !== null && <span>{step.carryPct}% carried through</span>}
          {step.lostHere > 0 && (
            <Badge
              variant={isWorst ? 'destructive' : 'secondary'}
              className="text-[10px] font-normal"
            >
              {step.lostHere} stopped here
            </Badge>
          )}
        </span>
      </div>
    </div>
  );
}

function Breakdown({
  title,
  rows,
  total,
  empty,
}: {
  title: string;
  rows: { value: string; count: number }[];
  total: number;
  empty: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((row) => (
            <li key={row.value} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-mono" title={row.value}>
                {row.value}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {row.count}
                {total > 0 && (
                  <span className="text-[10px]">
                    {' '}
                    ({Math.round((row.count / total) * 100)}%)
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function LaunchFunnel() {
  const firestore = useFirestore();
  const [docs, setDocs] = React.useState<LaunchDoc[] | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [truncated, setTruncated] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!firestore) return;
    setIsLoading(true);
    setError(null);
    try {
      const { collection, getDocs, limit, orderBy, query } = await import(
        'firebase/firestore'
      );
      const snap = await getDocs(
        query(
          collection(firestore, 'app_launches'),
          orderBy('lastSeenAt', 'desc'),
          limit(MAX_DOCS),
        ),
      );
      const rows = snap.docs.map((d) => ({ installId: d.id, ...(d.data() as any) })) as LaunchDoc[];
      setDocs(rows);
      setTruncated(rows.length >= MAX_DOCS);
    } catch (err: any) {
      // A missing collection reads as an empty result, not an error, so anything
      // landing here is a real permission or index problem worth naming.
      setError(err?.message || 'Could not read app_launches.');
      setDocs([]);
    } finally {
      setIsLoading(false);
    }
  }, [firestore]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const summary = React.useMemo(
    () => (docs ? summariseLaunches(docs) : null),
    [docs],
  );

  /** Never signed up, worst-off first — the list this panel exists to produce. */
  const lostInstalls = React.useMemo(() => {
    if (!docs) return [];
    return docs
      .filter((d) => !d.signedUp)
      .sort((a, b) => (launchDate(b)?.getTime() || 0) - (launchDate(a)?.getTime() || 0));
  }, [docs]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DoorOpen className="h-5 w-5 text-primary" />
              Install → Sign-up funnel
            </CardTitle>
            <CardDescription>
              What happens to people who install the app and never create an account.
              Anonymous — a random per-install id, no email and no typed input.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Refresh</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {isLoading && !summary && (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Loading launches…
          </div>
        )}

        {summary && summary.installs === 0 && !isLoading && (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            <p className="font-medium text-foreground">No launches recorded yet.</p>
            <p className="mt-1 text-xs">
              This only sees builds that shipped with launch telemetry. Store installs
              from before it cannot be recovered — they were never recorded anywhere.
              Numbers appear here once a new build reaches users.
            </p>
          </div>
        )}

        {summary && summary.installs > 0 && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                icon={DoorOpen}
                label="Installs seen"
                value={summary.installs}
                hint={truncated ? `Newest ${MAX_DOCS} only` : 'All recorded launches'}
              />
              <StatCard
                icon={UserPlus}
                label="Created an account"
                value={summary.signedUp}
                tone={summary.signedUp > 0 ? 'good' : undefined}
                hint={`${summary.conversionPct}% of installs`}
              />
              <StatCard
                icon={TrendingDown}
                label="Never signed up"
                value={summary.installs - summary.signedUp}
                tone={summary.installs - summary.signedUp > 0 ? 'bad' : undefined}
                hint={`${summary.returnedWithoutSigningUp} came back and still didn't`}
              />
              <StatCard
                icon={AlertTriangle}
                label="Hit an error"
                value={summary.installsWithFailures}
                tone={summary.installsWithFailures > 0 ? 'bad' : undefined}
                hint="Sign-in or sign-up failed at least once"
              />
            </div>

            {summary.worstStep && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-900 dark:bg-amber-950/40">
                <p className="font-semibold text-amber-900 dark:text-amber-200">
                  Biggest drop-off: {summary.worstStep.label}
                </p>
                <p className="mt-1 text-amber-800 dark:text-amber-300">
                  {summary.worstStep.lostHere} install
                  {summary.worstStep.lostHere === 1 ? '' : 's'} got no further than this.
                </p>
              </div>
            )}

            <div className="space-y-4">
              {summary.steps.map((step) => (
                <FunnelRow
                  key={step.key}
                  step={step}
                  isWorst={summary.worstStep?.key === step.key}
                />
              ))}
            </div>

            <div className="grid grid-cols-1 gap-6 border-t pt-5 sm:grid-cols-2 lg:grid-cols-3">
              <Breakdown
                title="Failure codes"
                rows={summary.failureCodes}
                total={summary.installsWithFailures}
                empty="No failures recorded."
              />
              <Breakdown
                title="Language of those who left"
                rows={summary.lostLocales}
                total={summary.installs - summary.signedUp}
                empty="Nobody left."
              />
              <Breakdown
                title="Platform"
                rows={summary.platforms}
                total={summary.installs}
                empty="—"
              />
              <Breakdown
                title="Country"
                rows={summary.countries}
                total={summary.installs}
                empty="—"
              />
              <Breakdown
                title="App version"
                rows={summary.appVersions}
                total={summary.installs}
                empty="—"
              />
              <Breakdown
                title="Screen size"
                rows={summary.screens}
                total={summary.installs}
                empty="—"
              />
            </div>

            <div className="space-y-2 border-t pt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Installs that never signed up ({lostInstalls.length})
              </p>
              <div className="max-h-96 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Last seen</TableHead>
                      <TableHead>Got as far as</TableHead>
                      <TableHead>Failure</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>Lang</TableHead>
                      <TableHead className="text-right">Opens</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lostInstalls.map((row) => {
                      const when = launchDate(row);
                      const lastFailure = (row.failures || []).slice(-1)[0];
                      return (
                        <TableRow key={row.installId}>
                          <TableCell className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {when ? format(when, 'dd MMM, HH:mm') : 'Unknown'}
                          </TableCell>
                          <TableCell className="text-xs">
                            {stageLabel(furthestStage(row))}
                          </TableCell>
                          <TableCell
                            className="max-w-[200px] truncate font-mono text-[10px]"
                            title={lastFailure?.code || ''}
                          >
                            {lastFailure?.code || '—'}
                          </TableCell>
                          <TableCell className="text-xs capitalize">
                            {row.platform || 'unknown'}
                          </TableCell>
                          <TableCell className="text-xs">{row.locale || '—'}</TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {row.launches || 1}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {lostInstalls.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="py-6 text-center text-sm text-muted-foreground"
                        >
                          Every recorded install signed up.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Installs from before launch telemetry shipped are not here and cannot be
                — nothing recorded them.
                {truncated && ` Showing the newest ${MAX_DOCS} installs only.`}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
