'use client';

/**
 * Email marketing.
 *
 * This page replaced a "Strategic Outreach" screen that could not send an email.
 * It sent a push notification, or rendered one hard-coded template for the
 * operator to copy-paste by hand, and it read and wrote an `outreachLogs`
 * collection that has no rule in `firestore.rules` — so its listener and every
 * one of its writes failed with permission-denied, and "last contacted" was
 * permanently blank. Push lives on the Alerts page; `outreachLogs` is gone rather
 * than granted a rule, because `follow_up_logs` already is the record of what was
 * sent and whether it was opened.
 *
 * The three tabs are the actual workflow: read behaviour, write to a segment, see
 * who opened it.
 *
 * ## Reads
 *
 * `users` and `businessInstances` are fetched **once** with `getDocs`, not held
 * open with `useCollection`. The previous page kept three live listeners on whole
 * collections for as long as it stayed open; a marketing console has no reason to
 * stream, and the platform owner pays for every one of those reads. The sent log
 * is fetched only when the Results tab is first opened, for the same reason.
 */

import * as React from 'react';
import {
  collection,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
} from 'firebase/firestore';
import { AlertTriangle, BanIcon, Mail, RefreshCw, Send, Sparkles, Users } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFirestore } from '@/firebase';
import { withFirestoreRetry } from '@/firebase/retry';
import type { BusinessInstance, UserProfile } from '@/types';
import {
  behaviorSegmentCounts,
  profileAudience,
  type BehaviorProfile,
  type BehaviorSegment,
} from '@/lib/behavior-segments';
import AudienceTable from '@/components/admin/email-marketing/audience-table';
import CampaignComposer from '@/components/admin/email-marketing/campaign-composer';
import CampaignResults, {
  type FollowUpLog,
} from '@/components/admin/email-marketing/campaign-results';
import { draftForSegment, type EmailDraft } from '@/lib/email-templates';
import { takeInsightCohort } from '@/lib/insight-cohort';

/** How far back the results tab looks. Deep enough to cover any real campaign. */
const LOG_LIMIT = 300;

function HeaderStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardContent className="flex min-w-0 items-center gap-3 p-4">
        <div className="shrink-0 rounded-full bg-primary/10 p-2">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="text-xl font-bold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function EmailMarketingPage() {
  /*
   * `useSearchParams` in the console below forces a Suspense boundary: without
   * one, Next fails the production build for this route rather than warning, and
   * the message points at prerendering rather than at the hook. The fallback is
   * never really seen — the console renders its own loading state.
   */
  return (
    <React.Suspense
      fallback={
        <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading email marketing…
        </div>
      }
    >
      <EmailMarketingConsole />
    </React.Suspense>
  );
}

