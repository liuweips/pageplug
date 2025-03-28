import React, {
  Component,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import styled, { ThemeContext, keyframes, css } from "styled-components";
import { connect, useDispatch, useSelector } from "react-redux";
import MediaQuery from "react-responsive";
import { useLocation } from "react-router-dom";
import { AppState } from "@appsmith/reducers";
import { Classes as BlueprintClasses } from "@blueprintjs/core";
import {
  thinScrollbar,
  truncateTextUsingEllipsis,
} from "constants/DefaultTheme";
import {
  getApplicationList,
  getApplicationSearchKeyword,
  getCreateApplicationError,
  getIsCreatingApplication,
  getIsDeletingApplication,
  getIsDuplicatingApplication,
  getIsFetchingApplications,
  getIsSavingWorkspaceInfo,
  getUserApplicationsWorkspaces,
  getUserApplicationsWorkspacesList,
} from "selectors/applicationSelectors";
import {
  ApplicationPayload,
  ReduxActionTypes,
} from "@appsmith/constants/ReduxActionConstants";
import PageWrapper from "pages/common/PageWrapper";
import SubHeader from "pages/common/SubHeader";
import ApplicationCard from "./ApplicationCard";
import WorkspaceInviteUsersForm from "@appsmith/pages/workspace/WorkspaceInviteUsersForm";
import FormDialogComponent from "components/editorComponents/form/FormDialogComponent";
import { User } from "constants/userConstants";
import { getCurrentUser } from "selectors/usersSelectors";
import { CREATE_WORKSPACE_FORM_NAME } from "@appsmith/constants/forms";
import {
  DropdownOnSelectActions,
  getOnSelectAction,
} from "pages/common/CustomizedDropdown/dropdownHelpers";
import {
  AppIconCollection,
  Button,
  Category,
  Classes,
  EditableText,
  EditInteractionKind,
  Icon,
  IconName,
  IconSize,
  Menu,
  MenuItem,
  notEmptyValidator,
  SavingState,
  Size,
  Text,
  TextType,
} from "design-system";
import {
  duplicateApplication,
  updateApplication,
} from "actions/applicationActions";
import { Position } from "@blueprintjs/core/lib/esm/common/position";
import { UpdateApplicationPayload } from "api/ApplicationApi";
import PerformanceTracker, {
  PerformanceTransactionName,
} from "utils/PerformanceTracker";
import { loadingUserWorkspaces } from "./ApplicationLoaders";
import { creatingApplicationMap } from "@appsmith/reducers/uiReducers/applicationsReducer";
import {
  deleteWorkspace,
  saveWorkspace,
} from "@appsmith/actions/workspaceActions";
import { leaveWorkspace } from "actions/userActions";
import CenteredWrapper from "components/designSystems/appsmith/CenteredWrapper";
import NoSearchImage from "assets/images/NoSearchResult.svg";
import { getNextEntityName, getRandomPaletteColor } from "utils/AppsmithUtils";
import { createWorkspaceSubmitHandler } from "@appsmith/pages/workspace/helpers";
import ImportApplicationModal from "./ImportApplicationModal";
import {
  createMessage,
  INVITE_USERS_MESSAGE,
  INVITE_USERS_PLACEHOLDER,
  NO_APPS_FOUND,
  SEARCH_APPS,
  WORKSPACES_HEADING,
} from "@appsmith/constants/messages";
import { ReactComponent as NoAppsFoundIcon } from "assets/svg/no-apps-icon.svg";

import { setHeaderMeta } from "actions/themeActions";
import SharedUserList from "pages/common/SharedUserList";
import { useIsMobileDevice } from "utils/hooks/useDeviceDetect";
import { Indices } from "constants/Layers";
import GitSyncModal from "pages/Editor/gitSync/GitSyncModal";
import DisconnectGitModal from "pages/Editor/gitSync/DisconnectGitModal";
import ReconnectDatasourceModal from "pages/Editor/gitSync/ReconnectDatasourceModal";
import LeftPaneBottomSection from "pages/Home/LeftPaneBottomSection";
import { MOBILE_MAX_WIDTH } from "constants/AppConstants";
import urlBuilder from "entities/URLRedirect/URLAssembly";
import RepoLimitExceededErrorModal from "../Editor/gitSync/RepoLimitExceededErrorModal";
import { resetEditorRequest } from "actions/initActions";
import {
  hasCreateNewAppPermission,
  hasCreateWorkspacePermission,
  hasDeleteWorkspacePermission,
  isPermitted,
  PERMISSION_TYPE,
} from "@appsmith/utils/permissionHelpers";
import { getTenantPermissions } from "@appsmith/selectors/tenantSelectors";

const WorkspaceDropDown = styled.div<{ isMobile?: boolean }>`
  display: flex;
  padding: ${(props) => (props.isMobile ? `10px 16px` : `10px 10px`)};
  font-size: ${(props) => props.theme.fontSizes[1]}px;
  justify-content: space-between;
  align-items: center;
  ${({ isMobile }) =>
    isMobile &&
    `
    position: sticky;
    top: 0;
    background-color: #fff;
    z-index: ${Indices.Layer8};
  `}
`;

const ApplicationCardsWrapper = styled.div<{ isMobile?: boolean }>`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ isMobile }) => (isMobile ? 12 : 20)}px;
  font-size: ${(props) => props.theme.fontSizes[4]}px;
  padding: ${({ isMobile }) => (isMobile ? `10px 16px` : `10px`)};
`;

const WorkspaceSection = styled.div<{ isMobile?: boolean }>`
  margin-bottom: ${({ isMobile }) => (isMobile ? `8` : `40`)}px;
`;

const PaddingWrapper = styled.div<{ isMobile?: boolean }>`
  display: flex;
  align-items: baseline;
  justify-content: center;
  width: ${(props) => props.theme.card.minWidth}px;

  @media screen and (min-width: 1500px) {
    .bp3-card {
      width: ${(props) => props.theme.card.minWidth}px;
      height: ${(props) => props.theme.card.minHeight}px;
    }
  }

  @media screen and (min-width: 1500px) and (max-width: 1512px) {
    width: ${(props) =>
      props.theme.card.minWidth + props.theme.spaces[4] * 2}px;
    .bp3-card {
      width: ${(props) => props.theme.card.minWidth - 5}px;
      height: ${(props) => props.theme.card.minHeight - 5}px;
    }
  }
  @media screen and (min-width: 1478px) and (max-width: 1500px) {
    width: ${(props) =>
      props.theme.card.minWidth + props.theme.spaces[4] * 2}px;
    .bp3-card {
      width: ${(props) => props.theme.card.minWidth - 8}px;
      height: ${(props) => props.theme.card.minHeight - 8}px;
    }
  }

  @media screen and (min-width: 1447px) and (max-width: 1477px) {
    width: ${(props) =>
      props.theme.card.minWidth + props.theme.spaces[3] * 2}px;
    .bp3-card {
      width: ${(props) => props.theme.card.minWidth - 8}px;
      height: ${(props) => props.theme.card.minHeight - 8}px;
    }
  }

  @media screen and (min-width: 1417px) and (max-width: 1446px) {
    width: ${(props) =>
      props.theme.card.minWidth + props.theme.spaces[3] * 2}px;
    .bp3-card {
      width: ${(props) => props.theme.card.minWidth - 11}px;
      height: ${(props) => props.theme.card.minHeight - 11}px;
    }
  }

  @media screen and (min-width: 1400px) and (max-width: 1417px) {
    width: ${(props) =>
      props.theme.card.minWidth + props.theme.spaces[2] * 2}px;
    .bp3-card {
      width: ${(props) => props.theme.card.minWidth - 15}px;
      height: ${(props) => props.theme.card.minHeight - 15}px;
    }
  }

  @media screen and (max-width: 1400px) {
    width: ${(props) =>
      props.theme.card.minWidth + props.theme.spaces[2] * 2}px;
    .bp3-card {
      width: ${(props) => props.theme.card.minWidth - 15}px;
      height: ${(props) => props.theme.card.minHeight - 15}px;
    }
  }

  ${({ isMobile }) =>
    isMobile &&
    `
    width: 100% !important;
  `}
`;

const LeftPaneWrapper = styled.div`
  overflow: auto;
  width: ${(props) => props.theme.homePage.sidebar}px;
  height: 100%;
  display: flex;
  padding-left: 16px;
  padding-top: 16px;
  flex-direction: column;
  position: fixed;
  top: ${(props) => props.theme.homePage.header}px;
  box-shadow: 1px 0px 0px #ededed;
`;
const ApplicationContainer = styled.div<{ isMobile?: boolean }>`
  padding-right: ${(props) => props.theme.homePage.leftPane.rightMargin}px;
  padding-top: 16px;
  ${({ isMobile }) =>
    isMobile &&
    `
    margin-left: 0;
    width: 100%;
    padding: 0;
  `}
`;

const ItemWrapper = styled.div`
  padding: 9px 15px;
`;
const StyledIcon = styled(Icon)`
  margin-right: 11px;
`;
const WorkspaceShareUsers = styled.div`
  display: flex;
  align-items: center;

  & .t--options-icon {
    margin-left: 8px;

    svg {
      path {
        fill: #090707;
      }
    }
  }

  & .t--new-button {
    margin-left: 8px;
  }

  & button,
  & a {
    padding: 4px 12px;
  }
`;

const NoAppsFound = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;

  & > span {
    margin-bottom: 24px;
  }
`;

function Item(props: {
  label: string;
  textType: TextType;
  icon?: IconName;
  isFetchingApplications: boolean;
}) {
  return (
    <ItemWrapper>
      {props.icon && <StyledIcon />}
      <Text
        className={
          props.isFetchingApplications ? BlueprintClasses.SKELETON : ""
        }
        type={props.textType}
      >
        {" "}
        {props.label}
      </Text>
    </ItemWrapper>
  );
}

const LeftPaneDataSection = styled.div`
  position: relative;
  height: calc(100vh - ${(props) => props.theme.homePage.header + 24}px);
  display: flex;
  flex-direction: column;
`;

function LeftPaneSection(props: {
  heading: string;
  children?: any;
  isFetchingApplications: boolean;
}) {
  return (
    <LeftPaneDataSection>
      {/* <MenuItem text={props.heading}/> */}
      <Item
        isFetchingApplications={props.isFetchingApplications}
        label={props.heading}
        textType={TextType.SIDE_HEAD}
      />
      {props.children}
    </LeftPaneDataSection>
  );
}

const StyledAnchor = styled.a`
  position: relative;
  top: -24px;
`;

const WorkpsacesNavigator = styled.div`
  overflow: auto;
  ${thinScrollbar};
  /* padding-bottom: 160px; */
`;

const textIconStyles = (props: { color: string; hover: string }) => {
  return `
    & {
      .${Classes.TEXT},.${Classes.ICON} svg path {
        color: ${props.color};
        stroke: ${props.color};
        fill: ${props.color};
      }

      &:hover {
        .${Classes.TEXT},.${Classes.ICON} svg path {
          color: ${props.hover};
          stroke: ${props.hover};
          fill: ${props.hover};
        }
      }
    }
  `;
};

function WorkspaceMenuItem({
  isFetchingApplications,
  selected,
  workspace,
}: any) {
  const menuRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (selected) {
      menuRef.current?.scrollIntoView({ behavior: "smooth" });
      menuRef.current?.click();
    }
  }, [selected]);

  return (
    <MenuItem
      containerClassName={
        isFetchingApplications ? BlueprintClasses.SKELETON : ""
      }
      ellipsize={20}
      href={`${window.location.pathname}#${workspace.workspace.id}`}
      icon="workspace"
      key={workspace.workspace.id}
      ref={menuRef}
      selected={selected}
      text={workspace.workspace.name}
      tooltipPos={Position.BOTTOM_LEFT}
    />
  );
}

