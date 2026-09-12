'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Mail, RefreshCw, Eye, AlertCircle, CheckCircle2, Send, Search, Filter, Clock, TrendingUp, Bot } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { getAuth } from 'firebase/auth';
import { safeToDate, cn } from '@/lib/utils';
import { apiBase } from '@/lib/platform';
import {
  SEGMENT_META,
  segmentCounts,
  type OutreachSegment,
  type ScoredBusiness,
} from '@/lib/outreach-scoring';
/**
 * Shared with the campaign templates rather than kept as a private copy here.
 *
 * The email body is HTML, and the name spliced into it comes from the `users`
 * collection — a field any self-registered account sets for itself. Unescaped, a
 * name like `<img src=x onerror=...>` is emailed as live markup and stored in
 * `follow_up_logs`, where the audit dialog renders it back on the admin origin.
 * Two copies of an escaper is how one of them ends up missing a case.
 */
import { escapeHtml } from '@/lib/email-templates';

/** Badge colours per segment tone. Keyed off SEGMENT_META so the two cannot drift. */
const TONE_CLASSES: Record<'danger' | 'warn' | 'info' | 'good', string> = {
  danger: 'bg-destructive/10 text-destructive border-destructive/20',
  warn: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  info: 'bg-sky-500/10 text-sky-600 border-sky-500/20',
  good: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
};

/**
 * Escape a string for literal use inside a RegExp.
 *
 * Business names are user-supplied, so interpolating one straight into `new RegExp`
 * throws on anything containing regex metacharacters — "C++ Store" and "Foo (Ltd)"
 * both blow up mid-send.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface FollowUpLog {
  id: string;
  sentTo: string;
  recipientName: string;
  subject: string;
  sentAt: any;
  openedAt?: any;
  status: 'sent' | 'opened' | 'failed';
  openCount: number;
  converted: boolean;
  html?: string;
  behaviorContext?: string;
}

interface FollowUpCenterProps {
  atRiskBusinesses: any[];
  /**
   * Every non-deleted business, ranked by outreach value. Optional so the tab
   * still renders if a caller has not been updated to pass it.
   */
  scoredLeads?: ScoredBusiness[];
  users: any[];
  conversionRate?: number;
  churnRiskCount?: number;
  cachedLogs?: FollowUpLog[];
  cachedSentCount?: number;
  isLoading?: boolean;
  onRefresh?: () => void;
  onMount?: () => void;
}

