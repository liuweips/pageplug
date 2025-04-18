import CanvasWidgetsNormalizer from "normalizers/CanvasWidgetsNormalizer";
import { AppState } from "@appsmith/reducers";
import {
  Page,
  ReduxAction,
  ReduxActionErrorTypes,
  ReduxActionTypes,
  UpdateCanvasPayload,
} from "@appsmith/constants/ReduxActionConstants";
import {
  clonePageSuccess,
  deletePageSuccess,
  FetchPageListPayload,
  fetchPageSuccess,
  fetchPublishedPageSuccess,
  savePageSuccess,
  setUrlData,
  initCanvasLayout,
  updateCurrentPage,
  updateWidgetNameSuccess,
  updateAndSaveLayout,
  saveLayout,
  setLastUpdatedTime,
  ClonePageActionPayload,
  CreatePageActionPayload,
  generateTemplateError,
  generateTemplateSuccess,
  fetchAllPageEntityCompletion,
  updatePageSuccess,
  updatePageError,
} from "actions/pageActions";
import PageApi, {
  ClonePageRequest,
  CreatePageRequest,
  DeletePageRequest,
  FetchPageListResponse,
  FetchPageRequest,
  FetchPageResponse,
  FetchPublishedPageRequest,
  PageLayout,
  SavePageRequest,
  SavePageResponse,
  SavePageResponseData,
  SetPageOrderRequest,
  UpdatePageRequest,
  UpdatePageResponse,
  UpdateWidgetNameRequest,
  UpdateWidgetNameResponse,
} from "api/PageApi";
import {
  CanvasWidgetsReduxState,
  FlattenedWidgetProps,
} from "reducers/entityReducers/canvasWidgetsReducer";
import {
  all,
  call,
  debounce,
  put,
  select,
  takeEvery,
  takeLatest,
  takeLeading,
} from "redux-saga/effects";
import history from "utils/history";
import {
  captureInvalidDynamicBindingPath,
  isNameValid,
  quickScrollToWidget,
} from "utils/helpers";
import { extractCurrentDSL } from "utils/WidgetPropsUtils";
import { checkIfMigrationIsNeeded } from "utils/DSLMigrations";
import {
  getAllPageIds,
  getEditorConfigs,
  getExistingPageNames,
  getWidgets,
} from "./selectors";
import { getDataTree } from "selectors/dataTreeSelectors";
import { IncorrectBindingError, validateResponse } from "./ErrorSagas";
import { ApiResponse } from "api/ApiResponses";
import {
  getCurrentApplicationId,
  getCurrentLayoutId,
  getCurrentPageId,
  getCurrentPageName,
  getPageById,
  isMobileLayout,
} from "selectors/editorSelectors";
import {
  executePageLoadActions,
  fetchActionsForPage,
  setActionsToExecuteOnPageLoad,
  setJSActionsToExecuteOnPageLoad,
  fetchActionsForPageSuccess,
  fetchActionsForPageError,
} from "actions/pluginActionActions";
import { UrlDataState } from "reducers/entityReducers/appReducer";
import { APP_MODE } from "entities/App";
import { clearEvalCache } from "./EvaluationsSaga";
import { getQueryParams } from "utils/URLUtils";
import PerformanceTracker, {
  PerformanceTransactionName,
} from "utils/PerformanceTracker";
import log from "loglevel";
import { Toaster, Variant } from "design-system";
import { migrateIncorrectDynamicBindingPathLists } from "utils/migrations/IncorrectDynamicBindingPathLists";
import * as Sentry from "@sentry/react";
import { ERROR_CODES } from "@appsmith/constants/ApiConstants";
import AnalyticsUtil from "utils/AnalyticsUtil";
import DEFAULT_TEMPLATE from "templates/default";
import { GenerateTemplatePageRequest } from "api/PageApi";

import { getAppMode } from "selectors/applicationSelectors";
import { setCrudInfoModalData } from "actions/crudInfoModalActions";
import {
  selectMultipleWidgetsAction,
  selectWidgetInitAction,
} from "actions/widgetSelectionActions";
import { inGuidedTour } from "selectors/onboardingSelectors";
import {
  fetchJSCollectionsForPage,
  fetchJSCollectionsForPageSuccess,
  fetchJSCollectionsForPageError,
} from "actions/jsActionActions";

import WidgetFactory from "utils/WidgetFactory";
import { toggleShowDeviationDialog } from "actions/onboardingActions";
import { DataTree } from "entities/DataTree/dataTreeFactory";
import { builderURL } from "RouteBuilder";
import { failFastApiCalls } from "./InitSagas";
import { hasManagePagePermission } from "@appsmith/utils/permissionHelpers";
import { resizePublishedMainCanvasToLowestWidget } from "./WidgetOperationUtils";
import { getSelectedWidgets } from "selectors/ui";
import { checkAndLogErrorsIfCyclicDependency } from "./helper";
import { LOCAL_STORAGE_KEYS } from "utils/localStorage";
import { generateAutoHeightLayoutTreeAction } from "actions/autoHeightActions";

