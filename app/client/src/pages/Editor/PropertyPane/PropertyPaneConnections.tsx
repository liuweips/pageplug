import React, { memo, useMemo, useCallback, useEffect, useRef } from "react";
import styled from "styled-components";
import { AppState } from "@appsmith/reducers";
import { useDispatch, useSelector } from "react-redux";
import { getDataTree } from "selectors/dataTreeSelectors";
import { isAction, isWidget } from "workers/Evaluation/evaluationUtils";
import {
  Classes,
  Dropdown,
  DefaultDropDownValueNodeProps,
  DropdownOption,
  getTypographyByKey,
  Icon,
  IconSize,
  Text,
  TextType,
  TooltipComponent as Tooltip,
  RenderDropdownOptionType,
} from "design-system";
import { useEntityLink } from "components/editorComponents/Debugger/hooks/debuggerHooks";
import { useGetEntityInfo } from "components/editorComponents/Debugger/hooks/useGetEntityInfo";
import {
  doesEntityHaveErrors,
  getDependenciesFromInverseDependencies,
} from "components/editorComponents/Debugger/helpers";
import { getFilteredErrors } from "selectors/debuggerSelectors";
import { ENTITY_TYPE, Log } from "entities/AppsmithConsole";
import { DebugButton } from "components/editorComponents/Debugger/DebugCTA";
import { showDebugger } from "actions/debuggerActions";
import AnalyticsUtil from "utils/AnalyticsUtil";
import { Colors } from "constants/Colors";
import { inGuidedTour } from "selectors/onboardingSelectors";
import {
  interactionAnalyticsEvent,
  InteractionAnalyticsEventDetail,
  INTERACTION_ANALYTICS_EVENT,
} from "utils/AppsmithUtils";
import { PopoverPosition } from "@blueprintjs/core/lib/esnext/components/popover/popoverSharedProps";
import equal from "fast-deep-equal";
import { mapValues, pick } from "lodash";
import { createSelector } from "reselect";

const CONNECTION_HEIGHT = 28;

const TopLayer = styled.div`
  display: flex;
  flex: 1;
  justify-content: space-between;
  padding: 0 1rem;

  .connection-dropdown {
    box-shadow: none;
    border: none;
    background-color: ${Colors.WHITE};
    padding: 0;
    width: auto;
  }

  .error {
    border: 1px solid
      ${(props) => props.theme.colors.propertyPane.connections.error};
    border-bottom: none;
  }
`;

const SelectedNodeWrapper = styled.div<{
  entityCount: number;
  hasError: boolean;
  justifyContent: string;
}>`
  display: flex;
  align-items: center;
  width: 100%;
  justify-content: ${(props) => props.justifyContent};
  color: ${(props) =>
    props.hasError
      ? props.theme.colors.propertyPane.connections.error
      : props.theme.colors.propertyPane.connections.connectionsCount};
  ${getTypographyByKey("p3")}
  opacity: ${(props) => (!!props.entityCount ? 1 : 0.5)};

  & > *:nth-child(2) {
    padding: 0 4px;
  }

  .${Classes.ICON} {
    margin-top: 1px;

    ${(props) =>
      props.hasError &&
      `
    svg {
      path {
        fill: ${props.theme.colors.propertyPane.connections.error}
      }
    }
    `}
  }
`;

const OptionWrapper = styled.div<{ hasError: boolean; fillIconColor: boolean }>`
  display: flex;
  width: 100%;
  overflow: hidden;

  .debug {
    height: ${CONNECTION_HEIGHT}px;
    margin-top: 0px;
    display: none;
  }

  ${(props) =>
    props.fillIconColor &&
    `&:not(:hover) {
    svg {
      path {
        fill: #6a86ce;
      }
    }
  }`}

  &:hover {
    .debug {
      display: flex;
    }

    background-color: ${(props) =>
      props.hasError && props.theme.colors.propertyPane.connections.optionBg}};

    &&& svg {
      rect {
        fill: ${(props) => props.theme.colors.textOnDarkBG};
      }
    }
  }
`;

const OptionContentWrapper = styled.div<{
  hasError: boolean;
  isSelected: boolean;
}>`
  padding: ${(props) => props.theme.spaces[2] + 1}px
    ${(props) => props.theme.spaces[5]}px;
  cursor: pointer;
  display: flex;
  align-items: center;
  line-height: 8px;
  flex: 1;
  min-width: 0;
  background-color: ${(props) =>
    props.isSelected &&
    !props.hasError &&
    props.theme.colors.dropdown.hovered.bg};

  span:first-child {
    font-size: 10px;
    font-weight: normal;
  }

  .${Classes.TEXT} {
    margin-left: 6px;
    letter-spacing: 0px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: ${(props) =>
      props.hasError
        ? props.theme.colors.propertyPane.connections.error
        : props.theme.colors.propertyPane.label};
  }

  .${Classes.ICON} {
    margin-right: ${(props) => props.theme.spaces[5]}px;
  }

  &:hover,
  &.highlighted {
    background-color: ${(props) =>
      !props.hasError && props.theme.colors.dropdown.hovered.bg};
  }
`;

