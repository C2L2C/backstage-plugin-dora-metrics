import { DoraMetricsClient } from '../api/DoraMetricsClient';
import { DoraEnvironment } from '../api/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePR(overrides: {
  number?: number;
  created_at: string;
  merged_at: string | null;
  labels?: Array<{ name: string }>;
  base?: string; // simulated base branch (used only in fetch mock routing)
}) {
  return {
    number: overrides.number ?? 1,
    title: `PR #${overrides.number ?? 1}`,
    html_url: `https://github.com/org/repo/pull/${overrides.number ?? 1}`,
    created_at: overrides.created_at,
    merged_at: overrides.merged_at,
    closed_at: overrides.merged_at,
    labels: overrides.labels ?? [],
    user: { login: 'dev', avatar_url: 'https://avatar.url' },
  };
}

/** Returns an ISO string N days ago from now */
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

const PROD_ENV: DoraEnvironment = { name: 'Production', branch: 'main', isProduction: true, label: 'hotfix' };
const STAGING_ENV: DoraEnvironment = { name: 'Staging', branch: 'staging', isProduction: false, label: '' };

function makeClient(
  prs: ReturnType<typeof makePR>[],
  configOverrides: Record<string, unknown> = {},
) {
  const githubAuthApi = { getAccessToken: jest.fn().mockResolvedValue('fake-token') };

  const config = {
    deploymentFrequency: 7,
    leadTime: 24,
    changeFailureRate: 15,
    mttr: 1,
    initialDays: 30,
    environments: [
      { name: 'Production', branch: 'main', isProduction: true, label: 'hotfix' },
      { name: 'Staging', branch: 'staging', isProduction: false, label: '' },
    ],
    ...configOverrides,
  };

  const configApi = {
    getConfig: (_key: string) => ({
      getOptionalConfig: (key: string) => {
        if (key === 'doraMetrics') {
          return {
            getOptionalConfigArray: (k: string) => {
              if (k === 'environments') {
                return (config.environments as any[]).map(e => ({
                  getString: (f: string) => (e as any)[f],
                  getOptionalBoolean: (f: string) => (e as any)[f],
                  getOptionalString: (f: string) => (e as any)[f] ?? undefined,
                }));
              }
              return [];
            },
            getOptionalConfig: (k: string) => {
              if (k === 'collection') {
                return { getOptionalNumber: () => config.initialDays };
              }
              if (k === 'targets') {
                return {
                  getOptionalNumber: (f: string) => (config as any)[f],
                };
              }
              return undefined;
            },
          };
        }
        return undefined;
      },
    }),
  };

  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(prs),
  }) as jest.Mock;

  return new DoraMetricsClient(githubAuthApi as any, configApi as any);
}

// ---------------------------------------------------------------------------
// computeRating (tested indirectly via getMetrics output)
// ---------------------------------------------------------------------------

describe('computeRating — deployment frequency (higher is better)', () => {
  const days = 7;

  it('rates elite when value >= target', async () => {
    const prs = Array.from({ length: 7 }, (_, i) =>
      makePR({ number: i + 1, created_at: daysAgo(6), merged_at: daysAgo(i) }),
    );
    const client = makeClient(prs);
    const result = await client.getMetrics('org/repo', PROD_ENV, days);
    expect(result.deploymentFrequency.rating).toBe('elite');
  });

  it('rates high when value >= 70% of target', async () => {
    const prs = Array.from({ length: 5 }, (_, i) =>
      makePR({ number: i + 1, created_at: daysAgo(6), merged_at: daysAgo(i) }),
    );
    const client = makeClient(prs);
    const result = await client.getMetrics('org/repo', PROD_ENV, days);
    expect(result.deploymentFrequency.rating).toBe('high');
  });

  it('rates medium when value >= 40% of target', async () => {
    const prs = Array.from({ length: 3 }, (_, i) =>
      makePR({ number: i + 1, created_at: daysAgo(6), merged_at: daysAgo(i) }),
    );
    const client = makeClient(prs);
    const result = await client.getMetrics('org/repo', PROD_ENV, days);
    expect(result.deploymentFrequency.rating).toBe('medium');
  });

  it('rates low when value < 40% of target', async () => {
    const prs = [makePR({ number: 1, created_at: daysAgo(6), merged_at: daysAgo(3) })];
    const client = makeClient(prs);
    const result = await client.getMetrics('org/repo', PROD_ENV, days);
    expect(result.deploymentFrequency.rating).toBe('low');
  });
});

