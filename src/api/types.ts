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
  /**
   * Raw branch pattern as configured — a single branch name, a comma-separated
   * list ("main,master"), or a JavaScript regex string ("^(main|master)$").
   * The client resolves this to a concrete list of branches at query time.
   */
  branch: string;
  isProduction: boolean;
  label: string;
}

export interface DoraTargets {
  deploymentFrequency: number;
  leadTime: number;
  changeFailureRate: number;
  mttr: number;
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
  getTargets(): DoraTargets;
  getMetrics(
    projectSlug: string,
    env: DoraEnvironment,
    days: number,
    targetsOverride?: Partial<DoraTargets>,
  ): Promise<DoraMetrics>;
  getHistory(
    projectSlug: string,
    env: DoraEnvironment,
    days: number,
  ): Promise<DoraHistoryPoint[]>;
}

export const doraMetricsApiRef = createApiRef<DoraMetricsApi>({
  id: 'plugin.dora-metrics.service',
});