type PropertyPaneConnectionsProps = {
  widgetName: string;
  widgetType: string;
};

type TriggerNodeProps = DefaultDropDownValueNodeProps & {
  entityCount: number;
  iconAlignment: "LEFT" | "RIGHT";
  connectionType: string;
  hasError: boolean;
  justifyContent: string;
  tooltipPosition?: PopoverPosition;
};

const doConnectionsHaveErrors = (
  options: DropdownOption[],
  debuggerErrors: Record<string, Log>,
) => {
  return options.some((option) =>
    doesEntityHaveErrors(option.value as string, debuggerErrors),
  );
};

const getDataTreeWithOnlyIds = createSelector(getDataTree, (tree) =>
  mapValues(tree, (x) => pick(x, ["ENTITY_TYPE", "widgetId", "actionId"])),
);

const useDependencyList = (name: string) => {
  const dataTree = useSelector(getDataTreeWithOnlyIds, equal);
  const inverseDependencyMap = useSelector(
    (state: AppState) => state.evaluations.dependencies.inverseDependencyMap,
    equal,
  );
  const guidedTour = useSelector(inGuidedTour);

  const getEntityId = useCallback((name) => {
    const entity = dataTree[name];

    if (isWidget(entity)) {
      return entity.widgetId;
    } else if (isAction(entity)) {
      return entity.actionId;
    }
  }, []);

  const entityDependencies = useMemo(() => {
    if (guidedTour) return null;
    return getDependenciesFromInverseDependencies(inverseDependencyMap, name);
  }, [name, inverseDependencyMap, guidedTour]);

  const dependencyOptions =
    entityDependencies?.directDependencies.map((e) => ({
      label: e,
      value: getEntityId(e) ?? e,
    })) ?? [];
  const inverseDependencyOptions =
    entityDependencies?.inverseDependencies.map((e) => ({
      label: e,
      value: getEntityId(e),
    })) ?? [];

  return {
    dependencyOptions,
    inverseDependencyOptions,
  };
};

function OptionNode(props: any) {
  const getEntityInfo = useGetEntityInfo(props.option.label);
  const entityInfo = getEntityInfo();
  const dispatch = useDispatch();
  const { navigateToEntity } = useEntityLink();

  const onClick = () => {
    if (entityInfo?.hasError) {
      if (entityInfo?.type === ENTITY_TYPE.WIDGET) {
        dispatch(showDebugger(true));
      }
    }
    navigateToEntity(props.option.label);
    AnalyticsUtil.logEvent("ASSOCIATED_ENTITY_CLICK", {
      source: "PROPERTY_PANE",
      entityType: entityInfo?.entityType,
    });
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!props.isSelectedNode && !props.isHighlighted) return;
    if (
      (props.isSelectedNode || props.isHighlighted) &&
      (e.key === " " || e.key === "Enter")
    )
      onClick();
  };

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [props.isSelectedNode, props.isHighlighted]);

  return (
    <OptionWrapper
      className={`t--dropdown-option`}
      fillIconColor={!entityInfo?.datasourceName}
      hasError={!!entityInfo?.hasError}
    >
      <OptionContentWrapper
        className={`${props.isHighlighted ? "highlighted" : ""}`}
        hasError={!!entityInfo?.hasError}
        isSelected={props.isSelectedNode}
        onClick={onClick}
      >
        <span>{entityInfo?.icon}</span>
        <Text type={TextType.H6}>
          {props.option.label}{" "}
          {entityInfo?.datasourceName && (
            <span>from {entityInfo?.datasourceName}</span>
          )}
        </Text>
      </OptionContentWrapper>
      {!!entityInfo?.hasError && (
        <DebugButton className="debug" onClick={onClick} />
      )}
    </OptionWrapper>
  );
}

const TriggerNode = memo((props: TriggerNodeProps) => {
  const ENTITY = "实体";
  const tooltipText = !!props.entityCount
    ? `查看${props.connectionType}连接`
    : `暂无${props.connectionType}连接`;
  const iconColor = props.hasError ? "#f22b2b" : "";

  const onClick = () => {
    AnalyticsUtil.logEvent("ASSOCIATED_ENTITY_DROPDOWN_CLICK");
  };

  return (
    <SelectedNodeWrapper
      className={props.hasError ? "t--connection-error" : "t--connection"}
      entityCount={props.entityCount}
      hasError={props.hasError}
      justifyContent={props.justifyContent}
      onClick={onClick}
    >
      {props.iconAlignment === "LEFT" && (
        <Icon
          fillColor={iconColor}
          keepColors={!props.hasError}
          name="trending-flat"
          size={IconSize.MEDIUM}
        />
      )}
      <span>
        <Tooltip
          content={tooltipText}
          disabled={props.isOpen}
          openOnTargetFocus={false}
          position={props.tooltipPosition}
        >
          {props.entityCount ? `${props.entityCount} ${ENTITY}` : "暂无实体"}
        </Tooltip>
      </span>
      {props.iconAlignment === "RIGHT" && (
        <Icon
          fillColor={iconColor}
          keepColors={!props.hasError}
          name="trending-flat"
          size={IconSize.MEDIUM}
        />
      )}
      <Icon keepColors name="expand-more" size={IconSize.XS} />
    </SelectedNodeWrapper>
  );
});

