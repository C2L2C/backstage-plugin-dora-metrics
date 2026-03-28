export interface Config {
  app?: {
    /**
     * DORA metrics configuration.
     * @visibility frontend
     */
    doraMetrics?: {
      /**
       * Enable debug mode — uses mock data instead of the GitHub API.
       * Useful for local development and screenshots.
       * @visibility frontend
       */
      debug?: boolean;
      /**
       * Environments to track. At most one environment may have isProduction: true.
       * @visibility frontend
       */
      environments?: Array<{
        /** Display name shown in the UI (e.g. "Production"). @visibility frontend */
        name: string;
        /**
         * Branch(es) to track for this environment. Accepts:
         *   - A single branch name:       "main"
         *   - Comma-separated names:      "main,master"
         *   - A JavaScript regex string:  "^(main|master)$"
         *
         * When multiple branches match, PRs are fetched from all of them and
         * deduplicated by PR number before metrics are computed.
         * @visibility frontend
         */
        branch: string;
        /**
         * Mark this environment as the production environment.
         * Only one environment across the entire list may set this to true.
         * Production environments unlock Change Failure Rate, MTTR, and Hotfix count metrics.
         * @visibility frontend
         */
        isProduction?: boolean;
        /** Label on PRs that represent production failures (hotfixes). Defaults to "hotfix". @visibility frontend */
        label?: string;
        /** Label on PRs that represent planned feature deployments. @visibility frontend */
        featureLabel?: string;
      }>;
      /**
       * @visibility frontend
       */
      collection?: {
        /** Number of days of history to fetch on initial load. Defaults to 30. @visibility frontend */
        initialDays?: number;
      };
      /**
       * Default performance targets used for rating calculations.
       * These can be overridden per entity via the dora-metrics/targets annotation.
       * @visibility frontend
       */
      targets?: {
        /** Target deployments per week (higher is better). Defaults to 7. @visibility frontend */
        deploymentFrequency?: number;
        /** Target lead time in hours (lower is better). Defaults to 24. @visibility frontend */
        leadTime?: number;
        /** Target change failure rate as a percentage (lower is better). Defaults to 15. @visibility frontend */
        changeFailureRate?: number;
        /** Target mean time to restore in hours (lower is better). Defaults to 1. @visibility frontend */
        mttr?: number;
      };
    };
  };
}
