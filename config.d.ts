export interface Config {
  app?: {
    /**
     * DORA metrics configuration.
     * @visibility frontend
     */
    doraMetrics?: {
      /**
       * @visibility frontend
       */
      environments?: Array<{
        /** @visibility frontend */
        name: string;
        /** @visibility frontend */
        branch: string;
        /** @visibility frontend */
        isProduction?: boolean;
        /** Label on PRs that represent production failures (hotfixes). @visibility frontend */
        label?: string;
        /** Label on PRs that represent planned feature deployments. @visibility frontend */
        featureLabel?: string;
      }>;
      /**
       * @visibility frontend
       */
      collection?: {
        /** @visibility frontend */
        initialDays?: number;
      };
      /**
       * @visibility frontend
       */
      targets?: {
        /** @visibility frontend */
        deploymentFrequency?: number;
        /** @visibility frontend */
        leadTime?: number;
        /** @visibility frontend */
        changeFailureRate?: number;
        /** @visibility frontend */
        mttr?: number;
      };
    };
  };
}