TriggerNode.displayName = "TriggerNode";

const selectedOption = { label: "", value: "" };

function PropertyPaneConnections(props: PropertyPaneConnectionsProps) {
  const dependencies = useDependencyList(props.widgetName);
  const { navigateToEntity } = useEntityLink();
  const debuggerErrors = useSelector(getFilteredErrors);
  const topLayerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    topLayerRef.current?.addEventListener(
      INTERACTION_ANALYTICS_EVENT,
      handleKbdEvent,
    );
    return () => {
      topLayerRef.current?.removeEventListener(
        INTERACTION_ANALYTICS_EVENT,
        handleKbdEvent,
      );
    };
  }, []);

  const handleKbdEvent = (e: Event) => {
    const event = e as CustomEvent<InteractionAnalyticsEventDetail>;
    if (!event.detail?.propertyName) {
      e.stopPropagation();
      topLayerRef.current?.dispatchEvent(
        interactionAnalyticsEvent({
          key: event.detail.key,
          propertyType: "PROPERTY_PANE_CONNECTION",
          propertyName: "propertyPaneConnections",
          widgetType: props.widgetType,
        }),
      );
    }
  };

  const errorIncomingConnections = useMemo(() => {
    return doConnectionsHaveErrors(
      dependencies.dependencyOptions,
      debuggerErrors,
    );
  }, [dependencies.dependencyOptions, debuggerErrors]);

  const errorOutgoingConnections = useMemo(() => {
    return doConnectionsHaveErrors(
      dependencies.inverseDependencyOptions,
      debuggerErrors,
    );
  }, [dependencies.inverseDependencyOptions, debuggerErrors]);

  return (
    <TopLayer ref={topLayerRef}>
      <Dropdown
        SelectedValueNode={(
          selectedValueProps: DefaultDropDownValueNodeProps,
        ) => (
          <TriggerNode
            iconAlignment={"LEFT"}
            justifyContent={"flex-start"}
            {...selectedValueProps}
            connectionType="输入"
            entityCount={dependencies.dependencyOptions.length}
            hasError={errorIncomingConnections}
            tooltipPosition="bottom-left"
          />
        )}
        className={`connection-dropdown ${
          errorIncomingConnections ? "error" : ""
        }`}
        disabled={!dependencies.dependencyOptions.length}
        headerLabel="输入连接"
        height={`${CONNECTION_HEIGHT}px`}
        options={dependencies.dependencyOptions}
        renderOption={(optionProps: RenderDropdownOptionType) => {
          return (
            <OptionNode
              isHighlighted={optionProps.isHighlighted}
              isSelectedNode={optionProps.isSelectedNode}
              option={optionProps.option}
            />
          );
        }}
        selected={selectedOption}
        showDropIcon={false}
        showLabelOnly
        width="100%"
      />
      {/* <PopperDragHandle /> */}
      <Dropdown
        SelectedValueNode={(
          selectedValueProps: DefaultDropDownValueNodeProps,
        ) => (
          <TriggerNode
            iconAlignment={"RIGHT"}
            justifyContent={"flex-end"}
            {...selectedValueProps}
            connectionType="输出"
            entityCount={dependencies.inverseDependencyOptions.length}
            hasError={errorOutgoingConnections}
            tooltipPosition="bottom-right"
          />
        )}
        className={`connection-dropdown ${
          errorOutgoingConnections ? "error" : ""
        }`}
        disabled={!dependencies.inverseDependencyOptions.length}
        headerLabel="输出连接"
        height={`${CONNECTION_HEIGHT}px`}
        onSelect={navigateToEntity}
        options={dependencies.inverseDependencyOptions}
        renderOption={(optionProps: RenderDropdownOptionType) => {
          return (
            <OptionNode
              isHighlighted={optionProps.isHighlighted}
              isSelectedNode={optionProps.isSelectedNode}
              option={optionProps.option}
            />
          );
        }}
        selected={{ label: "", value: "" }}
        showDropIcon={false}
        showLabelOnly
        width={`100%`}
      />
    </TopLayer>
  );
}

export default memo(PropertyPaneConnections);
