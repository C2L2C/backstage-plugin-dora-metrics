export declare const doraMetricsPlugin: import("@backstage/frontend-plugin-api").OverridableFrontendPlugin<{}, {}, {
    "api:dora-metrics/dora-metrics": import("@backstage/frontend-plugin-api").OverridableExtensionDefinition<{
        kind: "api";
        name: "dora-metrics";
        config: {};
        configInput: {};
        output: import("@backstage/frontend-plugin-api").ExtensionDataRef<import("@backstage/frontend-plugin-api").AnyApiFactory, "core.api.factory", {}>;
        inputs: {};
        params: <TApi, TImpl extends TApi, TDeps extends { [name in string]: unknown; }>(params: import("@backstage/frontend-plugin-api").ApiFactory<TApi, TImpl, TDeps>) => import("@backstage/frontend-plugin-api").ExtensionBlueprintParams<import("@backstage/frontend-plugin-api").AnyApiFactory>;
    }>;
    "entity-content:dora-metrics": import("@backstage/frontend-plugin-api").OverridableExtensionDefinition<{
        kind: "entity-content";
        name: undefined;
        config: {
            path: string | undefined;
            title: string | undefined;
            filter: import("@backstage/filter-predicates").FilterPredicate | undefined;
            group: string | false | undefined;
            icon: string | undefined;
        };
        configInput: {
            filter?: import("@backstage/filter-predicates").FilterPredicate | undefined;
            title?: string | undefined;
            path?: string | undefined;
            group?: string | false | undefined;
            icon?: string | undefined;
        };
        output: import("@backstage/frontend-plugin-api").ExtensionDataRef<string, "core.routing.path", {}> | import("@backstage/frontend-plugin-api").ExtensionDataRef<import("@backstage/frontend-plugin-api").RouteRef<import("@backstage/frontend-plugin-api").AnyRouteRefParams>, "core.routing.ref", {
            optional: true;
        }> | import("@backstage/frontend-plugin-api").ExtensionDataRef<import("react").JSX.Element, "core.reactElement", {}> | import("@backstage/frontend-plugin-api").ExtensionDataRef<(entity: import("@backstage/catalog-model").Entity) => boolean, "catalog.entity-filter-function", {
            optional: true;
        }> | import("@backstage/frontend-plugin-api").ExtensionDataRef<string, "catalog.entity-filter-expression", {
            optional: true;
        }> | import("@backstage/frontend-plugin-api").ExtensionDataRef<string, "catalog.entity-content-title", {}> | import("@backstage/frontend-plugin-api").ExtensionDataRef<string, "catalog.entity-content-group", {
            optional: true;
        }> | import("@backstage/frontend-plugin-api").ExtensionDataRef<string | import("react").ReactElement<any, string | import("react").JSXElementConstructor<any>>, "catalog.entity-content-icon", {
            optional: true;
        }>;
        inputs: {};
        params: {
            defaultPath?: [Error: `Use the 'path' param instead`];
            path: string;
            defaultTitle?: [Error: `Use the 'title' param instead`];
            title: string;
            defaultGroup?: [Error: `Use the 'group' param instead`];
            group?: ("overview" | "documentation" | "development" | "deployment" | "operation" | "observability") | (string & {});
            icon?: string | import("react").ReactElement;
            loader: () => Promise<JSX.Element>;
            routeRef?: import("@backstage/frontend-plugin-api").RouteRef;
            filter?: string | import("@backstage/filter-predicates").FilterPredicate | ((entity: import("@backstage/catalog-model").Entity) => boolean);
        };
    }>;
}>;
