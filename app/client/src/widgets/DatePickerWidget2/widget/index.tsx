import React from "react";
import BaseWidget, { WidgetProps, WidgetState } from "widgets/BaseWidget";
import { WidgetType } from "constants/WidgetConstants";
import { EventType } from "constants/AppsmithActionConstants/ActionConstants";
import DatePickerComponent from "../component";

import { ValidationTypes } from "constants/WidgetValidation";
import { DerivedPropertiesMap } from "utils/WidgetFactory";
import { AutocompleteDataType } from "utils/autocomplete/TernServer";

import derivedProperties from "./parseDerivedProperties";
import { DatePickerType, TimePrecision } from "../constants";
import { DateFormatOptions } from "./constants";

function allowedRange(value: any) {
  const allowedValues = [0, 1, 2, 3, 4, 5, 6];
  const isValid = allowedValues.includes(Number(value));
  return {
    isValid: isValid,
    parsed: isValid ? Number(value) : 0,
    messages: isValid ? [] : ["Number should be between 0-6."],
  };
}
class DatePickerWidget extends BaseWidget<DatePickerWidget2Props, WidgetState> {
  static getPropertyPaneConfig() {
    return [
      {
        sectionName: "属性",
        children: [
          {
            propertyName: "defaultDate",
            label: "默认日期",
            controlType: "DATE_PICKER",
            placeholderText: "输入默认日期",
            useValidationMessage: true,
            isJSConvertible: true,
            isBindProperty: true,
            isTriggerProperty: false,
            validation: { type: ValidationTypes.DATE_ISO_STRING },
          },
          {
            propertyName: "dateFormat",
            label: "日期格式",
            controlType: "DROP_DOWN",
            isJSConvertible: true,
            optionWidth: "340px",
            options: DateFormatOptions,
            isBindProperty: true,
            isTriggerProperty: false,
            validation: { type: ValidationTypes.TEXT },
            hideSubText: true,
          },
          {
            propertyName: "timePrecision",
            label: "Time precision",
            controlType: "DROP_DOWN",
            helpText: "Sets the different time picker or hide.",
            defaultValue: TimePrecision.MINUTE,
            options: [
              {
                label: "None",
                value: TimePrecision.NONE,
              },
              {
                label: "Minute",
                value: TimePrecision.MINUTE,
              },
              {
                label: "Second",
                value: TimePrecision.SECOND,
              },
            ],
            isJSConvertible: true,
            isBindProperty: true,
            isTriggerProperty: false,
            validation: {
              type: ValidationTypes.TEXT,
              params: {
                allowedValues: [
                  TimePrecision.NONE,
                  TimePrecision.MINUTE,
                  TimePrecision.SECOND,
                ],
                default: TimePrecision.MINUTE,
              },
            },
          },
          {
            propertyName: "isRequired",
            label: "是否必须",
            controlType: "SWITCH",
            isJSConvertible: true,
            isBindProperty: true,
            isTriggerProperty: false,
            validation: { type: ValidationTypes.BOOLEAN },
          },
          {
            propertyName: "isVisible",
            label: "是否可见",
            controlType: "SWITCH",
            isJSConvertible: true,
            isBindProperty: true,
            isTriggerProperty: false,
            validation: { type: ValidationTypes.BOOLEAN },
          },
          {
            propertyName: "isDisabled",
            label: "是否禁用",
            controlType: "SWITCH",
            isJSConvertible: true,
            isBindProperty: true,
            isTriggerProperty: false,
            validation: { type: ValidationTypes.BOOLEAN },
          },
          {
            propertyName: "animateLoading",
            label: "Animate Loading",
            controlType: "SWITCH",
            helpText: "Controls the loading of the widget",
            defaultValue: true,
            isJSConvertible: true,
            isBindProperty: true,
            isTriggerProperty: false,
            validation: { type: ValidationTypes.BOOLEAN },
          },
          {
            propertyName: "closeOnSelection",
            label: "选中日期后关闭",
            controlType: "SWITCH",
            defaultValue: true,
            isJSConvertible: false,
            isBindProperty: true,
            isTriggerProperty: false,
            validation: { type: ValidationTypes.BOOLEAN },
          },
          {
            propertyName: "shortcuts",
            label: "显示快捷键",
            controlType: "SWITCH",
            isJSConvertible: false,
            isBindProperty: true,
            isTriggerProperty: false,
            validation: { type: ValidationTypes.BOOLEAN },
          },
          {
            propertyName: "minDate",
            label: "最小日期",
            controlType: "DATE_PICKER",
            useValidationMessage: true,
            isJSConvertible: true,
            isBindProperty: true,
            isTriggerProperty: false,
            validation: { type: ValidationTypes.DATE_ISO_STRING },
          },
          {
            propertyName: "maxDate",
            label: "最大日期",
            controlType: "DATE_PICKER",
            useValidationMessage: true,
            isJSConvertible: true,
            isBindProperty: true,
            isTriggerProperty: false,
            validation: { type: ValidationTypes.DATE_ISO_STRING },
          },
          {
            propertyName: "firstDayOfWeek",
            label: "First Day Of Week",
            helpText: "Defines the first day of the week for calendar",
            controlType: "INPUT_TEXT",
            defaultValue: "0",
            inputType: "INTEGER",
            isJSConvertible: true,
            isBindProperty: true,
            isTriggerProperty: false,
            validation: {
              type: ValidationTypes.FUNCTION,
              params: {
                fn: allowedRange,
                expected: {
                  type:
                    "0 : sunday\n1 : monday\n2 : tuesday\n3 : wednesday\n4 : thursday\n5 : friday\n6 : saturday",
                  example: "0",
                  autocompleteDataType: AutocompleteDataType.STRING,
                },
              },
            },
          },
        ],
      },
      {
        sectionName: "Events",
        children: [
          {
            propertyName: "onDateSelected",
            label: "onDateSelected",
            controlType: "ACTION_SELECTOR",
            isJSConvertible: true,
            isBindProperty: true,
            isTriggerProperty: true,
          },
        ],
      },
    ];
  }