describe('computeRating — lead time (lower is better)', () => {
  const days = 30;

  it('rates elite when avg lead time <= target (24h)', async () => {
    const created = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const prs = [makePR({ created_at: created, merged_at: new Date().toISOString() })];
    const client = makeClient(prs);
    const result = await client.getMetrics('org/repo', PROD_ENV, days);
    expect(result.leadTime.rating).toBe('elite');
  });

  it('rates high when avg lead time <= 2x target (48h)', async () => {
    const created = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
    const prs = [makePR({ created_at: created, merged_at: new Date().toISOString() })];
    const client = makeClient(prs);
    const result = await client.getMetrics('org/repo', PROD_ENV, days);
    expect(result.leadTime.rating).toBe('high');
  });

  it('rates medium when avg lead time <= 4x target (96h)', async () => {
    const created = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    const prs = [makePR({ created_at: created, merged_at: new Date().toISOString() })];
    const client = makeClient(prs);
    const result = await client.getMetrics('org/repo', PROD_ENV, days);
    expect(result.leadTime.rating).toBe('medium');
  });

  it('rates low when avg lead time > 4x target (>96h)', async () => {
    const created = new Date(Date.now() - 120 * 60 * 60 * 1000).toISOString();
    const prs = [makePR({ created_at: created, merged_at: new Date().toISOString() })];
    const client = makeClient(prs);
    const result = await client.getMetrics('org/repo', PROD_ENV, days);
    expect(result.leadTime.rating).toBe('low');
  });
});

describe('computeRating — hotfix count (target = 0 special case)', () => {
  const days = 30;

  const hotfix = (n: number, i: number) =>
    makePR({ number: n, created_at: daysAgo(5), merged_at: daysAgo(i), labels: [{ name: 'hotfix' }] });

  it('rates elite with 0 hotfixes', async () => {
    const prs = [makePR({ created_at: daysAgo(5), merged_at: daysAgo(1) })];
    const client = makeClient(prs);
    const result = await client.getMetrics('org/repo', PROD_ENV, days);
    expect(result.numberOfHotfixes!.rating).toBe('elite');
  });

  it('rates high with 1–2 hotfixes', async () => {
    const prs = [hotfix(1, 2), hotfix(2, 1)];
    const client = makeClient(prs);
    const result = await client.getMetrics('org/repo', PROD_ENV, days);
    expect(result.numberOfHotfixes!.rating).toBe('high');
  });

  it('rates medium with 3–5 hotfixes', async () => {
    const prs = Array.from({ length: 4 }, (_, i) => hotfix(i + 1, i + 1));
    const client = makeClient(prs);
    const result = await client.getMetrics('org/repo', PROD_ENV, days);
    expect(result.numberOfHotfixes!.rating).toBe('medium');
  });

  it('rates low with > 5 hotfixes', async () => {
    const prs = Array.from({ length: 6 }, (_, i) => hotfix(i + 1, i + 1));
    const client = makeClient(prs);
    const result = await client.getMetrics('org/repo', PROD_ENV, days);
    expect(result.numberOfHotfixes!.rating).toBe('low');
  });
});

// ---------------------------------------------------------------------------
// getMetrics — core calculation logic
// ---------------------------------------------------------------------------