const WidgetTypes = WidgetFactory.widgetTypes;

const getWidgetName = (state: AppState, widgetId: string) =>
  state.entities.canvasWidgets[widgetId];

export function* fetchPageListSaga(
  fetchPageListAction: ReduxAction<FetchPageListPayload>,
) {
  PerformanceTracker.startAsyncTracking(
    PerformanceTransactionName.FETCH_PAGE_LIST_API,
  );
  try {
    const { applicationId, mode } = fetchPageListAction.payload;
    const apiCall =
      mode === APP_MODE.EDIT
        ? PageApi.fetchPageList
        : PageApi.fetchPageListViewMode;
    const response: FetchPageListResponse = yield call(apiCall, applicationId);
    const isValidResponse: boolean = yield validateResponse(response);
    if (isValidResponse) {
      const workspaceId = response.data.workspaceId;
      const pages: Page[] = response.data.pages.map((page) => ({
        pageName: page.name,
        pageId: page.id,
        isDefault: page.isDefault,
        isHidden: !!page.isHidden,
        icon: page.icon,
        slug: page.slug,
        userPermissions: page.userPermissions,
      }));
      yield put({
        type: ReduxActionTypes.SET_CURRENT_WORKSPACE_ID,
        payload: {
          workspaceId,
        },
      });
      yield put({
        type: ReduxActionTypes.FETCH_PAGE_LIST_SUCCESS,
        payload: {
          pages,
          applicationId: applicationId,
        },
      });
      PerformanceTracker.stopAsyncTracking(
        PerformanceTransactionName.FETCH_PAGE_LIST_API,
      );
    } else {
      PerformanceTracker.stopAsyncTracking(
        PerformanceTransactionName.FETCH_PAGE_LIST_API,
      );
      yield put({
        type: ReduxActionErrorTypes.FETCH_PAGE_LIST_ERROR,
        payload: {
          error: response.responseMeta.error,
        },
      });
    }
  } catch (error) {
    PerformanceTracker.stopAsyncTracking(
      PerformanceTransactionName.FETCH_PAGE_LIST_API,
      { failed: true },
    );
    yield put({
      type: ReduxActionErrorTypes.FETCH_PAGE_LIST_ERROR,
      payload: {
        error,
      },
    });
  }
}

export const getCanvasWidgetsPayload = (
  pageResponse: FetchPageResponse,
): UpdateCanvasPayload => {
  const normalizedResponse = CanvasWidgetsNormalizer.normalize(
    extractCurrentDSL(pageResponse),
  );
  return {
    pageWidgetId: normalizedResponse.result,
    currentPageName: pageResponse.data.name,
    currentPageId: pageResponse.data.id,
    widgets: normalizedResponse.entities.canvasWidgets,
    currentLayoutId: pageResponse.data.layouts[0].id, // TODO(abhinav): Handle for multiple layouts
    currentApplicationId: pageResponse.data.applicationId,
    pageActions: pageResponse.data.layouts[0].layoutOnLoadActions || [],
    layoutOnLoadActionErrors:
      pageResponse.data.layouts[0].layoutOnLoadActionErrors || [],
  };
};

export function* handleFetchedPage({
  fetchPageResponse,
  isFirstLoad = false,
  pageId,
}: {
  fetchPageResponse: FetchPageResponse;
  pageId: string;
  isFirstLoad?: boolean;
}) {
  const isValidResponse: boolean = yield validateResponse(fetchPageResponse);
  const willPageBeMigrated = checkIfMigrationIsNeeded(fetchPageResponse);
  const lastUpdatedTime = getLastUpdateTime(fetchPageResponse);
  const pageSlug = fetchPageResponse.data.slug;
  const pagePermissions = fetchPageResponse.data.userPermissions;

  if (isValidResponse) {
    // Clear any existing caches
    yield call(clearEvalCache);
    // Set url params
    yield call(setDataUrl);
    // Get Canvas payload
    const canvasWidgetsPayload = getCanvasWidgetsPayload(fetchPageResponse);
    // Update the canvas
    yield put(initCanvasLayout(canvasWidgetsPayload));
    // set current page
    yield put(updateCurrentPage(pageId, pageSlug, pagePermissions));
    // dispatch fetch page success
    yield put(fetchPageSuccess());
    // restore selected widgets while loading the page.
    yield call(restoreSelectedWidgetContext);

    /* Currently, All Actions are fetched in initSagas and on pageSwitch we only fetch page
     */
    // Hence, if is not isFirstLoad then trigger evaluation with execute pageLoad action
    if (!isFirstLoad) {
      yield put(fetchAllPageEntityCompletion([executePageLoadActions()]));
    }

    // Sets last updated time
    yield put(setLastUpdatedTime(lastUpdatedTime));
    const extractedDSL = extractCurrentDSL(fetchPageResponse);
    yield put({
      type: ReduxActionTypes.UPDATE_CANVAS_STRUCTURE,
      payload: extractedDSL,
    });

    // Since new page has new layout, we need to generate a data structure
    // to compute dynamic height based on the new layout.
    yield put(generateAutoHeightLayoutTreeAction(true, true));

    if (willPageBeMigrated) {
      yield put(saveLayout());
    }
  }
}
const getLastUpdateTime = (pageResponse: FetchPageResponse): number =>
  pageResponse.data.lastUpdatedTime;

