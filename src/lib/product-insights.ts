export const LOW_ADOPTION = 0.1;
export const SLOW_ROUTE_MS = 2000;

export type InsightSeverity = 'critical' | 'warn' | 'info' | 'good';

export interface Insight {
  id: string;
  severity: InsightSeverity;
  title: string;
  body: string;
  finding?: string;
  recommendation?: string;
  cohort?: any[];
  cohortIds?: string[];
  cohortLabel?: string;
  metric?: string;
  [key: string]: any;
}

export interface ProductTelemetry {
  empty: boolean;
  routes: Array<{
    route: string;
    routeKey?: string;
    path?: string;
    avgLoadMs: number | null;
    sampleCount: number;
    avgDwellSeconds?: number;
    views?: number;
    loadSamples?: number;
    [key: string]: any;
  }>;
  engaged: any[];
  sellers: any[];
  adoption: Array<{
    event: { key: string; label: string; question: string; category?: string; opportunity?: string; [key: string]: any };
    users: number;
    rate: number;
    total: number;
    perAdopter: number;
    opportunity?: string;
    [key: string]: any;
  }>;
  [key: string]: any;
}

export const aggregateTelemetry = (_users?: any[]): ProductTelemetry => ({
  empty: true,
  routes: [],
  engaged: [],
  sellers: [],
  adoption: [],
});

export const deriveInsights = (_telemetry?: ProductTelemetry): Insight[] => [];