import React from "react";
import BaseWidget, { WidgetProps, WidgetState } from "widgets/BaseWidget";
import { WidgetType } from "constants/WidgetConstants";
import MapComponent from "../component";

import { ValidationTypes } from "constants/WidgetValidation";
import { EventType } from "constants/AppsmithActionConstants/ActionConstants";
import { getAppsmithConfigs } from "@appsmith/configs";
import styled from "styled-components";
import { DEFAULT_CENTER } from "constants/WidgetConstants";
import { getBorderCSSShorthand } from "constants/DefaultTheme";
import { MarkerProps } from "../constants";
import { DerivedPropertiesMap } from "utils/WidgetFactory";
import { EvaluationSubstitutionType } from "entities/DataTree/dataTreeFactory";
import { Stylesheet } from "entities/AppTheming";

const { google } = getAppsmithConfigs();

const DisabledContainer = styled.div<{
  borderRadius: string;
  boxShadow?: string;
}>`
  background-color: white;
  height: 100%;
  text-align: center;
  display: flex;
  flex-direction: column;
  border-radius: ${({ borderRadius }) => borderRadius};
  box-shadow: ${({ boxShadow }) => boxShadow} !important;
  border: ${(props) => getBorderCSSShorthand(props.theme.borders[2])};
  h1 {
    margin-top: 15%;
    margin-bottom: 10%;
    color: #7c7c7c;
  }
  p {
    color: #0a0b0e;
  }
`;

const DefaultCenter = { ...DEFAULT_CENTER, long: DEFAULT_CENTER.lng };

type Center = {
  lat: number;
  long: number;
  [x: string]: any;
};
class MapWidget extends BaseWidget<MapWidgetProps, WidgetState> {
  static getPropertyPaneContentConfig() {
    return [
      {
        sectionName: "数据",
        children: [
          {
            propertyName: "mapCenter",
            label: "初始位置",
            isJSConvertible: true,
            controlType: "LOCATION_SEARCH",
            isBindProperty: true,
            isTriggerProperty: false,
            validation: {
              type: ValidationTypes.OBJECT,
              params: {
                allowedKeys: [
                  {
                    name: "lat",
                    type: ValidationTypes.NUMBER,
                    params: {
                      min: -90,
                      max: 90,
                      default: 0,
                      required: true,
                    },
                  },
                  {
                    name: "long",
                    type: ValidationTypes.NUMBER,
                    params: {
                      min: -180,
                      max: 180,
                      default: 0,
                      required: true,
                    },
                  },
                ],
              },
            },
          },
          {
            propertyName: "defaultMarkers",
            label: "默认标记",
            controlType: "INPUT_TEXT",
            inputType: "ARRAY",
            helpText: "设置地图的默认标记",
            placeholderText: '[{ "lat": "val1", "long": "val2" }]',
            isBindProperty: true,
            isTriggerProperty: false,
            validation: {
              type: ValidationTypes.ARRAY,
              params: {
                children: {
                  type: ValidationTypes.OBJECT,
                  params: {
                    required: true,
                    allowedKeys: [
                      {
                        name: "lat",
                        type: ValidationTypes.NUMBER,
                        params: {
                          min: -90,
                          max: 90,
                          default: 0,
                          required: true,
                        },
                      },
                      {
                        name: "long",
                        type: ValidationTypes.NUMBER,
                        params: {
                          min: -180,
                          max: 180,
                          default: 0,
                          required: true,
                        },
                      },
                      {
                        name: "title",
                        type: ValidationTypes.TEXT,
                      },
                      {
                        name: "color",
                        type: ValidationTypes.TEXT,
                      },
                    ],
                  },
                },
              },
            },
            evaluationSubstitutionType:
              EvaluationSubstitutionType.SMART_SUBSTITUTE,
          },
        ],
      },
      {
        sectionName: "属性",
        children: [
          {
            propertyName: "zoomLevel",
            label: "缩放比例",
            controlType: "STEP",
            helpText: "设置地图默认缩放比例",
            stepType: "ZOOM_PERCENTAGE",
            isBindProperty: false,
            isTriggerProperty: false,
          },
          {
            propertyName: "isVisible",
            label: "是否显示",
            helpText: "控制组件的显示/隐藏",
            controlType: "SWITCH",
            isJSConvertible: true,
            isBindProperty: true,
            isTriggerProperty: false,
            validation: { type: ValidationTypes.BOOLEAN },
          },
          {
            propertyName: "animateLoading",
            label: "加载时显示动画",
            controlType: "SWITCH",
            helpText: "组件依赖的数据加载时显示加载动画",
            defaultValue: true,
            isJSConvertible: true,
            isBindProperty: true,
            isTriggerProperty: false,
            validation: { type: ValidationTypes.BOOLEAN },
          },
          {
            propertyName: "enablePickLocation",
            label: "允许选中位置",
            helpText: "允许用户选中位置",
            controlType: "SWITCH",
            isBindProperty: false,
            isTriggerProperty: false,
          },
          {
            propertyName: "isClickedMarkerCentered",
            label: "居中标记",
            helpText: "是否将选中的标记在地图上居中显示",
            controlType: "SWITCH",
            isBindProperty: false,
            isTriggerProperty: false,
          },
          {
            propertyName: "enableSearch",
            label: "允许搜索位置",
            helpText: "允许用户搜索位置",
            controlType: "SWITCH",
            isBindProperty: false,
            isTriggerProperty: false,
          },
        ],
      },
      {
        sectionName: "Create Marker",
        children: [
          {
            propertyName: "enableCreateMarker",
            label: "允许标记",
            helpText: "允许用户在地图上创建标记",
            controlType: "SWITCH",
            isBindProperty: false,
            isTriggerProperty: false,
          },
          {
            propertyName: "onCreateMarker",
            label: "onCreateMarker",
            helpText:
              "When create new marker is enabled, this event triggers upon successful marker creation",
            controlType: "ACTION_SELECTOR",
            isJSConvertible: true,
            isBindProperty: true,
            isTriggerProperty: true,
            hidden: (props: MapWidgetProps) => {
              return !props.enableCreateMarker;
            },
            dependencies: ["enableCreateMarker"],
          },
        ],
      },
      {
        sectionName: "事件",
        children: [
          {
            propertyName: "onMarkerClick",
            label: "onMarkerClick",
            helpText: "Triggers an action when the user clicks on the marker",
            controlType: "ACTION_SELECTOR",
            isJSConvertible: true,
            isBindProperty: true,
            isTriggerProperty: true,
          },
        ],
      },
    ];
  }

