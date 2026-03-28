# Contributing

## Development setup

```bash
npm install --legacy-peer-deps
npm test -- --watchAll=false   # run unit tests
npm run lint                   # lint
npm run build                  # build (requires declaration files first)
npx tsc --project tsconfig.build.json && npm run build
```

## Making changes

1. Fork the repo and create a branch off `main`
2. Make your changes with tests
3. Bump the version in `package.json` following [semver](https://semver.org) and add a `CHANGELOG.md` entry
4. Open a pull request — CI must pass before merge

## Publishing

Merging to `main` automatically publishes to npm **if** `package.json` version differs from what is already on the registry. To ship a release: bump the version, update the changelog, and merge.

## Commit style

Plain English imperative: `add regex label support`, `fix branch dedup`, `bump 0.3.1`.
