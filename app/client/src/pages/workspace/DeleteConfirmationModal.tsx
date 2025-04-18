import React from "react";
import styled from "styled-components";
import {
  Button,
  Category,
  DialogComponent as Dialog,
  Size,
  Text,
  TextType,
  Variant,
} from "design-system";
import {
  DELETE_CONFIRMATION_MODAL_TITLE,
  DELETE_CONFIRMATION_MODAL_SUBTITLE,
} from "@appsmith/constants/messages";
import { Classes } from "@blueprintjs/core";
import { Colors } from "constants/Colors";

const StyledDialog = styled(Dialog)`
  && .${Classes.DIALOG_BODY} {
    padding-top: 0px;
  }
`;

const LeftContainer = styled.div`
  text-align: left;
`;

const ImportButton = styled(Button)<{ disabled?: boolean }>`
  height: 30px;
  width: 86px;
  pointer-events: ${(props) => (!!props.disabled ? "none" : "auto")};
`;

const ButtonWrapper = styled.div`
  display: flex;
  justify-content: end;
  margin-top: 20px;

  & > a {
    margin: 0 4px;
  }
`;

type DeleteConfirmationProps = {
  username?: string | null;
  name?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeletingUser: boolean;
};

function DeleteConfirmationModal(props: DeleteConfirmationProps) {
  const { isDeletingUser, isOpen, name, onClose, onConfirm, username } = props;

  return (
    <StyledDialog
      canOutsideClickClose
      className={"t--member-delete-confirmation-modal"}
      headerIcon={{
        name: "delete",
        fillColor: Colors.DANGER_SOLID,
        hoverColor: Colors.DANGER_SOLID_HOVER,
      }}
      isOpen={isOpen}
      maxHeight={"540px"}
      width={"400px"}
      setModalClose={onClose}
      title={DELETE_CONFIRMATION_MODAL_TITLE()}
    >
      <LeftContainer>
        <Text textAlign="center" type={TextType.P1}>
          {DELETE_CONFIRMATION_MODAL_SUBTITLE(name || username)}
        </Text>
        <ButtonWrapper>
          <ImportButton
            category={Category.secondary}
            className=".button-item"
            onClick={onClose}
            size={Size.large}
            text={"取消"}
            variant={Variant.danger}
          />
          <ImportButton
            className=".button-item"
            cypressSelector={"t--workspace-leave-button"}
            isLoading={isDeletingUser}
            onClick={onConfirm}
            size={Size.large}
            text={"移除"}
            variant={Variant.danger}
          />
        </ButtonWrapper>
      </LeftContainer>
    </StyledDialog>
  );
}

export default DeleteConfirmationModal;
