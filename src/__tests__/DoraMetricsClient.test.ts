import { DoraMetricsClient } from '../api/DoraMetricsClient';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePR(overrides: {
  number?: number;
  created_at: string;
  merged_at: string | null;
  labels?: Array<{ name: string }>;
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
  const slug = 'org/repo';
  const days = 7;

  it('rates elite when value >= target', async () => {
    // target = 7/week, 7 PRs in 7 days = 7/week
    const prs = Array.from({ length: 7 }, (_, i) =>
      makePR({ number: i + 1, created_at: daysAgo(6), merged_at: daysAgo(i) }),
    );
    const client = makeClient(prs);
    const result = await client.getMetrics(slug, 'main', false, 'hotfix', days);
    expect(result.deploymentFrequency.rating).toBe('elite');
  });

  it('rates high when value >= 70% of target', async () => {
    // target=7, need >= 4.9/week → 5 PRs in 7 days = 5/week
    const prs = Array.from({ length: 5 }, (_, i) =>
      makePR({ number: i + 1, created_at: daysAgo(6), merged_at: daysAgo(i) }),
    );
    const client = makeClient(prs);
    const result = await client.getMetrics(slug, 'main', false, 'hotfix', days);
    expect(result.deploymentFrequency.rating).toBe('high');
  });

  it('rates medium when value >= 40% of target', async () => {
    // target=7, need >= 2.8/week → 3 PRs in 7 days = 3/week
    const prs = Array.from({ length: 3 }, (_, i) =>
      makePR({ number: i + 1, created_at: daysAgo(6), merged_at: daysAgo(i) }),
    );
    const client = makeClient(prs);
    const result = await client.getMetrics(slug, 'main', false, 'hotfix', days);
    expect(result.deploymentFrequency.rating).toBe('medium');
  });

  it('rates low when value < 40% of target', async () => {
    // target=7, < 2.8/week → 1 PR in 7 days = 1/week
    const prs = [makePR({ number: 1, created_at: daysAgo(6), merged_at: daysAgo(3) })];
    const client = makeClient(prs);
    const result = await client.getMetrics(slug, 'main', false, 'hotfix', days);
    expect(result.deploymentFrequency.rating).toBe('low');
  });
});

describe('computeRating — lead time (lower is better)', () => {
  const slug = 'org/repo';
  const days = 30;

  it('rates elite when avg lead time <= target (24h)', async () => {
    // 12h lead time: created 12h ago, merged now
    const created = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const prs = [makePR({ created_at: created, merged_at: new Date().toISOString() })];
    const client = makeClient(prs);
    const result = await client.getMetrics(slug, 'main', false, 'hotfix', days);
    expect(result.leadTime.rating).toBe('elite');
  });

  it('rates high when avg lead time <= 2x target (48h)', async () => {
    // ~36h lead time: created 36h ago, merged now
    const created = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
    const prs = [makePR({ created_at: created, merged_at: new Date().toISOString() })];
    const client = makeClient(prs);
    const result = await client.getMetrics(slug, 'main', false, 'hotfix', days);
    expect(result.leadTime.rating).toBe('high');
  });

  it('rates medium when avg lead time <= 4x target (96h)', async () => {
    // ~72h lead time
    const created = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    const prs = [makePR({ created_at: created, merged_at: new Date().toISOString() })];
    const client = makeClient(prs);
    const result = await client.getMetrics(slug, 'main', false, 'hotfix', days);
    expect(result.leadTime.rating).toBe('medium');
  });

  it('rates low when avg lead time > 4x target (>96h)', async () => {
    // ~120h lead time
    const created = new Date(Date.now() - 120 * 60 * 60 * 1000).toISOString();
    const prs = [makePR({ created_at: created, merged_at: new Date().toISOString() })];
    const client = makeClient(prs);
    const result = await client.getMetrics(slug, 'main', false, 'hotfix', days);
    expect(result.leadTime.rating).toBe('low');
  });
});

