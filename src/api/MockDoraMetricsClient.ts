import { DoraEnvironment, DoraHistoryPoint, DoraMetrics, DoraMetricsApi, DoraTargets } from './types';

const MOCK_ENVIRONMENTS: DoraEnvironment[] = [
  { name: 'Production', branch: 'main', isProduction: true, label: 'hotfix' },
  { name: 'Staging', branch: 'staging', isProduction: false, label: '' },
];

const MOCK_TARGETS: DoraTargets = {
  deploymentFrequency: 7,
  leadTime: 24,
  changeFailureRate: 15,
  mttr: 1,
};

const MOCK_PRS = [
  { number: 142, title: 'feat: redesign dashboard layout', url: 'https://github.com/example/repo/pull/142', durationHours: 31.2, mergedAt: '2026-03-15T14:22:00Z', author: 'alice', authorAvatar: 'https://avatars.githubusercontent.com/u/1?v=4' },
  { number: 138, title: 'fix: resolve memory leak in worker thread', url: 'https://github.com/example/repo/pull/138', durationHours: 22.5, mergedAt: '2026-03-12T09:10:00Z', author: 'bob', authorAvatar: 'https://avatars.githubusercontent.com/u/2?v=4' },
  { number: 135, title: 'feat: add export to CSV functionality', url: 'https://github.com/example/repo/pull/135', durationHours: 18.8, mergedAt: '2026-03-10T16:45:00Z', author: 'carol', authorAvatar: 'https://avatars.githubusercontent.com/u/3?v=4' },
  { number: 131, title: 'chore: upgrade dependencies to latest', url: 'https://github.com/example/repo/pull/131', durationHours: 14.1, mergedAt: '2026-03-08T11:30:00Z', author: 'dave', authorAvatar: 'https://avatars.githubusercontent.com/u/4?v=4' },
  { number: 128, title: 'feat: implement rate limiting middleware', url: 'https://github.com/example/repo/pull/128', durationHours: 9.6, mergedAt: '2026-03-05T13:20:00Z', author: 'alice', authorAvatar: 'https://avatars.githubusercontent.com/u/1?v=4' },
];

const MOCK_HOTFIX_PRS = [
  { number: 140, title: 'hotfix: fix broken auth token refresh', url: 'https://github.com/example/repo/pull/140', durationHours: 1.2, mergedAt: '2026-03-14T03:45:00Z', author: 'bob', authorAvatar: 'https://avatars.githubusercontent.com/u/2?v=4' },
  { number: 133, title: 'hotfix: patch SQL injection in search query', url: 'https://github.com/example/repo/pull/133', durationHours: 0.8, mergedAt: '2026-03-09T22:10:00Z', author: 'carol', authorAvatar: 'https://avatars.githubusercontent.com/u/3?v=4' },
];

const MOCK_HISTORY: DoraHistoryPoint[] = [
  { weekLabel: 'Feb 17', bucketMidMs: new Date('2026-02-20').getTime(), deploymentCount: 3, leadTimeHours: 24.1, changeFailureRate: 0, mttrHours: 0 },
  { weekLabel: 'Feb 24', bucketMidMs: new Date('2026-02-27').getTime(), deploymentCount: 5, leadTimeHours: 19.8, changeFailureRate: 20, mttrHours: 1.2 },
  { weekLabel: 'Mar 3',  bucketMidMs: new Date('2026-03-06').getTime(), deploymentCount: 4, leadTimeHours: 22.3, changeFailureRate: 0, mttrHours: 0 },
  { weekLabel: 'Mar 10', bucketMidMs: new Date('2026-03-13').getTime(), deploymentCount: 6, leadTimeHours: 16.5, changeFailureRate: 16.7, mttrHours: 0.9 },
  { weekLabel: 'Mar 17', bucketMidMs: new Date('2026-03-20').getTime(), deploymentCount: 5, leadTimeHours: 18.4, changeFailureRate: 0, mttrHours: 0 },
];

export class MockDoraMetricsClient implements DoraMetricsApi {
  getEnvironments(): DoraEnvironment[] {
    return MOCK_ENVIRONMENTS;
  }

  getDefaultDays(): number {
    return 30;
  }

  getTargets(): DoraTargets {
    return MOCK_TARGETS;
  }

  async getMetrics(
    _projectSlug: string,
    env: DoraEnvironment,
    _days: number,
    _targetsOverride?: Partial<DoraTargets>,
  ): Promise<DoraMetrics> {
    await new Promise(r => setTimeout(r, 600)); // simulate network delay

    return {
      deploymentFrequency: {
        value: 4.2,
        unit: 'per week',
        rating: 'high',
        target: 7,
        slowestPRs: MOCK_PRS,
      },
      leadTime: {
        value: 18.4,
        unit: 'hours',
        rating: 'elite',
        target: 24,
        slowestPRs: MOCK_PRS,
      },
      changeFailureRate: env.isProduction
        ? { value: 8.3, unit: '%', rating: 'high', target: 15 }
        : null,
      mttr: env.isProduction
        ? { value: 0.8, unit: 'hours', rating: 'elite', target: 1, slowestPRs: MOCK_HOTFIX_PRS }
        : null,
      numberOfHotfixes: env.isProduction
        ? { value: 2, unit: 'PRs', rating: 'high', target: 0, slowestPRs: MOCK_HOTFIX_PRS }
        : null,
    };
  }

  async getHistory(
    _projectSlug: string,
    env: DoraEnvironment,
    _days: number,
  ): Promise<DoraHistoryPoint[]> {
    await new Promise(r => setTimeout(r, 400));

    return MOCK_HISTORY.map(point => ({
      ...point,
      changeFailureRate: env.isProduction ? point.changeFailureRate : undefined,
      mttrHours: env.isProduction ? point.mttrHours : undefined,
    }));
  }
}
