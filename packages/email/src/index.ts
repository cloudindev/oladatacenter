/**
 * `@ola/email` — transactional email for OLA VPS Cloud.
 *
 * Templates render with @react-email/components to table-based HTML with inline styles
 * only, and every one of them ships a plain-text twin. No environment variable is read
 * here: the caller injects the provider client, the `from` address and every URL.
 */

// tokens and formatting
export {
  COMPANY_CITY,
  COMPANY_NAME,
  CUSTOMER_AREA_URL,
  colors,
  FONT_STACK,
  MAX_WIDTH,
  MONO_STACK,
  SIGNATURE,
} from "./theme"
export {
  type DateInput,
  EmailFormatError,
  formatDate,
  formatDateTime,
  formatDays,
  formatMinutes,
  formatMoney,
  plainRows,
  plainText,
  spaceCode,
  toDate,
} from "./format"

// layout primitives, for anyone adding a template
export {
  Button,
  Callout,
  CodeValue,
  DataTable,
  type DataTableRow,
  EmailLayout,
  type EmailLayoutProps,
  Eyebrow,
  Heading,
  Muted,
  Paragraph,
  Rule,
  UrlFallback,
} from "./layout"
export { type BaseEmailProps, greeting } from "./templates/common"

// rendering
export {
  EMAIL_TEMPLATE_NAMES,
  type EmailMessage,
  type EmailPropsMap,
  type EmailTemplateName,
  emailSubject,
  isInternalTemplate,
  type RenderedEmail,
  renderEmail,
  renderMessage,
} from "./render"

// sending
export {
  type EmailSender,
  EmailSendError,
  MockEmailSender,
  type OutboundEmail,
  ResendSender,
  type ResendLike,
  type ResendSenderOptions,
  resendSender,
  type SendResult,
  type SentEmail,
} from "./sender"

// per-template props and components
export { type AccountVerifiedProps, AccountVerifiedEmail } from "./templates/account-verified"
export { type AdminAlertProps, AdminAlertEmail, type AlertSeverity } from "./templates/admin-alert"
export { type CreditExpiringProps, CreditExpiringEmail } from "./templates/credit-expiring"
export { type OrderDelayedProps, OrderDelayedEmail } from "./templates/order-delayed"
export { type OrderFailedProps, OrderFailedEmail } from "./templates/order-failed"
export { type OrderReceivedProps, OrderReceivedEmail } from "./templates/order-received"
export { type PasswordResetProps, PasswordResetEmail } from "./templates/password-reset"
export { type PaymentFailedProps, PaymentFailedEmail } from "./templates/payment-failed"
export { type PaymentReminderProps, PaymentReminderEmail } from "./templates/payment-reminder"
export { type DeletionWarningProps, DeletionWarningEmail } from "./templates/deletion-warning"
export { type PhoneOtpProps, PhoneOtpEmail } from "./templates/phone-otp"
export { type RenewalUpcomingProps, RenewalUpcomingEmail } from "./templates/renewal-upcoming"
export { type ServerReadyProps, ServerReadyEmail } from "./templates/server-ready"
export { type ServiceSuspendedProps, ServiceSuspendedEmail } from "./templates/service-suspended"
export {
  type ServiceTerminatingProps,
  ServiceTerminatingEmail,
} from "./templates/service-terminating"
export { type UpgradeCompleteProps, UpgradeCompleteEmail } from "./templates/upgrade-complete"
export { type WelcomeVerifyProps, WelcomeVerifyEmail } from "./templates/welcome-verify"
