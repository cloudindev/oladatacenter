/**
 * The template registry and the only way to turn a template plus its props into a sendable
 * message. `EmailMessage` is a discriminated union keyed by template name, so a caller that
 * passes the props of a different template does not compile.
 */
import * as React from "react"
import { render } from "@react-email/components"

import * as accountVerified from "./templates/account-verified"
import * as adminAlert from "./templates/admin-alert"
import * as creditExpiring from "./templates/credit-expiring"
import * as deletionWarning from "./templates/deletion-warning"
import * as orderDelayed from "./templates/order-delayed"
import * as orderFailed from "./templates/order-failed"
import * as orderReceived from "./templates/order-received"
import * as passwordReset from "./templates/password-reset"
import * as paymentFailed from "./templates/payment-failed"
import * as paymentReminder from "./templates/payment-reminder"
import * as phoneOtp from "./templates/phone-otp"
import * as renewalUpcoming from "./templates/renewal-upcoming"
import * as serverReady from "./templates/server-ready"
import * as serviceSuspended from "./templates/service-suspended"
import * as serviceTerminating from "./templates/service-terminating"
import * as upgradeComplete from "./templates/upgrade-complete"
import * as welcomeVerify from "./templates/welcome-verify"

/** Props accepted by each template, keyed by template name. */
export interface EmailPropsMap {
  "welcome-verify": welcomeVerify.WelcomeVerifyProps
  "phone-otp": phoneOtp.PhoneOtpProps
  "password-reset": passwordReset.PasswordResetProps
  "account-verified": accountVerified.AccountVerifiedProps
  "order-received": orderReceived.OrderReceivedProps
  "server-ready": serverReady.ServerReadyProps
  "order-delayed": orderDelayed.OrderDelayedProps
  "order-failed": orderFailed.OrderFailedProps
  "renewal-upcoming": renewalUpcoming.RenewalUpcomingProps
  "payment-reminder": paymentReminder.PaymentReminderProps
  "payment-failed": paymentFailed.PaymentFailedProps
  "service-suspended": serviceSuspended.ServiceSuspendedProps
  "deletion-warning": deletionWarning.DeletionWarningProps
  "service-terminating": serviceTerminating.ServiceTerminatingProps
  "upgrade-complete": upgradeComplete.UpgradeCompleteProps
  "credit-expiring": creditExpiring.CreditExpiringProps
  "admin-alert": adminAlert.AdminAlertProps
}

export type EmailTemplateName = keyof EmailPropsMap

/** One template name bound to its own props. Nothing else type-checks. */
export type EmailMessage = {
  [K in EmailTemplateName]: { template: K; props: EmailPropsMap[K] }
}[EmailTemplateName]

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

interface TemplateDefinition<P> {
  Component: React.FunctionComponent<P>
  subject: (props: P) => string
  text: (props: P) => string
}

type TemplateRegistry = { [K in EmailTemplateName]: TemplateDefinition<EmailPropsMap[K]> }

const TEMPLATES: TemplateRegistry = {
  "welcome-verify": {
    Component: welcomeVerify.WelcomeVerifyEmail,
    subject: welcomeVerify.subject,
    text: welcomeVerify.text,
  },
  "phone-otp": {
    Component: phoneOtp.PhoneOtpEmail,
    subject: phoneOtp.subject,
    text: phoneOtp.text,
  },
  "password-reset": {
    Component: passwordReset.PasswordResetEmail,
    subject: passwordReset.subject,
    text: passwordReset.text,
  },
  "account-verified": {
    Component: accountVerified.AccountVerifiedEmail,
    subject: accountVerified.subject,
    text: accountVerified.text,
  },
  "order-received": {
    Component: orderReceived.OrderReceivedEmail,
    subject: orderReceived.subject,
    text: orderReceived.text,
  },
  "server-ready": {
    Component: serverReady.ServerReadyEmail,
    subject: serverReady.subject,
    text: serverReady.text,
  },
  "order-delayed": {
    Component: orderDelayed.OrderDelayedEmail,
    subject: orderDelayed.subject,
    text: orderDelayed.text,
  },
  "order-failed": {
    Component: orderFailed.OrderFailedEmail,
    subject: orderFailed.subject,
    text: orderFailed.text,
  },
  "renewal-upcoming": {
    Component: renewalUpcoming.RenewalUpcomingEmail,
    subject: renewalUpcoming.subject,
    text: renewalUpcoming.text,
  },
  "payment-reminder": {
    Component: paymentReminder.PaymentReminderEmail,
    subject: paymentReminder.subject,
    text: paymentReminder.text,
  },
  "payment-failed": {
    Component: paymentFailed.PaymentFailedEmail,
    subject: paymentFailed.subject,
    text: paymentFailed.text,
  },
  "service-suspended": {
    Component: serviceSuspended.ServiceSuspendedEmail,
    subject: serviceSuspended.subject,
    text: serviceSuspended.text,
  },
  "deletion-warning": {
    Component: deletionWarning.DeletionWarningEmail,
    subject: deletionWarning.subject,
    text: deletionWarning.text,
  },
  "service-terminating": {
    Component: serviceTerminating.ServiceTerminatingEmail,
    subject: serviceTerminating.subject,
    text: serviceTerminating.text,
  },
  "upgrade-complete": {
    Component: upgradeComplete.UpgradeCompleteEmail,
    subject: upgradeComplete.subject,
    text: upgradeComplete.text,
  },
  "credit-expiring": {
    Component: creditExpiring.CreditExpiringEmail,
    subject: creditExpiring.subject,
    text: creditExpiring.text,
  },
  "admin-alert": {
    Component: adminAlert.AdminAlertEmail,
    subject: adminAlert.subject,
    text: adminAlert.text,
  },
}

/** Every template name, in sending order of the customer lifecycle. */
export const EMAIL_TEMPLATE_NAMES = Object.keys(TEMPLATES) as readonly EmailTemplateName[]

/** True for templates that go to the team mailbox instead of a customer. */
export function isInternalTemplate(template: EmailTemplateName): boolean {
  return template === "admin-alert"
}

/** Subject line without rendering the body. Useful for logs and for the outbox table. */
export function emailSubject<K extends EmailTemplateName>(
  template: K,
  props: EmailPropsMap[K],
): string {
  return TEMPLATES[template].subject(props)
}

/** Renders one template to the three parts a provider needs. */
export async function renderEmail<K extends EmailTemplateName>(
  template: K,
  props: EmailPropsMap[K],
): Promise<RenderedEmail> {
  const definition: TemplateDefinition<EmailPropsMap[K]> = TEMPLATES[template]
  const html = await render(React.createElement(definition.Component, props))
  return {
    subject: definition.subject(props),
    html,
    text: definition.text(props),
  }
}

/** Same thing for an already-built message. */
export function renderMessage(message: EmailMessage): Promise<RenderedEmail> {
  return renderEmail(message.template, message.props)
}
