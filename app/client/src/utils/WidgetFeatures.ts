import { ReduxActionTypes } from "ce/constants/ReduxActionConstants";
import {
  PropertyPaneConfig,
  PropertyPaneControlConfig,
  PropertyPaneSectionConfig,
} from "constants/PropertyControlConstants";
import {
  GridDefaults,
  WidgetHeightLimits,
  WidgetType,
} from "constants/WidgetConstants";
import { klona } from "klona/lite";
import { WidgetProps } from "widgets/BaseWidget";
import { WidgetConfiguration } from "widgets/constants";

export enum RegisteredWidgetFeatures {
  DYNAMIC_HEIGHT = "dynamicHeight",
}

interface WidgetFeatureConfig {
  active: boolean;
  defaultValue?: DynamicHeight;
  sectionIndex: number;
}

export type WidgetFeatures = Record<
  RegisteredWidgetFeatures,
  WidgetFeatureConfig
>;

export enum DynamicHeight {
  AUTO_HEIGHT = "AUTO_HEIGHT",
  FIXED = "FIXED",
  AUTO_HEIGHT_WITH_LIMITS = "AUTO_HEIGHT_WITH_LIMITS",
}

/* This contains all properties which will be added
   to a widget, automatically, by the Appsmith platform
   Each feature, is a unique key, whose value is an object
   with the list of properties to be added to a widget along
   with their default values

   Note: These are added to the widget configs during registration
*/
export const WidgetFeatureProps: Record<
  RegisteredWidgetFeatures,
  Record<string, unknown>
> = {
  [RegisteredWidgetFeatures.DYNAMIC_HEIGHT]: {
    minDynamicHeight: WidgetHeightLimits.MIN_HEIGHT_IN_ROWS,
    maxDynamicHeight: WidgetHeightLimits.MAX_HEIGHT_IN_ROWS,
    dynamicHeight: DynamicHeight.FIXED,
  },
};

export const WidgetFeaturePropertyEnhancements: Record<
  RegisteredWidgetFeatures,
  (config: WidgetConfiguration) => Record<string, unknown>
> = {
  [RegisteredWidgetFeatures.DYNAMIC_HEIGHT]: (config: WidgetConfiguration) => {
    const newProperties: Partial<WidgetProps> = {};
    newProperties.dynamicHeight =
      config.features?.dynamicHeight?.defaultValue || DynamicHeight.AUTO_HEIGHT;
    if (config.isCanvas) {
      newProperties.dynamicHeight = DynamicHeight.AUTO_HEIGHT;
      newProperties.minDynamicHeight =
        config.defaults.minDynamicHeight ||
        WidgetHeightLimits.MIN_CANVAS_HEIGHT_IN_ROWS;
      newProperties.shouldScrollContents = true;
    }
    if (config.defaults.overflow) newProperties.overflow = "NONE";
    return newProperties;
  },
};

function findAndUpdatePropertyPaneControlConfig(
  config: PropertyPaneConfig[],
  propertyPaneUpdates: Record<string, Record<string, unknown>>,
): PropertyPaneConfig[] {
  return config.map((sectionConfig: PropertyPaneConfig) => {
    if (
      Array.isArray(sectionConfig.children) &&
      sectionConfig.children.length > 0
    ) {
      Object.keys(propertyPaneUpdates).forEach((propertyName: string) => {
        const controlConfigIndex:
          | number
          | undefined = sectionConfig.children?.findIndex(
          (controlConfig: PropertyPaneConfig) =>
            (controlConfig as PropertyPaneControlConfig).propertyName ===
            propertyName,
        );

        if (
          controlConfigIndex !== undefined &&
          controlConfigIndex > -1 &&
          sectionConfig.children
        ) {
          sectionConfig.children[controlConfigIndex] = {
            ...sectionConfig.children[controlConfigIndex],
            ...propertyPaneUpdates[propertyName],
          };
        }
      });
    }
    return sectionConfig;
  });
}

export const WidgetFeaturePropertyPaneEnhancements: Record<
  RegisteredWidgetFeatures,
  (
    config: PropertyPaneConfig[],
    widgetType?: WidgetType,
  ) => PropertyPaneConfig[]
