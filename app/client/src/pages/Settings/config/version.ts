import { Dispatch } from "react";
import {
  ReduxAction,
  ReduxActionTypes,
} from "@appsmith/constants/ReduxActionConstants";
import {
  AdminConfigType,
  SettingCategories,
  SettingTypes,
} from "@appsmith/pages/AdminSettings/config/types";

export const config: AdminConfigType = {
  icon: "timer-2-line",
  type: SettingCategories.VERSION,
  controlType: SettingTypes.GROUP,
  title: "版本",
  canSave: false,
  settings: [
    {
      id: "APPSMITH_CURRENT_VERSION",
      category: SettingCategories.VERSION,
      controlType: SettingTypes.TEXT,
      label: "当前版本",
    },
    {
      id: "APPSMITH_VERSION_READ_MORE",
      action: (dispatch?: Dispatch<ReduxAction<boolean>>) => {
        dispatch &&
          dispatch({
            type: ReduxActionTypes.TOGGLE_RELEASE_NOTES,
            payload: true,
          });
      },
      category: SettingCategories.VERSION,
      controlType: SettingTypes.LINK,
      label: "Appsmith 官方版本发布",
    },
  ],
};