describe('computeRating — hotfix count (target = 0 special case)', () => {
  const slug = 'org/repo';
  const days = 30;

  const hotfix = (n: number, i: number) =>
    makePR({ number: n, created_at: daysAgo(5), merged_at: daysAgo(i), labels: [{ name: 'hotfix' }] });

  it('rates elite with 0 hotfixes', async () => {
    const prs = [makePR({ created_at: daysAgo(5), merged_at: daysAgo(1) })];
    const client = makeClient(prs);
    const result = await client.getMetrics(slug, 'main', true, 'hotfix', days);
    expect(result.numberOfHotfixes!.rating).toBe('elite');
  });

  it('rates high with 1–2 hotfixes', async () => {
    const prs = [hotfix(1, 2), hotfix(2, 1)];
    const client = makeClient(prs);
    const result = await client.getMetrics(slug, 'main', true, 'hotfix', days);
    expect(result.numberOfHotfixes!.rating).toBe('high');
  });

  it('rates medium with 3–5 hotfixes', async () => {
    const prs = Array.from({ length: 4 }, (_, i) => hotfix(i + 1, i + 1));
    const client = makeClient(prs);
    const result = await client.getMetrics(slug, 'main', true, 'hotfix', days);
    expect(result.numberOfHotfixes!.rating).toBe('medium');
  });

  it('rates low with > 5 hotfixes', async () => {
    const prs = Array.from({ length: 6 }, (_, i) => hotfix(i + 1, i + 1));
    const client = makeClient(prs);
    const result = await client.getMetrics(slug, 'main', true, 'hotfix', days);
    expect(result.numberOfHotfixes!.rating).toBe('low');
  });
});

// ---------------------------------------------------------------------------
// getMetrics — core calculation logic
// ---------------------------------------------------------------------------