const submitCreateWorkspaceForm = async (data: any, dispatch: any) => {
  const result = await createWorkspaceSubmitHandler(data, dispatch);
  return result;
};

function LeftPane() {
  const dispatch = useDispatch();
  const fetchedUserWorkspaces = useSelector(getUserApplicationsWorkspaces);
  const isFetchingApplications = useSelector(getIsFetchingApplications);
  const isMobile = useIsMobileDevice();

  let userWorkspaces;
  if (!isFetchingApplications) {
    userWorkspaces = fetchedUserWorkspaces;
  } else {
    userWorkspaces = loadingUserWorkspaces as any;
  }

  const tenantPermissions = useSelector(getTenantPermissions);
  const canCreateWorkspace = hasCreateWorkspacePermission(tenantPermissions);

  const location = useLocation();
  const urlHash = location.hash.slice(1);

  if (isMobile) return null;

  return (
    <LeftPaneWrapper>
      <LeftPaneSection
        heading={createMessage(WORKSPACES_HEADING)}
        isFetchingApplications={isFetchingApplications}
      >
        <WorkpsacesNavigator data-cy="t--left-panel">
          {!isFetchingApplications &&
            fetchedUserWorkspaces &&
            canCreateWorkspace && (
              <MenuItem
                cypressSelector="t--workspace-new-workspace-auto-create"
                icon="plus"
                onSelect={() =>
                  submitCreateWorkspaceForm(
                    {
                      name: getNextEntityName(
                        "应用组 ",
                        fetchedUserWorkspaces.map(
                          (el: any) => el.workspace.name,
                        ),
                      ),
                    },
                    dispatch,
                  )
                }
                text={CREATE_WORKSPACE_FORM_NAME}
              />
            )}
          {userWorkspaces &&
            userWorkspaces.map((workspace: any) => (
              <WorkspaceMenuItem
                isFetchingApplications={isFetchingApplications}
                key={workspace.workspace.id}
                selected={urlHash === workspace.workspace.id}
                workspace={workspace}
              />
            ))}
        </WorkpsacesNavigator>
        <LeftPaneBottomSection />
      </LeftPaneSection>
    </LeftPaneWrapper>
  );
}

