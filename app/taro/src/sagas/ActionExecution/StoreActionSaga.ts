import { put, select, take } from "redux-saga/effects";
import { getAppStoreName } from "constants/AppConstants";
import {
  updateAppPersistentStore,
  updateAppTransientStore,
} from "actions/pageActions";
import AppsmithConsole from "utils/AppsmithConsole";
import { getAppStoreData } from "selectors/entitiesSelector";
import { StoreValueActionDescription } from "entities/DataTree/actionTriggers";
import { getCurrentGitBranch } from "selectors/gitSyncSelectors";
import { getCurrentApplicationId } from "selectors/editorSelectors";
import { ReduxActionTypes } from "@appsmith/constants/ReduxActionConstants";
import Taro from "@tarojs/taro";

export default function* storeValueLocally(
  action: StoreValueActionDescription["payload"]
) {
  if (action.persist) {
    const applicationId = yield select(getCurrentApplicationId);
    const branch = yield select(getCurrentGitBranch);
    const appStoreName = getAppStoreName(applicationId, branch);
    const existingStore = Taro.getStorageSync(appStoreName) || "{}";
    const parsedStore = JSON.parse(existingStore);
    parsedStore[action.key] = action.value;
    const storeString = JSON.stringify(parsedStore);
    Taro.setStorageSync(appStoreName, storeString);
    yield put(updateAppPersistentStore(parsedStore));
    AppsmithConsole.info({
      text: `store('${action.key}', '${action.value}', true)`,
    });
  } else {
    const existingStore = yield select(getAppStoreData);
    const newTransientStore = {
      ...existingStore.transient,
      [action.key]: action.value,
    };
    yield put(updateAppTransientStore(newTransientStore));
    AppsmithConsole.info({
      text: `store('${action.key}', '${action.value}', false)`,
    });
  }
  yield take(ReduxActionTypes.UPDATE_APP_STORE_EVALUATED);
}
