import { createFrontendPlugin } from '@backstage/frontend-plugin-api';
import { doraMetricsEntityContentExtension } from './extensions/entityContent';
import { doraMetricsApiExtension } from './extensions/api';

export const doraMetricsPlugin = createFrontendPlugin({
  pluginId: 'dora-metrics',
  extensions: [doraMetricsEntityContentExtension, doraMetricsApiExtension],
});
