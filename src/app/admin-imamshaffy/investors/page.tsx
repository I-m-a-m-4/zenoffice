'use client';

/**
 * Zeneva's cap table.
 *
 * This is the platform owner's own equity — who owns what percentage of Zeneva
 * the company. It is not tenant data, and nothing here is scoped by businessId.
 *
 * One `useCollection` feeds the whole page. Every tab is a pure function of that
 * one snapshot, computed once in `buildCapTable` and passed down. That is
 * deliberate: the owner pays the Firestore bill, and a per-tab listener would
 * multiply the read cost of a page whose entire dataset is a few hundred small
 * documents. The audit trail is the one thing left out of it — it grows without
 * bound, so the History tab fetches its own page of events on demand.
 */

import * as React from 'react';
import { collection, query } from 'firebase/firestore';
import { Loader, PieChart } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { buildCapTable } from '@/lib/equity/engine';
import { CAP_TABLE_COLLECTION, seedFoundingCapTable } from '@/lib/equity/data';
import type { EquityRecord } from '@/lib/equity/types';
import { EquitySetup, type SetupValues } from '@/components/admin/equity/equity-setup';
import { OverviewTab } from '@/components/admin/equity/overview-tab';
import { ValuationTab } from '@/components/admin/equity/valuation-tab';
import { StakeholdersTab } from '@/components/admin/equity/stakeholders-tab';
import { TransactionsTab } from '@/components/admin/equity/transactions-tab';
import { RoundsTab } from '@/components/admin/equity/rounds-tab';
import { ConvertiblesTab } from '@/components/admin/equity/convertibles-tab';
import { OptionsTab } from '@/components/admin/equity/options-tab';
import { ModelingTab } from '@/components/admin/equity/modeling-tab';
import { HistoryTab } from '@/components/admin/equity/history-tab';
import { CapTableAssistant } from '@/components/admin/equity/cap-table-assistant';

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'valuation', label: 'Valuation' },
  { value: 'stakeholders', label: 'Stakeholders' },
  { value: 'transactions', label: 'Transactions' },
  { value: 'rounds', label: 'Rounds' },
  { value: 'convertibles', label: 'SAFEs & Notes' },
  { value: 'options', label: 'Options' },
  { value: 'modeling', label: 'Modeling' },
  { value: 'ask', label: 'Ask Zen' },
  { value: 'history', label: 'History' },
];

export default function InvestorsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [isSeeding, setIsSeeding] = React.useState(false);

  const capTableQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, CAP_TABLE_COLLECTION)) : null),
    [firestore],
  );
  const { data: records, isLoading } = useCollection<EquityRecord>(capTableQuery);

  // One computation for the whole page. `asOf` is pinned per render pass rather
  // than read inside the engine, so every tab agrees on what "now" means.
  const summary = React.useMemo(
    () => buildCapTable((records ?? []) as EquityRecord[], new Date()),
    [records],
  );

  const actorEmail = user?.email ?? 'unknown';

  const handleSetup = async (values: SetupValues) => {
    if (!firestore) return;
    setIsSeeding(true);
    try {
      await seedFoundingCapTable(
        firestore,
        {
          companyLegalName: values.companyLegalName,
          currency: values.currency,
          incorporationDate: new Date(values.incorporationDate),
          founderName: values.founderName,
          founderEmail: values.founderEmail,
          authorizedShares: values.authorizedShares,
          foundingShares: values.foundingShares,
          parValue: values.parValue,
        },
        actorEmail,
      );
      toast({
        variant: 'success',
        title: 'Cap table created',
        description: `${values.founderName} holds 100% of ${values.companyLegalName}.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Could not create the cap table',
        description: error?.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsSeeding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <Loader className="size-8 animate-spin text-primary" />
        <p className="ml-4 text-lg">Loading cap table...</p>
      </div>
    );
  }

  // Nothing recorded yet — offer setup rather than an empty grid.
  const isEmpty = !records || records.length === 0;
  if (isEmpty && !isSeeding) {
    return (
      <div className="space-y-6">
        <PageHeader summary={null} />
        <EquitySetup
          defaultFounderName={user?.displayName || 'Bello Imam'}
          defaultFounderEmail={user?.email || ''}
          onSubmit={handleSetup}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader summary={summary} />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex h-auto w-full snap-x justify-start overflow-x-auto overflow-y-hidden py-2 scrollbar-hide">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="shrink-0 snap-start">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab summary={summary} />
        </TabsContent>

        <TabsContent value="valuation">
          <ValuationTab
            records={(records ?? []) as EquityRecord[]}
            summary={summary}
            actorEmail={actorEmail}
          />
        </TabsContent>

        <TabsContent value="stakeholders">
          <StakeholdersTab
            records={(records ?? []) as EquityRecord[]}
            summary={summary}
            actorEmail={actorEmail}
          />
        </TabsContent>

        <TabsContent value="transactions">
          <TransactionsTab
            records={(records ?? []) as EquityRecord[]}
            summary={summary}
            actorEmail={actorEmail}
          />
        </TabsContent>

        <TabsContent value="rounds">
          <RoundsTab
            records={(records ?? []) as EquityRecord[]}
            summary={summary}
            actorEmail={actorEmail}
          />
        </TabsContent>

        <TabsContent value="convertibles">
          <ConvertiblesTab
            records={(records ?? []) as EquityRecord[]}
            summary={summary}
            actorEmail={actorEmail}
          />
        </TabsContent>

        <TabsContent value="options">
          <OptionsTab
            records={(records ?? []) as EquityRecord[]}
            summary={summary}
            actorEmail={actorEmail}
          />
        </TabsContent>

        <TabsContent value="modeling">
          <ModelingTab records={(records ?? []) as EquityRecord[]} summary={summary} />
        </TabsContent>

        <TabsContent value="ask">
          <div className="mx-auto max-w-3xl">
            <CapTableAssistant summary={summary} />
          </div>
        </TabsContent>

        <TabsContent value="history">
          <HistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PageHeader({ summary }: { summary: ReturnType<typeof buildCapTable> | null }) {
  return (
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <PieChart className="size-7 text-primary" />
          Cap Table
        </h1>
        <p className="text-muted-foreground">
          {summary
            ? `Equity ownership of ${summary.companyLegalName} — shareholders, rounds, options and exit modeling.`
            : 'Track who owns what share of the company.'}
        </p>
      </div>
      {summary && (
        <Badge variant="outline" className="h-7 shrink-0 gap-1.5 self-start md:self-auto">
          <span className="size-2 rounded-full bg-green-500" />
          {summary.currency} · as of {summary.asOf.toLocaleDateString()}
        </Badge>
      )}
    </div>
  );
}