> = {
  [RegisteredWidgetFeatures.DYNAMIC_HEIGHT]: (
    config: PropertyPaneConfig[],
    widgetType?: WidgetType,
  ) => {
    function hideWhenDynamicHeightIsEnabled(props: WidgetProps) {
      return (
        props.dynamicHeight === DynamicHeight.AUTO_HEIGHT_WITH_LIMITS ||
        props.dynamicHeight === DynamicHeight.AUTO_HEIGHT
      );
    }
    let update = findAndUpdatePropertyPaneControlConfig(config, {
      shouldScrollContents: {
        hidden: hideWhenDynamicHeightIsEnabled,
        dependencies: ["dynamicHeight"],
      },
      scrollContents: {
        hidden: hideWhenDynamicHeightIsEnabled,
        dependencies: ["dynamicHeight"],
      },
      fixedFooter: {
        hidden: hideWhenDynamicHeightIsEnabled,
        dependencies: ["dynamicHeight"],
      },
      overflow: {
        hidden: hideWhenDynamicHeightIsEnabled,
        dependencies: ["dynamicHeight"],
      },
    });
    if (widgetType === "MODAL_WIDGET") {
      update = findAndUpdatePropertyPaneControlConfig(update, {
        dynamicHeight: {
          options: [
            {
              label: "自动高度",
              value: DynamicHeight.AUTO_HEIGHT,
            },
            {
              label: "固定高度",
              value: DynamicHeight.FIXED,
            },
          ],
        },
      });
    }
    return update;
  },
};

/* Hide the min height and max height properties using this function
   as the `hidden` hook in the property pane configuration
   This function checks if the `dynamicHeight` property is enabled
   and returns true if disabled, and false if enabled.
*/
export function hideDynamicHeightPropertyControl(props: WidgetProps) {
  return props.dynamicHeight !== DynamicHeight.AUTO_HEIGHT_WITH_LIMITS;
}

// TODO (abhinav): ADD_UNIT_TESTS
function updateMinMaxDynamicHeight(
  props: WidgetProps,
  propertyName: string,
  propertyValue: unknown,
) {
  const updates = [
    {
      propertyPath: propertyName,
      propertyValue: propertyValue,
    },
  ];

  if (propertyValue === DynamicHeight.AUTO_HEIGHT_WITH_LIMITS) {
    const minDynamicHeight = parseInt(props.minDynamicHeight, 10);

    if (
      isNaN(minDynamicHeight) ||
      minDynamicHeight < WidgetHeightLimits.MIN_HEIGHT_IN_ROWS
    ) {
      updates.push({
        propertyPath: "minDynamicHeight",
        propertyValue: WidgetHeightLimits.MIN_HEIGHT_IN_ROWS,
      });
    }
    const maxDynamicHeight = parseInt(props.maxDynamicHeight, 10);
    if (
      isNaN(maxDynamicHeight) ||
      maxDynamicHeight === WidgetHeightLimits.MAX_HEIGHT_IN_ROWS ||
      maxDynamicHeight <= WidgetHeightLimits.MIN_HEIGHT_IN_ROWS
    ) {
      updates.push({
        propertyPath: "maxDynamicHeight",
        propertyValue:
          props.bottomRow - props.topRow + GridDefaults.CANVAS_EXTENSION_OFFSET,
      });
    }

    // Case where maxDynamicHeight is zero
    if (isNaN(maxDynamicHeight) || maxDynamicHeight === 0) {
      updates.push({
        propertyPath: "maxDynamicHeight",
        propertyValue: props.bottomRow - props.topRow,
      });
    }
  } else if (propertyValue === DynamicHeight.AUTO_HEIGHT) {
    const minHeightInRows = props.isCanvas
      ? WidgetHeightLimits.MIN_CANVAS_HEIGHT_IN_ROWS
      : WidgetHeightLimits.MIN_HEIGHT_IN_ROWS;
    updates.push(
      {
        propertyPath: "minDynamicHeight",
        propertyValue: minHeightInRows,
      },
      {
        propertyPath: "maxDynamicHeight",
        propertyValue: WidgetHeightLimits.MAX_HEIGHT_IN_ROWS,
      },
    );
  }

  if (propertyValue === DynamicHeight.FIXED) {
    updates.push({
      propertyPath: "originalBottomRow",
      propertyValue: undefined,
    });
    updates.push({
      propertyPath: "originalTopRow",
      propertyValue: undefined,
    });
  }

  // The following are updates which apply to specific widgets.
  if (
    propertyValue === DynamicHeight.AUTO_HEIGHT ||
    propertyValue === DynamicHeight.AUTO_HEIGHT_WITH_LIMITS
  ) {
    if (props.dynamicHeight === DynamicHeight.FIXED) {
      updates.push({
        propertyPath: "originalBottomRow",
        propertyValue: props.bottomRow,
      });
      updates.push({
        propertyPath: "originalTopRow",
        propertyValue: props.topRow,
      });
    }
    if (!props.shouldScrollContents) {
      updates.push({
        propertyPath: "shouldScrollContents",
        propertyValue: true,
      });
    }
    if (props.overflow !== undefined) {
      updates.push({
        propertyPath: "overflow",
        propertyValue: "NONE",
      });
    }
    if (props.scrollContents === true) {
      updates.push({
        propertyPath: "scrollContents",
        propertyValue: false,
      });
    }
    if (props.fixedFooter === true) {
      updates.push({
        propertyPath: "fixedFooter",
        propertyValue: false,
      });
    }
  }

  return updates;
}