  static getPropertyPaneStyleConfig() {
    return [
      {
        sectionName: "轮廓样式",
        children: [
          {
            propertyName: "borderRadius",
            label: "边框圆角",
            helpText: "边框圆角样式",
            controlType: "BORDER_RADIUS_OPTIONS",

            isJSConvertible: true,
            isBindProperty: true,
            isTriggerProperty: false,
            validation: { type: ValidationTypes.TEXT },
          },
          {
            propertyName: "boxShadow",
            label: "阴影",
            helpText: "组件轮廓投影",
            controlType: "BOX_SHADOW_OPTIONS",
            isJSConvertible: true,
            isBindProperty: true,
            isTriggerProperty: false,
            validation: { type: ValidationTypes.TEXT },
          },
        ],
      },
    ];
  }
  static getDefaultPropertiesMap(): Record<string, any> {
    return {
      markers: "defaultMarkers",
      center: "mapCenter",
    };
  }

  static getMetaPropertiesMap(): Record<string, any> {
    return {
      center: undefined,
      markers: undefined,
      selectedMarker: undefined,
    };
  }
  static getDerivedPropertiesMap(): DerivedPropertiesMap {
    return {};
  }

  static getStylesheetConfig(): Stylesheet {
    return {
      borderRadius: "{{appsmith.theme.borderRadius.appBorderRadius}}",
      boxShadow: "{{appsmith.theme.boxShadow.appBoxShadow}}",
    };
  }

  updateCenter = (lat: number, long: number, title?: string) => {
    this.props.updateWidgetMetaProperty("center", { lat, long, title });
  };

  updateMarker = (lat: number, long: number, index: number) => {
    const markers: Array<MarkerProps> = [...(this.props.markers || [])].map(
      (marker, i) => {
        if (index === i) {
          marker = { lat, long };
        }
        return marker;
      },
    );
    this.disableDrag(false);
    this.props.updateWidgetMetaProperty("markers", markers);
  };

