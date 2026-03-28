import { ConfigApi, OAuthApi } from '@backstage/core-plugin-api';
import {
  DoraEnvironment,
  DoraHistoryPoint,
  DoraMetrics,
  DoraMetricValue,
  DoraMetricsApi,
  DoraRating,
  DoraTargets,
  PrDetail,
} from './types';

interface GitHubPR {
  number: number;
  title: string;
  html_url: string;
  created_at: string;
  merged_at: string | null;
  closed_at: string | null;
  labels: Array<{ name: string }>;
  user: { login: string; avatar_url: string } | null;
}

/**
 * Compute a DORA rating based on the configured target.
 *
 * lowerIsBetter (lead time, CFR, MTTR, hotfix count):
 *   elite  = value <= target
 *   high   = value <= target * 2
 *   medium = value <= target * 4
 *   low    = value >  target * 4
 *
 * higherIsBetter (deployment frequency):
 *   elite  = value >= target
 *   high   = value >= target * 0.7
 *   medium = value >= target * 0.4
 *   low    = value <  target * 0.4
 *
 * Special case — target = 0 (hotfix count ideal = 0):
 *   elite=0, high≤2, medium≤5, low>5
 */
function computeRating(value: number, target: number, lowerIsBetter: boolean): DoraRating {
  if (lowerIsBetter) {
    if (target === 0) {
      if (value === 0) return 'elite';
      if (value <= 2) return 'high';
      if (value <= 5) return 'medium';
      return 'low';
    }
    if (value <= target) return 'elite';
    if (value <= target * 2) return 'high';
    if (value <= target * 4) return 'medium';
    return 'low';
  }
  if (value >= target) return 'elite';
  if (value >= target * 0.7) return 'high';
  if (value >= target * 0.4) return 'medium';
  return 'low';
}

function toPrDetail(pr: GitHubPR, durationHours: number): PrDetail {
  return {
    number: pr.number,
    title: pr.title,
    url: pr.html_url,
    durationHours: Math.round(durationHours * 10) / 10,
    mergedAt: pr.merged_at!,
    author: pr.user?.login,
    authorAvatar: pr.user?.avatar_url,
  };
}

/**
 * Determine whether a branch pattern string is a regex (vs a plain name or
 * comma-separated list of names).  A string is treated as a regex if it
 * contains any regex meta-character: | ^ $ [ ] ( ) { } ? + * \
 */
function isRegexPattern(pattern: string): boolean {
  return /[|^$[\](){}?+*\\]/.test(pattern);
}

/**
 * Resolve a branch pattern to a concrete list of branch names.
 *
 * - Single name  "main"           → ["main"]
 * - Comma-sep    "main,master"    → ["main", "master"]
 * - Regex        "^(main|master)$"→ fetched from the repo's branch list and filtered
 */
async function resolveBranches(
  owner: string,
  repo: string,
  branchPattern: string,
  fetchFn: <T>(url: string) => Promise<T>,
): Promise<string[]> {
  if (isRegexPattern(branchPattern)) {
    const repoBranches = await fetchFn<Array<{ name: string }>>(
      `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`,
    );
    const regex = new RegExp(branchPattern);
    return repoBranches.map(b => b.name).filter(name => regex.test(name));
  }
  // Comma-separated or single branch name
  return branchPattern.split(',').map(b => b.trim()).filter(Boolean);
}

export class DoraMetricsClient implements DoraMetricsApi {
  private readonly githubAuthApi: OAuthApi;
  private readonly configApi: ConfigApi;

  constructor(githubAuthApi: OAuthApi, configApi: ConfigApi) {
    this.githubAuthApi = githubAuthApi;
    this.configApi = configApi;
  }

  private getConfig() {
    const appCfg = this.configApi.getConfig('app');
    const cfg = appCfg.getOptionalConfig('doraMetrics');

    const rawEnvs = cfg?.getOptionalConfigArray('environments') ?? [];
    const environments: DoraEnvironment[] = rawEnvs.map(e => ({
      name: e.getString('name'),
      branch: e.getString('branch'),
      isProduction: e.getOptionalBoolean('isProduction') ?? false,
      label: e.getOptionalString('label') ?? 'hotfix',
    }));

    // Validate: at most one isProduction environment
    const prodEnvs = environments.filter(e => e.isProduction);
    if (prodEnvs.length > 1) {
      throw new Error(
        `DORA metrics config error: only one environment may have isProduction: true, ` +
        `but found ${prodEnvs.length}: ${prodEnvs.map(e => e.name).join(', ')}`,
      );
    }

    const initialDays =
      cfg?.getOptionalConfig('collection')?.getOptionalNumber('initialDays') ?? 30;

    const targetsCfg = cfg?.getOptionalConfig('targets');
    const targets: DoraTargets = {
      deploymentFrequency: targetsCfg?.getOptionalNumber('deploymentFrequency') ?? 7,
      leadTime: targetsCfg?.getOptionalNumber('leadTime') ?? 24,
      changeFailureRate: targetsCfg?.getOptionalNumber('changeFailureRate') ?? 15,
      mttr: targetsCfg?.getOptionalNumber('mttr') ?? 1,
    };

    return { environments, initialDays, targets };
  }

