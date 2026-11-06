/**
 * The Stripe port.
 *
 * Nothing outside `src/lib/stripe` knows the Stripe SDK exists: the billing services take
 * this interface as a dependency, which is what lets the whole checkout run offline against
 * `MockStripe`. The DTOs below are deliberately narrow — only the fields we persist or
 * branch on — so the mock stays small and every field is typed.
 *
 * Money is integer cents of EUR, like the rest of the platform.
 */

export const STRIPE_CURRENCY = "eur"

/** Stripe's API version this codebase is written against. Pinned, never "latest". */
export const STRIPE_API_VERSION = "2025-02-24.acacia"

export type StripeSetupIntentStatus =
  | "requires_payment_method"
  | "requires_confirmation"
  | "requires_action"
  | "processing"
  | "canceled"
  | "succeeded"

export interface StripeSetupIntent {
  id: string
  /** Safe to send to the browser: it only authorises this one intent. */
  clientSecret: string | null
  status: StripeSetupIntentStatus
  customerId: string | null
  paymentMethodId: string | null
}

export interface StripeCardDetails {
  brand: string
  last4: string
  expMonth: number
  expYear: number
  /**
   * Stripe's stable per-card identifier. It is the same across customers, which is exactly
   * why it is one of the welcome-credit fraud signals. It is not a card number and carries
   * no PAN, but it is still never logged.
   */
  fingerprint: string | null
}

export interface StripePaymentMethod {
  id: string
  customerId: string | null
  card: StripeCardDetails | null
}

export type StripePaymentIntentStatus =
  | "requires_payment_method"
  | "requires_confirmation"
  | "requires_action"
  | "processing"
  | "requires_capture"
  | "canceled"
  | "succeeded"

export interface StripeErrorInfo {
  code: string | null
  declineCode: string | null
  message: string
}

export interface StripePaymentIntent {
  id: string
  status: StripePaymentIntentStatus
  /** Integer cents, as charged. */
  amount: number
  currency: string
  clientSecret: string | null
  customerId: string | null
  paymentMethodId: string | null
  latestChargeId: string | null
  lastPaymentError: StripeErrorInfo | null
}

export interface StripeRefund {
  id: string
  paymentIntentId: string
  amount: number
  status: string
}

export interface StripeWebhookEvent {
  id: string
  type: string
  /** `event.data.object`, untyped on purpose: each handler validates what it needs. */
  object: Record<string, unknown>
}

export interface EnsureCustomerInput {
  /** Reuse this Stripe customer when it is still usable. */
  stripeCustomerId?: string | null
  email: string
  name?: string | null
  /** Never put anything secret in here; it is readable in the Stripe dashboard. */
  metadata?: Readonly<Record<string, string>>
}

export interface CreateSetupIntentInput {
  stripeCustomerId: string
  idempotencyKey?: string
  metadata?: Readonly<Record<string, string>>
}

export interface CreatePaymentIntentInput {
  /** Integer cents. Always computed on the server from the quote. */
  amount: number
  stripeCustomerId: string
  paymentMethodId: string
  /**
   * The order's `idempotencyKey`. Stripe replays the first response for a repeated key,
   * which is what makes a double submit impossible to double charge.
   */
  idempotencyKey: string
  /** True for a renewal or a checkout the customer is not watching. */
  offSession: boolean
  /** Confirm in the same call. We always do: the card is already on file. */
  confirm: boolean
  description: string
  metadata?: Readonly<Record<string, string>>
}

export interface ConfirmPaymentIntentInput {
  idempotencyKey?: string
  paymentMethodId?: string
}

export interface CreateRefundInput {
  paymentIntentId: string
  /** Stripe's own reason vocabulary. */
  reason?: "duplicate" | "fraudulent" | "requested_by_customer"
  idempotencyKey?: string
  metadata?: Readonly<Record<string, string>>
}

/**
 * Every failure the gateway surfaces, normalised. `code` and `declineCode` are what
 * `classifyStripeFailure` reads to decide whether the dunning job should retry.
 */
export class StripeGatewayError extends Error {
  readonly code: string | null
  readonly declineCode: string | null
  readonly stripeType: string | null

  constructor(
    message: string,
    options: {
      code?: string | null
      declineCode?: string | null
      stripeType?: string | null
      cause?: unknown
    } = {},
  ) {
    super(message, { cause: options.cause })
    this.name = "StripeGatewayError"
    this.code = options.code ?? null
    this.declineCode = options.declineCode ?? null
    this.stripeType = options.stripeType ?? null
  }
}

/** Raised when a webhook body does not match its signature header. Never retried. */
export class StripeSignatureError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "StripeSignatureError"
  }
}

export interface StripeGateway {
  /** Creates the Stripe customer, or returns the existing one unchanged. */
  ensureCustomer(input: EnsureCustomerInput): Promise<{ id: string }>

  /**
   * SetupIntent for adding a card. 3D Secure is always requested so the card is
   * authenticated once, up front, and later off-session charges go through.
   */
  createSetupIntent(input: CreateSetupIntentInput): Promise<StripeSetupIntent>

  retrieveSetupIntent(id: string): Promise<StripeSetupIntent>

  retrievePaymentMethod(id: string): Promise<StripePaymentMethod>

  detachPaymentMethod(id: string): Promise<void>

  createPaymentIntent(input: CreatePaymentIntentInput): Promise<StripePaymentIntent>

  confirmPaymentIntent(id: string, input?: ConfirmPaymentIntentInput): Promise<StripePaymentIntent>

  retrievePaymentIntent(id: string): Promise<StripePaymentIntent>

  createRefund(input: CreateRefundInput): Promise<StripeRefund>

  /**
   * Verifies the signature against the RAW body and returns the event.
   * Throws `StripeSignatureError` on any mismatch — the handler answers 400 and does not retry.
   */
  constructWebhookEvent(rawBody: string, signatureHeader: string | null): StripeWebhookEvent
}
