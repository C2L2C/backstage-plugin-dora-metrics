import { createApiRef } from '@backstage/core-plugin-api';

export type DoraRating = 'elite' | 'high' | 'medium' | 'low';

export interface PrDetail {
  number: number;
  title: string;
  url: string;
  durationHours: number;
  mergedAt: string;
  author?: string;
  authorAvatar?: string;
}

export interface DoraMetricValue {
  value: number;
  unit: string;
  rating: DoraRating;
  target: number;
  slowestPRs?: PrDetail[];
}

export interface DoraEnvironment {
  name: string;
  branch: string;
  isProduction: boolean;
  label: string;
}

export interface DoraMetrics {
  deploymentFrequency: DoraMetricValue;
  leadTime: DoraMetricValue;
  /** null for non-production environments */
  changeFailureRate: DoraMetricValue | null;
  /** null for non-production environments */
  mttr: DoraMetricValue | null;
  /** null for non-production environments */
  numberOfHotfixes: DoraMetricValue | null;
}

export interface DoraHistoryPoint {
  weekLabel: string;       // e.g. "Mar 10"
  bucketMidMs: number;     // timestamp (ms) of bucket midpoint — for chart x-axis alignment
  deploymentCount: number; // total PRs merged that week
  leadTimeHours: number;   // avg lead time that week (0 if no PRs)
  changeFailureRate?: number; // % (prod only)
  mttrHours?: number;         // avg (prod only)
}

export interface DoraMetricsApi {
  getEnvironments(): DoraEnvironment[];
  getDefaultDays(): number;
  getMetrics(
    projectSlug: string,
    branch: string,
    isProduction: boolean,
    label: string,
    days: number,
  ): Promise<DoraMetrics>;
  getHistory(
    projectSlug: string,
    branch: string,
    isProduction: boolean,
    label: string,
    days: number,
  ): Promise<DoraHistoryPoint[]>;
}

export const doraMetricsApiRef = createApiRef<DoraMetricsApi>({
  id: 'plugin.dora-metrics.service',
});