export function* fetchPageSaga(
  pageRequestAction: ReduxAction<FetchPageRequest>,
) {
  try {
    const { id, isFirstLoad } = pageRequestAction.payload;
    PerformanceTracker.startAsyncTracking(
      PerformanceTransactionName.FETCH_PAGE_API,
      { pageId: id },
    );
    const fetchPageResponse: FetchPageResponse = yield call(PageApi.fetchPage, {
      id,
    });

    yield handleFetchedPage({
      fetchPageResponse,
      pageId: id,
      isFirstLoad,
    });

    PerformanceTracker.stopAsyncTracking(
      PerformanceTransactionName.FETCH_PAGE_API,
    );
  } catch (error) {
    log.error(error);
    PerformanceTracker.stopAsyncTracking(
      PerformanceTransactionName.FETCH_PAGE_API,
      {
        failed: true,
      },
    );
    yield put({
      type: ReduxActionErrorTypes.FETCH_PAGE_ERROR,
      payload: {
        error,
      },
    });
  }
}

export function* fetchPublishedPageSaga(
  pageRequestAction: ReduxAction<{
    pageId: string;
    bustCache: boolean;
    firstLoad: boolean;
  }>,
) {
  try {
    const { bustCache, firstLoad, pageId } = pageRequestAction.payload;
    PerformanceTracker.startAsyncTracking(
      PerformanceTransactionName.FETCH_PAGE_API,
      {
        pageId: pageId,
        published: true,
      },
    );
    const request: FetchPublishedPageRequest = {
      pageId,
      bustCache,
    };
    const response: FetchPageResponse = yield call(
      PageApi.fetchPublishedPage,
      request,
    );
    const isValidResponse: boolean = yield validateResponse(response);
    if (isValidResponse) {
      // Clear any existing caches
      yield call(clearEvalCache);
      // Set url params
      yield call(setDataUrl);
      // Get Canvas payload
      const canvasWidgetsPayload = getCanvasWidgetsPayload(response);
      // resize main canvas
      resizePublishedMainCanvasToLowestWidget(canvasWidgetsPayload.widgets);
      // Update the canvas
      yield put(initCanvasLayout(canvasWidgetsPayload));
      // set current page
      yield put(updateCurrentPage(pageId, response.data.slug));

      // dispatch fetch page success
      yield put(fetchPublishedPageSuccess());

      // Since new page has new layout, we need to generate a data structure
      // to compute dynamic height based on the new layout.
      yield put(generateAutoHeightLayoutTreeAction(true, true));

      /* Currently, All Actions are fetched in initSagas and on pageSwitch we only fetch page
       */
      // Hence, if is not isFirstLoad then trigger evaluation with execute pageLoad action
      if (!firstLoad) {
        yield put(fetchAllPageEntityCompletion([executePageLoadActions()]));
      }

      PerformanceTracker.stopAsyncTracking(
        PerformanceTransactionName.FETCH_PAGE_API,
      );
    }
  } catch (error) {
    PerformanceTracker.stopAsyncTracking(
      PerformanceTransactionName.FETCH_PAGE_API,
      {
        failed: true,
      },
    );
    yield put({
      type: ReduxActionErrorTypes.FETCH_PUBLISHED_PAGE_ERROR,
      payload: {
        error,
      },
    });
  }
}

export function* fetchAllPublishedPagesSaga() {
  try {
    const pageIds: string[] = yield select(getAllPageIds);
    yield all(
      pageIds.map((pageId: string) => {
        return call(PageApi.fetchPublishedPage, { pageId, bustCache: true });
      }),
    );
  } catch (error) {
    log.error({ error });
  }
}

