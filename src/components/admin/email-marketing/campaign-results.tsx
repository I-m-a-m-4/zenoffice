'use client';

/**
 * Campaign results — who was mailed, and who opened it.
 *
 * Opens come from the 1×1 pixel in `src/app/api/track/route.ts`, which is the
 * only signal available without a link click. That endpoint already increments
 * atomically, so the counts here are safe to read directly.
 *
 * The numbers are honest but approximate, and the UI says so rather than
 * implying precision it does not have. Gmail fetches the pixel once through its
 * own image proxy and caches it, so a second read by the same person often never
 * reaches us; a recipient with images off never registers at all. Open rate is
 * therefore a floor, useful for comparing two subject lines against each other
 * and misleading if read as a headcount.
 */

import * as React from 'react';
import { format } from 'date-fns';
import {
  BanIcon,
  CheckCircle2,
  Clock,
  Eye,
  Info,
  Mail,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { toDate } from '@/components/admin/user-detail/user-primitives';
import { BEHAVIOR_SEGMENT_META, type BehaviorSegment } from '@/lib/behavior-segments';
import { TONE_CLASSES } from './segment-styles';

export interface FollowUpLog {
  id: string;
  sentTo?: string;
  recipientName?: string;
  subject?: string;
  sentAt?: any;
  openedAt?: any;
  status?: 'pending' | 'sent' | 'opened' | 'failed';
  openCount?: number;
  businessId?: string;
  type?: string;
  segment?: BehaviorSegment | null;
  behaviorContext?: string | null;
  unsubscribed?: boolean;
  html?: string;
  error?: string;
}

/** A log row counts as opened on either signal — status, or a non-zero count. */
function wasOpened(log: FollowUpLog): boolean {
  return log.status === 'opened' || (log.openCount ?? 0) > 0;
}

type Campaign = {
  key: string;
  subject: string;
  segment: BehaviorSegment | null;
  logs: FollowUpLog[];
  sent: number;
  opened: number;
  failed: number;
  unsubscribed: number;
  openRate: number;
  lastSentAt: Date | null;
};

function buildCampaigns(logs: FollowUpLog[]): Campaign[] {
  const byKey = new Map<string, Campaign>();

  for (const log of logs) {
    const subject = log.subject || '(no subject)';
    // Subject alone is not the identity: the same headline sent to two segments is
    // two campaigns, and averaging their open rates hides which targeting worked.
    const key = `${subject}::${log.segment ?? ''}`;

    let campaign = byKey.get(key);
    if (!campaign) {
      campaign = {
        key,
        subject,
        segment: log.segment ?? null,
        logs: [],
        sent: 0,
        opened: 0,
        failed: 0,
        unsubscribed: 0,
        openRate: 0,
        lastSentAt: null,
      };
      byKey.set(key, campaign);
    }

    campaign.logs.push(log);
    if (log.status === 'failed') campaign.failed++;
    else campaign.sent++;
    if (wasOpened(log)) campaign.opened++;
    if (log.unsubscribed) campaign.unsubscribed++;

    const sentAt = toDate(log.sentAt);
    if (sentAt && (!campaign.lastSentAt || sentAt > campaign.lastSentAt)) {
      campaign.lastSentAt = sentAt;
    }
  }

  return [...byKey.values()]
    .map(c => ({ ...c, openRate: c.sent > 0 ? (c.opened / c.sent) * 100 : 0 }))
    .sort((a, b) => (b.lastSentAt?.getTime() ?? 0) - (a.lastSentAt?.getTime() ?? 0));
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
        <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
        {sub && <p className="mt-0.5 break-words text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

interface CampaignResultsProps {
  logs: FollowUpLog[];
  isLoading: boolean;
  onRefresh: () => void;
  /**
   * Hand a set of recipient addresses back to the composer as a new selection.
   * Absent when the caller has nowhere to put them, in which case the follow-up
   * panel still reports the finding but offers no button.
   */
  onFollowUp?: (emails: string[]) => void;
}

/** Sent this long ago and still unopened is a follow-up candidate, not a failure. */
const FOLLOW_UP_AFTER_DAYS = 3;

export default function CampaignResults({
  logs,
  isLoading,
  onRefresh,
  onFollowUp,
}: CampaignResultsProps) {
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');
  const [viewLog, setViewLog] = React.useState<FollowUpLog | null>(null);

  const campaigns = React.useMemo(() => buildCampaigns(logs), [logs]);

  const totals = React.useMemo(() => {
    const delivered = logs.filter(l => l.status !== 'failed');
    const opened = delivered.filter(wasOpened);
    return {
      sent: delivered.length,
      opened: opened.length,
      openRate: delivered.length > 0 ? (opened.length / delivered.length) * 100 : 0,
      failed: logs.filter(l => l.status === 'failed').length,
      unsubscribed: logs.filter(l => l.unsubscribed).length,
    };
  }, [logs]);

  const selected = campaigns.find(c => c.key === selectedKey) ?? null;

  /**
   * Open rate per behavioural segment.
   *
   * The single most useful number on this page: it says which *targeting* works,
   * not which subject line does. A 40% open rate on lapsed users and 8% on
   * champions is telling you where the attention actually is.
   */
  const segmentPerf = React.useMemo(() => {
    const bySegment = new Map<string, { sent: number; opened: number; unsub: number }>();
    for (const log of logs) {
      if (log.status === 'failed') continue;
      const key = log.segment ?? 'unlabelled';
      const acc = bySegment.get(key) ?? { sent: 0, opened: 0, unsub: 0 };
      acc.sent += 1;
      if (wasOpened(log)) acc.opened += 1;
      if (log.unsubscribed) acc.unsub += 1;
      bySegment.set(key, acc);
    }
    return [...bySegment.entries()]
      .map(([key, v]) => ({
        key,
        label: BEHAVIOR_SEGMENT_META[key as BehaviorSegment]?.label ?? 'Unlabelled',
        tone: BEHAVIOR_SEGMENT_META[key as BehaviorSegment]?.tone ?? 'neutral',
        ...v,
        openRate: v.sent > 0 ? (v.opened / v.sent) * 100 : 0,
      }))
      .sort((a, b) => b.openRate - a.openRate);
  }, [logs]);

  /**
   * How *deeply* people engaged, not just whether they opened.
   *
   * A single open is often the preview pane loading the pixel. Three or more is
   * somebody who came back to the message, which is the closest thing to intent
   * this tracking can see.
   */
  const engagement = React.useMemo(() => {
    const delivered = logs.filter(l => l.status !== 'failed');
    const bucket = { none: 0, once: 0, few: 0, many: 0 };
    for (const log of delivered) {
      const opens = log.openCount ?? 0;
      if (opens <= 0) bucket.none += 1;
      else if (opens === 1) bucket.once += 1;
      else if (opens <= 3) bucket.few += 1;
      else bucket.many += 1;
    }
    return { ...bucket, total: delivered.length };
  }, [logs]);

  /**
   * Delivered, given a few days, and still never opened.
   *
   * The point of surfacing these separately is that they are not failures — they
   * are the people a second attempt is actually for. Unsubscribes are excluded,
   * because mailing them again would be both wrong and unlawful.
   */
  const needsFollowUp = React.useMemo(() => {
    const cutoff = Date.now() - FOLLOW_UP_AFTER_DAYS * 86_400_000;
    const seen = new Set<string>();
    const out: FollowUpLog[] = [];
    for (const log of logs) {
      if (log.status === 'failed' || log.unsubscribed || wasOpened(log)) continue;
      const sentAt = toDate(log.sentAt);
      if (!sentAt || sentAt.getTime() > cutoff) continue;
      const email = (log.sentTo || '').trim().toLowerCase();
      if (!email || seen.has(email)) continue;
      seen.add(email);
      out.push(log);
    }
    return out;
  }, [logs]);

  const rows = React.useMemo(() => {
    const base = selected ? selected.logs : logs;
    const needle = search.trim().toLowerCase();
    const filtered = needle
      ? base.filter(
          l =>
            (l.sentTo || '').toLowerCase().includes(needle)
            || (l.recipientName || '').toLowerCase().includes(needle)
            || (l.subject || '').toLowerCase().includes(needle),
        )
      : base;
    return [...filtered].sort(
      (a, b) => (toDate(b.sentAt)?.getTime() ?? 0) - (toDate(a.sentAt)?.getTime() ?? 0),
    );
  }, [selected, logs, search]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Delivered" value={isLoading ? '—' : totals.sent} icon={Mail} />
        <StatCard
          label="Opened"
          value={isLoading ? '—' : totals.opened}
          sub={isLoading ? undefined : `${totals.openRate.toFixed(1)}% open rate`}
          icon={Eye}
        />
        <StatCard label="Failed" value={isLoading ? '—' : totals.failed} icon={XCircle} />
        <StatCard
          label="Unsubscribed"
          value={isLoading ? '—' : totals.unsubscribed}
          sub="From these emails"
          icon={BanIcon}
        />
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Opens are counted by a tracking pixel, so treat them as a floor rather than
          a headcount. Gmail loads the image once through its own proxy and caches
          it, so repeat opens usually go unrecorded, and anyone reading with images
          turned off never registers at all. The number is reliable for comparing one
          subject line against another; it is not a list of everyone who read it.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Which targeting works, rather than which subject line does. */}
        <Card className="min-w-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Open rate by segment</CardTitle>
            <CardDescription className="text-xs">
              Which behavioural group is actually paying attention. This is the number
              that should decide who you write to next.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {segmentPerf.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">Nothing sent yet.</p>
            ) : (
              segmentPerf.map(row => (
                <div key={row.key} className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <Badge
                      variant="outline"
                      className={cn('text-[10px]', TONE_CLASSES[row.tone as keyof typeof TONE_CLASSES])}
                    >
                      {row.label}
                    </Badge>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {row.opened}/{row.sent} opened
                      {row.unsub > 0 ? ` · ${row.unsub} unsubscribed` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${Math.min(100, row.openRate)}%` }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-right text-[11px] font-bold tabular-nums text-emerald-600">
                      {row.openRate.toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Depth of engagement. One open is often just a preview pane. */}
        <Card className="min-w-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">How deeply they engaged</CardTitle>
            <CardDescription className="text-xs">
              A single open is frequently just a preview pane loading the pixel. Three
              or more means somebody came back to the message.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {engagement.total === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">Nothing sent yet.</p>
            ) : (
              <div className="space-y-2.5">
                {(
                  [
                    ['Never opened', engagement.none, 'bg-muted-foreground/40'],
                    ['Opened once', engagement.once, 'bg-sky-500'],
                    ['Opened 2–3 times', engagement.few, 'bg-emerald-500'],
                    ['Opened 4+ times', engagement.many, 'bg-emerald-600'],
                  ] as const
                ).map(([label, count, colour]) => (
                  <div key={label} className="min-w-0">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="truncate text-xs">{label}</span>
                      <span className="shrink-0 text-[11px] font-semibold tabular-nums">
                        {count}
                        <span className="ml-1 font-normal text-muted-foreground">
                          ({Math.round((count / engagement.total) * 100)}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn('h-full rounded-full', colour)}
                        style={{ width: `${(count / engagement.total) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Not a failure list — the people a second attempt is actually for. */}
      {needsFollowUp.length > 0 && (
        <Card className="min-w-0 border-amber-500/30">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-base">
                  {needsFollowUp.length} worth a second attempt
                </CardTitle>
                <CardDescription className="text-xs">
                  Delivered more than {FOLLOW_UP_AFTER_DAYS} days ago and never opened.
                  Not failures — a different subject line at a different hour often
                  lands where the first one did not. Anyone who unsubscribed is
                  excluded.
                </CardDescription>
              </div>
              {onFollowUp && (
                <Button
                  size="sm"
                  className="shrink-0 gap-1.5"
                  onClick={() =>
                    onFollowUp(
                      needsFollowUp.map(l => (l.sentTo || '').trim()).filter(Boolean),
                    )
                  }
                >
                  <Mail className="h-3.5 w-3.5" />
                  Select all {needsFollowUp.length}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {needsFollowUp.slice(0, 40).map(log => (
                <span
                  key={log.id}
                  title={log.subject}
                  className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  {log.recipientName || log.sentTo}
                </span>
              ))}
              {needsFollowUp.length > 40 && (
                <span className="px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  +{needsFollowUp.length - 40} more
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
            <div className="min-w-0">
              <CardTitle className="text-base">Campaigns</CardTitle>
              <CardDescription className="text-xs">Grouped by subject and segment.</CardDescription>
            </div>
            <Button variant="ghost" size="icon" className="shrink-0" onClick={onRefresh} disabled={isLoading}>
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[460px]">
              <div className="space-y-2 p-3 pt-0">
                <button
                  type="button"
                  onClick={() => setSelectedKey(null)}
                  className={cn(
                    'w-full rounded-lg border p-3 text-left transition-colors',
                    selectedKey === null ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
                  )}
                >
                  <p className="text-sm font-semibold">All sends</p>
                  <p className="text-[11px] text-muted-foreground">
                    {logs.length} email{logs.length === 1 ? '' : 's'} across{' '}
                    {campaigns.length} campaign{campaigns.length === 1 ? '' : 's'}
                  </p>
                </button>

                {campaigns.length === 0 && !isLoading && (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    Nothing sent yet.
                  </p>
                )}

                {campaigns.map(campaign => (
                  <button
                    key={campaign.key}
                    type="button"
                    onClick={() => setSelectedKey(campaign.key)}
                    className={cn(
                      'w-full rounded-lg border p-3 text-left transition-colors',
                      selectedKey === campaign.key
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/50',
                    )}
                  >
                    <p className="truncate text-sm font-semibold">{campaign.subject}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {campaign.segment && BEHAVIOR_SEGMENT_META[campaign.segment] && (
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[9px]',
                            TONE_CLASSES[BEHAVIOR_SEGMENT_META[campaign.segment].tone],
                          )}
                        >
                          {BEHAVIOR_SEGMENT_META[campaign.segment].label}
                        </Badge>
                      )}
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {campaign.sent} sent · {campaign.opened} opened
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${Math.min(100, campaign.openRate)}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-[10px] font-bold tabular-nums text-emerald-600">
                        {campaign.openRate.toFixed(0)}%
                      </span>
                    </div>
                    {campaign.lastSentAt && (
                      <p className="mt-1.5 text-[10px] text-muted-foreground">
                        {format(campaign.lastSentAt, 'MMM d, yyyy h:mm a')}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <CardTitle className="break-words text-base">
                  {selected ? selected.subject : 'Every recipient'}
                </CardTitle>
                <CardDescription className="text-xs">
                  {rows.length} row{rows.length === 1 ? '' : 's'}
                </CardDescription>
              </div>
              <div className="relative w-full max-w-[240px]">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search recipient…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="h-9 pl-8 text-xs"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[460px]">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead className="pl-4">Recipient</TableHead>
                    <TableHead className="hidden lg:table-cell">Why they were mailed</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Sent</TableHead>
                    <TableHead className="pr-4 text-right">Opens</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                        No sends to show.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map(log => {
                      const sentAt = toDate(log.sentAt);
                      const openedAt = toDate(log.openedAt);
                      const opened = wasOpened(log);
                      return (
                        <TableRow
                          key={log.id}
                          className="cursor-pointer"
                          onClick={() => setViewLog(log)}
                        >
                          <TableCell className="max-w-[220px] pl-4">
                            <p className="break-words text-sm font-medium">{log.recipientName || '—'}</p>
                            <p className="break-all text-[11px] text-muted-foreground">{log.sentTo}</p>
                            {log.unsubscribed && (
                              <Badge
                                variant="outline"
                                className="mt-1 gap-1 border-destructive/30 text-[9px] font-bold uppercase text-destructive"
                              >
                                <BanIcon className="h-2.5 w-2.5" />
                                Unsubscribed
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="hidden max-w-[220px] lg:table-cell">
                            <p className="truncate text-[11px] text-muted-foreground">
                              {log.behaviorContext || '—'}
                            </p>
                          </TableCell>
                          <TableCell>
                            {log.status === 'failed' ? (
                              <Badge
                                variant="destructive"
                                className="gap-1 text-[10px] font-bold uppercase"
                                title={log.error}
                              >
                                <XCircle className="h-3 w-3" />
                                Failed
                              </Badge>
                            ) : opened ? (
                              <Badge className="gap-1 border-emerald-500/20 bg-emerald-500/10 text-[10px] font-bold uppercase text-emerald-600 hover:bg-emerald-500/20">
                                <CheckCircle2 className="h-3 w-3" />
                                Opened
                              </Badge>
                            ) : (
                              <Badge
                                variant="secondary"
                                className="gap-1 text-[10px] font-bold uppercase"
                              >
                                <Clock className="h-3 w-3" />
                                Delivered
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <p className="text-[11px] tabular-nums">
                              {sentAt ? format(sentAt, 'MMM d, h:mm a') : '—'}
                            </p>
                            {openedAt && (
                              <p className="text-[11px] font-semibold tabular-nums text-emerald-600">
                                opened {format(openedAt, 'MMM d, h:mm a')}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="pr-4 text-right">
                            <span className="text-sm font-bold tabular-nums">
                              {log.openCount ?? 0}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Archived copy of exactly what was sent. */}
      <Dialog open={!!viewLog} onOpenChange={open => !open && setViewLog(null)}>
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              {viewLog?.subject}
            </DialogTitle>
            <DialogDescription>
              Sent to {viewLog?.recipientName} ({viewLog?.sentTo})
              {viewLog?.behaviorContext ? ` · ${viewLog.behaviorContext}` : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 flex-1 overflow-hidden rounded-md border bg-white">
            {viewLog?.html ? (
              // Sandboxed for the same reason as the composer preview: the archived
              // body contains merchant-supplied names and renders on the super-admin
              // origin. Logs written before names were escaped still hold raw markup.
              <iframe
                sandbox=""
                referrerPolicy="no-referrer"
                srcDoc={viewLog.html}
                title="Sent email"
                className="h-[60vh] w-full border-0 bg-white"
              />
            ) : (
              <p className="py-10 text-center italic text-muted-foreground">
                No copy of this email was stored.
              </p>
            )}
          </div>

          <DialogFooter className="mt-3">
            <Button variant="outline" onClick={() => setViewLog(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
