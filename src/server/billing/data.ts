/**
 * The billing data port.
 *
 * Every read and write the billing services need, expressed as one interface. The Drizzle
 * implementation lives in `store.ts`; the test suite passes an in-memory one. That is what
 * makes checkout, credit, dunning classification and the webhook unit-testable with no
 * Postgres anywhere near them.
 *
 * Money is integer cents. Nothing here ever deletes a row from `orders`, `services`,
 * `invoices` or `credits`: statuses and timestamps carry the state.
 */
import type { Cents, CreditReason, OrderKind, OrderStatus, Term } from "@ola/core"

// ─── records ─────────────────────────────────────────────────────────────────

/** The customer as billing needs it: the `customers` row joined with its user. */
export interface BillingCustomer {
  id: string
  userId: string
  email: string
  kind: "company" | "individual"
  legalName: string | null
  country: string | null
  taxId: string | null
  taxIdValidated: boolean
  status: string
  phone: string | null
  phoneVerifiedAt: Date | null
  emailVerifiedAt: Date | null
  whmcsClientId: number | null
  stripeCustomerId: string | null
  /** Set on the first non-zero payment. `null` means the trial limits still apply. */
  firstPaidAt: Date | null
  /** True when the postal address WHMCS needs is complete. */
  billingComplete: boolean
}

export interface PaymentMethodRecord {
  id: string
  customerId: string
  stripePaymentMethodId: string
  fingerprint: string | null
  brand: string | null
  last4: string | null
  expMonth: number | null
  expYear: number | null
  verifiedAt: Date | null
  isDefault: boolean
  detachedAt: Date | null
  createdAt: Date
}

export interface NewPaymentMethod {
  customerId: string
  stripePaymentMethodId: string
  fingerprint: string | null
  brand: string | null
  last4: string | null
  expMonth: number | null
  expYear: number | null
  verifiedAt: Date | null
  isDefault: boolean
}

export interface CreditRecord {
  id: string
  customerId: string
  amount: Cents
  consumed: Cents
  reason: CreditReason
  note: string | null
  expiresAt: Date | null
  signals: Record<string, string | null> | null
  createdAt: Date
}

export interface NewCredit {
  customerId: string
  amount: Cents
  reason: CreditReason
  note: string | null
  expiresAt: Date | null
  signals: Record<string, string | null> | null
}

/** One past welcome grant, for the duplicate-signal check across every customer. */
export interface WelcomeGrant {
  customerId: string
  grantedAt: Date
  signals: Record<string, string | null> | null
}

export interface OrderRecord {
  id: string
  customerId: string
  kind: OrderKind
  status: OrderStatus
  serviceId: string | null
  items: Record<string, unknown>
  term: Term
  subtotal: Cents
  tax: Cents
  creditApplied: Cents
  total: Cents
  expectedCost: Cents
  stripePaymentIntentId: string | null
  whmcsOrderId: number | null
  whmcsInvoiceId: number | null
  completedSteps: string[]
  idempotencyKey: string
  error: string | null
  errorCode: string | null
  paidAt: Date | null
  deliveredAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface NewOrder {
  customerId: string
  kind: OrderKind
  status: OrderStatus
  serviceId: string | null
  items: Record<string, unknown>
  term: Term
  subtotal: Cents
  tax: Cents
  creditApplied: Cents
  total: Cents
  expectedCost: Cents
  idempotencyKey: string
  completedSteps?: string[]
}

export type OrderPatch = Partial<
  Pick<
    OrderRecord,
    | "status"
    | "stripePaymentIntentId"
    | "whmcsOrderId"
    | "whmcsInvoiceId"
    | "completedSteps"
    | "error"
    | "errorCode"
    | "paidAt"
    | "creditApplied"
  >
>

export interface PaymentRecord {
  id: string
  customerId: string
  orderId: string | null
  invoiceId: string | null
  stripePaymentIntentId: string | null
  amount: Cents
  status: string
  failureCode: string | null
  failureMessage: string | null
  refundedAmount: Cents
  settledAt: Date | null
  createdAt: Date
}

export interface NewPayment {
  customerId: string
  orderId: string | null
  invoiceId: string | null
  stripePaymentIntentId: string | null
  amount: Cents
  status: string
  failureCode: string | null
  failureMessage: string | null
  settledAt: Date | null
}

export type PaymentPatch = Partial<
  Pick<PaymentRecord, "status" | "refundedAmount" | "failureCode" | "failureMessage" | "settledAt">
>

export interface InvoiceRecord {
  id: string
  customerId: string
  serviceId: string | null
  orderId: string | null
  whmcsInvoiceId: number
  number: string | null
  status: "unpaid" | "paid" | "cancelled" | "refunded"
  subtotal: Cents
  tax: Cents
  credit: Cents
  total: Cents
  dueAt: Date | null
  paidAt: Date | null
  createdAt: Date
}

export interface NewInvoice {
  customerId: string
  serviceId: string | null
  orderId: string | null
  whmcsInvoiceId: number
  number: string | null
  status: "unpaid" | "paid" | "cancelled" | "refunded"
  subtotal: Cents
  tax: Cents
  credit: Cents
  total: Cents
  dueAt: Date | null
  paidAt: Date | null
}

export type InvoicePatch = Partial<Pick<InvoiceRecord, "status" | "paidAt" | "number">>

/** The slice of a service the renewal charge needs. */
export interface BillingService {
  id: string
  customerId: string
  status: string
  displayName: string | null
  term: Term
  monthlyPrice: Cents
  nextDueAt: Date | null
  whmcsServiceId: number | null
}

export interface WebhookRecordResult {
  /** False when this provider+eventId pair was already stored: the caller must no-op. */
  fresh: boolean
  id: string
}

// ─── the port ────────────────────────────────────────────────────────────────

export interface BillingStore {
  // customers
  getCustomer(customerId: string): Promise<BillingCustomer | null>
  /** Reverse lookup for the webhook path, where only Stripe's own id is known. */
  findCustomerByStripeId(stripeCustomerId: string): Promise<BillingCustomer | null>
  setStripeCustomerId(customerId: string, stripeCustomerId: string): Promise<void>
  /** Only ever set once; a second call with a value already present is a no-op. */
  setFirstPaidAt(customerId: string, at: Date): Promise<boolean>
  flagCustomerForReview(customerId: string, note: string): Promise<void>

