import React from "react";
import { WidgetState } from "widgets/BaseWidget";
import { WidgetType } from "constants/WidgetConstants";
import CurrencyInputComponent, {
  CurrencyInputComponentProps,
} from "../component";
import { EventType } from "constants/AppsmithActionConstants/ActionConstants";
import {
  ValidationTypes,
  ValidationResponse,
} from "constants/WidgetValidation";
import {
  createMessage,
  FIELD_REQUIRED_ERROR,
} from "@appsmith/constants/messages";
import { DerivedPropertiesMap } from "utils/WidgetFactory";
import {
  CurrencyDropdownOptions,
  getCountryCodeFromCurrencyCode,
} from "../component/CurrencyCodeDropdown";
import { AutocompleteDataType } from "utils/autocomplete/CodemirrorTernService";
import _ from "lodash";
import derivedProperties from "./parsedDerivedProperties";
import BaseInputWidget from "widgets/BaseInputWidget";
import { BaseInputWidgetProps } from "widgets/BaseInputWidget/widget";
import * as Sentry from "@sentry/react";
import log from "loglevel";
import {
  formatCurrencyNumber,
  limitDecimalValue,
} from "../component/utilities";
import { getLocale, mergeWidgetConfig } from "utils/helpers";
import { GRID_DENSITY_MIGRATION_V1 } from "widgets/constants";
import {
  getLocaleDecimalSeperator,
  getLocaleThousandSeparator,
  isAutoHeightEnabledForWidget,
} from "widgets/WidgetUtils";
import { Stylesheet } from "entities/AppTheming";

export function defaultValueValidation(
  value: any,
  props: CurrencyInputWidgetProps,
  _?: any,
): ValidationResponse {
  const NUMBER_ERROR_MESSAGE = "This value must be number";
  const DECIMAL_SEPARATOR_ERROR_MESSAGE =
    "Please use . as the decimal separator for default values.";
  const EMPTY_ERROR_MESSAGE = "";
  const localeLang = navigator.languages?.[0] || "en-US";

  function getLocaleDecimalSeperator() {
    return Intl.NumberFormat(localeLang)
      .format(1.1)
      .replace(/\p{Number}/gu, "");
  }
  const decimalSeperator = getLocaleDecimalSeperator();
  const defaultDecimalSeperator = ".";
  if (_.isObject(value)) {
    return {
      isValid: false,
      parsed: JSON.stringify(value, null, 2),
      messages: [NUMBER_ERROR_MESSAGE],
    };
  }

  let parsed: any = Number(value);
  let isValid, messages;

  if (_.isString(value) && value.trim() === "") {
    /*
     *  When value is emtpy string
     */
    isValid = true;
    messages = [EMPTY_ERROR_MESSAGE];
    parsed = undefined;
  } else if (!Number.isFinite(parsed)) {
    /*
     *  When parsed value is not a finite numer
     */
    isValid = false;
    parsed = undefined;

    /**
     * Check whether value contains the locale decimal separator apart from "."
     * We only allow "." as a decimal separator inside default value
     */
    if (
      String(value).indexOf(defaultDecimalSeperator) === -1 &&
      String(value).indexOf(decimalSeperator) > 0
    ) {
      messages = [DECIMAL_SEPARATOR_ERROR_MESSAGE];
    } else {
      messages = [NUMBER_ERROR_MESSAGE];
    }
  } else {
    /*
     *  When parsed value is a Number
     */

    // Check whether value is honoring the decimals property
    if (parsed !== Number(parsed.toFixed(props.decimals))) {
      isValid = false;
      messages = [
        "No. of decimals are higher than the decimals field set. Please update the default or the decimals field",
      ];
    } else {
      isValid = true;
      messages = [EMPTY_ERROR_MESSAGE];
    }

    parsed = String(parsed);
  }

  return {
    isValid,
    parsed,
    messages,
  };
}

class CurrencyInputWidget extends BaseInputWidget<
  CurrencyInputWidgetProps,
  WidgetState
