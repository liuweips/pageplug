import React, { useEffect } from "react";
import { connect, useDispatch } from "react-redux";
import { withRouter, RouteComponentProps, Link } from "react-router-dom";
import {
  change,
  reduxForm,
  InjectedFormProps,
  formValueSelector,
} from "redux-form";
import StyledForm from "components/editorComponents/Form";
import {
  FormActions,
  BlackAuthCardNavLink,
  FormMessagesContainer,
} from "./StyledComponents";
import { withTheme } from "styled-components";
import { Theme } from "constants/DefaultTheme";
import {
  FORGOT_PASSWORD_PAGE_EMAIL_INPUT_LABEL,
  FORGOT_PASSWORD_PAGE_EMAIL_INPUT_PLACEHOLDER,
  FORGOT_PASSWORD_PAGE_SUBMIT_BUTTON_TEXT,
  FORGOT_PASSWORD_PAGE_TITLE,
  FORM_VALIDATION_EMPTY_EMAIL,
  FORM_VALIDATION_INVALID_EMAIL,
  FORGOT_PASSWORD_SUCCESS_TEXT,
  FORGOT_PASSWORD_PAGE_LOGIN_LINK,
  createMessage,
} from "@appsmith/constants/messages";
import { AUTH_LOGIN_URL } from "constants/routes";
import { FORGOT_PASSWORD_FORM_NAME } from "@appsmith/constants/forms";
import FormTextField from "components/utils/ReduxFormTextField";
import { Button, FormGroup, FormMessage, Size } from "design-system";
import { Icon } from "@blueprintjs/core";
import { isEmail, isEmptyString } from "utils/formhelpers";
import {
  ForgotPasswordFormValues,
  forgotPasswordSubmitHandler,
} from "./helpers";
import { getAppsmithConfigs } from "@appsmith/configs";
import Container from "./Container";

const { mailEnabled } = getAppsmithConfigs();

const validate = (values: ForgotPasswordFormValues) => {
  const errors: ForgotPasswordFormValues = {};
  if (!values.email || isEmptyString(values.email)) {
    errors.email = createMessage(FORM_VALIDATION_EMPTY_EMAIL);
  } else if (!isEmail(values.email)) {
    errors.email = createMessage(FORM_VALIDATION_INVALID_EMAIL);
  }
  return errors;
};

type ForgotPasswordProps = InjectedFormProps<
  ForgotPasswordFormValues,
  { emailValue: string }
> &
  RouteComponentProps<{ email: string }> & { emailValue: string };

export const ForgotPassword = withTheme(
  (props: ForgotPasswordProps & { theme: Theme }) => {
    const {
      error,
      handleSubmit,
      submitFailed,
      submitSucceeded,
      submitting,
    } = props;
    const dispatch = useDispatch();

    useEffect(() => {
      if (submitSucceeded) {
        props.reset();
        dispatch(change(FORGOT_PASSWORD_FORM_NAME, "email", ""));
      }
    }, [props.emailValue]);

    return (
      <Container
        subtitle={
          <BlackAuthCardNavLink className="text-sm" to={AUTH_LOGIN_URL}>
            <Icon
              icon="arrow-left"
              style={{ marginRight: props.theme.spaces[3] }}
            />
            {createMessage(FORGOT_PASSWORD_PAGE_LOGIN_LINK)}
          </BlackAuthCardNavLink>
        }
        title={createMessage(FORGOT_PASSWORD_PAGE_TITLE)}
      >
        <FormMessagesContainer>
          {submitSucceeded && (
            <FormMessage
              intent="lightSuccess"
              message={createMessage(
                FORGOT_PASSWORD_SUCCESS_TEXT,
                props.emailValue,
              )}
            />
          )}
          {!mailEnabled && (
            <FormMessage
              actions={[
                {
                  linkElement: (
                    <a
                      href="https://docs.appsmith.com/v/v1.2.1/setup/docker/email"
                      rel="noreferrer"
                      target="_blank"
                    >
                      配置邮件服务
                    </a>
                  ),
                  text: "配置邮件服务",
                  intent: "primary",
                },
              ]}
              intent="warning"
              linkAs={Link}
              message={"系统未开通邮件服务，不能正常发送重置邮件"}
            />
          )}
          {submitFailed && error && (
            <FormMessage intent="warning" message={error} />
          )}
        </FormMessagesContainer>
        <StyledForm onSubmit={handleSubmit(forgotPasswordSubmitHandler)}>
          <FormGroup
            intent={error ? "danger" : "none"}
            label={createMessage(FORGOT_PASSWORD_PAGE_EMAIL_INPUT_LABEL)}
          >
            <FormTextField
              disabled={submitting}
              name="email"
              placeholder={createMessage(
                FORGOT_PASSWORD_PAGE_EMAIL_INPUT_PLACEHOLDER,
              )}
            />
          </FormGroup>
          <FormActions>
            <Button
              disabled={!isEmail(props.emailValue)}
              fill
              isLoading={submitting}
              size={Size.large}
              tag="button"
              text={createMessage(FORGOT_PASSWORD_PAGE_SUBMIT_BUTTON_TEXT)}
              type="submit"
            />
          </FormActions>
        </StyledForm>
      </Container>
    );
  },
);

const selector = formValueSelector(FORGOT_PASSWORD_FORM_NAME);

export default connect((state, props: ForgotPasswordProps) => {
  const queryParams = new URLSearchParams(props.location.search);
  return {
    initialValues: {
      email: queryParams.get("email") || "",
    },
    emailValue: selector(state, "email"),
  };
})(
  reduxForm<ForgotPasswordFormValues, { emailValue: string }>({
    validate,
    form: FORGOT_PASSWORD_FORM_NAME,
    touchOnBlur: true,
  })(withRouter(ForgotPassword)),
);