export default function FollowUpCenter({
    atRiskBusinesses,
    scoredLeads = [],
    users,
    conversionRate = 0, 
    churnRiskCount = 0,
    cachedLogs = [],
    cachedSentCount = 0,
    isLoading: parentLoading = false,
    onRefresh,
    onMount
}: FollowUpCenterProps) {
  const [logs, setLogs] = React.useState<FollowUpLog[]>(cachedLogs);
  const [sentCount, setSentCount] = React.useState(cachedSentCount);
  const [isLoading, setIsLoading] = React.useState(false);
  const [filterStatus, setFilterStatus] = React.useState<'all' | 'opened' | 'sent' | 'failed' | 'newly_opened'>('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  /** null = "everything worth acting on" rather than a specific segment. */
  const [segmentFilter, setSegmentFilter] = React.useState<OutreachSegment | null>(null);
  /** Separate from `searchQuery`, which filters the sent-log table below. */
  const [leadSearch, setLeadSearch] = React.useState('');

  const counts = React.useMemo(() => segmentCounts(scoredLeads), [scoredLeads]);

  /**
   * The queue itself.
   *
   * Default view hides `healthy_paid` and `active_free`: they are the two
   * segments whose correct action is "leave them alone", and including them
   * buried the handful of accounts that actually need an email. They stay
   * reachable by picking the segment explicitly.
   */
  const queue = React.useMemo(() => {
    const base = segmentFilter
      ? scoredLeads.filter(lead => lead.segment === segmentFilter)
      : scoredLeads.filter(
          lead => lead.segment !== 'healthy_paid' && lead.segment !== 'active_free',
        );

    const needle = leadSearch.trim().toLowerCase();
    if (!needle) return base;
    return base.filter(lead =>
      lead.businessName.toLowerCase().includes(needle)
      || (lead.email || '').toLowerCase().includes(needle)
      || (lead.contactName || '').toLowerCase().includes(needle),
    );
  }, [scoredLeads, segmentFilter, leadSearch]);
  
  // Sync with parent cache.
  //
  // This deliberately mirrors an empty parent list too. Guarding on
  // `cachedLogs.length > 0` meant a parent refresh that legitimately returned
  // nothing left the previous campaign's rows on screen for ever.
  const isParentControlled = typeof onRefresh === 'function';
  React.useEffect(() => {
    if (!isParentControlled) return;
    setLogs(cachedLogs);
    setSentCount(cachedSentCount);
  }, [cachedLogs, cachedSentCount, isParentControlled]);

  // Ask the parent for data once on mount. Reads a ref rather than
  // `cachedLogs.length` so the empty-deps array is not a stale closure.
  const hasRequestedMount = React.useRef(false);
  React.useEffect(() => {
    if (hasRequestedMount.current) return;
    hasRequestedMount.current = true;
    if (onMount && cachedLogs.length === 0) onMount();
  }, [onMount, cachedLogs.length]);

  /**
   * Owner lookup, indexed once per users change.
   *
   * The previous `users.find(u => u.businessId === bus.id)` returned whichever user
   * happened to sit first in the array — often a cashier rather than the account
   * owner, so retention mail addressed the wrong person. Prefer the admin, then the
   * most recently seen account.
   */
  const ownersByBusiness = React.useMemo(() => {
    const byBusiness = new Map<string, any>();
    for (const user of users || []) {
      if (!user?.businessId) continue;
      const current = byBusiness.get(user.businessId);
      if (!current) {
        byBusiness.set(user.businessId, user);
        continue;
      }
      const currentIsAdmin = current.role === 'admin';
      const candidateIsAdmin = user.role === 'admin';
      if (candidateIsAdmin && !currentIsAdmin) {
        byBusiness.set(user.businessId, user);
      } else if (candidateIsAdmin === currentIsAdmin) {
        const currentSeen = safeToDate(current.lastSeen)?.getTime() ?? -Infinity;
        const candidateSeen = safeToDate(user.lastSeen)?.getTime() ?? -Infinity;
        if (candidateSeen > currentSeen) byBusiness.set(user.businessId, user);
      }
    }
    return byBusiness;
  }, [users]);

  const ownerFor = React.useCallback(
    (businessId: string) => ownersByBusiness.get(businessId) || null,
    [ownersByBusiness]
  );

  const campaignStats = React.useMemo(() => {
    const validLogs = logs.filter(l => l.status !== 'failed');
    const totalSent = validLogs.length;
    const openedLogs = validLogs.filter(l => l.status === 'opened' || (l.openCount && l.openCount > 0));
    const totalOpened = openedLogs.length;
    
    // 1. Open Rate
    const openRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0;
    
    // 2. Outreach Conversion Rate (converted field is boolean)
    const convertedLogs = validLogs.filter(l => l.converted);
    const outreachConversionRate = totalSent > 0 ? (convertedLogs.length / totalSent) * 100 : 0;

    // 3. Best Performing Template (by open rate)
    const templateStats: Record<string, { sent: number; opened: number }> = {};
    validLogs.forEach(l => {
      const subject = l.subject || 'Standard Follow-Up';
      if (!templateStats[subject]) {
        templateStats[subject] = { sent: 0, opened: 0 };
      }
      templateStats[subject].sent++;
      if (l.status === 'opened' || (l.openCount && l.openCount > 0)) {
        templateStats[subject].opened++;
      }
    });

    let bestCampaign = 'None';
    let bestRate = 0;
    Object.entries(templateStats).forEach(([subject, stats]) => {
      const rate = stats.sent > 0 ? (stats.opened / stats.sent) * 100 : 0;
      if (rate > bestRate && stats.sent >= 2) {
        bestRate = rate;
        bestCampaign = subject;
      }
    });
    // Fallback if not enough campaign data
    if (bestCampaign === 'None' && Object.keys(templateStats).length > 0) {
      const sorted = Object.entries(templateStats).sort((a,b) => b[1].opened - a[1].opened);
      bestCampaign = sorted[0][0];
      bestRate = (sorted[0][1].opened / sorted[0][1].sent) * 100;
    }

    // Shorten subject for display
    const cleanBestCampaign = bestCampaign.length > 25 ? bestCampaign.substring(0, 25) + '...' : bestCampaign;

    // 4. Outreach Coverage of At-Risk Businesses
    const atRiskEmails = new Set(atRiskBusinesses.map(bus => {
      const owner = ownerFor(bus.id);
      return owner?.email;
    }).filter(Boolean));

    // Count DISTINCT businesses reached, not log rows. Counting rows against a
    // distinct-email denominator pushed coverage past 100% as soon as anyone was
    // emailed twice.
    const contactedAtRisk = new Set(
      logs.map(l => l.sentTo).filter(email => atRiskEmails.has(email))
    );
    const coverage = atRiskEmails.size > 0 ? (contactedAtRisk.size / atRiskEmails.size) * 100 : 0;

    return {
      openRate,
      outreachConversionRate,
      bestCampaign: cleanBestCampaign,
      bestRate,
      coverage
    };
  }, [logs, atRiskBusinesses, ownerFor]);

  const [isSending, setIsSending] = React.useState(false);
  const [bulkProgress, setBulkProgress] = React.useState<{ done: number; total: number } | null>(null);
  const abortBulkRef = React.useRef(false);
  const { toast } = useToast();
  const [selectedRecipient, setSelectedRecipient] = React.useState<any>(null);
  const [subject, setSubject] = React.useState('Getting the most out of Zeneva');
  const [emailBody, setEmailBody] = React.useState('');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [viewLog, setViewLog] = React.useState<FollowUpLog | null>(null);

  const fetchLogs = async () => {
    if (onRefresh) {
        onRefresh();
        return;
    }
    // Fallback if not controlled
    // Intel Mission: Query Firestore directly to bypass 404 in static desktop environment
    setIsLoading(true);
    try {
      const { firestore } = await import('@/firebase');
      const { collection, query, orderBy, getDocs } = await import('firebase/firestore');
      
      const logsQuery = query(
        collection(firestore, 'follow_up_logs'),
        orderBy('sentAt', 'desc')
      );
      const snapshot = await getDocs(logsQuery);
      const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FollowUpLog[];
      
      setLogs(logsData);
      setSentCount(logsData.filter(log => log.status !== 'failed').length);
    } catch (error) {
      console.error('Failed to fetch logs from Firestore:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Controlled internally or by parent via useEffect hooks above

  const handleSendEmail = async () => {
    if (!selectedRecipient || !subject || !emailBody) {
      toast({ variant: 'destructive', title: 'Missing Info', description: 'Please fill all fields.' });
      return;
    }

    setIsSending(true);
    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();

      if (selectedRecipient.isBulk) {
        const targets = selectedRecipient.recipients as any[];
        let successCount = 0;
        let failCount = 0;

        // Sequential on purpose — this is transactional email to real customers, and
        // firing N requests at once risks tripping provider rate limits. What was
        // missing is feedback and a way out: a 200-recipient run previously froze the
        // dialog with no progress and no cancel.
        abortBulkRef.current = false;
        setBulkProgress({ done: 0, total: targets.length });

        for (const target of targets) {
          if (abortBulkRef.current) break;
          try {
            let customizedBody = emailBody;
            const safeTargetName = escapeHtml(target.name);
            if (selectedRecipient.name && emailBody.includes(selectedRecipient.name)) {
              customizedBody = emailBody.replace(
                new RegExp(escapeRegExp(selectedRecipient.name), 'g'),
                () => safeTargetName
              );
            } else {
              customizedBody = emailBody.replace(/Hi\s+[^,]+/i, () => `Hi ${safeTargetName}`);
            }
            const response = await fetch(`${apiBase()}/api/admin/send-follow-up`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                to: target.email,
                name: target.name,
                subject,
                html: customizedBody,
                businessId: target.businessId,
                type: 'retention'
              })
            });
            const result = await response.json();
            if (result.success) {
              successCount++;
            } else {
              failCount++;
            }
          } catch (e) {
            failCount++;
          }
          setBulkProgress(prev => ({ done: prev.done + 1, total: prev.total }));
        }

        const stopped = abortBulkRef.current;
        setBulkProgress(null);
        toast({
          variant: failCount === 0 && !stopped ? 'success' : 'destructive',
          title: stopped ? 'Bulk Email Stopped' : 'Bulk Email Complete',
          description: `Dispatched to ${successCount} recipients. Failed: ${failCount}.`
            + (stopped ? ` ${targets.length - successCount - failCount} not attempted.` : ''),
        });
        setIsModalOpen(false);
        await fetchLogs();
      } else {
        const response = await fetch(`${apiBase()}/api/admin/send-follow-up`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            to: selectedRecipient.email,
            name: selectedRecipient.name,
            subject,
            html: emailBody,
            businessId: selectedRecipient.businessId,
            type: 'retention'
          })
        });

        const result = await response.json();

        if (result.success) {
          toast({ variant: 'success', title: 'Success', description: 'Follow-up email dispatched.' });
          setIsModalOpen(false);
          await fetchLogs();
        } else {
          throw new Error(result.message);
        }
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsSending(false);
      // Clear here too: an exception mid-run would otherwise strand the progress bar.
      setBulkProgress(null);
      abortBulkRef.current = false;
    }
  };

  const templates = [
    {
      name: 'Download App',
      subject: 'Download the official Zeneva Desktop & Mobile App',
      body: (name: string) => `Hi ${name || 'there'},<br><br>To get the best experience out of Zeneva, we highly recommend downloading our official app for PC, Mac, and mobile devices.<br><br>The native Zeneva app runs much faster, operates fully offline, and connects seamlessly to barcode scanners and receipt printers.<br><br>You can download the app for all your devices here: <a href="https://zeneva.space/download" target="_blank" style="color: #ea580c; font-weight: bold; text-decoration: underline;">https://zeneva.space/download</a><br><br>If you need help setting up the application on your computer or phone, please reply to this email and we'll walk you through it.<br><br>Best,<br>Zeneva Team`
    },
    {
      name: 'Usage Follow-up',
      subject: 'Are you still using Zeneva?',
      body: (name: string) => `Hi ${name || 'there'},<br><br>I noticed you haven't logged into Zeneva in a while. I'm reaching out to see if you are still using our software for your business, or if you ran into any issues that stopped you from moving forward.<br><br>We're constantly improving Zeneva based on feedback. If it wasn't a good fit, or if there's a feature you felt was missing, I'd love to hear your thoughts so we can make it better.<br><br>If you need help getting back on track, just reply to this email and I'll personally assist you.<br><br>Best,<br>Zeneva Team`
    },
    {
      name: 'Onboarding Help',
      subject: 'Need help adding your inventory to Zeneva?',
      body: (name: string) => `Hi ${name || 'there'},<br><br>I see you created an account with Zeneva but haven't added your products yet. I know setting up a new system can take some time, so I wanted to offer my help.<br><br>Do you need any assistance uploading your product list or setting up your initial inventory? I can walk you through the process or even help you import your existing data.<br><br>Just reply to this email and let me know how I can be of assistance.<br><br>Best,<br>Zeneva Team`
    },
    {
      name: 'Feedback Request',
      subject: 'How is Zeneva working out for your business?',
      body: (name: string) => `Hi ${name || 'there'},<br><br>You've been using Zeneva for a while now, and I wanted to check in and see how everything is going.<br><br>Is the system doing everything you need it to do? We are currently planning our next set of features, and feedback from active business owners like you is incredibly valuable to us.<br><br>If there's anything you'd like to see improved, or a new feature that would make your life easier, please reply and let me know. I read every single response.<br><br>Best,<br>Zeneva Team`
    }
  ];

  const applyTemplate = (template: any) => {
    if (!selectedRecipient) return;
    setSubject(template.subject);
    // Templates build raw HTML around the recipient's name, and that name comes
    // from a self-registered `users` document. Escaping here covers both send
    // paths, since the single-recipient branch posts `emailBody` verbatim.
    setEmailBody(template.body(escapeHtml(selectedRecipient.name || '')));
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="p-4 flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Churn Risk</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{churnRiskCount}</div>
            <p className="text-xs text-muted-foreground">High risk accounts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Conv. Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{conversionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Trial to Paid</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{atRiskBusinesses.length}</div>
            <p className="text-xs text-muted-foreground">Inactive &gt; 14 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Support</CardTitle>
            <Mail className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{sentCount}</div>
            <p className="text-xs text-muted-foreground">Follow-ups sent</p>
          </CardContent>
        </Card>
      </div>

      {/* Campaign outreach analytics row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 border-t border-slate-100 pt-4">
        <Card className="bg-slate-50/50">
          <CardHeader className="p-4 flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-500">Outreach Open Rate</CardTitle>
            <Eye className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-slate-900">{campaignStats.openRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Opened emails out of dispatches</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-50/50">
          <CardHeader className="p-4 flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-500">Response Conversion</CardTitle>
            <TrendingUp className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-slate-900">{campaignStats.outreachConversionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Dispatches converting users</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-50/50">
          <CardHeader className="p-4 flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-500">At-Risk Contacted</CardTitle>
            <Bot className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-slate-900">{campaignStats.coverage.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Emailed at-risk merchants</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-50/50">
          <CardHeader className="p-4 flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-500">Best Campaign</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-[13px] font-bold text-slate-900 truncate" title={campaignStats.bestCampaign}>
              {campaignStats.bestCampaign}
            </div>
            <p className="text-xs text-muted-foreground font-semibold text-emerald-600 mt-1">
              ({campaignStats.bestRate.toFixed(0)}% open rate)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Priority outreach queue — ranked by src/lib/outreach-scoring.ts */}
      {scoredLeads.length > 0 && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Priority Outreach Queue
                </CardTitle>
                <CardDescription>
                  Every account ranked by what it is worth reaching out to right now.
                </CardDescription>
              </div>
              <Input
                placeholder="Search name or email..."
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
                className="h-9 w-full sm:max-w-[240px]"
              />
            </div>

            {/* Segment rail. Counts come from the engine, so they always sum to the full book. */}
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSegmentFilter(null)}
                className={cn(
                  'rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors',
                  segmentFilter === null
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:bg-muted',
                )}
              >
                Needs action
              </button>
              {(Object.keys(SEGMENT_META) as OutreachSegment[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSegmentFilter(key)}
                  title={SEGMENT_META[key].blurb}
                  className={cn(
                    'rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors',
                    segmentFilter === key
                      ? 'border-primary bg-primary text-primary-foreground'
                      : cn(TONE_CLASSES[SEGMENT_META[key].tone], 'hover:opacity-80'),
                  )}
                >
                  {SEGMENT_META[key].label} ({counts[key]})
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[420px] pr-3">
              <div className="space-y-2">
                {queue.length === 0 && (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    Nothing in this segment.
                  </p>
                )}
                {queue.map((lead) => (
                  <div
                    key={lead.businessId}
                    className="flex flex-col gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold">{lead.businessName}</span>
                        <Badge
                          variant="outline"
                          className={cn('text-[10px]', TONE_CLASSES[SEGMENT_META[lead.segment].tone])}
                        >
                          {SEGMENT_META[lead.segment].label}
                        </Badge>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          score {lead.score}
                        </span>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {lead.contactName || 'Unknown contact'}
                        {lead.email ? ` • ${lead.email}` : ' • no email on file'}
                      </div>
                      {lead.reasons.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {lead.reasons.map((reason) => (
                            <span
                              key={reason}
                              className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                            >
                              {reason}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!lead.contactable}
                      title={lead.contactable ? undefined : 'No email address on this account'}
                      className="h-8 shrink-0 text-xs"
                      onClick={() => {
                        setSelectedRecipient({
                          id: lead.businessId,
                          name: lead.contactName || lead.businessName,
                          email: lead.email,
                          businessId: lead.businessId,
                        });
                        setIsModalOpen(true);
                      }}
                    >
                      <Mail className="mr-2 h-3 w-3" /> Reach out
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: At Risk Businesses */}
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                At-Risk Businesses
              </CardTitle>
              <CardDescription>No activity in the last 14 days.</CardDescription>
            </div>
            {atRiskBusinesses.length > 0 && (
              <Button 
                size="sm" 
                variant="outline" 
                className="text-[10px] font-bold h-8 border-destructive/20 text-destructive hover:bg-destructive/10 shrink-0"
                onClick={() => {
                  const allRecipients = atRiskBusinesses
                    .map(bus => ownerFor(bus.id))
                    .filter(u => !!u);
                  
                  setSelectedRecipient({
                    name: 'All At-Risk Owners',
                    email: `${allRecipients.length} recipients`,
                    isBulk: true,
                    recipients: allRecipients
                  });
                  setIsModalOpen(true);
                }}
              >
                <Mail className="h-3 w-3 mr-1" /> Bulk Email All
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {atRiskBusinesses.map((bus) => {
                  const owner = ownerFor(bus.id);
                  if (!owner) return null;
                  return (
                    <div key={bus.id} className="p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-semibold text-sm">{bus.name}</span>
                        <Badge variant="outline" className="text-[10px]">At Risk</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mb-2">{owner.name} • {owner.email}</div>
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="w-full text-xs h-8"
                        onClick={() => {
                          setSelectedRecipient(owner);
                          setIsModalOpen(true);
                        }}
                      >
                        <Mail className="h-3 w-3 mr-2" /> Send Follow-Up
                      </Button>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right Col: Sent Logs & Stats */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Send className="h-5 w-5 text-primary" />
                Recent Outreach
              </CardTitle>
              <CardDescription>Tracking engagement for follow-up emails.</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={fetchLogs} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </CardHeader>
          <CardContent>
            {/* Search and Filters Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
              <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-lg">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'newly_opened', label: 'Newly Opened' },
                  { id: 'opened', label: 'Opened' },
                  { id: 'sent', label: 'Not Opened' },
                  { id: 'failed', label: 'Failed' }
                ].map((btn) => (
                  <Button
                    key={btn.id}
                    variant="ghost"
                    size="sm"
                    className={`text-[11px] h-7 px-3 font-semibold rounded-md transition-all ${
                      filterStatus === btn.id 
                        ? 'bg-white text-slate-900 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                    onClick={() => setFilterStatus(btn.id as any)}
                  >
                    {btn.label}
                  </Button>
                ))}
              </div>
              
              <div className="relative max-w-xs w-full">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search recipient or subject..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 text-xs h-8.5 rounded-lg border-slate-200"
                />
              </div>
            </div>

            <ScrollArea className="h-[400px] pr-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Mission Context</TableHead>
                    <TableHead>Telemetry</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Engagement</TableHead>
                    <TableHead className="text-right">Audit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {(() => {
                  // 1. Group logs to merge duplicates and track aggregates/latest status
                  // Group by recipient AND subject to explicitly show different email campaigns separate
                  const groupedLogs: Record<string, any> = {};
                  logs.forEach(log => {
                    const key = `${log.sentTo}-${log.subject}`;
                    if (!groupedLogs[key]) {
                      groupedLogs[key] = { ...log, count: log.status === 'failed' ? 0 : 1, history: [log] };
                    } else {
                      groupedLogs[key].history.push(log);
                      if (log.status !== 'failed') groupedLogs[key].count++;
                      groupedLogs[key].openCount = Math.max(groupedLogs[key].openCount, log.openCount);
                      if (log.status === 'opened') groupedLogs[key].status = 'opened';
                      else if (log.status === 'failed' && groupedLogs[key].status !== 'opened') groupedLogs[key].status = 'failed';
                      
                      // Retain latest openedAt
                      if (log.openedAt?.seconds) {
                        if (!groupedLogs[key].openedAt?.seconds || log.openedAt.seconds > groupedLogs[key].openedAt.seconds) {
                          groupedLogs[key].openedAt = log.openedAt;
                        }
                      }
                      // Retain latest sentAt
                      if (log.sentAt?.seconds) {
                        if (!groupedLogs[key].sentAt?.seconds || log.sentAt.seconds > groupedLogs[key].sentAt.seconds) {
                          groupedLogs[key].sentAt = log.sentAt;
                        }
                      }
                    }
                  });

                  let processedList = Object.values(groupedLogs);

                  // 2. Search Query Filtering
                  if (searchQuery.trim()) {
                    const queryStr = searchQuery.toLowerCase();
                    processedList = processedList.filter(log => 
                      log.recipientName?.toLowerCase().includes(queryStr) ||
                      log.sentTo?.toLowerCase().includes(queryStr) ||
                      log.subject?.toLowerCase().includes(queryStr)
                    );
                  }

                  // 3. Status Filtering
                  if (filterStatus === 'opened') {
                    processedList = processedList.filter(log => log.status === 'opened' || log.openCount > 0);
                  } else if (filterStatus === 'sent') {
                    processedList = processedList.filter(log => log.status === 'sent' && !(log.openCount > 0));
                  } else if (filterStatus === 'failed') {
                    processedList = processedList.filter(log => log.status === 'failed');
                  } else if (filterStatus === 'newly_opened') {
                    processedList = processedList.filter(log => log.openedAt?.seconds);
                  }

                  // 4. Sorting
                  if (filterStatus === 'newly_opened') {
                    // Sort by openedAt descending
                    processedList.sort((a, b) => {
                      const timeA = a.openedAt?.seconds || 0;
                      const timeB = b.openedAt?.seconds || 0;
                      return timeB - timeA;
                    });
                  } else {
                    // Default sort by sentAt descending
                    processedList.sort((a, b) => {
                      const timeA = a.sentAt?.seconds || 0;
                      const timeB = b.sentAt?.seconds || 0;
                      return timeB - timeA;
                    });
                  }

                  if (processedList.length === 0) {
                    return (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No matching outreach logs found.
                        </TableCell>
                      </TableRow>
                    );
                  }

                  return processedList.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="font-bold text-xs flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                          {log.recipientName}
                        </div>
                        <div className="text-[10px] text-muted-foreground ml-3">{log.sentTo}</div>
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        <div className="text-xs font-medium truncate">{log.subject}</div>
                        {log.behaviorContext && (
                          <div className="flex items-center gap-1 mt-1">
                              <Bot className="h-3 w-3 text-orange-400" />
                              <span className="text-[9px] text-orange-400/80 font-black uppercase tracking-tighter">Intel: {log.behaviorContext}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-[10px] font-mono whitespace-nowrap">
                        <div>Sent: {log.sentAt?.seconds ? format(new Date(log.sentAt.seconds * 1000), 'MMM d, h:mm a') : 'N/A'}</div>
                        {log.openedAt?.seconds && (
                          <div className="text-emerald-600 font-bold mt-0.5">
                            Opened: {format(new Date(log.openedAt.seconds * 1000), 'MMM d, h:mm a')}
                          </div>
                        )}
                        <div className="text-[9px] text-muted-foreground mt-0.5">via ZENEVA Outreach</div>
                      </TableCell>
                      <TableCell>
                        {log.status === 'opened' || (log.openCount > 0 && log.status === 'sent') ? (
                          <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20 text-[10px] font-black uppercase">
                             <CheckCircle2 className="h-3 w-3 mr-1" /> Opened
                             {log.count > 1 && <span className="ml-1 opacity-70">[{log.count}]</span>}
                          </Badge>
                        ) : log.status === 'failed' ? (
                          <Badge variant="destructive" className="bg-rose-500/10 text-rose-500 border-rose-500/20 text-[10px] font-black uppercase">
                            <AlertCircle className="h-3 w-3 mr-1" /> FAILED
                            {log.count > 1 && <span className="ml-1">({log.count}x)</span>}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-orange-500/10 text-orange-400 border-orange-500/20 text-[10px] font-black uppercase">
                            <Clock className="h-3 w-3 mr-1" /> Dispatch
                            {log.count > 1 && <span className="ml-1">({log.count})</span>}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.converted ? (
                           <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30 text-[10px] font-black">
                              <TrendingUp className="h-3 w-3 mr-1" /> CONVERTED
                           </Badge>
                        ) : (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center justify-end gap-2 text-xs cursor-help select-none">
                                  <Eye className="h-3 w-3 text-muted-foreground" />
                                  <span className="font-bold">{log.openCount || 0}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="bg-slate-900 border-slate-800 text-white text-xs max-w-xs p-3 space-y-1.5 shadow-lg">
                                <p className="font-bold text-orange-400">Campaign Outreach Metrics</p>
                                <p>This specific email campaign was opened <span className="font-bold text-emerald-400">{log.openCount || 0} times</span>.</p>
                                <p className="text-[10px] text-slate-300">
                                  Total system dispatches: {log.count}<br />
                                  Last open: {log.openedAt?.seconds ? format(new Date(log.openedAt.seconds * 1000), 'MMM d, h:mm a') : 'Never'}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-orange-500/10" onClick={() => setViewLog(log)}>
                          <Search className="h-4 w-4 text-orange-400" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ));
                })()}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
        </Card>
      </div>

      {/* Compose Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Send Strategic Follow-Up</DialogTitle>
            <DialogDescription>
              Sending to: <span className="font-bold text-foreground">{selectedRecipient?.name}</span> ({selectedRecipient?.email})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex gap-2 mb-2">
              <span className="text-xs font-semibold text-muted-foreground self-center">Templates:</span>
              {templates.map(t => (
                <Button key={t.name} variant="outline" size="sm" className="text-[10px] h-6" onClick={() => applyTemplate(t)}>
                  {t.name}
                </Button>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Email Subject</Label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Message Body (HTML Supported)</Label>
              <Textarea 
                className="min-h-[200px] font-mono text-xs" 
                value={emailBody} 
                onChange={e => setEmailBody(e.target.value)} 
                placeholder="Hi {{name}}..."
              />
              <p className="text-[10px] text-muted-foreground">The Zeneva tracking pixel will be automatically appended to provide reach analytics.</p>
            </div>
          </div>

          <DialogFooter className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {bulkProgress ? (
              <div className="flex w-full items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-orange-600 transition-all duration-300"
                    style={{ width: `${bulkProgress.total > 0 ? (bulkProgress.done / bulkProgress.total) * 100 : 0}%` }}
                  />
                </div>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {bulkProgress.done}/{bulkProgress.total}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => { abortBulkRef.current = true; }}
                >
                  Stop
                </Button>
              </div>
            ) : (
              <div className="flex w-full justify-end gap-2">
                <Button variant="ghost" onClick={() => setIsModalOpen(false)} disabled={isSending}>Cancel</Button>
                <Button onClick={handleSendEmail} disabled={isSending} className="bg-orange-600 hover:bg-orange-700 text-white">
                  {isSending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Dispatch Strike
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* View Email Modal */}
      <Dialog open={!!viewLog} onOpenChange={(open) => !open && setViewLog(null)}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Outreach Audit: {viewLog?.subject}
            </DialogTitle>
            <DialogDescription>
              Sent to {viewLog?.recipientName} ({viewLog?.sentTo})
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto border rounded-md p-4 bg-white mt-4">
             {viewLog?.html ? (
               /*
                * Rendered in a fully-sandboxed iframe rather than via
                * dangerouslySetInnerHTML. Logs written before the escaping fix
                * above still hold raw recipient names, and this dialog runs on
                * the super-admin origin — the one session firestore.rules grants
                * platform-wide read/write. `sandbox=""` applies every
                * restriction, so no script, form or navigation in the stored
                * body can execute. An iframe also previews the email closer to
                * how the recipient sees it, styles included.
                */
               <iframe
                 sandbox=""
                 referrerPolicy="no-referrer"
                 srcDoc={viewLog.html}
                 title="Email body preview"
                 className="w-full h-[60vh] border-0 bg-white"
               />
             ) : (
               <div className="text-center py-10 text-muted-foreground italic">
                 Email body not stored in this log.
               </div>
             )}
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setViewLog(null)}>Close Audit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