const CreateNewLabel = styled(Text)`
  margin-top: 18px;
`;

const WorkspaceNameElement = styled(Text)<{ isMobile?: boolean }>`
  max-width: ${({ isMobile }) => (isMobile ? 220 : 500)}px;
  ${truncateTextUsingEllipsis}
`;

const WorkspaceNameHolder = styled(Text)`
  display: flex;
  align-items: center;
`;

const WorkspaceNameWrapper = styled.div<{ disabled?: boolean }>`
  ${(props) => {
    const color = props.disabled
      ? props.theme.colors.applications.workspaceColor
      : props.theme.colors.applications.hover.workspaceColor[9];
    return `${textIconStyles({
      color: color,
      hover: color,
    })}`;
  }}
  .${Classes.ICON} {
    display: ${(props) => (!props.disabled ? "inline" : "none")};
    margin-left: 8px;
    color: ${(props) => props.theme.colors.applications.iconColor};
  }
`;
const WorkspaceRename = styled(EditableText)`
  padding: 0 2px;
`;

const NoSearchResultImg = styled.img`
  margin: 1em;
  height: 240px;
`;

const ApplicationsWrapper = styled.div<{ isMobile: boolean }>`
  height: calc(100vh - ${(props) => props.theme.homePage.search.height - 40}px);
  overflow: auto;
  margin-left: ${(props) =>
    props.theme.homePage.leftPane.width +
    props.theme.homePage.leftPane.rightMargin +
    props.theme.homePage.leftPane.leftPadding}px;
  width: calc(
    100% -
      ${(props) =>
        props.theme.homePage.leftPane.width +
        props.theme.homePage.leftPane.rightMargin +
        props.theme.homePage.leftPane.leftPadding}px
  );
  scroll-behavior: smooth;
  ${({ isMobile }) =>
    isMobile &&
    `
    margin-left: 0;
    width: 100%;
    padding: 0;
  `}
`;