  getEnvironments(): DoraEnvironment[] {
    return this.getConfig().environments;
  }

  getDefaultDays(): number {
    return this.getConfig().initialDays;
  }

  getTargets(): DoraTargets {
    return this.getConfig().targets;
  }

  private async fetchWithAuth<T>(url: string, token: string): Promise<T> {
    const response = await fetch(url, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error(
        `GitHub API request failed: ${response.status} ${response.statusText} — ${url}`,
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * Fetch all merged PRs for an environment, resolving branch patterns and
   * deduplicating across multiple branches by PR number.
   */
  private async fetchMergedPRs(
    owner: string,
    repo: string,
    env: DoraEnvironment,
    cutoff: Date,
    token: string,
  ): Promise<GitHubPR[]> {
    const boundFetch = <T>(url: string) => this.fetchWithAuth<T>(url, token);

    const branches = await resolveBranches(owner, repo, env.branch, boundFetch);

    const allByNumber = new Map<number, GitHubPR>();

    await Promise.all(
      branches.map(async branch => {
        const url =
          `https://api.github.com/repos/${owner}/${repo}/pulls` +
          `?state=closed&base=${branch}&per_page=100`;
        const prs = await boundFetch<GitHubPR[]>(url);
        for (const pr of prs) {
          if (pr.merged_at && new Date(pr.merged_at) >= cutoff) {
            // Keep first occurrence (branches may share PRs — shouldn't happen
            // for base-branch-filtered queries, but guard anyway)
            if (!allByNumber.has(pr.number)) {
              allByNumber.set(pr.number, pr);
            }
          }
        }
      }),
    );

    return Array.from(allByNumber.values());
  }

  async getMetrics(
    projectSlug: string,
    env: DoraEnvironment,
    days: number,
    targetsOverride?: Partial<DoraTargets>,
  ): Promise<DoraMetrics> {
    const token = await this.githubAuthApi.getAccessToken('repo');
    const { targets: configTargets } = this.getConfig();
    const targets: DoraTargets = { ...configTargets, ...targetsOverride };

    const [owner, repo] = projectSlug.split('/');
    if (!owner || !repo) {
      throw new Error(`Invalid project slug "${projectSlug}". Expected "owner/repo".`);
    }

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const mergedPRs = await this.fetchMergedPRs(owner, repo, env, cutoff, token);

    // --- Deployment Frequency ---
    const deploymentsPerWeek = days > 0 ? (mergedPRs.length / days) * 7 : 0;

    const deploymentFrequency: DoraMetricValue = {
      value: Math.round(deploymentsPerWeek * 100) / 100,
      unit: 'per week',
      rating: computeRating(deploymentsPerWeek, targets.deploymentFrequency, false),
      target: targets.deploymentFrequency,
      // All merged PRs sorted newest-first — used in expanded view date table
      slowestPRs: [...mergedPRs]
        .sort((a, b) => new Date(b.merged_at!).getTime() - new Date(a.merged_at!).getTime())
        .map(pr => toPrDetail(pr,
          (new Date(pr.merged_at!).getTime() - new Date(pr.created_at).getTime()) / (1000 * 60 * 60)
        )),
    };

    // --- Lead Time ---
    const prsWithLeadTime = mergedPRs
      .map(pr => ({
        pr,
        durationHours:
          (new Date(pr.merged_at!).getTime() - new Date(pr.created_at).getTime()) /
          (1000 * 60 * 60),
      }))
      .sort((a, b) => b.durationHours - a.durationHours);

    const avgLeadTimeHours =
      prsWithLeadTime.length > 0
        ? prsWithLeadTime.reduce((sum, p) => sum + p.durationHours, 0) / prsWithLeadTime.length
        : 0;

    const leadTime: DoraMetricValue = {
      value: Math.round(avgLeadTimeHours * 10) / 10,
      unit: 'hours',
      rating: computeRating(avgLeadTimeHours, targets.leadTime, true),
      target: targets.leadTime,
      slowestPRs: prsWithLeadTime
        .slice(0, 10)
        .map(p => toPrDetail(p.pr, p.durationHours)),
    };

    // --- Production-only metrics ---
    if (!env.isProduction) {
      return {
        deploymentFrequency,
        leadTime,
        changeFailureRate: null,
        mttr: null,
        numberOfHotfixes: null,
      };
    }

    const hotfixPRs = mergedPRs.filter(pr =>
      (pr.labels ?? []).some(l => l.name === env.label),
    );

    // Number of Hotfixes — sorted newest-first for the expanded list
    const numberOfHotfixes: DoraMetricValue = {
      value: hotfixPRs.length,
      unit: 'PRs',
      rating: computeRating(hotfixPRs.length, 0, true),
      target: 0,
      slowestPRs: [...hotfixPRs]
        .sort((a, b) => new Date(b.merged_at!).getTime() - new Date(a.merged_at!).getTime())
        .map(pr => toPrDetail(pr,
          (new Date(pr.merged_at!).getTime() - new Date(pr.created_at).getTime()) / (1000 * 60 * 60)
        )),
    };

    // Change Failure Rate = fix PRs / all merged PRs (DORA standard: always 0–100%)
    const changeFailureRatePct =
      mergedPRs.length > 0 ? (hotfixPRs.length / mergedPRs.length) * 100 : 0;

    const changeFailureRate: DoraMetricValue = {
      value: Math.round(changeFailureRatePct * 10) / 10,
      unit: '%',
      rating: computeRating(changeFailureRatePct, targets.changeFailureRate, true),
      target: targets.changeFailureRate,
    };

    // MTTR
    const hotfixWithDuration = hotfixPRs
      .map(pr => ({
        pr,
        durationHours:
          (new Date(pr.merged_at!).getTime() - new Date(pr.created_at).getTime()) /
          (1000 * 60 * 60),
      }))
      .sort((a, b) => b.durationHours - a.durationHours);

    const avgMttrHours =
      hotfixWithDuration.length > 0
        ? hotfixWithDuration.reduce((sum, p) => sum + p.durationHours, 0) /
          hotfixWithDuration.length
        : 0;

    const mttr: DoraMetricValue = {
      value: Math.round(avgMttrHours * 10) / 10,
      unit: 'hours',
      rating: computeRating(avgMttrHours, targets.mttr, true),
      target: targets.mttr,
      slowestPRs: hotfixWithDuration
        .slice(0, 10)
        .map(p => toPrDetail(p.pr, p.durationHours)),
    };

    return { deploymentFrequency, leadTime, changeFailureRate, mttr, numberOfHotfixes };
  }

  async getHistory(
    projectSlug: string,
    env: DoraEnvironment,
    days: number,
  ): Promise<DoraHistoryPoint[]> {
    const token = await this.githubAuthApi.getAccessToken('repo');
    const [owner, repo] = projectSlug.split('/');
    if (!owner || !repo) throw new Error(`Invalid project slug "${projectSlug}".`);

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const mergedPRs = await this.fetchMergedPRs(owner, repo, env, cutoff, token);

    // Scale bucket size so we always get ~7 data points regardless of date range
    const bucketDays = Math.max(1, Math.round(days / 7));
    const numBuckets = Math.max(2, Math.ceil(days / bucketDays));
    const buckets: DoraHistoryPoint[] = [];

    for (let w = numBuckets - 1; w >= 0; w--) {
      const weekEnd   = new Date(Date.now() - w * bucketDays * 24 * 60 * 60 * 1000);
      const weekStart = new Date(weekEnd.getTime() - bucketDays * 24 * 60 * 60 * 1000);

      const weekPRs = mergedPRs.filter(pr => {
        const t = new Date(pr.merged_at!).getTime();
        return t >= weekStart.getTime() && t < weekEnd.getTime();
      });

      const leadTimes = weekPRs.map(pr =>
        (new Date(pr.merged_at!).getTime() - new Date(pr.created_at).getTime()) / (1000 * 60 * 60),
      );
      const avgLeadTime =
        leadTimes.length > 0 ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length : 0;

      let changeFailureRate: number | undefined;
      let mttrHours: number | undefined;

      if (env.isProduction) {
        const hotfixPRs = weekPRs.filter(pr => pr.labels.some(l => l.name === env.label));
        changeFailureRate =
          weekPRs.length > 0 ? Math.round((hotfixPRs.length / weekPRs.length) * 1000) / 10 : 0;
        const hotfixDurations = hotfixPRs.map(pr =>
          (new Date(pr.merged_at!).getTime() - new Date(pr.created_at).getTime()) / (1000 * 60 * 60),
        );
        mttrHours =
          hotfixDurations.length > 0
            ? Math.round((hotfixDurations.reduce((a, b) => a + b, 0) / hotfixDurations.length) * 10) / 10
            : 0;
      }

      buckets.push({
        weekLabel: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        bucketMidMs: Math.round((weekStart.getTime() + weekEnd.getTime()) / 2),
        deploymentCount: weekPRs.length,
        leadTimeHours: Math.round(avgLeadTime * 10) / 10,
        changeFailureRate,
        mttrHours,
      });
    }

    return buckets;
  }
}