function* savePageSaga(action: ReduxAction<{ isRetry?: boolean }>) {
  const widgets: CanvasWidgetsReduxState = yield select(getWidgets);
  const editorConfigs:
    | {
        applicationId: string;
        pageId: string;
        layoutId: string;
      }
    | undefined = yield select(getEditorConfigs) as any;
  const guidedTourEnabled: boolean = yield select(inGuidedTour);
  const savePageRequest: SavePageRequest = getLayoutSavePayload(
    widgets,
    editorConfigs,
  );
  PerformanceTracker.startAsyncTracking(
    PerformanceTransactionName.SAVE_PAGE_API,
    {
      pageId: savePageRequest.pageId,
    },
  );
  try {
    // Store the updated DSL in the pageDSLs reducer
    yield put({
      type: ReduxActionTypes.FETCH_PAGE_DSL_SUCCESS,
      payload: {
        pageId: savePageRequest.pageId,
        dsl: savePageRequest.dsl,
      },
    });

    yield put({
      type: ReduxActionTypes.UPDATE_CANVAS_STRUCTURE,
      payload: savePageRequest.dsl,
    });

    captureInvalidDynamicBindingPath(
      CanvasWidgetsNormalizer.denormalize("0", {
        canvasWidgets: widgets,
      }),
    );

    const savePageResponse: SavePageResponse = yield call(
      PageApi.savePage,
      savePageRequest,
    );
    const isValidResponse: boolean = yield validateResponse(savePageResponse);
    if (isValidResponse) {
      const { actionUpdates, messages } = savePageResponse.data;
      // We do not want to show these toasts in guided tour
      // Show toast messages from the server
      if (messages && messages.length && !guidedTourEnabled) {
        savePageResponse.data.messages.forEach((message) => {
          Toaster.show({
            text: message,
            type: Variant.info,
          });
        });
      }
      // Update actions
      if (actionUpdates && actionUpdates.length > 0) {
        const actions = actionUpdates.filter(
          (d) => !d.hasOwnProperty("collectionId"),
        );
        if (actions && actions.length) {
          yield put(setActionsToExecuteOnPageLoad(actions));
        }
        const jsActions = actionUpdates.filter((d) =>
          d.hasOwnProperty("collectionId"),
        );
        if (jsActions && jsActions.length) {
          yield put(setJSActionsToExecuteOnPageLoad(jsActions));
        }
      }
      yield put(setLastUpdatedTime(Date.now() / 1000));
      yield put(savePageSuccess(savePageResponse));
      PerformanceTracker.stopAsyncTracking(
        PerformanceTransactionName.SAVE_PAGE_API,
      );
      checkAndLogErrorsIfCyclicDependency(
        (savePageResponse.data as SavePageResponseData)
          .layoutOnLoadActionErrors,
      );
    }
  } catch (error) {
    PerformanceTracker.stopAsyncTracking(
      PerformanceTransactionName.SAVE_PAGE_API,
      {
        failed: true,
      },
    );

    yield put({
      type: ReduxActionErrorTypes.SAVE_PAGE_ERROR,
      payload: {
        error,
        show: false,
      },
    });

    if (error instanceof IncorrectBindingError) {
      const { isRetry } = action?.payload;
      const incorrectBindingError = JSON.parse(error.message);
      const { message } = incorrectBindingError;
      if (isRetry) {
        Sentry.captureException(new Error("Failed to correct binding paths"));
        yield put({
          type: ReduxActionErrorTypes.FAILED_CORRECTING_BINDING_PATHS,
          payload: {
            error: {
              message,
              code: ERROR_CODES.FAILED_TO_CORRECT_BINDING,
              crash: true,
            },
          },
        });
      } else {
        // Create a denormalized structure because the migration needs the children in the dsl form
        const denormalizedWidgets = CanvasWidgetsNormalizer.denormalize("0", {
          canvasWidgets: widgets,
        });
        const correctedWidgets = migrateIncorrectDynamicBindingPathLists(
          denormalizedWidgets,
        );
        // Normalize the widgets because the save page needs it in the flat structure
        const normalizedWidgets = CanvasWidgetsNormalizer.normalize(
          correctedWidgets,
        );
        AnalyticsUtil.logEvent("CORRECT_BAD_BINDING", {
          error: error.message,
          correctWidget: JSON.stringify(normalizedWidgets),
        });
        yield put(
          updateAndSaveLayout(normalizedWidgets.entities.canvasWidgets, {
            isRetry: true,
          }),
        );
      }
    }
  }
}

function getLayoutSavePayload(
  widgets: {
    [widgetId: string]: FlattenedWidgetProps;
  },
  editorConfigs: any,
) {
  const denormalizedDSL = CanvasWidgetsNormalizer.denormalize(
    Object.keys(widgets)[0],
    { canvasWidgets: widgets },
  );
  return {
    ...editorConfigs,
    dsl: denormalizedDSL,
  };
}