const spreadKeyframes = (init: number) => {
  const frames = Array.from(Array(21))
    .map((a, i) => {
      return `
        ${i * 5}% { --spread: ${init + i}px; }
      `;
    })
    .join("\n");
  return keyframes`${frames}`;
};

const SpreadButton = styled(Button)`
  --spread: 20px;
  &:hover {
    animation: ${spreadKeyframes(20)} 0.6s infinite;
    background: ${(props) => props.theme.colors.applications.bg};
  }

  & svg {
    width: 18px;
    height: 18px;
  }
`;

function ApplicationsSection(props: any) {
  const enableImportExport = true;
  const dispatch = useDispatch();
  const theme = useContext(ThemeContext);
  const isSavingWorkspaceInfo = useSelector(getIsSavingWorkspaceInfo);
  const isFetchingApplications = useSelector(getIsFetchingApplications);
  const userWorkspaces = useSelector(getUserApplicationsWorkspacesList);
  const creatingApplicationMap = useSelector(getIsCreatingApplication);
  const currentUser = useSelector(getCurrentUser);
  const isMobile = useIsMobileDevice();
  const deleteApplication = (applicationId: string) => {
    if (applicationId && applicationId.length > 0) {
      dispatch({
        type: ReduxActionTypes.DELETE_APPLICATION_INIT,
        payload: {
          applicationId,
        },
      });
    }
  };
  const [warnLeavingWorkspace, setWarnLeavingWorkspace] = useState(false);
  const [warnDeleteWorkspace, setWarnDeleteWorkspace] = useState(false);
  const [workspaceToOpenMenu, setWorkspaceToOpenMenu] = useState<string | null>(
    null,
  );
  const updateApplicationDispatch = (
    id: string,
    data: UpdateApplicationPayload,
  ) => {
    dispatch(updateApplication(id, data));
  };

  useEffect(() => {
    // Clears URL params cache
    urlBuilder.resetURLParams();
  }, []);

  const duplicateApplicationDispatch = (applicationId: string) => {
    dispatch(duplicateApplication(applicationId));
  };

  const [
    selectedWorkspaceIdForImportApplication,
    setSelectedWorkspaceIdForImportApplication,
  ] = useState<string | undefined>();

  const leaveWS = (workspaceId: string) => {
    setWarnLeavingWorkspace(false);
    setWorkspaceToOpenMenu(null);
    dispatch(leaveWorkspace(workspaceId));
  };

  const handleDeleteWorkspace = useCallback(
    (workspaceId: string) => {
      setWarnDeleteWorkspace(false);
      setWorkspaceToOpenMenu(null);
      dispatch(deleteWorkspace(workspaceId));
    },
    [dispatch],
  );

  const WorkspaceNameChange = (newName: string, workspaceId: string) => {
    dispatch(
      saveWorkspace({
        id: workspaceId as string,
        name: newName,
      }),
    );
  };

  function WorkspaceMenuTarget(props: {
    workspaceName: string;
    disabled?: boolean;
    workspaceSlug: string;
  }) {
    const { disabled, workspaceName, workspaceSlug } = props;

    return (
      <WorkspaceNameWrapper
        className="t--workspace-name-text"
        disabled={disabled}
      >
        <StyledAnchor id={workspaceSlug} />
        <WorkspaceNameHolder
          className={isFetchingApplications ? BlueprintClasses.SKELETON : ""}
          type={TextType.H1}
        >
          <WorkspaceNameElement
            className={isFetchingApplications ? BlueprintClasses.SKELETON : ""}
            isMobile={isMobile}
            type={TextType.H1}
          >
            {workspaceName}
          </WorkspaceNameElement>
        </WorkspaceNameHolder>
      </WorkspaceNameWrapper>
    );
  }

  const createNewApplication = (
    applicationName: string,
    workspaceId: string,
    isMobile: boolean,
  ) => {
    const color = getRandomPaletteColor(theme.colors.appCardColors);
    const icon =
      AppIconCollection[Math.floor(Math.random() * AppIconCollection.length)];

    return dispatch({
      type: ReduxActionTypes.CREATE_APPLICATION_INIT,
      payload: {
        applicationName,
        workspaceId,
        icon,
        color,
        isMobile,
      },
    });
  };

  const CreateApp = ({ isMobile, orgId, applications }: any) => {
    return (
      <SpreadButton
        className="t--new-button createnew"
        icon={"plus"}
        isLoading={creatingApplicationMap && creatingApplicationMap[orgId]}
        onClick={() => {
          if (
            Object.entries(creatingApplicationMap).length === 0 ||
            (creatingApplicationMap && !creatingApplicationMap[orgId])
          ) {
            createNewApplication(
              getNextEntityName(
                "应用 ",
                applications.map((el: any) => el.name),
              ),
              orgId,
              isMobile,
            );
          }
        }}
        size={Size.medium}
        tag="button"
        text={`创建${isMobile ? "移动" : "桌面"}应用`}
      />
    );
  };

  let updatedWorkspaces;
  if (!isFetchingApplications) {
    updatedWorkspaces = userWorkspaces;
  } else {
    updatedWorkspaces = loadingUserWorkspaces as any;
  }

  let workspacesListComponent;
  if (
    !isFetchingApplications &&
    props.searchKeyword &&
    props.searchKeyword.trim().length > 0 &&
    updatedWorkspaces.length === 0
  ) {
    workspacesListComponent = (
      <CenteredWrapper
        style={{
          flexDirection: "column",
          position: "static",
        }}
      >
        <CreateNewLabel type={TextType.H4}>
          {createMessage(NO_APPS_FOUND)}
        </CreateNewLabel>
        <NoSearchResultImg alt="没有搜索到相关内容" src={NoSearchImage} />
      </CenteredWrapper>
    );
  } else {
    workspacesListComponent = updatedWorkspaces.map(
      (workspaceObject: any, index: number) => {
        const { applications, workspace } = workspaceObject;
        const hasManageWorkspacePermissions = isPermitted(
          workspace.userPermissions,
          PERMISSION_TYPE.MANAGE_WORKSPACE,
        );
        const canInviteToWorkspace = isPermitted(
          workspace.userPermissions,
          PERMISSION_TYPE.INVITE_USER_TO_WORKSPACE,
        );
        const canDeleteWorkspace = hasDeleteWorkspacePermission(
          workspace?.userPermissions || [],
        );
        const hasCreateNewApplicationPermission =
          hasCreateNewAppPermission(workspace.userPermissions) && !isMobile;

        const showWorkspaceMenuOptions =
          canInviteToWorkspace ||
          hasManageWorkspacePermissions ||
          hasCreateNewApplicationPermission ||
          canDeleteWorkspace;

        return (
          <WorkspaceSection
            className="t--workspace-section"
            isMobile={isMobile}
            key={index}
          >
            <WorkspaceDropDown isMobile={isMobile}>
              {(currentUser || isFetchingApplications) &&
                WorkspaceMenuTarget({
                  workspaceName: workspace.name,
                  workspaceSlug: workspace.id,
                })}
              {selectedWorkspaceIdForImportApplication && (
                <ImportApplicationModal
                  isModalOpen={
                    selectedWorkspaceIdForImportApplication === workspace.id
                  }
                  onClose={() => setSelectedWorkspaceIdForImportApplication("")}
                  workspaceId={selectedWorkspaceIdForImportApplication}
                />
              )}
              {!isFetchingApplications && (
                <WorkspaceShareUsers>
                  <SharedUserList workspaceId={workspace.id} />
                  {canInviteToWorkspace && !isMobile && (
                    <FormDialogComponent
                      Form={WorkspaceInviteUsersForm}
                      canOutsideClickClose
                      message={createMessage(INVITE_USERS_MESSAGE)}
                      placeholder={createMessage(INVITE_USERS_PLACEHOLDER)}
                      title={`邀请小伙伴到应用组 ${workspace.name}`}
                      trigger={
                        <Button
                          category={Category.secondary}
                          icon={"share-line"}
                          size={Size.medium}
                          tag="button"
                          text={"分享"}
                        />
                      }
                      workspaceId={workspace.id}
                    />
                  )}
                  {hasCreateNewApplicationPermission &&
                    !isFetchingApplications &&
                    applications.length !== 0 && [
                      <CreateApp
                        key="pc"
                        orgId={workspace.id}
                        applications={applications}
                      />,
                      <CreateApp
                        key="mobile"
                        orgId={workspace.id}
                        applications={applications}
                        isMobile
                      />,
                    ]}
                  {(currentUser || isFetchingApplications) &&
                    !isMobile &&
                    showWorkspaceMenuOptions && (
                      <Menu
                        autoFocus={false}
                        className="t--workspace-name"
                        closeOnItemClick
                        cypressSelector="t--workspace-name"
                        disabled={isFetchingApplications}
                        isOpen={workspace.id === workspaceToOpenMenu}
                        onClose={() => {
                          setWorkspaceToOpenMenu(null);
                        }}
                        onClosing={() => {
                          setWarnLeavingWorkspace(false);
                          setWarnDeleteWorkspace(false);
                        }}
                        position={Position.BOTTOM_RIGHT}
                        target={
                          <Icon
                            className="t--options-icon"
                            name="context-menu"
                            onClick={() => {
                              setWorkspaceToOpenMenu(workspace.id);
                            }}
                            size={IconSize.XXXL}
                          />
                        }
                      >
                        {hasManageWorkspacePermissions && (
                          <>
                            <div className="px-3 py-2">
                              <WorkspaceRename
                                cypressSelector="t--workspace-rename-input"
                                defaultValue={workspace.name}
                                editInteractionKind={EditInteractionKind.SINGLE}
                                fill
                                hideEditIcon={false}
                                isEditingDefault={false}
                                isInvalid={(value: string) => {
                                  return notEmptyValidator(value).message;
                                }}
                                onBlur={(value: string) => {
                                  WorkspaceNameChange(value, workspace.id);
                                }}
                                placeholder="应用组名称"
                                savingState={
                                  isSavingWorkspaceInfo
                                    ? SavingState.STARTED
                                    : SavingState.NOT_STARTED
                                }
                                underline
                              />
                            </div>
                            <MenuItem
                              cypressSelector="t--workspace-setting"
                              icon="settings-2-line"
                              onSelect={() =>
                                getOnSelectAction(
                                  DropdownOnSelectActions.REDIRECT,
                                  {
                                    path: `/workspace/${workspace.id}/settings/general`,
                                  },
                                )
                              }
                              text="配置"
                            />
                          </>
                        )}
                        {enableImportExport &&
                          hasCreateNewApplicationPermission && (
                            <MenuItem
                              cypressSelector="t--workspace-import-app"
                              icon="download"
                              onSelect={() =>
                                setSelectedWorkspaceIdForImportApplication(
                                  workspace.id,
                                )
                              }
                              text="导入"
                            />
                          )}
                        {hasManageWorkspacePermissions && canInviteToWorkspace && (
                          <MenuItem
                            icon="member"
                            onSelect={() =>
                              getOnSelectAction(
                                DropdownOnSelectActions.REDIRECT,
                                {
                                  path: `/workspace/${workspace.id}/settings/members`,
                                },
                              )
                            }
                            text="成员"
                          />
                        )}
                        {canInviteToWorkspace && (
                          <MenuItem
                            icon="logout"
                            onSelect={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              !warnLeavingWorkspace
                                ? setWarnLeavingWorkspace(true)
                                : leaveWS(workspace.id);
                            }}
                            text={
                              !warnLeavingWorkspace
                                ? "退出应用组"
                                : "确定退出应用组吗？"
                            }
                            type={!warnLeavingWorkspace ? undefined : "warning"}
                          />
                        )}
                        {applications.length === 0 && canDeleteWorkspace && (
                          <MenuItem
                            icon="trash"
                            onSelect={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              warnDeleteWorkspace
                                ? handleDeleteWorkspace(workspace.id)
                                : setWarnDeleteWorkspace(true);
                            }}
                            text={
                              !warnDeleteWorkspace
                                ? "删除应用组"
                                : "确定删除应用组吗？"
                            }
                            type={!warnDeleteWorkspace ? undefined : "warning"}
                          />
                        )}
                      </Menu>
                    )}
                </WorkspaceShareUsers>
              )}
            </WorkspaceDropDown>
            <ApplicationCardsWrapper isMobile={isMobile} key={workspace.id}>
              {applications.map((application: any) => {
                return (
                  <PaddingWrapper isMobile={isMobile} key={application.id}>
                    <ApplicationCard
                      application={application}
                      delete={deleteApplication}
                      duplicate={duplicateApplicationDispatch}
                      enableImportExport={enableImportExport}
                      hasCreateNewApplicationPermission={
                        hasCreateNewApplicationPermission
                      }
                      isMobile={isMobile}
                      key={application.id}
                      update={updateApplicationDispatch}
                    />
                  </PaddingWrapper>
                );
              })}
              {applications.length === 0 && (
                <NoAppsFound>
                  <NoAppsFoundIcon />
                  <span>应用组是空的</span>
                  {/* below component is duplicate. This is because of cypress test were failing */}
                  {hasCreateNewApplicationPermission && (
                    <div
                      className="flex justify-between"
                      style={{ width: 272 }}
                    >
                      <CreateApp
                        key="pc"
                        orgId={workspace.id}
                        applications={applications}
                      />
                      <CreateApp
                        key="mobile"
                        orgId={workspace.id}
                        applications={applications}
                        isMobile
                      />
                    </div>
                  )}
                </NoAppsFound>
              )}
            </ApplicationCardsWrapper>
          </WorkspaceSection>
        );
      },
    );
  }

  return (
    <ApplicationContainer
      className="t--applications-container"
      isMobile={isMobile}
    >
      {workspacesListComponent}
      <>
        <GitSyncModal isImport />
        <DisconnectGitModal />
      </>
      <ReconnectDatasourceModal />
    </ApplicationContainer>
  );
}

