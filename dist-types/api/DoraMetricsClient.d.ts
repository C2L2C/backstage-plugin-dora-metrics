import { ConfigApi, OAuthApi } from '@backstage/core-plugin-api';
import { DoraEnvironment, DoraHistoryPoint, DoraMetrics, DoraMetricsApi, DoraTargets } from './types';
export declare class DoraMetricsClient implements DoraMetricsApi {
    private readonly githubAuthApi;
    private readonly configApi;
    constructor(githubAuthApi: OAuthApi, configApi: ConfigApi);
    private getConfig;
    getEnvironments(): DoraEnvironment[];
    getDefaultDays(): number;
    getTargets(): DoraTargets;
    private fetchWithAuth;
    /**
     * Fetch all merged PRs for an environment, resolving branch patterns and
     * deduplicating across multiple branches by PR number.
     */
    private fetchMergedPRs;
    getMetrics(projectSlug: string, env: DoraEnvironment, days: number, targetsOverride?: Partial<DoraTargets>): Promise<DoraMetrics>;
    getHistory(projectSlug: string, env: DoraEnvironment, days: number): Promise<DoraHistoryPoint[]>;
}
