import React from "react";
import { INTEGRATION_TABS } from "constants/routes";
import { Datasource } from "entities/Datasource";
import { keyBy } from "lodash";
import { useAppWideAndOtherDatasource } from "pages/Editor/Explorer/hooks";
import { useMemo } from "react";
import { getPageList, getPagePermissions } from "selectors/editorSelectors";
import {
  getActions,
  getAllPageWidgets,
  getJSCollections,
  getPlugins,
} from "selectors/entitiesSelector";
import { useSelector } from "react-redux";
import { EventLocation } from "utils/AnalyticsUtil";
import history from "utils/history";
import {
  actionOperations,
  attachKind,
  isMatching,
  SEARCH_ITEM_TYPES,
} from "./utils";
import { PluginType } from "entities/Action";
import { integrationEditorURL } from "RouteBuilder";
import AddLineIcon from "remixicon-react/AddLineIcon";
import { EntityIcon } from "pages/Editor/Explorer/ExplorerIcons";
import { createNewQueryAction } from "actions/apiPaneActions";
import {
  hasCreateActionPermission,
  hasCreateDatasourceActionPermission,
  hasCreateDatasourcePermission,
} from "@appsmith/utils/permissionHelpers";
import { AppState } from "@appsmith/reducers";
import { getCurrentAppWorkspace } from "@appsmith/selectors/workspaceSelectors";

export const useFilteredFileOperations = (query = "") => {
  const { appWideDS = [], otherDS = [] } = useAppWideAndOtherDatasource();
  /**
   *  Work around to get the rest api cloud image.
   *  We don't have it store as an svg
   */
  const plugins = useSelector(getPlugins);
  const restApiPlugin = plugins.find(
    (plugin) => plugin.type === PluginType.API,
  );
  const newApiActionIdx = actionOperations.findIndex(
    (op) => op.title === "新建 API",
  );
  if (newApiActionIdx > -1) {
    actionOperations[newApiActionIdx].pluginId = restApiPlugin?.id;
  }

  const userWorkspacePermissions = useSelector(
    (state: AppState) => getCurrentAppWorkspace(state).userPermissions ?? [],
  );

  const pagePermissions = useSelector(getPagePermissions);

  const canCreateActions = hasCreateActionPermission(pagePermissions);

  const canCreateDatasource = hasCreateDatasourcePermission(
    userWorkspacePermissions,
  );

  return useMemo(() => {
    let fileOperations: any =
      (canCreateActions &&
        actionOperations.filter((op) =>
          op.title.toLowerCase().includes(query.toLowerCase()),
        )) ||
      [];
    const filteredAppWideDS = appWideDS.filter((ds: Datasource) =>
      ds.name.toLowerCase().includes(query.toLowerCase()),
    );
    const otherFilteredDS = otherDS.filter((ds: Datasource) =>
      ds.name.toLowerCase().includes(query.toLowerCase()),
    );

    if (filteredAppWideDS.length > 0 || otherFilteredDS.length > 0) {
      const showCreateQuery = [
        ...filteredAppWideDS,
        ...otherFilteredDS,
      ].some((ds: Datasource) =>
        hasCreateDatasourceActionPermission([
          ...(ds.userPermissions ?? []),
          ...pagePermissions,
        ]),
      );

      fileOperations = [
        ...fileOperations,
        showCreateQuery && {
          title: "新建查询",
          kind: SEARCH_ITEM_TYPES.sectionTitle,
        },
      ];
    }
    if (filteredAppWideDS.length > 0) {
      fileOperations = [
        ...fileOperations,
        ...filteredAppWideDS.map((ds) => {
          return hasCreateDatasourceActionPermission([
            ...(ds.userPermissions ?? []),
            ...pagePermissions,
          ])
            ? {
                title: `新建 ${ds.name} 查询`,
                shortTitle: `${ds.name} 查询`,
                desc: `创建一次对 ${ds.name} 的数据查询`,
                pluginId: ds.pluginId,
                kind: SEARCH_ITEM_TYPES.actionOperation,
                action: (pageId: string, from: EventLocation) =>
                  createNewQueryAction(pageId, from, ds.id),
              }
            : null;
        }),
      ];
    }
    if (otherFilteredDS.length > 0) {
      fileOperations = [
        ...fileOperations,
        ...otherFilteredDS.map((ds) => {
          return hasCreateDatasourceActionPermission([
            ...(ds.userPermissions ?? []),
            ...pagePermissions,
          ])
            ? {
                title: `新建 ${ds.name} 查询`,
                shortTitle: `${ds.name} 查询`,
                desc: `创建一次对 ${ds.name} 的数据查询`,
                kind: SEARCH_ITEM_TYPES.actionOperation,
                pluginId: ds.pluginId,
                action: (pageId: string, from: EventLocation) =>
                  createNewQueryAction(pageId, from, ds.id),
              }
            : null;
        }),
      ];
    }
    fileOperations = [
      ...fileOperations,
      canCreateDatasource && {
        title: "添加数据源",
        icon: (
          <EntityIcon>
            <AddLineIcon size={22} />
          </EntityIcon>
        ),
        kind: SEARCH_ITEM_TYPES.actionOperation,
        redirect: (pageId: string) => {
          history.push(
            integrationEditorURL({
              pageId,
              selectedTab: INTEGRATION_TABS.NEW,
            }),
          );
        },
      },
    ];
    return fileOperations.filter(Boolean);
  }, [query, appWideDS, otherDS]);
};