export function* saveLayoutSaga(action: ReduxAction<{ isRetry?: boolean }>) {
  try {
    const currentPageId: string = yield select(getCurrentPageId);
    const currentPage: Page = yield select(getPageById(currentPageId));

    if (!hasManagePagePermission(currentPage?.userPermissions || [])) {
      yield validateResponse({
        status: 403,
        resourceType: "Page",
        resourceId: currentPage.pageId,
      });
    }

    const appMode: APP_MODE | undefined = yield select(getAppMode);
    if (appMode === APP_MODE.EDIT) {
      yield put(saveLayout(action.payload.isRetry));
    }
  } catch (error) {
    yield put({
      type: ReduxActionErrorTypes.SAVE_PAGE_ERROR,
      payload: {
        error,
      },
    });
  }
}

export function* createPageSaga(
  createPageAction: ReduxAction<CreatePageActionPayload>,
) {
  try {
    const guidedTourEnabled: boolean = yield select(inGuidedTour);
    // Prevent user from creating a new page during the guided tour
    if (guidedTourEnabled) {
      yield put(toggleShowDeviationDialog(true));
      return;
    }
    const request: CreatePageRequest = createPageAction.payload;
    const response: FetchPageResponse = yield call(PageApi.createPage, request);
    const isValidResponse: boolean = yield validateResponse(response);
    const isMobile: boolean = yield select(isMobileLayout);
    if (isValidResponse) {
      yield put({
        type: ReduxActionTypes.CREATE_PAGE_SUCCESS,
        payload: {
          pageId: response.data.id,
          pageName: response.data.name,
          layoutId: response.data.layouts[0].id,
          slug: response.data.slug,
          customSlug: response.data.customSlug,
          userPermissions: response.data.userPermissions,
        },
      });
      // Add this to the page DSLs for entity explorer
      yield put({
        type: ReduxActionTypes.FETCH_PAGE_DSL_SUCCESS,
        payload: {
          pageId: response.data.id,
          dsl: extractCurrentDSL(response),
        },
      });
      // TODO: Update URL params here
      // route to generate template for new page created
      if (!createPageAction.payload.blockNavigation) {
        history.push(
          builderURL({
            pageId: response.data.id,
          }),
        );
      }
    }
  } catch (error) {
    yield put({
      type: ReduxActionErrorTypes.CREATE_PAGE_ERROR,
      payload: {
        error,
      },
    });
  }
}

export function* updatePageSaga(action: ReduxAction<UpdatePageRequest>) {
  try {
    const request: UpdatePageRequest = action.payload;
    // to be done in backend
    request.customSlug = request.customSlug?.replaceAll(" ", "-");

    const response: ApiResponse<UpdatePageResponse> = yield call(
      PageApi.updatePage,
      request,
    );
    const isValidResponse: boolean = yield validateResponse(response);
    if (isValidResponse) {
      yield put(updatePageSuccess(response.data));
    }
  } catch (error) {
    yield put(
      updatePageError({
        request: action.payload,
        error,
      }),
    );
  }
}

export function* deletePageSaga(action: ReduxAction<DeletePageRequest>) {
  try {
    const request: DeletePageRequest = action.payload;
    const defaultPageId: string = yield select(
      (state: AppState) => state.entities.pageList.defaultPageId,
    );
    if (defaultPageId === request.id) {
      throw Error("Cannot delete the home page.");
    } else {
      const response: ApiResponse = yield call(PageApi.deletePage, request);
      const isValidResponse: boolean = yield validateResponse(response);
      if (isValidResponse) {
        yield put(deletePageSuccess());
      }
      // Remove this page from page DSLs
      yield put({
        type: ReduxActionTypes.FETCH_PAGE_DSL_SUCCESS,
        payload: {
          pageId: request.id,
          dsl: undefined,
        },
      });
      // Update route params here
      const currentPageId: string = yield select(
        (state: AppState) => state.entities.pageList.currentPageId,
      );
      if (currentPageId === action.payload.id)
        history.push(
          builderURL({
            pageId: defaultPageId,
          }),
        );
    }
  } catch (error) {
    yield put({
      type: ReduxActionErrorTypes.DELETE_PAGE_ERROR,
      payload: {
        error: { message: (error as Error).message, show: true },
        show: true,
      },
    });
  }
}

export function* clonePageSaga(
  clonePageAction: ReduxAction<ClonePageActionPayload>,
) {
  try {
    const request: ClonePageRequest = clonePageAction.payload;
    const response: FetchPageResponse = yield call(PageApi.clonePage, request);
    const isValidResponse: boolean = yield validateResponse(response);
    if (isValidResponse) {
      yield put(
        clonePageSuccess(
          response.data.id,
          response.data.name,
          response.data.layouts[0].id,
          response.data.slug,
        ),
      );
      // Add this to the page DSLs for entity explorer
      yield put({
        type: ReduxActionTypes.FETCH_PAGE_DSL_SUCCESS,
        payload: {
          pageId: response.data.id,
          dsl: extractCurrentDSL(response),
        },
      });

      yield put(fetchActionsForPage(response.data.id));
      yield put(fetchJSCollectionsForPage(response.data.id));
      yield put(selectMultipleWidgetsAction([]));

      // TODO: Update URL params here.

      if (!clonePageAction.payload.blockNavigation) {
        history.push(
          builderURL({
            pageId: response.data.id,
          }),
        );
      }
    }
  } catch (error) {
    yield put({
      type: ReduxActionErrorTypes.CLONE_PAGE_ERROR,
      payload: {
        error,
      },
    });
  }
}

