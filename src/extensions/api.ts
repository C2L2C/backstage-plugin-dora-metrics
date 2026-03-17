import {
  ApiBlueprint,
  createApiFactory,
  configApiRef,
} from '@backstage/frontend-plugin-api';
import { githubAuthApiRef} from '@backstage/core-plugin-api';
import { doraMetricsApiRef } from '../api/types';
import { DoraMetricsClient } from '../api/DoraMetricsClient';

export const doraMetricsApiExtension = ApiBlueprint.make({
  name: 'dora-metrics',
  params: createApi =>
    createApi(
      createApiFactory({
        api: doraMetricsApiRef,
        deps: {
          githubAuthApi: githubAuthApiRef,
          configApi: configApiRef,
        },
        factory: ({ githubAuthApi, configApi }) =>
          new DoraMetricsClient(githubAuthApi, configApi),
      }),
    ),
});
