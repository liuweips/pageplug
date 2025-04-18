import { Colors } from "constants/Colors";
import IconSVG from "./icon.svg";
import Widget from "./widget";

export const CONFIG = {
  type: Widget.getWidgetType(),
  name: "分隔线",
  iconSVG: IconSVG,
  searchTags: ["line", "divider"],
  defaults: {
    rows: 4,
    columns: 20,
    widgetName: "Divider",
    orientation: "horizontal",
    capType: "nc",
    capSide: 0,
    strokeStyle: "solid",
    dividerColor: Colors.GRAY,
    thickness: 2,
    isVisible: true,
    version: 1,
    animateLoading: true,
  },
  properties: {
    derived: Widget.getDerivedPropertiesMap(),
    default: Widget.getDefaultPropertiesMap(),
    meta: Widget.getMetaPropertiesMap(),
    config: Widget.getPropertyPaneConfig(),
    contentConfig: Widget.getPropertyPaneContentConfig(),
    styleConfig: Widget.getPropertyPaneStyleConfig(),
  },
};

export default Widget;