// TODO FEATURE:(abhinav) Add validations to these properties

const CONTAINER_SCROLL_HELPER_TEXT =
  "组件在编辑时会显示内部滚动条，因为当你往组件添加子组件后，它需要自动调整大小。不过请放心，这个滚动条在页面发布后不会出现。";

export const PropertyPaneConfigTemplates: Record<
  RegisteredWidgetFeatures,
  PropertyPaneConfig[]
> = {
  [RegisteredWidgetFeatures.DYNAMIC_HEIGHT]: [
    {
      helpText: "自动高度：组件高度随着组件内容高度变化而变化",
      propertyName: "dynamicHeight",
      label: "高度",
      controlType: "DROP_DOWN",
      isBindProperty: false,
      isTriggerProperty: false,
      dependencies: [
        "shouldScrollContents",
        "maxDynamicHeight",
        "minDynamicHeight",
        "bottomRow",
        "topRow",
        "overflow",
        "dynamicHeight",
        "isCanvas",
      ],
      updateHook: updateMinMaxDynamicHeight,
      helperText: (props: WidgetProps) => {
        return props.isCanvas &&
          props.dynamicHeight === DynamicHeight.AUTO_HEIGHT
          ? CONTAINER_SCROLL_HELPER_TEXT
          : "";
      },
      options: [
        {
          label: "自动高度",
          value: DynamicHeight.AUTO_HEIGHT,
        },
        {
          label: "区间自动高度",
          value: DynamicHeight.AUTO_HEIGHT_WITH_LIMITS,
        },
        {
          label: "固定高度",
          value: DynamicHeight.FIXED,
        },
      ],
      postUpdateAction: ReduxActionTypes.CHECK_CONTAINERS_FOR_AUTO_HEIGHT,
    },
  ],
};

//TODO make this logic a lot cleaner
export function disableWidgetFeatures(
  widgetConfig: readonly PropertyPaneConfig[],
  disabledWidgetFeatures?: string[],
) {
  if (!disabledWidgetFeatures || disabledWidgetFeatures.length <= 0)
    return widgetConfig;

  const clonedConfig = klona(widgetConfig);
  const GeneralConfig = clonedConfig.find(
    (sectionConfig) =>
      (sectionConfig as PropertyPaneSectionConfig)?.sectionName === "属性",
  );

  for (let i = 0; i < (GeneralConfig?.children?.length || -1); i++) {
    const config = GeneralConfig?.children?.[i];
    if (
      disabledWidgetFeatures.indexOf(
        (config as PropertyPaneControlConfig)?.propertyName || "",
      ) > -1
    ) {
      GeneralConfig?.children?.splice(i, 1);
      i--;
    }
  }

  return clonedConfig;
}