/**
 * this saga do two things
 *
 * 1. Checks if the name of page is conflicting with any used name
 * 2. dispatches a action which triggers a request to update the name
 *
 * @param action
 */
export function* updateWidgetNameSaga(
  action: ReduxAction<{ id: string; newName: string }>,
) {
  try {
    const { widgetName } = yield select(getWidgetName, action.payload.id);
    const layoutId: string | undefined = yield select(getCurrentLayoutId);
    const evalTree: DataTree = yield select(getDataTree);
    const pageId: string | undefined = yield select(getCurrentPageId);
    const existingPageNames: Record<string, unknown> = yield select(
      getExistingPageNames,
    );

    // TODO(abhinav): Why do we need to jump through these hoops just to
    // change the tab name? Figure out a better design to make this moot.
    const tabsObj: Record<
      string,
      {
        id: string;
        widgetId: string;
        label: string;
      }
    > = yield select((state: AppState) => {
      // Check if this widget exists in the canvas widgets
      if (state.entities.canvasWidgets.hasOwnProperty(action.payload.id)) {
        // If it does assign it to a variable
        const widget = state.entities.canvasWidgets[action.payload.id];
        // Check if this widget has a parent in the canvas widgets
        if (
          widget.parentId &&
          state.entities.canvasWidgets.hasOwnProperty(widget.parentId)
        ) {
          // If the parent exists assign it to a variable
          const parent = state.entities.canvasWidgets[widget.parentId];
          // Check if this parent is a TABS_WIDGET
          if (parent.type === WidgetTypes.TABS_WIDGET) {
            // If it is return the tabs property
            return parent.tabsObj;
          }
        }
      }
      // This isn't a tab in a tabs widget so return undefined
      return;
    });

    // If we're trying to update the name of a tab in the TABS_WIDGET
    if (tabsObj !== undefined) {
      const tabs: any = Object.values(tabsObj);
      // Get all canvas widgets
      const stateWidgets: CanvasWidgetsReduxState = yield select(getWidgets);
      // Shallow copy canvas widgets as they're immutable
      const widgets = { ...stateWidgets };
      // Get the parent Id of the tab (canvas widget) whose name we're updating
      const parentId = widgets[action.payload.id].parentId;
      // Update the tabName property of the tab (canvas widget)
      widgets[action.payload.id] = {
        ...widgets[action.payload.id],
        tabName: action.payload.newName,
      };
      // Shallow copy the parent widget so that we can update the properties
      // @ts-expect-error parentId can be undefined
      const parent = { ...widgets[parentId] };
      // Update the tabs property of the parent tabs widget
      const tabToChange = tabs.find(
        (each: any) => each.widgetId === action.payload.id,
      );
      const updatedTab = {
        ...tabToChange,
        label: action.payload.newName,
      };
      parent.tabsObj = {
        ...parent.tabsObj,
        [updatedTab.id]: {
          ...updatedTab,
        },
      };
      // replace the parent widget in the canvas widgets
      // @ts-expect-error parentId can be undefined
      widgets[parentId] = parent;
      // Update and save the new widgets
      //TODO Identify the updated widgets and pass the values
      yield put(updateAndSaveLayout(widgets));
      // Send a update saying that we've successfully updated the name
      yield put(updateWidgetNameSuccess());
    } else {
      // check if name is not conflicting with any
      // existing entity/api/queries/reserved words
      if (
        isNameValid(action.payload.newName, {
          ...evalTree,
          ...existingPageNames,
        })
      ) {
        const request: UpdateWidgetNameRequest = {
          newName: action.payload.newName,
          oldName: widgetName,
          // @ts-expect-error: pageId can be undefined
          pageId,
          // @ts-expect-error: layoutId can be undefined
          layoutId,
        };
        const response: UpdateWidgetNameResponse = yield call(
          PageApi.updateWidgetName,
          request,
        );
        const isValidResponse: boolean = yield validateResponse(response);
        if (isValidResponse) {
          // @ts-expect-error: pageId can be undefined
          yield updateCanvasWithDSL(response.data, pageId, layoutId);
          yield put(updateWidgetNameSuccess());
          // Add this to the page DSLs for entity explorer
          yield put({
            type: ReduxActionTypes.FETCH_PAGE_DSL_SUCCESS,
            payload: {
              pageId: pageId,
              dsl: response.data.dsl,
            },
          });
          checkAndLogErrorsIfCyclicDependency(
            (response.data as PageLayout).layoutOnLoadActionErrors,
          );
        }
      } else {
        yield put({
          type: ReduxActionErrorTypes.UPDATE_WIDGET_NAME_ERROR,
          payload: {
            error: {
              message: `Entity name: ${action.payload.newName} is already being used or is a restricted keyword.`,
            },
          },
        });
      }
    }
  } catch (error) {
    yield put({
      type: ReduxActionErrorTypes.UPDATE_WIDGET_NAME_ERROR,
      payload: {
        error,
      },
    });
  }
}