function EmailMarketingConsole() {
  const firestore = useFirestore();
  const searchParams = useSearchParams();

  const [users, setUsers] = React.useState<UserProfile[]>([]);
  const [businesses, setBusinesses] = React.useState<BusinessInstance[]>([]);
  const [audienceLoading, setAudienceLoading] = React.useState(true);
  const [audienceError, setAudienceError] = React.useState<string | null>(null);

  const [logs, setLogs] = React.useState<FollowUpLog[]>([]);
  const [logsLoading, setLogsLoading] = React.useState(false);
  const logsRequestedRef = React.useRef(false);

  const [tab, setTab] = React.useState('audience');
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [segmentFilter, setSegmentFilter] = React.useState<BehaviorSegment | null>(null);

  /**
   * The campaign draft lives here, not in the composer.
   *
   * Radix unmounts inactive `TabsContent`, so a draft held inside the composer
   * would be silently discarded every time the operator flipped back to the
   * Audience tab to check who they were writing to.
   */
  const [templateSegment, setTemplateSegment] = React.useState<BehaviorSegment>('feature_focused');
  const [draft, setDraft] = React.useState<EmailDraft>(() => draftForSegment('feature_focused'));
  /** Latches so the seeding below runs once per campaign, never over live edits. */
  const draftSeededRef = React.useRef(false);

  const loadAudience = React.useCallback(async () => {
    if (!firestore) return;
    setAudienceLoading(true);
    setAudienceError(null);
    try {
      const [userSnap, businessSnap] = await Promise.all([
        withFirestoreRetry(() => getDocs(collection(firestore, 'users')), {
          label: 'Email marketing audience',
        }),
        withFirestoreRetry(() => getDocs(collection(firestore, 'businessInstances')), {
          label: 'Email marketing businesses',
        }),
      ]);
      setUsers(userSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
      setBusinesses(businessSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    } catch (error: any) {
      console.error('Failed to load audience', error);
      setAudienceError(error?.message || 'Could not load the audience.');
    } finally {
      setAudienceLoading(false);
    }
  }, [firestore]);

  const loadLogs = React.useCallback(async () => {
    if (!firestore) return;
    setLogsLoading(true);
    try {
      // Single-field order, so Firestore's automatic index covers it — no
      // composite index to deploy.
      const snap = await withFirestoreRetry(
        () =>
          getDocs(
            query(
              collection(firestore, 'follow_up_logs'),
              orderBy('sentAt', 'desc'),
              fsLimit(LOG_LIMIT),
            ),
          ),
        { label: 'Campaign results' },
      );
      setLogs(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    } catch (error) {
      console.error('Failed to load campaign logs', error);
    } finally {
      setLogsLoading(false);
    }
  }, [firestore]);

  React.useEffect(() => {
    loadAudience();
  }, [loadAudience]);

  // Deferred until the tab is actually opened — see the Reads note above.
  React.useEffect(() => {
    if (tab !== 'results' || logsRequestedRef.current) return;
    logsRequestedRef.current = true;
    loadLogs();
  }, [tab, loadLogs]);

  const profiles = React.useMemo(
    () => profileAudience(users, businesses),
    [users, businesses],
  );
  const segmentCounts = React.useMemo(() => behaviorSegmentCounts(profiles), [profiles]);

  const profileById = React.useMemo(() => {
    const map = new Map<string, BehaviorProfile>();
    for (const p of profiles) map.set(p.userId, p);
    return map;
  }, [profiles]);

  const recipients = React.useMemo(
    () => [...selectedIds].map(id => profileById.get(id)).filter((p): p is BehaviorProfile => !!p),
    [selectedIds, profileById],
  );

  /**
   * Which template to open the composer on.
   *
   * The explicit segment filter wins; failing that, the most common segment among
   * the people actually selected. Guessing beats defaulting, because a mixed
   * selection still gets the template that fits most of it.
   */
  const suggestedSegment = React.useMemo<BehaviorSegment | null>(() => {
    if (segmentFilter) return segmentFilter;
    if (!recipients.length) return null;
    const tally = new Map<BehaviorSegment, number>();
    for (const r of recipients) tally.set(r.segment, (tally.get(r.segment) ?? 0) + 1);
    return [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }, [segmentFilter, recipients]);

  const mailableCount = React.useMemo(
    () => profiles.filter(p => p.contactable).length,
    [profiles],
  );
  const optedOutCount = React.useMemo(() => profiles.filter(p => p.optedOut).length, [profiles]);

  const pickTemplate = React.useCallback((segment: BehaviorSegment) => {
    setTemplateSegment(segment);
    setDraft(draftForSegment(segment));
  }, []);

  /**
   * Seed the draft from the selection the first time the composer is opened.
   *
   * Guarded by the latch rather than re-running on every selection change: once
   * the operator has started editing, silently replacing their copy because they
   * ticked one more person would be worse than opening on a slightly wrong
   * template.
   */
  React.useEffect(() => {
    if (tab !== 'compose' || draftSeededRef.current) return;
    draftSeededRef.current = true;
    pickTemplate(suggestedSegment ?? 'feature_focused');
  }, [tab, suggestedSegment, pickTemplate]);

  const [audienceNotice, setAudienceNotice] = React.useState<string | null>(null);

  /**
   * Arriving from a Product Intelligence finding with its cohort attached.
   *
   * The ids come from `sessionStorage`, not the URL — see `insight-cohort.ts` for
   * why. Runs once the audience is loaded so a preselected id that no longer
   * resolves to a mailable user is dropped rather than silently counted, and only
   * once: the read consumes the cohort, so a refresh does not re-apply it.
   */
  const cohortAppliedRef = React.useRef(false);
  React.useEffect(() => {
    if (cohortAppliedRef.current || audienceLoading) return;
    const cohortId = searchParams?.get('cohort');
    if (!cohortId) return;
    cohortAppliedRef.current = true;

    const cohort = takeInsightCohort(cohortId);
    if (!cohort) {
      setAudienceNotice(
        'That insight cohort has expired — it is held for one visit only. Open the finding again from Usage Analytics.',
      );
      return;
    }

    const known = new Set(profiles.map(p => p.userId));
    const resolved = cohort.userIds.filter(id => known.has(id));
    setSelectedIds(new Set(resolved));
    setTab('compose');

    const dropped = cohort.userIds.length - resolved.length;
    setAudienceNotice(
      `${resolved.length} selected from “${cohort.label ?? cohortId}”`
      + (dropped > 0 ? ` · ${dropped} no longer match an active account` : ''),
    );
  }, [searchParams, audienceLoading, profiles]);

  const toggleOne = React.useCallback((userId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }, []);

  const selectMany = React.useCallback((userIds: string[]) => {
    setSelectedIds(new Set(userIds));
  }, []);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <Mail className="h-6 w-6 shrink-0 text-primary" />
            <h1 className="text-2xl font-bold">Email Marketing</h1>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Every user, grouped by how they actually use Zeneva — hours in the app and
            the pages they spend them on. Pick a group, send them a branded email that
            quotes their own numbers back to them, and see who opened it.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadAudience}
          disabled={audienceLoading}
          className="gap-1.5"
        >
          <RefreshCw className={audienceLoading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
          Refresh
        </Button>
      </div>

      {audienceError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {audienceError}
        </div>
      )}

      {audienceNotice && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          <Send className="h-4 w-4 shrink-0 text-primary" />
          <span className="flex-1">{audienceNotice}</span>
          <Button variant="ghost" size="sm" onClick={() => setAudienceNotice(null)}>
            Dismiss
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <HeaderStat
          label="Users"
          value={audienceLoading ? '—' : profiles.length}
          icon={Users}
        />
        <HeaderStat
          label="Mailable"
          value={audienceLoading ? '—' : mailableCount}
          icon={Mail}
        />
        <HeaderStat
          label="Unsubscribed"
          value={audienceLoading ? '—' : optedOutCount}
          icon={BanIcon}
        />
        <HeaderStat label="Selected" value={selectedIds.size} icon={Send} />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full min-w-0">
        {/* Scrolls rather than overflows: three triggers plus the selection badge
            is already wider than a small phone. */}
        <TabsList className="max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="audience" className="shrink-0 gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Audience
          </TabsTrigger>
          <TabsTrigger value="compose" className="shrink-0 gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Templates &amp; Compose
            {selectedIds.size > 0 && (
              <span className="ml-1 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                {selectedIds.size}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="results" className="shrink-0 gap-1.5">
            <Mail className="h-3.5 w-3.5" />
            Results
          </TabsTrigger>
        </TabsList>

        <TabsContent value="audience" className="mt-4">
          <AudienceTable
            profiles={profiles}
            isLoading={audienceLoading}
            selectedIds={selectedIds}
            onToggle={toggleOne}
            onSelectMany={selectMany}
            segmentFilter={segmentFilter}
            onSegmentFilterChange={setSegmentFilter}
            segmentCounts={segmentCounts}
          />
          {selectedIds.size > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3">
              <p className="text-sm">
                <strong>{selectedIds.size}</strong> selected
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                  Clear
                </Button>
                <Button size="sm" className="gap-1.5" onClick={() => setTab('compose')}>
                  <Send className="h-3.5 w-3.5" />
                  Write to them
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="compose" className="mt-4">
          <CampaignComposer
            recipients={recipients}
            draft={draft}
            onDraftChange={setDraft}
            templateSegment={templateSegment}
            onPickTemplate={pickTemplate}
            onSent={() => {
              setSelectedIds(new Set());
              // Next campaign starts from a fresh suggestion rather than the copy
              // that was just sent.
              draftSeededRef.current = false;
              // The results tab may never have been opened; mark it fetched so the
              // deferred load does not immediately overwrite this fresh pull.
              logsRequestedRef.current = true;
              loadLogs();
              setTab('results');
            }}
          />
        </TabsContent>

        <TabsContent value="results" className="mt-4">
          <CampaignResults
            logs={logs}
            isLoading={logsLoading}
            onRefresh={loadLogs}
            onFollowUp={emails => {
              // Matched on address rather than id: `follow_up_logs` records who was
              // mailed, not which user document it came from, and one address can
              // belong to more than one account.
              const wanted = new Set(emails.map(e => e.trim().toLowerCase()));
              const matched = profiles.filter(
                p => p.contactable && p.email && wanted.has(p.email.toLowerCase()),
              );
              setSelectedIds(new Set(matched.map(p => p.userId)));
              // A follow-up is a new message, not a repeat of the one they ignored,
              // so let the composer reseed from this cohort's own segment.
              draftSeededRef.current = false;
              setTab('compose');
              const missing = wanted.size - matched.length;
              setAudienceNotice(
                `${matched.length} selected for a follow-up`
                + (missing > 0
                  ? ` · ${missing} skipped (unsubscribed since, or no active account)`
                  : ''),
              );
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
