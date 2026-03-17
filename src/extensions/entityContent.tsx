import { EntityContentBlueprint } from '@backstage/plugin-catalog-react/alpha';

export const doraMetricsEntityContentExtension = EntityContentBlueprint.make({
  params: {
    path: 'dora-metrics',
    title: 'DORA Metrics',
    filter: entity =>
      entity.spec?.type === 'service' ||
      Boolean(entity.metadata.annotations?.['github.com/project-slug']),
    loader: () =>
      import('../components/DoraMetricsContent').then(m => (
        <m.DoraMetricsContent />
      )),
  },
});