type ApplicationProps = {
  applicationList: ApplicationPayload[];
  searchApplications: (keyword: string) => void;
  isCreatingApplication: creatingApplicationMap;
  isFetchingApplications: boolean;
  createApplicationError?: string;
  deleteApplication: (id: string) => void;
  deletingApplication: boolean;
  duplicatingApplication: boolean;
  getAllApplication: () => void;
  userWorkspaces: any;
  currentUser?: User;
  searchKeyword: string | undefined;
  setHeaderMetaData: (
    hideHeaderShadow: boolean,
    showHeaderSeparator: boolean,
  ) => void;
  resetEditor: () => void;
};

class Applications extends Component<
  ApplicationProps,
  { selectedWorkspaceId: string; showOnboardingForm: boolean }
> {
  constructor(props: ApplicationProps) {
    super(props);

    this.state = {
      selectedWorkspaceId: "",
      showOnboardingForm: false,
    };
  }

  componentDidMount() {
    PerformanceTracker.stopTracking(PerformanceTransactionName.LOGIN_CLICK);
    PerformanceTracker.stopTracking(PerformanceTransactionName.SIGN_UP);
    if (!this.props.userWorkspaces.length) {
      this.props.getAllApplication();
    }
    this.props.setHeaderMetaData(true, true);
  }

  componentWillUnmount() {
    this.props.setHeaderMetaData(false, false);
  }

  public render() {
    return (
      <PageWrapper displayName="应用管理">
        <LeftPane />
        <MediaQuery maxWidth={MOBILE_MAX_WIDTH}>
          {(matches: boolean) => (
            <ApplicationsWrapper isMobile={matches}>
              <SubHeader
                search={{
                  placeholder: createMessage(SEARCH_APPS),
                  queryFn: this.props.searchApplications,
                  defaultValue: this.props.searchKeyword,
                }}
              />
              <ApplicationsSection searchKeyword={this.props.searchKeyword} />
              <RepoLimitExceededErrorModal />
            </ApplicationsWrapper>
          )}
        </MediaQuery>
      </PageWrapper>
    );
  }
}