  onCreateMarker = (lat: number, long: number) => {
    this.disableDrag(true);
    const marker = { lat, long, title: "" };

    const markers = [];
    (this.props.markers || []).forEach((m) => {
      markers.push(m);
    });
    markers.push(marker);
    this.props.updateWidgetMetaProperty("markers", markers);
    this.props.updateWidgetMetaProperty("selectedMarker", marker, {
      triggerPropertyName: "onCreateMarker",
      dynamicString: this.props.onCreateMarker,
      event: {
        type: EventType.ON_CREATE_MARKER,
      },
    });
  };

  unselectMarker = () => {
    this.props.updateWidgetMetaProperty("selectedMarker", undefined);
  };

  onMarkerClick = (lat: number, long: number, title: string) => {
    this.disableDrag(true);
    const selectedMarker = {
      lat: lat,
      long: long,
      title: title,
    };
    this.props.updateWidgetMetaProperty("selectedMarker", selectedMarker, {
      triggerPropertyName: "onMarkerClick",
      dynamicString: this.props.onMarkerClick,
      event: {
        type: EventType.ON_MARKER_CLICK,
      },
    });
  };

  getCenter(): Center {
    return this.props.center || this.props.mapCenter || DefaultCenter;
  }

  componentDidUpdate(prevProps: MapWidgetProps) {
    //remove selectedMarker when map initial location is updated
    if (
      JSON.stringify(prevProps.center) !== JSON.stringify(this.props.center) &&
      this.props.selectedMarker
    ) {
      this.unselectMarker();
    }

    // If initial location was changed
    if (
      JSON.stringify(prevProps.mapCenter) !==
      JSON.stringify(this.props.mapCenter)
    ) {
      this.props.updateWidgetMetaProperty("center", this.props.mapCenter);
      return;
    }

    // If markers were changed
    if (
      this.props.markers &&
      this.props.markers.length > 0 &&
      JSON.stringify(prevProps.markers) !== JSON.stringify(this.props.markers)
    ) {
      this.props.updateWidgetMetaProperty(
        "center",
        this.props.markers[this.props.markers.length - 1],
      );
    }
  }

  enableDrag = () => {
    this.disableDrag(false);
  };

  getPageView() {
    return (
      <>
        {!google.enabled && (
          <DisabledContainer
            borderRadius={this.props.borderRadius}
            boxShadow={this.props.boxShadow}
          >
            <h1>{"Map Widget disabled"}</h1>
            <p>{"Map widget requires a Google Maps API Key"}</p>
            <p>
              {"See our"}
              <a
                href="https://docs.appsmith.com/v/v1.2.1/setup/docker/google-maps"
                rel="noopener noreferrer"
                target="_blank"
              >
                {" documentation "}
              </a>
              {"to configure API Keys"}
            </p>
          </DisabledContainer>
        )}
        {google.enabled && (
          <MapComponent
            allowZoom={this.props.allowZoom}
            apiKey={google.apiKey}
            borderRadius={this.props.borderRadius}
            boxShadow={this.props.boxShadow}
            center={this.getCenter()}
            clickedMarkerCentered={this.props.isClickedMarkerCentered}
            enableCreateMarker={this.props.enableCreateMarker}
            enableDrag={this.enableDrag}
            enablePickLocation={this.props.enablePickLocation}
            enableSearch={this.props.enableSearch}
            isDisabled={this.props.isDisabled}
            isVisible={this.props.isVisible}
            markers={this.props.markers}
            saveMarker={this.onCreateMarker}
            selectMarker={this.onMarkerClick}
            selectedMarker={this.props.selectedMarker}
            unselectMarker={this.unselectMarker}
            updateCenter={this.updateCenter}
            updateMarker={this.updateMarker}
            widgetId={this.props.widgetId}
            zoomLevel={this.props.zoomLevel}
          />
        )}
      </>
    );
  }

  static getWidgetType(): WidgetType {
    return "MAP_WIDGET";
  }
}

export interface MapWidgetProps extends WidgetProps {
  isDisabled?: boolean;
  isVisible?: boolean;
  enableSearch: boolean;
  zoomLevel: number;
  allowZoom: boolean;
  enablePickLocation: boolean;
  mapCenter: {
    lat: number;
    long: number;
    title?: string;
  };
  center?: {
    lat: number;
    long: number;
  };
  defaultMarkers?: Array<MarkerProps>;
  markers?: Array<MarkerProps>;
  selectedMarker?: {
    lat: number;
    long: number;
    title?: string;
    color?: string;
  };
  onMarkerClick?: string;
  onCreateMarker?: string;
  borderRadius: string;
  boxShadow?: string;
}

export default MapWidget;