export function* updateCanvasWithDSL(
  data: PageLayout,
  pageId: string,
  layoutId: string,
) {
  const normalizedWidgets = CanvasWidgetsNormalizer.normalize(data.dsl);
  const currentPageName: string = yield select(getCurrentPageName);

  const applicationId: string = yield select(getCurrentApplicationId);
  const canvasWidgetsPayload: UpdateCanvasPayload = {
    pageWidgetId: normalizedWidgets.result,
    currentPageName,
    currentPageId: pageId,
    currentLayoutId: layoutId,
    currentApplicationId: applicationId,
    pageActions: data.layoutOnLoadActions,
    widgets: normalizedWidgets.entities.canvasWidgets,
  };
  yield put(initCanvasLayout(canvasWidgetsPayload));
  yield put(fetchActionsForPage(pageId));
  yield put(fetchJSCollectionsForPage(pageId));
}

export function* setDataUrl() {
  const urlData: UrlDataState = {
    fullPath: window.location.href,
    host: window.location.host,
    hostname: window.location.hostname,
    queryParams: getQueryParams(),
    protocol: window.location.protocol,
    pathname: window.location.pathname,
    port: window.location.port,
    hash: window.location.hash,
  };
  yield put(setUrlData(urlData));
}

function* fetchPageDSLSaga(pageId: string) {
  try {
    const fetchPageResponse: FetchPageResponse = yield call(PageApi.fetchPage, {
      id: pageId,
    });
    const isValidResponse: boolean = yield validateResponse(fetchPageResponse);
    if (isValidResponse) {
      return {
        pageId: pageId,
        dsl: extractCurrentDSL(fetchPageResponse),
        userPermissions: fetchPageResponse.data?.userPermissions,
      };
    }
  } catch (error) {
    yield put({
      type: ReduxActionErrorTypes.FETCH_PAGE_DSL_ERROR,
      payload: {
        pageId: pageId,
        error,
        show: true,
      },
    });
    return {
      pageId: pageId,
      dsl: DEFAULT_TEMPLATE,
    };
  }
}

export function* populatePageDSLsSaga() {
  try {
    const pageIds: string[] = yield select((state: AppState) =>
      state.entities.pageList.pages.map((page: Page) => page.pageId),
    );
    const pageDSLs: unknown = yield all(
      pageIds.map((pageId: string) => {
        return call(fetchPageDSLSaga, pageId);
      }),
    );
    yield put({
      type: ReduxActionTypes.FETCH_PAGE_DSLS_SUCCESS,
      payload: pageDSLs,
    });
    yield put({
      type: ReduxActionTypes.UPDATE_PAGE_LIST,
      payload: pageDSLs,
    });
  } catch (error) {
    yield put({
      type: ReduxActionErrorTypes.POPULATE_PAGEDSLS_ERROR,
      payload: {
        error,
      },
    });
  }
}

/**
 * saga to update the page order
 *
 * @param action
 */
export function* setPageOrderSaga(action: ReduxAction<SetPageOrderRequest>) {
  try {
    const request: SetPageOrderRequest = action.payload;
    const response: ApiResponse = yield call(PageApi.setPageOrder, request);
    const isValidResponse: boolean = yield validateResponse(response);
    if (isValidResponse) {
      yield put({
        type: ReduxActionTypes.SET_PAGE_ORDER_SUCCESS,
        payload: {
          // @ts-expect-error: response.data is of type unknown
          pages: response.data.pages,
        },
      });
    }
  } catch (error) {
    yield put({
      type: ReduxActionErrorTypes.SET_PAGE_ORDER_ERROR,
      payload: {
        error,
      },
    });
  }
}

