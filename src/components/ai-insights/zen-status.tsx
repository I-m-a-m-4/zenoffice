'use client';

import * as React from 'react';
import { ZenMark } from './zen-mark';

/** Shown while the model is deciding — no tool has been called yet. */
const IDLE_LINES = [
  'Scanning store records',
  'Pulling the day book',
  'Cross-checking ledger',
  'Formulating response',
];

/**
 * Exact copy per tool. Keys must match the tool names exported from
 * `src/app/api/chat/tools.ts`.
 */
const TOOL_LINES: Record<string, string> = {
  queryProducts: 'Scanning inventory',
  findSimilarProducts: 'Matching product names',
  showProductImage: 'Fetching product photo',
  getProductDetails: 'Pulling product record',
  getLowStockAlerts: 'Checking shelf levels',
  getInventoryValuation: 'Valuing stock on hand',
  getDeadStock: 'Hunting dead stock',
  getExpiringProducts: 'Checking expiry dates',
  getCategoryBreakdown: 'Grouping by category',
  getStockCoverage: 'Projecting days of cover',
  getReorderSuggestions: 'Building reorder list',
  getMarginAnalysis: 'Analyzing profit margins',
  getDataHealthCheck: 'Auditing inventory data',
  getSalesMetrics: 'Totalling the takings',
  getDailyReport: 'Closing off day book',
  getBusinessRating: 'Rating business metrics',
  linkToPage: 'Finding the right page',
  explainHowTo: 'Writing out the steps',
  getSalesTrend: 'Plotting sales curve',
  comparePeriods: 'Comparing against last period',
  getTopSellingProducts: 'Ranking best sellers',
  getWorstSellingProducts: 'Finding slow movers',
  getPeakHours: 'Mapping trading hours',
  forecastRevenue: 'Projecting revenue trend',
  getGrowthRate: 'Measuring business growth',
  forecastStockout: 'Projecting stockouts',
  getRecentTransactions: 'Reading recent receipts',
  getUnpaidInvoices: 'Checking outstanding credit',
  queryCustomer: 'Looking up customer',
  getTopCustomers: 'Ranking your regulars',
  getCustomerPurchaseHistory: 'Reading purchase history',
  getAtRiskCustomers: 'Spotting lapsed customers',
  getBranchPerformance: 'Comparing branches',
  getStaffPerformance: 'Totalling sales per staff',
  getAuditTrail: 'Reading audit trail',
  runLossPreventionScan: 'Sweeping for losses',
  getBusinessOverview: 'Taking a full store-take',
  proposeStockAdjustment: 'Drafting stock adjustment',
  proposeCostPrices: 'Matching cost prices',
  proposeCostEstimate: 'Calculating cost estimates',
  proposePriceChange: 'Drafting price update',
  proposeLoyaltyAdjustment: 'Drafting loyalty adjustment',
  proposeRestock: 'Drafting restock order',
  proposeLowStockThreshold: 'Drafting threshold change',
  proposeSale: 'Ringing up the sale',
  reportUnanswered: 'Logging unanswered query',
};

export function labelForTool(toolName: string): string {
  return TOOL_LINES[toolName] ?? toolName;
}

export const ZEN_TOOL_NAMES = Object.keys(TOOL_LINES);
export const ZEN_TOOL_COUNT = ZEN_TOOL_NAMES.length;
export const ZEN_WRITE_TOOL_NAMES = ZEN_TOOL_NAMES.filter((n) => n.startsWith('propose'));
export const ZEN_READ_TOOL_NAMES = ZEN_TOOL_NAMES.filter((n) => !n.startsWith('propose'));

/**
 * Returns a contextual sequence of progressive thinking states tailored to the user query.
 */
function getProgressiveSequence(prompt?: string): string[] {
  if (!prompt || typeof prompt !== 'string') return IDLE_LINES;
  const lower = prompt.toLowerCase();

  if (/sale|sold|record|receipt|buy|pay|order|cash|pos|sell/.test(lower)) {
    return [
      'Parsing transaction line items',
      'Matching product catalog & unit pricing',
      'Calculating subtotal, tax & balance',
      'Drafting sale proposal record',
    ];
  }
  if (/stock|inventory|count|shelf|reorder|depletion|low|quantity|item|out of stock/.test(lower)) {
    return [
      'Scanning live warehouse stock',
      'Auditing shelf quantities & thresholds',
      'Calculating days of inventory cover',
      'Compiling stock health summary',
    ];
  }
  if (/money|profit|loss|margin|p&l|revenue|cost|earning|takings|financ|takings/.test(lower)) {
    return [
      'Pulling daily sales transactions',
      'Calculating item cost basis & margins',
      'Reconciling net profit & cashflow',
      'Synthesizing financial breakdown',
    ];
  }
  if (/customer|debt|owe|credit|vip|buyer|regular|loyalty|client|unpaid/.test(lower)) {
    return [
      'Querying customer directory',
      'Aggregating purchase & payment history',
      'Auditing credit limits & unpaid balances',
      'Drafting customer intelligence report',
    ];
  }
  if (/forecast|trend|predict|future|growth|next month|ahead|projection/.test(lower)) {
    return [
      'Analyzing historical sales velocity',
      'Detecting demand patterns & seasonality',
      'Fitting predictive trajectory curve',
      'Generating revenue & restock projection',
    ];
  }

  return [
    'Scanning store records',
    'Cross-checking ledger history',
    'Analyzing business context',
    'Formulating actionable answer',
  ];
}

/**
 * @param activeTool      name of the tool currently running, if any
 * @param lastUserPrompt  latest prompt text submitted by the user
 * @param showMark        draw the glyph icon
 */
export function ZenStatus({
  activeTool,
  lastUserPrompt,
  showMark = true,
}: {
  activeTool?: string | null;
  lastUserPrompt?: string;
  showMark?: boolean;
}) {
  const [stepIndex, setStepIndex] = React.useState(0);
  const sequence = React.useMemo(() => getProgressiveSequence(lastUserPrompt), [lastUserPrompt]);

  // Advance progressive sequence every 1.8 seconds while awaiting tools or answer
  React.useEffect(() => {
    if (activeTool) return;
    setStepIndex(0);
    const interval = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % sequence.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [activeTool, sequence]);

  const label = activeTool ? labelForTool(activeTool) : sequence[stepIndex];

  return (
    <div className="flex items-center gap-2.5">
      {showMark && (
        <div className="w-6 h-6 shrink-0">
          <ZenMark animated />
        </div>
      )}
      <span key={label} className="zen-status-in text-sm text-muted-foreground font-medium flex items-center">
        {label}
        <span className="inline-block w-4 text-left ml-0.5">…</span>
      </span>
    </div>
  );
}