  // services
  countActiveServices(customerId: string): Promise<number>
  getService(serviceId: string): Promise<BillingService | null>

  // payment methods
  listPaymentMethods(customerId: string): Promise<PaymentMethodRecord[]>
  findPaymentMethodByStripeId(stripePaymentMethodId: string): Promise<PaymentMethodRecord | null>
  insertPaymentMethod(input: NewPaymentMethod): Promise<PaymentMethodRecord>
  /** Clears the flag on every other card of the customer in the same step. */
  setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void>
  markPaymentMethodDetached(paymentMethodId: string, at: Date): Promise<void>

  // credit
  listCredits(customerId: string): Promise<CreditRecord[]>
  insertCredit(input: NewCredit): Promise<CreditRecord>
  countCreditsByReason(customerId: string, reason: CreditReason): Promise<number>
  listWelcomeGrants(since: Date): Promise<WelcomeGrant[]>
  /**
   * Consumes `amount` cents across the customer's live entries, oldest expiry first, and
   * returns what was actually taken. Must be safe against two concurrent orders: the
   * implementation updates each row conditionally on its current `consumed` value.
   */
  consumeCredit(customerId: string, amount: Cents, orderId: string): Promise<Cents>

  // orders
  insertOrder(input: NewOrder): Promise<OrderRecord>
  getOrder(orderId: string): Promise<OrderRecord | null>
  findOrderByIdempotencyKey(idempotencyKey: string): Promise<OrderRecord | null>
  findOrderByPaymentIntent(paymentIntentId: string): Promise<OrderRecord | null>
  updateOrder(orderId: string, patch: OrderPatch): Promise<OrderRecord>
  listOrders(customerId: string, limit?: number): Promise<OrderRecord[]>

  // payments
  insertPayment(input: NewPayment): Promise<PaymentRecord>
  findPaymentByPaymentIntent(paymentIntentId: string): Promise<PaymentRecord | null>
  updatePayment(paymentId: string, patch: PaymentPatch): Promise<PaymentRecord>
  /** Non-zero settled charges, used to decide whether the trial limits still apply. */
  countSettledPayments(customerId: string): Promise<number>

  // invoices
  insertInvoice(input: NewInvoice): Promise<InvoiceRecord>
  listInvoices(customerId: string): Promise<InvoiceRecord[]>
  findInvoiceByWhmcsId(whmcsInvoiceId: number): Promise<InvoiceRecord | null>
  findUnpaidInvoiceForService(serviceId: string): Promise<InvoiceRecord | null>
  updateInvoice(invoiceId: string, patch: InvoicePatch): Promise<InvoiceRecord>

  // webhooks
  recordWebhookEvent(input: {
    provider: "stripe" | "whmcs"
    eventId: string
    eventType: string
    payload: Record<string, unknown>
  }): Promise<WebhookRecordResult>
  markWebhookProcessed(provider: "stripe" | "whmcs", eventId: string): Promise<void>
  markWebhookFailed(provider: "stripe" | "whmcs", eventId: string, error: string): Promise<void>
}