> {
  static getPropertyPaneContentConfig() {
    return mergeWidgetConfig(
      [
        {
          sectionName: "数据",
          children: [
            {
              helpText: "设置组件默认值，当默认值改变后，组件当前值会自动更新",
              propertyName: "defaultText",
              label: "默认值",
              controlType: "INPUT_TEXT",
              placeholderText: "100",
              isBindProperty: true,
              isTriggerProperty: false,
              validation: {
                type: ValidationTypes.FUNCTION,
                params: {
                  fn: defaultValueValidation,
                  expected: {
                    type: "number",
                    example: `100`,
                    autocompleteDataType: AutocompleteDataType.STRING,
                  },
                },
              },
              dependencies: ["decimals"],
            },
            {
              helpText: "修改货币类型",
              propertyName: "defaultCurrencyCode",
              label: "货币",
              enableSearch: true,
              dropdownHeight: "156px",
              controlType: "DROP_DOWN",
              searchPlaceholderText: "通过名称或者编号搜索",
              options: CurrencyDropdownOptions,
              isJSConvertible: true,
              isBindProperty: true,
              isTriggerProperty: false,
              validation: {
                type: ValidationTypes.TEXT,
              },
            },
            {
              propertyName: "allowCurrencyChange",
              label: "允许修改货币",
              helpText: "通过国家或者货币搜索",
              controlType: "SWITCH",
              isJSConvertible: true,
              isBindProperty: true,
              isTriggerProperty: false,
              validation: { type: ValidationTypes.BOOLEAN },
            },
            {
              helpText: "货币精确到小数点后几位",
              propertyName: "decimals",
              label: "Decimals Allowed",
              controlType: "DROP_DOWN",
              options: [
                {
                  label: "0",
                  value: 0,
                },
                {
                  label: "1",
                  value: 1,
                },
                {
                  label: "2",
                  value: 2,
                },
              ],
              isJSConvertible: true,
              isBindProperty: true,
              isTriggerProperty: false,
              validation: {
                type: ValidationTypes.NUMBER,
                params: {
                  min: 0,
                  max: 2,
                },
              },
            },
          ],
        },
        {
          sectionName: "标签",
          children: [],
        },
        {
          sectionName: "校验",
          children: [
            {
              propertyName: "isRequired",
              label: "必填",
              helpText: "强制用户填写",
              controlType: "SWITCH",
              isJSConvertible: true,
              isBindProperty: true,
              isTriggerProperty: false,
              validation: { type: ValidationTypes.BOOLEAN },
            },
          ],
        },
      ],
      super.getPropertyPaneContentConfig(),
    );
  }

  static getPropertyPaneStyleConfig() {
    return super.getPropertyPaneStyleConfig();
  }

  static getDerivedPropertiesMap(): DerivedPropertiesMap {
    return {
      isValid: `{{(()=>{${derivedProperties.isValid}})()}}`,
      value: `{{(()=>{${derivedProperties.value}})()}}`,
    };
  }

  static getMetaPropertiesMap(): Record<string, any> {
    return _.merge(super.getMetaPropertiesMap(), {
      text: undefined,
      currencyCode: undefined,
    });
  }

  static getDefaultPropertiesMap(): Record<string, string> {
    return _.merge(super.getDefaultPropertiesMap(), {
      currencyCode: "defaultCurrencyCode",
    });
  }

  static getStylesheetConfig(): Stylesheet {
    return {
      accentColor: "{{appsmith.theme.colors.primaryColor}}",
      borderRadius: "{{appsmith.theme.borderRadius.appBorderRadius}}",
      boxShadow: "none",
    };
  }

  componentDidMount() {
    //format the defaultText and store it in text
    this.formatText();
  }

  componentDidUpdate(prevProps: CurrencyInputWidgetProps) {
    if (
      prevProps.text !== this.props.text &&
      !this.props.isFocused &&
      this.props.text === String(this.props.defaultText)
    ) {
      this.formatText();
    }
    // If defaultText property has changed, reset isDirty to false
    if (
      this.props.defaultText !== prevProps.defaultText &&
      this.props.isDirty
    ) {
      this.props.updateWidgetMetaProperty("isDirty", false);
    }

    if (
      this.props.currencyCode === this.props.defaultCurrencyCode &&
      prevProps.currencyCode !== this.props.currencyCode
    ) {
      this.onCurrencyTypeChange(this.props.currencyCode);
    }
  }

  formatText() {
    if (!!this.props.text) {
      try {
        /**
         * Since we are restricting default value to only have "." decimal separator,
         * hence we directly convert it to the current locale
         */
        const floatVal = parseFloat(this.props.text);

        const formattedValue = Intl.NumberFormat(getLocale(), {
          style: "decimal",
          minimumFractionDigits: this.props.decimals,
          maximumFractionDigits: this.props.decimals,
        }).format(floatVal);
        this.props.updateWidgetMetaProperty("text", formattedValue);
      } catch (e) {
        log.error(e);
        Sentry.captureException(e);
      }
    }
  }

  onValueChange = (value: string) => {
    let formattedValue = "";
    const decimalSeperator = getLocaleDecimalSeperator();
    try {
      if (value && value.includes(decimalSeperator)) {
        formattedValue = limitDecimalValue(this.props.decimals, value);
      } else {
        formattedValue = value;
      }
    } catch (e) {
      formattedValue = value;
      log.error(e);
      Sentry.captureException(e);
    }

    // text is stored as what user has typed
    this.props.updateWidgetMetaProperty("text", String(formattedValue), {
      triggerPropertyName: "onTextChanged",
      dynamicString: this.props.onTextChanged,
      event: {
        type: EventType.ON_TEXT_CHANGE,
      },
    });

    if (!this.props.isDirty) {
      this.props.updateWidgetMetaProperty("isDirty", true);
    }
  };

  handleFocusChange = (isFocused?: boolean) => {
    try {
      if (isFocused) {
        const text = this.props.text || "";
        const deFormattedValue = text.replace(
          new RegExp("\\" + getLocaleThousandSeparator(), "g"),
          "",
        );
        this.props.updateWidgetMetaProperty("text", deFormattedValue);
        this.props.updateWidgetMetaProperty("isFocused", isFocused, {
          triggerPropertyName: "onFocus",
          dynamicString: this.props.onFocus,
          event: {
            type: EventType.ON_FOCUS,
          },
        });
      } else {
        if (this.props.text) {
          const formattedValue = formatCurrencyNumber(
            this.props.decimals,
            this.props.text,
          );
          this.props.updateWidgetMetaProperty("text", formattedValue);
        }
        this.props.updateWidgetMetaProperty("isFocused", isFocused, {
          triggerPropertyName: "onBlur",
          dynamicString: this.props.onBlur,
          event: {
            type: EventType.ON_BLUR,
          },
        });
      }
    } catch (e) {
      log.error(e);
      Sentry.captureException(e);
      this.props.updateWidgetMetaProperty("text", this.props.text);
    }

    super.handleFocusChange(!!isFocused);
  };

  onCurrencyTypeChange = (currencyCode?: string) => {
    const countryCode = getCountryCodeFromCurrencyCode(currencyCode);

    this.props.updateWidgetMetaProperty("countryCode", countryCode);
    this.props.updateWidgetMetaProperty("currencyCode", currencyCode);
  };

  handleKeyDown = (
    e:
      | React.KeyboardEvent<HTMLTextAreaElement>
      | React.KeyboardEvent<HTMLInputElement>,
  ) => {
    super.handleKeyDown(e);
  };

  onStep = (direction: number) => {
    const value = Number(this.props.value) + direction;

    // Since value is always going to be a number therefore, directly converting it to the current locale
    const formattedValue = Intl.NumberFormat(getLocale()).format(value);
    if (!this.props.isDirty) {
      this.props.updateWidgetMetaProperty("isDirty", true);
    }

    this.props.updateWidgetMetaProperty("text", String(formattedValue), {
      triggerPropertyName: "onTextChanged",
      dynamicString: this.props.onTextChanged,
      event: {
        type: EventType.ON_TEXT_CHANGE,
      },
    });
  };

  getPageView() {
    const value = this.props.text ?? "";
    const isInvalid =
      "isValid" in this.props && !this.props.isValid && !!this.props.isDirty;
    const currencyCode = this.props.currencyCode;
    const conditionalProps: Partial<CurrencyInputComponentProps> = {};
    conditionalProps.errorMessage = this.props.errorMessage;
    if (this.props.isRequired && value.length === 0) {
      conditionalProps.errorMessage = createMessage(FIELD_REQUIRED_ERROR);
    }

    return (
      <CurrencyInputComponent
        accentColor={this.props.accentColor}
        allowCurrencyChange={this.props.allowCurrencyChange}
        autoFocus={this.props.autoFocus}
        borderRadius={this.props.borderRadius}
        boxShadow={this.props.boxShadow}
        compactMode={
          !(
            (this.props.bottomRow - this.props.topRow) /
              GRID_DENSITY_MIGRATION_V1 >
            1
          )
        }
        currencyCode={currencyCode}
        decimals={this.props.decimals}
        defaultValue={this.props.defaultText}
        disableNewLineOnPressEnterKey={!!this.props.onSubmit}
        disabled={this.props.isDisabled}
        iconAlign={this.props.iconAlign}
        iconName={this.props.iconName}
        inputType={this.props.inputType}
        isDynamicHeightEnabled={isAutoHeightEnabledForWidget(this.props)}
        isInvalid={isInvalid}
        isLoading={this.props.isLoading}
        label={this.props.label}
        labelAlignment={this.props.labelAlignment}
        labelPosition={this.props.labelPosition}
        labelStyle={this.props.labelStyle}
        labelTextColor={this.props.labelTextColor}
        labelTextSize={this.props.labelTextSize}
        labelWidth={this.getLabelWidth()}
        onCurrencyTypeChange={this.onCurrencyTypeChange}
        onFocusChange={this.handleFocusChange}
        onKeyDown={this.handleKeyDown}
        onStep={this.onStep}
        onValueChange={this.onValueChange}
        placeholder={this.props.placeholderText}
        renderMode={this.props.renderMode}
        showError={!!this.props.isFocused}
        tooltip={this.props.tooltip}
        value={value}
        widgetId={this.props.widgetId}
        {...conditionalProps}
      />
    );
  }

  static getWidgetType(): WidgetType {
    return "CURRENCY_INPUT_WIDGET";
  }
}

export interface CurrencyInputWidgetProps extends BaseInputWidgetProps {
  countryCode?: string;
  currencyCode?: string;
  noOfDecimals?: number;
  allowCurrencyChange?: boolean;
  decimals?: number;
  defaultText?: number;
}

export default CurrencyInputWidget;
