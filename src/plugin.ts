import { createFrontendPlugin, type FrontendPlugin } from '@backstage/frontend-plugin-api';
import { doraMetricsEntityContentExtension } from './extensions/entityContent';
import { doraMetricsApiExtension } from './extensions/api';

export const doraMetricsPlugin: FrontendPlugin = createFrontendPlugin({
  pluginId: 'dora-metrics',
  extensions: [doraMetricsEntityContentExtension, doraMetricsApiExtension],
});