export const useFilteredWidgets = (query: string) => {
  const allWidgets = useSelector(getAllPageWidgets);
  const pages = useSelector(getPageList) || [];
  const pageMap = keyBy(pages, "pageId");
  const searchableWidgets = useMemo(
    () =>
      allWidgets.filter(
        (widget: any) =>
          ["CANVAS_WIDGET", "ICON_WIDGET"].indexOf(widget.type) === -1,
      ),
    [allWidgets],
  );
  return useMemo(() => {
    if (!query) return searchableWidgets;

    return searchableWidgets.filter((widget: any) => {
      const page = pageMap[widget.pageId];
      const isPageNameMatching = isMatching(page?.pageName, query);
      const isWidgetNameMatching = isMatching(widget?.widgetName, query);

      return isWidgetNameMatching || isPageNameMatching;
    });
  }, [allWidgets, query, pages]);
};

export const useFilteredActions = (query: string) => {
  const actions = useSelector(getActions);
  const pages = useSelector(getPageList) || [];
  const pageMap = keyBy(pages, "pageId");
  return useMemo(() => {
    if (!query) return actions;
    return actions.filter((action: any) => {
      const page = pageMap[action?.config?.pageId];
      const isPageNameMatching = isMatching(page?.pageName, query);
      const isActionNameMatching = isMatching(action?.config?.name, query);

      return isActionNameMatching || isPageNameMatching;
    });
  }, [actions, query, pages]);
};

export const useFilteredJSCollections = (query: string) => {
  const jsActions = useSelector(getJSCollections);
  const pages = useSelector(getPageList) || [];
  const pageMap = keyBy(pages, "pageId");

  return useMemo(() => {
    if (!query) return jsActions;

    return jsActions.filter((action: any) => {
      const page = pageMap[action?.config?.pageId];
      const isPageNameMatching = isMatching(page?.pageName, query);
      const isActionNameMatching = isMatching(action?.config?.name, query);

      return isActionNameMatching || isPageNameMatching;
    });
  }, [jsActions, query, pages]);
};

export const useFilteredPages = (query: string) => {
  const pages = useSelector(getPageList) || [];
  return useMemo(() => {
    if (!query) return attachKind(pages, SEARCH_ITEM_TYPES.page);
    return attachKind(
      pages.filter(
        (page: any) =>
          page.pageName.toLowerCase().indexOf(query?.toLowerCase()) > -1,
      ),
      SEARCH_ITEM_TYPES.page,
    );
  }, [pages, query]);
};