describe('getMetrics — calculations', () => {
  it('excludes PRs outside the lookback window', async () => {
    const prs = [
      makePR({ number: 1, created_at: daysAgo(40), merged_at: daysAgo(35) }), // outside 30d
      makePR({ number: 2, created_at: daysAgo(10), merged_at: daysAgo(5) }),  // inside
    ];
    const client = makeClient(prs);
    const result = await client.getMetrics('org/repo', PROD_ENV, 30);
    expect(result.deploymentFrequency.value).toBe(
      Math.round((1 / 30) * 7 * 100) / 100,
    );
  });

  it('excludes unmerged (closed) PRs', async () => {
    const prs = [
      makePR({ number: 1, created_at: daysAgo(5), merged_at: null }),
      makePR({ number: 2, created_at: daysAgo(5), merged_at: daysAgo(2) }),
    ];
    const client = makeClient(prs);
    const result = await client.getMetrics('org/repo', PROD_ENV, 30);
    expect(result.deploymentFrequency.value).toBe(
      Math.round((1 / 30) * 7 * 100) / 100,
    );
  });

  it('computes deployment frequency correctly', async () => {
    const prs = Array.from({ length: 10 }, (_, i) =>
      makePR({ number: i + 1, created_at: daysAgo(20), merged_at: daysAgo(i + 1) }),
    );
    const client = makeClient(prs);
    const result = await client.getMetrics('org/repo', PROD_ENV, 30);
    expect(result.deploymentFrequency.value).toBe(Math.round((10 / 30) * 7 * 100) / 100);
    expect(result.deploymentFrequency.unit).toBe('per week');
  });

  it('computes average lead time correctly', async () => {
    const now = Date.now();
    const prs = [
      makePR({ number: 1, created_at: new Date(now - 48 * 3600_000).toISOString(), merged_at: new Date(now - 24 * 3600_000).toISOString() }),
      makePR({ number: 2, created_at: new Date(now - 48 * 3600_000).toISOString(), merged_at: new Date(now).toISOString() }),
    ];
    const client = makeClient(prs);
    const result = await client.getMetrics('org/repo', PROD_ENV, 30);
    expect(result.leadTime.value).toBe(36);
    expect(result.leadTime.unit).toBe('hours');
  });

  it('returns null production metrics for non-production environments', async () => {
    const prs = [makePR({ created_at: daysAgo(5), merged_at: daysAgo(1) })];
    const client = makeClient(prs);
    const result = await client.getMetrics('org/repo', STAGING_ENV, 30);
    expect(result.changeFailureRate).toBeNull();
    expect(result.mttr).toBeNull();
    expect(result.numberOfHotfixes).toBeNull();
  });

  it('computes CFR as percentage of hotfix PRs', async () => {
    const prs = [
      makePR({ number: 1, created_at: daysAgo(5), merged_at: daysAgo(2), labels: [{ name: 'hotfix' }] }),
      makePR({ number: 2, created_at: daysAgo(5), merged_at: daysAgo(2) }),
      makePR({ number: 3, created_at: daysAgo(5), merged_at: daysAgo(2) }),
      makePR({ number: 4, created_at: daysAgo(5), merged_at: daysAgo(2) }),
    ];
    const client = makeClient(prs);
    const result = await client.getMetrics('org/repo', PROD_ENV, 30);
    expect(result.changeFailureRate!.value).toBe(25);
    expect(result.changeFailureRate!.unit).toBe('%');
  });

  it('computes MTTR as avg duration of hotfix PRs', async () => {
    const now = Date.now();
    const prs = [
      makePR({ number: 1, created_at: new Date(now - 4 * 3600_000).toISOString(), merged_at: new Date(now - 2 * 3600_000).toISOString(), labels: [{ name: 'hotfix' }] }),
      makePR({ number: 2, created_at: new Date(now - 9 * 3600_000).toISOString(), merged_at: new Date(now - 3 * 3600_000).toISOString(), labels: [{ name: 'hotfix' }] }),
    ];
    const client = makeClient(prs);
    const result = await client.getMetrics('org/repo', PROD_ENV, 30);
    expect(result.mttr!.value).toBe(4);
    expect(result.mttr!.unit).toBe('hours');
  });

  it('returns zero values when there are no merged PRs', async () => {
    const client = makeClient([]);
    const result = await client.getMetrics('org/repo', PROD_ENV, 30);
    expect(result.deploymentFrequency.value).toBe(0);
    expect(result.leadTime.value).toBe(0);
    expect(result.changeFailureRate!.value).toBe(0);
    expect(result.mttr!.value).toBe(0);
  });

  it('throws on invalid project slug', async () => {
    const client = makeClient([]);
    await expect(client.getMetrics('invalid', PROD_ENV, 30)).rejects.toThrow(
      'Invalid project slug',
    );
  });

  it('throws when GitHub API returns an error', async () => {
    const githubAuthApi = { getAccessToken: jest.fn().mockResolvedValue('token') };
    const configApi = {
      getConfig: () => ({
        getOptionalConfig: () => ({
          getOptionalConfigArray: () => [],
          getOptionalConfig: () => ({ getOptionalNumber: () => undefined }),
        }),
      }),
    };
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403, statusText: 'Forbidden' }) as jest.Mock;
    const client = new DoraMetricsClient(githubAuthApi as any, configApi as any);
    await expect(client.getMetrics('org/repo', PROD_ENV, 30)).rejects.toThrow(
      'GitHub API request failed: 403',
    );
  });
});

