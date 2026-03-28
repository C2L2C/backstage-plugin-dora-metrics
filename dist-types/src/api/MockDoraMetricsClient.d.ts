import { DoraEnvironment, DoraHistoryPoint, DoraMetrics, DoraMetricsApi, DoraTargets } from './types';
export declare class MockDoraMetricsClient implements DoraMetricsApi {
    getEnvironments(): DoraEnvironment[];
    getDefaultDays(): number;
    getTargets(): DoraTargets;
    getMetrics(_projectSlug: string, env: DoraEnvironment, _days: number, _targetsOverride?: Partial<DoraTargets>): Promise<DoraMetrics>;
    getHistory(_projectSlug: string, env: DoraEnvironment, _days: number): Promise<DoraHistoryPoint[]>;
}