export function* generateTemplatePageSaga(
  action: ReduxAction<GenerateTemplatePageRequest>,
) {
  try {
    const request: GenerateTemplatePageRequest = action.payload;
    // if pageId is available in request, it will just update that page else it will generate new page.
    const response: ApiResponse<{
      page: any;
      successImageUrl: string;
      successMessage: string;
    }> = yield call(PageApi.generateTemplatePage, request);

    const isValidResponse: boolean = yield validateResponse(response);
    if (isValidResponse) {
      const pageId = response.data.page.id;

      yield put(
        generateTemplateSuccess({
          page: response.data.page,
          isNewPage: !request.pageId,
          // if pageId if not defined, that means a new page is generated.
        }),
      );

      yield handleFetchedPage({
        fetchPageResponse: {
          data: response.data.page,
          responseMeta: response.responseMeta,
        },
        pageId,
        isFirstLoad: true,
      });

      // trigger evaluation after completion of page success & fetch actions for page + fetch jsobject for page

      const triggersAfterPageFetch = [
        fetchActionsForPage(pageId),
        fetchJSCollectionsForPage(pageId),
      ];

      const afterActionsFetch: unknown = yield failFastApiCalls(
        triggersAfterPageFetch,
        [
          fetchActionsForPageSuccess([]).type,
          fetchJSCollectionsForPageSuccess([]).type,
        ],
        [
          fetchActionsForPageError().type,
          fetchJSCollectionsForPageError().type,
        ],
      );

      if (!afterActionsFetch) {
        throw new Error("Failed generating template");
      }
      yield put(fetchAllPageEntityCompletion([executePageLoadActions()]));

      history.replace(
        builderURL({
          pageId,
        }),
      );
      // TODO : Add it to onSuccessCallback
      Toaster.show({
        text: "页面创建成功！",
        variant: Variant.success,
      });

      yield put(
        setCrudInfoModalData({
          open: true,
          generateCRUDSuccessInfo: {
            successImageUrl: response.data.successImageUrl,
            successMessage: response.data.successMessage,
          },
        }),
      );
    }
  } catch (error) {
    yield put(generateTemplateError());
  }
}

function* restoreSelectedWidgetContext() {
  const selectedWidgets: string[] = yield select(getSelectedWidgets);
  if (!selectedWidgets.length) return;

  if (selectedWidgets.length === 1) {
    yield put(selectWidgetInitAction(selectedWidgets[0]));
  }

  quickScrollToWidget(selectedWidgets[0]);
}

function* deleteCanvasCardsStateSaga() {
  const currentPageId: string = yield select(getCurrentPageId);
  const state = JSON.parse(
    localStorage.getItem(LOCAL_STORAGE_KEYS.CANVAS_CARDS_STATE) ?? "{}",
  );
  delete state[currentPageId];
  localStorage.setItem(
    LOCAL_STORAGE_KEYS.CANVAS_CARDS_STATE,
    JSON.stringify(state),
  );
}

function* setCanvasCardsStateSaga(action: ReduxAction<string>) {
  const state = localStorage.getItem(LOCAL_STORAGE_KEYS.CANVAS_CARDS_STATE);
  const stateObject = JSON.parse(state ?? "{}");
  stateObject[action.payload] = true;
  localStorage.setItem(
    LOCAL_STORAGE_KEYS.CANVAS_CARDS_STATE,
    JSON.stringify(stateObject),
  );
}

export default function* pageSagas() {
  yield all([
    takeLatest(ReduxActionTypes.FETCH_PAGE_INIT, fetchPageSaga),
    takeLatest(
      ReduxActionTypes.FETCH_PUBLISHED_PAGE_INIT,
      fetchPublishedPageSaga,
    ),
    takeLatest(ReduxActionTypes.UPDATE_LAYOUT, saveLayoutSaga),
    takeLeading(ReduxActionTypes.CREATE_PAGE_INIT, createPageSaga),
    takeLeading(ReduxActionTypes.CLONE_PAGE_INIT, clonePageSaga),
    takeLatest(ReduxActionTypes.UPDATE_PAGE_INIT, updatePageSaga),
    takeLatest(ReduxActionTypes.DELETE_PAGE_INIT, deletePageSaga),
    debounce(500, ReduxActionTypes.SAVE_PAGE_INIT, savePageSaga),
    takeLatest(ReduxActionTypes.UPDATE_WIDGET_NAME_INIT, updateWidgetNameSaga),
    takeLatest(
      ReduxActionTypes.FETCH_ALL_PUBLISHED_PAGES,
      fetchAllPublishedPagesSaga,
    ),
    takeLatest(
      ReduxActionTypes.GENERATE_TEMPLATE_PAGE_INIT,
      generateTemplatePageSaga,
    ),
    takeLatest(ReduxActionTypes.SET_PAGE_ORDER_INIT, setPageOrderSaga),
    takeLatest(ReduxActionTypes.POPULATE_PAGEDSLS_INIT, populatePageDSLsSaga),
    takeEvery(ReduxActionTypes.SET_CANVAS_CARDS_STATE, setCanvasCardsStateSaga),
    takeEvery(
      ReduxActionTypes.DELETE_CANVAS_CARDS_STATE,
      deleteCanvasCardsStateSaga,
    ),
  ]);
}