const mapStateToProps = (state: AppState) => ({
  applicationList: getApplicationList(state),
  isFetchingApplications: getIsFetchingApplications(state),
  isCreatingApplication: getIsCreatingApplication(state),
  createApplicationError: getCreateApplicationError(state),
  deletingApplication: getIsDeletingApplication(state),
  duplicatingApplication: getIsDuplicatingApplication(state),
  userWorkspaces: getUserApplicationsWorkspacesList(state),
  currentUser: getCurrentUser(state),
  searchKeyword: getApplicationSearchKeyword(state),
});

const mapDispatchToProps = (dispatch: any) => ({
  getAllApplication: () => {
    dispatch({ type: ReduxActionTypes.GET_ALL_APPLICATION_INIT });
  },
  resetEditor: () => {
    dispatch(resetEditorRequest());
  },
  searchApplications: (keyword: string) => {
    dispatch({
      type: ReduxActionTypes.SEARCH_APPLICATIONS,
      payload: {
        keyword,
      },
    });
  },
  setHeaderMetaData: (
    hideHeaderShadow: boolean,
    showHeaderSeparator: boolean,
  ) => {
    dispatch(setHeaderMeta(hideHeaderShadow, showHeaderSeparator));
  },
});

export default connect(mapStateToProps, mapDispatchToProps)(Applications);
