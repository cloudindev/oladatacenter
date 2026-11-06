/**
 * Everything billing needs from the rest of the platform, as ports.
 *
 * Each one is implemented twice: for real in `integration.ts`, and as a fake in the test
 * suite. Billing therefore compiles and runs with no catalog, no WHMCS, no Inngest, no
 * Resend and no Stripe key.
 */
import type { Cents, Quote, Term } from "@ola/core"
import type { StripeGateway } from "@/lib/stripe/types"

import type { BillingStore } from "./data"

// ─── the configuration the configurator hands us ─────────────────────────────

/**
 * The checkout configuration, in the public slug vocabulary that travels in the URL.
 * `src/app/app/servers/new` validates the query string into this shape before anything
 * else happens, and the price is then computed from it on the server. Nothing the browser
 * sends about money is ever read.
 */
export interface CheckoutConfiguration {
  /** Commercial plan slug: "s" | "m" | "l" | "xl". Never an OVH plan code. */
  plan: string
  /** Datacenter slug, e.g. "gravelines". */
  dc: string
  /** Operating-system slug, e.g. "debian-13". */
  os: string
  term: Term
  /** Option slugs. One per family; mandatory families are resolved by `buildQuote`. */
  addons: readonly string[]
}

// ─── catalog ─────────────────────────────────────────────────────────────────

/** Raw query-string parameters, exactly as a Next.js page receives them. */
export type RawConfigurationParams = Readonly<
  Record<string, string | readonly string[] | undefined>
>

/** One line of the breakdown as the customer may see it: no cost, no OVH name. */
export interface PublicLine {
  slug: string
  label: string
  /** Addon family, or "plan" for the server itself. */
  family: string
  monthlyPrice: Cents
  cyclePrice: Cents
  mandatory: boolean
}

export interface PricedConfiguration {
  configuration: CheckoutConfiguration
  /**
   * The full quote. It carries OUR COST and OVH's own plan name, so it stays on the server:
   * never return it from a Server Action and never put it in a Client Component's props.
   */
  quote: Quote
  planName: string
  datacenterLabel: string
  osLabel: string
  lines: readonly PublicLine[]
}

export interface CatalogPort {
  /**
   * Validates a raw query string against the published plans and fills every gap with a
   * real default, so a hand-edited or stale link still resolves to something sellable.
   */
  resolve(raw: RawConfigurationParams): Promise<CheckoutConfiguration>
  /** Prices one configuration on the server. The only source of an amount, ever. */
  price(configuration: CheckoutConfiguration): Promise<PricedConfiguration>
}

// ─── WHMCS, narrowed to what billing needs ───────────────────────────────────

export interface WhmcsInvoiceLine {
  description: string
  /** Integer cents. Negative for the credit discount line. */
  amount: Cents
  taxed: boolean
}

export interface BillingLedgerPort {
  /**
   * WHMCS client id for this customer, or `null` when WHMCS does not know them yet.
   * Billing never creates the client: the `whmcs_client` provisioning step owns that,
   * because it is the only place with the full postal address.
   */
  ensureClient(customerId: string): Promise<number | null>
  createInvoice(input: {
    whmcsClientId: number
    lines: readonly WhmcsInvoiceLine[]
    taxRatePercent: number | null
    status: "Unpaid" | "Paid"
    notes: string | null
  }): Promise<{ invoiceId: number }>
  /**
   * There is deliberately NO `recordPayment` here.
   *
   * Registering a payment in WHMCS has exactly one writer: the jobs layer's
   * `ola/payment.succeeded` handler. It is the same funnel bank transfers arrive through
   * (the WHMCS webhook emits the event with `source: "whmcs"`), so one owner means the
   * book of record can never be written twice or disagree with itself. Billing charges and
   * emits; it does not book.
   */
  /** Short-lived SSO link into the WHMCS client area, for the invoice PDF. */
  invoiceAreaUrl(whmcsClientId: number): Promise<string | null>
}

// ─── notifications ───────────────────────────────────────────────────────────

