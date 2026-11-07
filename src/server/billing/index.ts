/**
 * The billing API, free of Inngest and of any framework.
 *
 * Every function here is a plain async function with an optional dependency override, so it
 * can be called from an Inngest step, from a Server Action, from a Route Handler, from a
 * script or from a test. Nothing in billing imports the jobs layer; billing only ever
 * *emits* events (see `BILLING_EVENTS`).
 *
 * The two entry points the jobs layer calls:
 *
 *   chargeRenewal(serviceId)        -> RenewalChargeResult   (never throws on a decline)
 *   refundOrder(orderId, reason)    -> RefundResult
 */

export {
  checkoutConfigurationSchema,
  checkoutParamsSchema,
  chargeRenewal,
  confirmPendingPayment,
  createOrderDraft,
  flagDisputedPayment,
  formatCheckoutAmount,
  markOrderPaid,
  markOrderPaymentFailed,
  orderRef,
  payOrder,
  previewCheckout,
  recordExternalRefund,
  refundOrder,
  resolveCheckoutConfiguration,
  settlePaymentIntent,
  termLabelFor,
  toAdminChargeResult,
  type CheckoutBlock,
  type CheckoutQuoteView,
  type CheckoutSession,
  type CheckoutVatView,
  type PayOrderResult,
  type RefundResult,
  type RenewalChargeResult,
} from "./checkout"

export {
  orderProgress,
  PROGRESS_PHASES,
  type OrderProgressView,
  type PhaseState,
  type ProgressPhase,
} from "./progress"

export {
  HANDLED_STRIPE_EVENTS,
  handleStripeWebhook,
  type HandledStripeEvent,
  type WebhookOutcome,
} from "./webhook"

export {
  consumeCredit,
  creditSummary,
  customerCredit,
  grantWelcomeCredit,
  type CreditSummary,
  type WelcomeCreditResult,
} from "./credit"

export {
  LastCardError,
  confirmCardSetup,
  defaultPaymentMethod,
  detachPaymentMethod,
  listPaymentMethods,
  setDefaultPaymentMethod,
  startCardSetup,
  type CardSetupTicket,
} from "./payment-methods"

export {
  listBillingInvoices,
  listInvoiceViews,
  type BillingInvoiceView,
  type BillingInvoicesResult,
} from "./invoices"

export { setBillingDeps } from "./deps"
export { BILLING_EVENTS } from "./ports"
export type {
  BillingDeps,
  BillingDepsOverride,
  BillingEvent,
  BillingEventName,
  CheckoutConfiguration,
  PublicLine,
} from "./ports"
export type {
  BillingCustomer,
  BillingStore,
  CreditRecord,
  InvoiceRecord,
  OrderRecord,
  PaymentMethodRecord,
  PaymentRecord,
} from "./data"
export type { PaymentFailure, PaymentFailureReason } from "@/lib/stripe/failures"
