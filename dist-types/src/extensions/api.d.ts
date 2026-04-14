export declare const doraMetricsApiExtension: import("@backstage/frontend-plugin-api").OverridableExtensionDefinition<{
    kind: "api";
    name: "dora-metrics";
    config: {};
    configInput: {};
    output: import("@backstage/frontend-plugin-api").ExtensionDataRef<import("@backstage/frontend-plugin-api").AnyApiFactory, "core.api.factory", {}>;
    inputs: {};
    params: <TApi, TImpl extends TApi, TDeps extends { [name in string]: unknown; }>(params: import("@backstage/frontend-plugin-api").ApiFactory<TApi, TImpl, TDeps>) => import("@backstage/frontend-plugin-api").ExtensionBlueprintParams<import("@backstage/frontend-plugin-api").AnyApiFactory>;
}>;
