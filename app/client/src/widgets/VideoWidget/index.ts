import IconSVG from "./icon.svg";
import Widget from "./widget";

export const CONFIG = {
  type: Widget.getWidgetType(),
  name: "视频",
  iconSVG: IconSVG,
  needsMeta: true,
  searchTags: ["youtube", "video"],
  defaults: {
    rows: 28,
    columns: 24,
    widgetName: "Video",
    url: "https://assets.appsmith.com/widgets/bird.mp4",
    autoPlay: false,
    version: 1,
    animateLoading: true,
    backgroundColor: "#000",
  },
  properties: {
    derived: Widget.getDerivedPropertiesMap(),
    default: Widget.getDefaultPropertiesMap(),
    meta: Widget.getMetaPropertiesMap(),
    config: Widget.getPropertyPaneConfig(),
    contentConfig: Widget.getPropertyPaneContentConfig(),
    styleConfig: Widget.getPropertyPaneStyleConfig(),
    stylesheetConfig: Widget.getStylesheetConfig(),
  },
};

export default Widget;
