# Changelog

All notable changes to this project are documented here.

## [0.3.3] - 2026-04-09

### Fixed
- `exports` field in `package.json` pointed to `./src/` (not included in the published package) instead of `./dist/`, causing `Module not found` errors for consumers

## [0.3.1] - 2026-03-28

### Added
- Label patterns: `label` field now accepts comma-separated names (`hotfix,fix,bug`) and JavaScript regex strings (`^hotfix`) in addition to single label names
- Example configs in `examples/` (regex branch, multi-branch, per-repo catalog annotation)
- GitHub Actions CI (lint + test + build on Node 20 & 22) and auto-publish on push to `main`
- Issue/PR templates and Dependabot config

### Fixed
- README Configuration section rewritten to document all branch and label pattern formats

## [0.3.0] - 2026-03-27

### Added
- **Multi-branch environments**: `branch` field accepts comma-separated names (`main,master`) or JavaScript regex (`^release/.*`); PRs deduplicated by number across branches
- **Hotfix PR list**: clicking the Hotfixes to Production card shows all hotfix PRs ("View N PRs →" footer link)
- **Single-production constraint**: exactly one environment may set `isProduction: true`; throws a config error at startup otherwise
- **Per-repo overrides** via `catalog-info.yaml` annotations: `dora-metrics/environments` and `dora-metrics/targets`
- `getTargets()` method on `DoraMetricsApi`
- `MockDoraMetricsClient` exported from the package
- 42 unit tests

## [0.2.0] - 2026-03-15

### Added
- Initial public release
- Deployment Frequency, Lead Time, Change Failure Rate, MTTR, Hotfix count metrics
- Environment-based branch tracking
- History chart (7-bucket rolling window)
- Debug mode with `MockDoraMetricsClient`