  static getDerivedPropertiesMap(): DerivedPropertiesMap {
    return {
      isValid: `{{(()=>{${derivedProperties.isValidDate}})()}}`,
      selectedDate: `{{ this.value ? moment(this.value).toISOString() : "" }}`,
      formattedDate: `{{ this.value ? moment(this.value).format(this.dateFormat) : "" }}`,
    };
  }

  static getDefaultPropertiesMap(): Record<string, string> {
    return {
      value: "defaultDate",
    };
  }

  static getMetaPropertiesMap(): Record<string, any> {
    return {
      value: undefined,
    };
  }

  getPageView() {
    return (
      <DatePickerComponent
        closeOnSelection={this.props.closeOnSelection}
        dateFormat={this.props.dateFormat}
        datePickerType={"DATE_PICKER"}
        firstDayOfWeek={this.props.firstDayOfWeek}
        isDisabled={this.props.isDisabled}
        isLoading={this.props.isLoading}
        label={`${this.props.label}`}
        maxDate={this.props.maxDate}
        minDate={this.props.minDate}
        onDateSelected={this.onDateSelected}
        selectedDate={this.props.value}
        shortcuts={this.props.shortcuts}
        timePrecision={this.props.timePrecision}
        widgetId={this.props.widgetId}
      />
    );
  }

  onDateSelected = (selectedDate: string) => {
    this.props.updateWidgetMetaProperty("value", selectedDate, {
      triggerPropertyName: "onDateSelected",
      dynamicString: this.props.onDateSelected,
      event: {
        type: EventType.ON_DATE_SELECTED,
      },
    });
  };

  static getWidgetType(): WidgetType {
    return "DATE_PICKER_WIDGET2";
  }
}

export interface DatePickerWidget2Props extends WidgetProps {
  defaultDate: string;
  selectedDate: string;
  formattedDate: string;
  isDisabled: boolean;
  dateFormat: string;
  label: string;
  datePickerType: DatePickerType;
  onDateSelected?: string;
  onDateRangeSelected?: string;
  maxDate: string;
  minDate: string;
  isRequired?: boolean;
  closeOnSelection: boolean;
  shortcuts: boolean;
  firstDayOfWeek?: number;
  timePrecision: TimePrecision;
}

export default DatePickerWidget;