// ---------------------------------------------------------------------------
// getMetrics — targets override
// ---------------------------------------------------------------------------

describe('getMetrics — targets override', () => {
  it('uses override targets when provided', async () => {
    // 1 PR in 7 days = 1/wk. Default target=7 → low. Override target=1 → elite.
    const prs = [makePR({ created_at: daysAgo(6), merged_at: daysAgo(3) })];
    const client = makeClient(prs);
    const result = await client.getMetrics('org/repo', PROD_ENV, 7, { deploymentFrequency: 1 });
    expect(result.deploymentFrequency.rating).toBe('elite');
    expect(result.deploymentFrequency.target).toBe(1);
  });

  it('applies partial overrides, falling back to config targets for the rest', async () => {
    const created = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const prs = [makePR({ created_at: created, merged_at: new Date().toISOString() })];
    const client = makeClient(prs);
    // Only override leadTime; deploymentFrequency should stay at config default (7)
    const result = await client.getMetrics('org/repo', PROD_ENV, 30, { leadTime: 48 });
    // 12h lead time <= 48h target → elite
    expect(result.leadTime.rating).toBe('elite');
    expect(result.leadTime.target).toBe(48);
    // deploymentFrequency target unchanged at 7
    expect(result.deploymentFrequency.target).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// getMetrics — hotfix PR list
// ---------------------------------------------------------------------------

describe('getMetrics — hotfix PR list (numberOfHotfixes.slowestPRs)', () => {
  it('populates slowestPRs on numberOfHotfixes with all hotfix PRs', async () => {
    const prs = [
      makePR({ number: 1, created_at: daysAgo(5), merged_at: daysAgo(2), labels: [{ name: 'hotfix' }] }),
      makePR({ number: 2, created_at: daysAgo(5), merged_at: daysAgo(1), labels: [{ name: 'hotfix' }] }),
      makePR({ number: 3, created_at: daysAgo(5), merged_at: daysAgo(3) }), // not a hotfix
    ];
    const client = makeClient(prs);
    const result = await client.getMetrics('org/repo', PROD_ENV, 30);
    expect(result.numberOfHotfixes!.slowestPRs).toHaveLength(2);
    expect(result.numberOfHotfixes!.slowestPRs!.map(p => p.number)).toContain(1);
    expect(result.numberOfHotfixes!.slowestPRs!.map(p => p.number)).toContain(2);
  });

  it('returns empty slowestPRs when there are no hotfixes', async () => {
    const prs = [makePR({ created_at: daysAgo(5), merged_at: daysAgo(1) })];
    const client = makeClient(prs);
    const result = await client.getMetrics('org/repo', PROD_ENV, 30);
    expect(result.numberOfHotfixes!.slowestPRs).toHaveLength(0);
  });

  it('sorts hotfix PRs newest-first', async () => {
    const prs = [
      makePR({ number: 10, created_at: daysAgo(10), merged_at: daysAgo(5), labels: [{ name: 'hotfix' }] }),
      makePR({ number: 20, created_at: daysAgo(5), merged_at: daysAgo(1), labels: [{ name: 'hotfix' }] }),
    ];
    const client = makeClient(prs);
    const result = await client.getMetrics('org/repo', PROD_ENV, 30);
    const prNumbers = result.numberOfHotfixes!.slowestPRs!.map(p => p.number);
    // PR #20 merged 1 day ago (newer) should come before PR #10 merged 5 days ago
    expect(prNumbers[0]).toBe(20);
    expect(prNumbers[1]).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// getMetrics — multi-branch (comma-separated)
// ---------------------------------------------------------------------------

describe('getMetrics — comma-separated branch pattern', () => {
  it('fetches from each branch and deduplicates PRs by number', async () => {
    const prMain   = makePR({ number: 1, created_at: daysAgo(5), merged_at: daysAgo(2) });
    const prMaster = makePR({ number: 2, created_at: daysAgo(5), merged_at: daysAgo(3) });

    // Simulate: first call returns prMain, second returns prMaster
    let callCount = 0;
    global.fetch = jest.fn().mockImplementation(() => {
      const prs = callCount === 0 ? [prMain] : [prMaster];
      callCount++;
      return Promise.resolve({ ok: true, json: () => Promise.resolve(prs) });
    }) as jest.Mock;

    const githubAuthApi = { getAccessToken: jest.fn().mockResolvedValue('token') };
    const configApi = {
      getConfig: () => ({
        getOptionalConfig: () => ({
          getOptionalConfigArray: () => [],
          getOptionalConfig: () => ({ getOptionalNumber: () => undefined }),
        }),
      }),
    };
    const client = new DoraMetricsClient(githubAuthApi as any, configApi as any);

    const multiEnv: DoraEnvironment = { name: 'Production', branch: 'main,master', isProduction: false, label: 'hotfix' };
    const result = await client.getMetrics('org/repo', multiEnv, 30);

    // Both PRs should be counted
    expect(result.deploymentFrequency.slowestPRs).toHaveLength(2);
    // fetch should have been called twice (once per branch)
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('deduplicates PRs that appear in multiple branches', async () => {
    const sharedPR = makePR({ number: 1, created_at: daysAgo(5), merged_at: daysAgo(2) });

    // Both branch calls return the same PR
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([sharedPR]),
    }) as jest.Mock;

    const githubAuthApi = { getAccessToken: jest.fn().mockResolvedValue('token') };
    const configApi = {
      getConfig: () => ({
        getOptionalConfig: () => ({
          getOptionalConfigArray: () => [],
          getOptionalConfig: () => ({ getOptionalNumber: () => undefined }),
        }),
      }),
    };
    const client = new DoraMetricsClient(githubAuthApi as any, configApi as any);

    const multiEnv: DoraEnvironment = { name: 'Production', branch: 'main,master', isProduction: false, label: '' };
    const result = await client.getMetrics('org/repo', multiEnv, 30);

    // Deduplicated — only one PR despite two branch calls
    expect(result.deploymentFrequency.slowestPRs).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// getMetrics — regex branch pattern
// ---------------------------------------------------------------------------

describe('getMetrics — regex branch pattern', () => {
  it('fetches repo branches, filters by regex, then queries each matching branch', async () => {
    const pr = makePR({ number: 1, created_at: daysAgo(5), merged_at: daysAgo(2) });

    // Call sequence:
    //  1st: GET /branches  → returns ['main','develop','feature/x']
    //  2nd: GET /pulls?base=main   → returns [pr]
    let callCount = 0;
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/branches')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ name: 'main' }, { name: 'develop' }, { name: 'feature/x' }]),
        });
      }
      // Only 'main' matches regex '^main$'; 'develop' and 'feature/x' do not
      callCount++;
      return Promise.resolve({ ok: true, json: () => Promise.resolve([pr]) });
    }) as jest.Mock;

    const githubAuthApi = { getAccessToken: jest.fn().mockResolvedValue('token') };
    const configApi = {
      getConfig: () => ({
        getOptionalConfig: () => ({
          getOptionalConfigArray: () => [],
          getOptionalConfig: () => ({ getOptionalNumber: () => undefined }),
        }),
      }),
    };
    const client = new DoraMetricsClient(githubAuthApi as any, configApi as any);

    const regexEnv: DoraEnvironment = { name: 'Production', branch: '^main$', isProduction: false, label: '' };
    const result = await client.getMetrics('org/repo', regexEnv, 30);

    // Should have fetched repo branches + 1 PR call for 'main' only
    expect(callCount).toBe(1); // only 'main' matched
    expect(result.deploymentFrequency.slowestPRs).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// getMetrics — only-one-isProduction validation
// ---------------------------------------------------------------------------

describe('getConfig — isProduction validation', () => {
  it('throws when more than one environment has isProduction: true', () => {
    const githubAuthApi = { getAccessToken: jest.fn().mockResolvedValue('token') };

    const configApi = {
      getConfig: () => ({
        getOptionalConfig: () => ({
          getOptionalConfigArray: (k: string) => {
            if (k !== 'environments') return [];
            return [
              { getString: (f: string) => ({ name: 'Prod', branch: 'main' }[f] ?? ''), getOptionalBoolean: () => true, getOptionalString: () => undefined },
              { getString: (f: string) => ({ name: 'Also Prod', branch: 'master' }[f] ?? ''), getOptionalBoolean: () => true, getOptionalString: () => undefined },
            ];
          },
          getOptionalConfig: () => ({ getOptionalNumber: () => undefined }),
        }),
      }),
    };

    const client = new DoraMetricsClient(githubAuthApi as any, configApi as any);
    expect(() => client.getEnvironments()).toThrow(
      /only one environment may have isProduction: true/,
    );
  });

  it('does not throw with a single isProduction environment', () => {
    const client = makeClient([]);
    expect(() => client.getEnvironments()).not.toThrow();
  });

  it('does not throw with zero isProduction environments', () => {
    const client = makeClient([], {
      environments: [
        { name: 'Staging', branch: 'staging', isProduction: false, label: '' },
      ],
    });
    expect(() => client.getEnvironments()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getHistory — bucket logic
// ---------------------------------------------------------------------------

describe('getHistory — bucket logic', () => {
  it('returns ~7 buckets for a 30-day range', async () => {
    const client = makeClient([]);
    const result = await client.getHistory('org/repo', STAGING_ENV, 30);
    expect(result.length).toBeGreaterThanOrEqual(7);
  });

  it('assigns PRs to the correct time bucket', async () => {
    const prs = [makePR({ created_at: daysAgo(10), merged_at: daysAgo(3) })];
    const client = makeClient(prs);
    const result = await client.getHistory('org/repo', STAGING_ENV, 30);
    const total = result.reduce((sum, b) => sum + b.deploymentCount, 0);
    expect(total).toBe(1);
  });

  it('excludes PRs outside the lookback window', async () => {
    const prs = [
      makePR({ number: 1, created_at: daysAgo(60), merged_at: daysAgo(40) }),
      makePR({ number: 2, created_at: daysAgo(10), merged_at: daysAgo(5) }),
    ];
    const client = makeClient(prs);
    const result = await client.getHistory('org/repo', STAGING_ENV, 30);
    const total = result.reduce((sum, b) => sum + b.deploymentCount, 0);
    expect(total).toBe(1);
  });

  it('omits changeFailureRate and mttrHours for non-production', async () => {
    const client = makeClient([]);
    const result = await client.getHistory('org/repo', STAGING_ENV, 30);
    result.forEach(bucket => {
      expect(bucket.changeFailureRate).toBeUndefined();
      expect(bucket.mttrHours).toBeUndefined();
    });
  });

  it('includes changeFailureRate and mttrHours for production', async () => {
    const prs = [
      makePR({ number: 1, created_at: daysAgo(5), merged_at: daysAgo(3), labels: [{ name: 'hotfix' }] }),
      makePR({ number: 2, created_at: daysAgo(5), merged_at: daysAgo(3) }),
    ];
    const client = makeClient(prs);
    const result = await client.getHistory('org/repo', PROD_ENV, 30);
    const bucketsWithPRs = result.filter(b => b.deploymentCount > 0);
    expect(bucketsWithPRs.length).toBeGreaterThan(0);
    bucketsWithPRs.forEach(bucket => {
      expect(bucket.changeFailureRate).toBeDefined();
      expect(bucket.mttrHours).toBeDefined();
    });
  });

  it('computes lead time per bucket correctly', async () => {
    const now = Date.now();
    const prs = [
      makePR({
        created_at: new Date(now - (2 * 86400_000 + 10 * 3600_000)).toISOString(),
        merged_at: new Date(now - 2 * 86400_000).toISOString(),
      }),
    ];
    const client = makeClient(prs);
    const result = await client.getHistory('org/repo', STAGING_ENV, 30);
    const bucketsWithPRs = result.filter(b => b.deploymentCount > 0);
    expect(bucketsWithPRs[0].leadTimeHours).toBe(10);
  });

  it('each bucket has a weekLabel and bucketMidMs', async () => {
    const client = makeClient([]);
    const result = await client.getHistory('org/repo', STAGING_ENV, 30);
    result.forEach(bucket => {
      expect(typeof bucket.weekLabel).toBe('string');
      expect(bucket.weekLabel.length).toBeGreaterThan(0);
      expect(typeof bucket.bucketMidMs).toBe('number');
      expect(bucket.bucketMidMs).toBeGreaterThan(0);
    });
  });

  it('uses env label to identify hotfix PRs in production', async () => {
    const customLabelEnv: DoraEnvironment = { name: 'Production', branch: 'main', isProduction: true, label: 'fix' };
    const prs = [
      makePR({ number: 1, created_at: daysAgo(5), merged_at: daysAgo(3), labels: [{ name: 'fix' }] }),
      makePR({ number: 2, created_at: daysAgo(5), merged_at: daysAgo(3) }),
    ];
    const client = makeClient(prs);
    const result = await client.getHistory('org/repo', customLabelEnv, 30);
    const bucket = result.find(b => b.deploymentCount > 0);
    // 1 hotfix / 2 total = 50%
    expect(bucket?.changeFailureRate).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// getTargets
// ---------------------------------------------------------------------------

describe('getTargets', () => {
  it('returns the configured target values', () => {
    const client = makeClient([]);
    const targets = client.getTargets();
    expect(targets.deploymentFrequency).toBe(7);
    expect(targets.leadTime).toBe(24);
    expect(targets.changeFailureRate).toBe(15);
    expect(targets.mttr).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getMetrics — label patterns (comma-separated and regex)
// ---------------------------------------------------------------------------

describe('getMetrics — label patterns', () => {
  const days = 30;

  it('matches a hotfix PR using a comma-separated label pattern', async () => {
    const prs = [
      makePR({ number: 1, created_at: daysAgo(5), merged_at: daysAgo(2), labels: [{ name: 'fix' }] }),
      makePR({ number: 2, created_at: daysAgo(5), merged_at: daysAgo(3) }),
    ];
    const client = makeClient(prs);
    const env: DoraEnvironment = { ...PROD_ENV, label: 'hotfix,fix,bug' };
    const result = await client.getMetrics('org/repo', env, days);
    expect(result.numberOfHotfixes!.value).toBe(1);
  });

  it('matches multiple hotfix PRs using a comma-separated label pattern', async () => {
    const prs = [
      makePR({ number: 1, created_at: daysAgo(5), merged_at: daysAgo(2), labels: [{ name: 'hotfix' }] }),
      makePR({ number: 2, created_at: daysAgo(5), merged_at: daysAgo(3), labels: [{ name: 'bug' }] }),
      makePR({ number: 3, created_at: daysAgo(5), merged_at: daysAgo(4) }),
    ];
    const client = makeClient(prs);
    const env: DoraEnvironment = { ...PROD_ENV, label: 'hotfix,fix,bug' };
    const result = await client.getMetrics('org/repo', env, days);
    expect(result.numberOfHotfixes!.value).toBe(2);
  });

  it('matches a hotfix PR using a regex label pattern', async () => {
    const prs = [
      makePR({ number: 1, created_at: daysAgo(5), merged_at: daysAgo(2), labels: [{ name: 'hotfix/urgent' }] }),
      makePR({ number: 2, created_at: daysAgo(5), merged_at: daysAgo(3) }),
    ];
    const client = makeClient(prs);
    const env: DoraEnvironment = { ...PROD_ENV, label: '^hotfix' };
    const result = await client.getMetrics('org/repo', env, days);
    expect(result.numberOfHotfixes!.value).toBe(1);
  });

  it('does not match a PR whose labels do not satisfy the pattern', async () => {
    const prs = [
      makePR({ number: 1, created_at: daysAgo(5), merged_at: daysAgo(2), labels: [{ name: 'feature' }] }),
    ];
    const client = makeClient(prs);
    const env: DoraEnvironment = { ...PROD_ENV, label: 'hotfix,fix' };
    const result = await client.getMetrics('org/repo', env, days);
    expect(result.numberOfHotfixes!.value).toBe(0);
  });
});