export interface NotifierPort {
  orderReceived(input: {
    to: string
    name: string | null
    orderRef: string
    planName: string
    amountCents: Cents
    termLabel: string
    orderUrl: string
  }): Promise<void>
  paymentFailed(input: {
    to: string
    name: string | null
    serviceName: string
    invoiceRef: string
    amountCents: Cents
    retryDate: Date
    suspendDate: Date
    deletionDate: Date
    updateCardUrl: string
    cardBrand: string | null
    cardLast4: string | null
  }): Promise<void>
  creditExpiring(input: {
    to: string
    name: string | null
    amountCents: Cents
    expiresAt: Date
  }): Promise<void>
  orderRefunded(input: {
    to: string
    name: string | null
    orderRef: string
    planName: string | null
    refundedCents: Cents
    supportUrl: string
  }): Promise<void>
}

// ─── jobs ────────────────────────────────────────────────────────────────────

/**
 * Inngest events billing EMITS, with the payloads the jobs layer declares in
 * `src/inngest/client.ts`. The imports are type-only, so nothing here loads the Inngest
 * client — but if the jobs layer changes a payload, this file stops compiling, which is
 * exactly the alarm we want.
 *
 * Billing CONSUMES nothing. The jobs layer calls `chargeRenewal` and `refundOrder`
 * directly (it emits `ola/service.charge.requested` and `ola/order.refund.requested` to
 * its own handlers, which then call us).
 */
import type {
  AlertRaiseData,
  OrderPaidData,
  PaymentFailedData,
  PaymentSucceededData,
} from "@/inngest/client"

export const BILLING_EVENTS = {
  /** Payment settled (or fully covered by credit): provisioning may start. */
  orderPaid: "ola/order.paid",
  /** A renewal was paid: the jobs layer books it and moves the due date. */
  paymentSucceeded: "ola/payment.succeeded",
  /** A charge was declined. The dunning calendar decides what happens next. */
  paymentFailed: "ola/payment.failed",
  /** Something a human must look at — a chargeback, a payment we could not book. */
  alertRaise: "ola/alert.raise",
} as const

export type BillingEventName = (typeof BILLING_EVENTS)[keyof typeof BILLING_EVENTS]

export type BillingEvent =
  | { name: typeof BILLING_EVENTS.orderPaid; data: OrderPaidData }
  | { name: typeof BILLING_EVENTS.paymentSucceeded; data: PaymentSucceededData }
  | { name: typeof BILLING_EVENTS.paymentFailed; data: PaymentFailedData }
  | { name: typeof BILLING_EVENTS.alertRaise; data: AlertRaiseData }

export interface EventBusPort {
  /**
   * Never throws — by the time billing emits, the money has usually already moved, and
   * failing the charge over a queue outage would be worse than a delayed job.
   *
   * It returns whether the event was actually enqueued instead. Callers whose event is the
   * ONLY path to a side effect that must happen (booking a renewal in WHMCS) check this and
   * raise a critical alert on `false`, so "money taken, nothing booked" is never silent.
   */
  emit(event: BillingEvent): Promise<boolean>
}

// ─── audit ───────────────────────────────────────────────────────────────────

export interface AuditPort {
  record(entry: {
    actorId?: string | null
    actorType?: "user" | "admin" | "system" | "webhook"
    entity: string
    entityId?: string | null
    action: string
    diff?: Record<string, unknown>
    correlationId?: string | null
  }): Promise<void>
}

// ─── the bundle every billing service takes ──────────────────────────────────

export interface BillingDeps {
  store: BillingStore
  stripe: StripeGateway
  catalog: CatalogPort
  ledger: BillingLedgerPort
  notifier: NotifierPort
  events: EventBusPort
  audit: AuditPort
  /** Injectable clock, so a test can assert on an expiry date. */
  now: () => Date
  /** Absolute base URL for the links we put in emails. */
  siteUrl: string
}

/** What a caller may override; everything else comes from `integration.ts`. */
export type BillingDepsOverride = Partial<BillingDeps>
