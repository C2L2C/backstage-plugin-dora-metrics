# @c2l2c/backstage-plugin-dora-metrics

A Backstage frontend plugin that displays **DORA metrics** for catalog entities using the GitHub API.

Tracks the four key DORA metrics:
- **Deployment Frequency** — how often you deploy to a given branch
- **Lead Time for Changes** — time from first commit to merge
- **Change Failure Rate** — percentage of deployments causing failures (production only)
- **MTTR** — mean time to recovery from failures (production only)

Ratings are classified as **Elite / High / Medium / Low** per DORA research benchmarks.

---

## Requirements

- Backstage v1.35+ (new frontend system)
- GitHub OAuth configured in your Backstage instance (the plugin uses `githubAuthApi` to call the GitHub REST API)
- Catalog entities annotated with `github.com/project-slug: org/repo`

---

## Installation

```bash
# In your Backstage app workspace
yarn workspace app add @c2l2c/backstage-plugin-dora-metrics
```

### Register the plugin

In `packages/app/src/App.tsx`:

```ts
import doraMetricsPlugin from '@c2l2c/backstage-plugin-dora-metrics/alpha';

// Add to your app's plugins array
const app = createApp({
  plugins: [doraMetricsPlugin],
  // ...
});
```

---

## Configuration

Add to your `app-config.yaml`:

```yaml
app:
  doraMetrics:
    # Lookback window in days (default: 30)
    collection:
      initialDays: 30

    # Define the environments / branches to track
    environments:
      - name: Production
        branch: main
        isProduction: true
        label: hotfix          # PR label for production failures (used for CFR/MTTR)
      - name: Staging
        branch: staging
        isProduction: false

    # Optional: override DORA benchmark targets
    targets:
      deploymentFrequency: 1   # deploys per day (Elite ≥ 1)
      leadTime: 24             # hours (Elite ≤ 24h)
      changeFailureRate: 5     # % (Elite ≤ 5%)
      mttr: 1                  # hours (Elite ≤ 1h)
```

---

## How it works

The plugin reads the `github.com/project-slug` annotation from the catalog entity and calls the GitHub REST API (authenticated via the user's GitHub OAuth session) to fetch merged pull requests within the configured time window.

It calculates:
- **Deployment Frequency**: merged PRs per day to the target branch
- **Lead Time**: time from PR creation to merge
- **CFR**: percentage of PRs labelled as hotfixes (production environments only)
- **MTTR**: average time hotfix PRs were open (production environments only)

---

## License

Apache-2.0