describe('getMetrics — calculations', () => {
  const slug = 'org/repo';

  it('excludes PRs outside the lookback window', async () => {
    const prs = [
      makePR({ number: 1, created_at: daysAgo(40), merged_at: daysAgo(35) }), // outside 30d
      makePR({ number: 2, created_at: daysAgo(10), merged_at: daysAgo(5) }),  // inside
    ];
    const client = makeClient(prs);
    const result = await client.getMetrics(slug, 'main', false, 'hotfix', 30);
    expect(result.deploymentFrequency.value).toBe(
      Math.round((1 / 30) * 7 * 100) / 100,
    );
  });

  it('excludes unmerged (closed) PRs', async () => {
    const prs = [
      makePR({ number: 1, created_at: daysAgo(5), merged_at: null }), // closed, not merged
      makePR({ number: 2, created_at: daysAgo(5), merged_at: daysAgo(2) }),
    ];
    const client = makeClient(prs);
    const result = await client.getMetrics(slug, 'main', false, 'hotfix', 30);
    expect(result.deploymentFrequency.value).toBe(
      Math.round((1 / 30) * 7 * 100) / 100,
    );
  });

  it('computes deployment frequency correctly', async () => {
    // 10 PRs over 30 days = (10/30)*7 ≈ 2.33/week
    const prs = Array.from({ length: 10 }, (_, i) =>
      makePR({ number: i + 1, created_at: daysAgo(20), merged_at: daysAgo(i + 1) }),
    );
    const client = makeClient(prs);
    const result = await client.getMetrics(slug, 'main', false, 'hotfix', 30);
    expect(result.deploymentFrequency.value).toBe(Math.round((10 / 30) * 7 * 100) / 100);
    expect(result.deploymentFrequency.unit).toBe('per week');
  });

  it('computes average lead time correctly', async () => {
    // PR1: 24h lead time, PR2: 48h lead time → avg = 36h
    const now = Date.now();
    const prs = [
      makePR({ number: 1, created_at: new Date(now - 48 * 3600_000).toISOString(), merged_at: new Date(now - 24 * 3600_000).toISOString() }),
      makePR({ number: 2, created_at: new Date(now - 48 * 3600_000).toISOString(), merged_at: new Date(now).toISOString() }),
    ];
    const client = makeClient(prs);
    const result = await client.getMetrics(slug, 'main', false, 'hotfix', 30);
    expect(result.leadTime.value).toBe(36);
    expect(result.leadTime.unit).toBe('hours');
  });

  it('returns null production metrics for non-production environments', async () => {
    const prs = [makePR({ created_at: daysAgo(5), merged_at: daysAgo(1) })];
    const client = makeClient(prs);
    const result = await client.getMetrics(slug, 'staging', false, 'hotfix', 30);
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
    const result = await client.getMetrics(slug, 'main', true, 'hotfix', 30);
    // 1 hotfix / 4 total = 25%
    expect(result.changeFailureRate!.value).toBe(25);
    expect(result.changeFailureRate!.unit).toBe('%');
  });

  it('computes MTTR as avg duration of hotfix PRs', async () => {
    const now = Date.now();
    const prs = [
      // hotfix with 2h lead time
      makePR({ number: 1, created_at: new Date(now - 4 * 3600_000).toISOString(), merged_at: new Date(now - 2 * 3600_000).toISOString(), labels: [{ name: 'hotfix' }] }),
      // hotfix with 6h lead time
      makePR({ number: 2, created_at: new Date(now - 9 * 3600_000).toISOString(), merged_at: new Date(now - 3 * 3600_000).toISOString(), labels: [{ name: 'hotfix' }] }),
    ];
    const client = makeClient(prs);
    const result = await client.getMetrics(slug, 'main', true, 'hotfix', 30);
    // avg = (2 + 6) / 2 = 4h
    expect(result.mttr!.value).toBe(4);
    expect(result.mttr!.unit).toBe('hours');
  });

  it('returns zero values when there are no merged PRs', async () => {
    const client = makeClient([]);
    const result = await client.getMetrics(slug, 'main', true, 'hotfix', 30);
    expect(result.deploymentFrequency.value).toBe(0);
    expect(result.leadTime.value).toBe(0);
    expect(result.changeFailureRate!.value).toBe(0);
    expect(result.mttr!.value).toBe(0);
  });

  it('throws on invalid project slug', async () => {
    const client = makeClient([]);
    await expect(client.getMetrics('invalid', 'main', false, 'hotfix', 30)).rejects.toThrow(
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
    await expect(client.getMetrics('org/repo', 'main', false, 'hotfix', 30)).rejects.toThrow(
      'GitHub API request failed: 403',
    );
  });
});

// ---------------------------------------------------------------------------
// getHistory — bucket logic
// ---------------------------------------------------------------------------

describe('getHistory — bucket logic', () => {
  const slug = 'org/repo';

  it('returns ~7 buckets for a 30-day range', async () => {
    const client = makeClient([]);
    const result = await client.getHistory(slug, 'main', false, 'hotfix', 30);
    expect(result.length).toBeGreaterThanOrEqual(7);
  });

  it('assigns PRs to the correct time bucket', async () => {
    // One PR merged 3 days ago
    const prs = [makePR({ created_at: daysAgo(10), merged_at: daysAgo(3) })];
    const client = makeClient(prs);
    const result = await client.getHistory(slug, 'main', false, 'hotfix', 30);
    const total = result.reduce((sum, b) => sum + b.deploymentCount, 0);
    expect(total).toBe(1);
  });

  it('excludes PRs outside the lookback window', async () => {
    const prs = [
      makePR({ number: 1, created_at: daysAgo(60), merged_at: daysAgo(40) }), // outside
      makePR({ number: 2, created_at: daysAgo(10), merged_at: daysAgo(5) }),  // inside
    ];
    const client = makeClient(prs);
    const result = await client.getHistory(slug, 'main', false, 'hotfix', 30);
    const total = result.reduce((sum, b) => sum + b.deploymentCount, 0);
    expect(total).toBe(1);
  });

  it('omits changeFailureRate and mttrHours for non-production', async () => {
    const client = makeClient([]);
    const result = await client.getHistory(slug, 'staging', false, 'hotfix', 30);
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
    const result = await client.getHistory(slug, 'main', true, 'hotfix', 30);
    const bucketsWithPRs = result.filter(b => b.deploymentCount > 0);
    expect(bucketsWithPRs.length).toBeGreaterThan(0);
    bucketsWithPRs.forEach(bucket => {
      expect(bucket.changeFailureRate).toBeDefined();
      expect(bucket.mttrHours).toBeDefined();
    });
  });

  it('computes lead time per bucket correctly', async () => {
    const now = Date.now();
    // PR with 10h lead time merged 2 days ago
    const prs = [
      makePR({
        created_at: new Date(now - (2 * 86400_000 + 10 * 3600_000)).toISOString(),
        merged_at: new Date(now - 2 * 86400_000).toISOString(),
      }),
    ];
    const client = makeClient(prs);
    const result = await client.getHistory(slug, 'main', false, 'hotfix', 30);
    const bucketsWithPRs = result.filter(b => b.deploymentCount > 0);
    expect(bucketsWithPRs[0].leadTimeHours).toBe(10);
  });

  it('each bucket has a weekLabel and bucketMidMs', async () => {
    const client = makeClient([]);
    const result = await client.getHistory(slug, 'main', false, 'hotfix', 30);
    result.forEach(bucket => {
      expect(typeof bucket.weekLabel).toBe('string');
      expect(bucket.weekLabel.length).toBeGreaterThan(0);
      expect(typeof bucket.bucketMidMs).toBe('number');
      expect(bucket.bucketMidMs).toBeGreaterThan(0);
    });
  });
});
