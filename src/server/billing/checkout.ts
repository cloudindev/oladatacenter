import { randomUUID } from "node:crypto"
import { z } from "zod"

import {
  DomainError,
  TERM_MONTHS,
  canTransitionOrder,
  checkTrialLimits,
  checkoutTotals,
  dunningSchedule,
  formatCents,
  termSchema,
  vatTreatment,
  type Cents,
  type CheckoutTotals,
  type Quote,
  type Term,
  type VatContext,
  type VatTreatment,
} from "@ola/core"
import {
  classifyPaymentFailure,
  localFailure,
  noPaymentMethodFailure,
  type PaymentFailure,
} from "@/lib/stripe/failures"
import { StripeGatewayError, type StripePaymentIntent } from "@/lib/stripe/types"

import { customerCredit } from "./credit"
import { resolveDeps } from "./deps"
import type { BillingCustomer, InvoiceRecord, OrderRecord } from "./data"
import {
  BILLING_EVENTS,
  type BillingDeps,
  type BillingDepsOverride,
  type CheckoutConfiguration,
  type PricedConfiguration,
  type PublicLine,
  type RawConfigurationParams,
} from "./ports"

/**
 * Checkout, payment and refunds.
 *
 * Three rules this module exists to enforce:
 *
 *  1. **The amount is always computed here.** The browser sends a configuration of slugs,
 *     nothing more. `catalog.price` + `checkoutTotals` produce the figure we charge; a
 *     price, a plan cost or a total arriving from the client is dropped by the zod schema
 *     and never read.
 *  2. **Credit is a discount, applied before VAT, never below zero.** `checkoutTotals` owns
 *     that arithmetic. When credit covers the order there is nothing to charge: Stripe is
 *     not called at all, and the order is still invoiced with the credit as a discount line.
 *  3. **One order, one charge.** Every order carries `idempotencyKey`, and that key is what
 *     we hand Stripe, so a double submit replays the first PaymentIntent instead of taking
 *     the money twice.
 */

// ─── validation ──────────────────────────────────────────────────────────────

/**
 * The query string `/app/servers/new` accepts, read defensively. Anything else the
 * configurator (or a hand-edited link) sends is ignored — including anything that looks
 * like a price.
 */
export const checkoutParamsSchema = z
  .object({
    plan: z.union([z.string(), z.array(z.string())]).optional(),
    dc: z.union([z.string(), z.array(z.string())]).optional(),
    os: z.union([z.string(), z.array(z.string())]).optional(),
    term: z.union([z.string(), z.array(z.string())]).optional(),
    addons: z.union([z.string(), z.array(z.string())]).optional(),
  })
  .partial()

/** The resolved configuration, as it crosses a Server Action boundary. */
export const checkoutConfigurationSchema = z.object({
  plan: z.string().min(1).max(32),
  dc: z.string().min(1).max(64),
  os: z.string().min(1).max(64),
  term: termSchema,
  addons: z.array(z.string().min(1).max(64)).max(8).default([]),
})

/**
 * Reads whatever the configurator sent and hands back a configuration that is always
 * sellable: the catalog fills every missing or stale key with a real default.
 */
export async function resolveCheckoutConfiguration(
  raw: RawConfigurationParams,
  override: BillingDepsOverride = {},
): Promise<CheckoutConfiguration> {
  const deps = await resolveDeps(override)
  const parsed = checkoutParamsSchema.safeParse(raw)
  return deps.catalog.resolve(parsed.success ? parsed.data : {})
}

// ─── the checkout screen's view model ────────────────────────────────────────

export type CheckoutBlock =
  | { kind: "not_verified"; message: string; href: string }
  | { kind: "under_review"; message: string }
  | { kind: "blocked"; message: string }
  | { kind: "trial_limit"; message: string }

export interface CheckoutVatView {
  kind: VatTreatment["kind"]
  rate: number
  /** "IVA 21 %" or "Inversión del sujeto pasivo". */
  label: string
  /** One sentence explaining why, shown under the line. */
  note: string | null
}

/**
 * Everything the checkout screen renders. Deliberately free of our cost and of any OVH
 * name, so it is safe to pass into a Client Component.
 */
export interface CheckoutQuoteView {
  configuration: CheckoutConfiguration
  planName: string
  datacenterLabel: string
  osLabel: string
  termLabel: string
  months: number
  lines: readonly PublicLine[]
  /** Net price per month. Integer cents, never the subtotal divided by the term. */
  monthlyPrice: Cents
  subtotal: Cents
  creditAvailable: Cents
  creditApplied: Cents
  taxableBase: Cents
  tax: Cents
  total: Cents
  vat: CheckoutVatView
  block: CheckoutBlock | null
}

function vatView(treatment: VatTreatment): CheckoutVatView {
  if (treatment.kind === "reverse_charge") {
    return {
      kind: treatment.kind,
      rate: 0,
      label: "Inversión del sujeto pasivo",
      note: "Operación exenta de IVA español. Tu empresa autoliquida el impuesto en su país.",
    }
  }
  if (treatment.kind === "exempt") {
    return {
      kind: treatment.kind,
      rate: 0,
      label: "IVA no aplicable",
      note: "Servicio prestado fuera de la Unión Europea, no sujeto a IVA español.",
    }
  }
  return {
    kind: treatment.kind,
    rate: treatment.rate,
    label: `IVA ${Math.round(treatment.rate * 100)} %`,
    note: null,
  }
}

export function termLabelFor(term: Term): string {
  return TERM_MONTHS[term] === 12 ? "Anual (12 meses)" : "Mensual"
}

function vatContextFor(customer: BillingCustomer): VatContext {
  return {
    // No country on file means Spain: the conservative choice, it charges VAT.
    country: customer.country ?? "ES",
    kind: customer.kind,
    hasValidEuVatNumber: customer.taxIdValidated,
  }
}

/** Short, human order reference. The ULID itself is never read out loud. */
export function orderRef(orderId: string): string {
  return orderId.slice(-8).toUpperCase()
}

async function loadCustomer(customerId: string, deps: BillingDeps): Promise<BillingCustomer> {
  const customer = await deps.store.getCustomer(customerId)
  if (!customer) throw new DomainError("internal", { detail: `unknown customer ${customerId}` })
  return customer
}

function verificationBlock(customer: BillingCustomer): CheckoutBlock | null {
  if (customer.status === "blocked") {
    return {
      kind: "blocked",
      message:
        "Tu cuenta está bloqueada, así que no podemos procesar pedidos. Escríbenos y lo revisamos.",
    }
  }
  if (customer.status === "review") {
    return {
      kind: "under_review",
      message:
        "Estamos revisando tu cuenta a mano. En cuanto terminemos podrás completar el pedido.",
    }
  }
  if (customer.status !== "verified" || !customer.billingComplete) {
    return {
      kind: "not_verified",
      message:
        "Necesitas terminar de verificar tu cuenta y completar los datos de facturación antes de contratar.",
      href: "/onboarding",
    }
  }
  return null
}

async function trialBlock(
  customer: BillingCustomer,
  quote: Quote,
  deps: BillingDeps,
): Promise<CheckoutBlock | null> {
  const addonFamilies: string[] = []
  for (const line of quote.lines) {
    if (line.kind === "addon" && line.family !== undefined) addonFamilies.push(line.family)
  }

  const check = checkTrialLimits({
    hasPaidRealMoney: customer.firstPaidAt !== null,
    currentServiceCount: await deps.store.countActiveServices(customer.id),
    planCode: quote.planCode,
    addonFamilies,
  })
  return check.allowed ? null : { kind: "trial_limit", message: check.reason }
}

/**
 * Prices the configuration for the checkout screen: the same arithmetic `createOrderDraft`
 * will run, plus the reason the customer cannot continue when there is one.
 */
export async function previewCheckout(
  customerId: string,
  configuration: CheckoutConfiguration,
  override: BillingDepsOverride = {},
): Promise<CheckoutQuoteView> {
  const deps = await resolveDeps(override)
  const customer = await loadCustomer(customerId, deps)
  const priced = await deps.catalog.price(configuration)
  const credit = await customerCredit(customerId, override)
  const totals = checkoutTotals(priced.quote, credit, vatContextFor(customer))

  const block = verificationBlock(customer) ?? (await trialBlock(customer, priced.quote, deps))

  return {
    configuration: priced.configuration,
    planName: priced.planName,
    datacenterLabel: priced.datacenterLabel,
    osLabel: priced.osLabel,
    termLabel: termLabelFor(priced.quote.term),
    months: priced.quote.months,
    lines: priced.lines,
    monthlyPrice: priced.quote.monthlyPrice,
    subtotal: totals.subtotal,
    creditAvailable: credit,
    creditApplied: totals.creditApplied,
    taxableBase: totals.taxableBase,
    tax: totals.tax,
    total: totals.total,
    vat: vatView(totals.vat.treatment),
    block,
  }
}

// ─── creating the order ──────────────────────────────────────────────────────

/** What goes into `orders.items`: the full record of what was sold, never recomputed. */
interface OrderItems extends Record<string, unknown> {
  configuration: CheckoutConfiguration
  planName: string
  datacenterLabel: string
  osLabel: string
  quote: Quote
  lines: readonly PublicLine[]
  totals: {
    subtotal: Cents
    creditApplied: Cents
    taxableBase: Cents
    tax: Cents
    total: Cents
  }
  vat: CheckoutVatView
}

function buildItems(
  priced: PricedConfiguration,
  totals: CheckoutTotals,
  vat: CheckoutVatView,
): OrderItems {
  return {
    configuration: priced.configuration,
    planName: priced.planName,
    datacenterLabel: priced.datacenterLabel,
    osLabel: priced.osLabel,
    quote: priced.quote,
    lines: priced.lines,
    totals: {
      subtotal: totals.subtotal,
      creditApplied: totals.creditApplied,
      taxableBase: totals.taxableBase,
      tax: totals.tax,
      total: totals.total,
    },
    vat,
  }
}

/** The session slice checkout needs. Matches `SessionContext` without importing the route. */
export interface CheckoutSession {
  user: { id: string; email: string }
  customer: { id: string } | null
}

/**
 * Validates, re-prices on the server, checks the trial limits and inserts the
 * `pending_payment` order. Nothing is charged here.
 */
export async function createOrderDraft(
  session: CheckoutSession,
  configuration: unknown,
  override: BillingDepsOverride = {},
): Promise<OrderRecord> {
  const deps = await resolveDeps(override)
  if (!session.customer) {
    throw new DomainError("not_verified", { detail: "the session carries no customer" })
  }

  // Anything beyond these five keys — a price above all — is dropped right here.
  const parsed = checkoutConfigurationSchema.safeParse(configuration)
  if (!parsed.success) {
    throw new DomainError("catalog_out_of_sync", {
      detail: `invalid configuration: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`,
    })
  }
  const config: CheckoutConfiguration = parsed.data

  const customer = await loadCustomer(session.customer.id, deps)

  const block = verificationBlock(customer)
  if (block) {
    throw new DomainError(block.kind === "trial_limit" ? "limit_reached" : "not_verified", {
      detail: block.message,
    })
  }

  const priced = await deps.catalog.price(config)

  const trial = await trialBlock(customer, priced.quote, deps)
  if (trial) throw new DomainError("limit_reached", { detail: trial.message })

  const credit = await customerCredit(customer.id, override)
  const totals = checkoutTotals(priced.quote, credit, vatContextFor(customer))
  const vat = vatView(totals.vat.treatment)

  const order = await deps.store.insertOrder({
    customerId: customer.id,
    kind: "new",
    status: "pending_payment",
    serviceId: null,
    items: buildItems(priced, totals, vat),
    term: priced.quote.term,
    subtotal: totals.subtotal,
    tax: totals.tax,
    creditApplied: totals.creditApplied,
    total: totals.total,
    // What we expect OVH to charge us for this cycle. The checkout job re-checks it.
    expectedCost: priced.quote.cycleCost,
    idempotencyKey: `ord_${randomUUID()}`,
    completedSteps: [],
  })

  await deps.audit.record({
    actorId: session.user.id,
    actorType: "user",
    entity: "order",
    entityId: order.id,
    action: "order_created",
    diff: {
      plan: config.plan,
      term: config.term,
      subtotal: totals.subtotal,
      creditApplied: totals.creditApplied,
      tax: totals.tax,
      total: totals.total,
    },
  })

  return order
}

// ─── paying the order ────────────────────────────────────────────────────────

export type PayOrderResult =
  | {
      status: "paid"
      orderId: string
      total: Cents
      /** `null` when credit covered the whole order and Stripe was never called. */
      paymentIntentId: string | null
    }
  | {
      status: "requires_action"
      orderId: string
      paymentIntentId: string
      /** Hand this to Stripe.js so the browser can run the 3DS challenge. */
      clientSecret: string
    }
  | { status: "failed"; orderId: string; failure: PaymentFailure }

/**
 * Charges the order for exactly `totals.total`, computed from the stored quote — never from
 * anything the client sent.
 *
 * The order's `idempotencyKey` is passed to Stripe, so a second submit of the same order
 * replays the first PaymentIntent and the customer is charged once.
 */
export async function payOrder(
  orderId: string,
  override: BillingDepsOverride = {},
): Promise<PayOrderResult> {
  const deps = await resolveDeps(override)
  const order = await deps.store.getOrder(orderId)
  if (!order) throw new DomainError("internal", { detail: `unknown order ${orderId}` })

  // Already settled: say so instead of charging again.
  if (order.status !== "pending_payment") {
    if (order.paidAt !== null) {
      return {
        status: "paid",
        orderId: order.id,
        total: order.total,
        paymentIntentId: order.stripePaymentIntentId,
      }
    }
    throw new DomainError("conflict", { detail: `order ${orderId} is ${order.status}` })
  }

  const customer = await loadCustomer(order.customerId, deps)

  // ── zero to charge: credit covered everything ────────────────────────────
  if (order.total === 0) {
    await settleWithCredit(order, customer, deps)
    return { status: "paid", orderId: order.id, total: 0, paymentIntentId: null }
  }

  const method = await defaultCardFor(order.customerId, deps)
  if (!method) return { status: "failed", orderId: order.id, failure: noPaymentMethodFailure() }

  const stripeCustomerId = customer.stripeCustomerId
  if (!stripeCustomerId) {
    return {
      status: "failed",
      orderId: order.id,
      failure: localFailure("no_payment_method"),
    }
  }

  // Credit is spent before the charge, so the amount charged and the amount discounted can
  // never disagree. Marked on the order so a retry after a 3DS challenge does not spend it
  // twice. A concurrent order that got there first lowers what is left, and that is a
  // price mismatch, not a smaller charge.
  await consumeOrderCredit(order, deps)

  let intent: StripePaymentIntent
  try {
    intent = await deps.stripe.createPaymentIntent({
      amount: order.total,
      stripeCustomerId,
      paymentMethodId: method.stripePaymentMethodId,
      idempotencyKey: order.idempotencyKey,
      offSession: true,
      confirm: true,
      description: `OLA VPS · pedido ${orderRef(order.id)}`,
      metadata: { ola_order_id: order.id, ola_customer_id: order.customerId },
    })
  } catch (error) {
    const failure = classifyPaymentFailure(error)
    await recordFailedCharge(order, customer, failure, deps)
    return { status: "failed", orderId: order.id, failure }
  }

  await deps.store.updateOrder(order.id, { stripePaymentIntentId: intent.id })

  if (intent.status === "requires_action") {
    if (!intent.clientSecret) {
      const failure = localFailure("authentication_required", { requiresAction: true })
      await recordFailedCharge(order, customer, failure, deps)
      return { status: "failed", orderId: order.id, failure }
    }
    return {
      status: "requires_action",
      orderId: order.id,
      paymentIntentId: intent.id,
      clientSecret: intent.clientSecret,
    }
  }

  if (intent.status === "succeeded") {
    await markOrderPaid(order.id, intent, deps)
    return {
      status: "paid",
      orderId: order.id,
      total: order.total,
      paymentIntentId: intent.id,
    }
  }

  // `processing` means Stripe will tell us over the webhook; anything else is a decline
  // the PaymentIntent reported without throwing.
  const failure = intent.lastPaymentError
    ? classifyPaymentFailure(
        new StripeGatewayError(intent.lastPaymentError.message, {
          code: intent.lastPaymentError.code,
          declineCode: intent.lastPaymentError.declineCode,
        }),
      )
    : localFailure("processing_error", { retryable: true })
  if (intent.status !== "processing") await recordFailedCharge(order, customer, failure, deps)
  return { status: "failed", orderId: order.id, failure }
}

/**
 * Called after the browser finished a 3DS challenge. Re-reads the PaymentIntent from
 * Stripe — never trusting what the browser says happened — and settles the order.
 *
 * The webhook does the same thing independently; whichever gets there first wins and the
 * other is a no-op.
 */
export async function confirmPendingPayment(
  orderId: string,
  override: BillingDepsOverride = {},
): Promise<PayOrderResult> {
  const deps = await resolveDeps(override)
  const order = await deps.store.getOrder(orderId)
  if (!order) throw new DomainError("internal", { detail: `unknown order ${orderId}` })

  if (order.paidAt !== null) {
    return {
      status: "paid",
      orderId: order.id,
      total: order.total,
      paymentIntentId: order.stripePaymentIntentId,
    }
  }
  if (!order.stripePaymentIntentId) {
    throw new DomainError("conflict", { detail: `order ${orderId} has no payment in flight` })
  }

  const intent = await deps.stripe.retrievePaymentIntent(order.stripePaymentIntentId)

  if (intent.status === "succeeded") {
    await markOrderPaid(order.id, intent, deps)
    return {
      status: "paid",
      orderId: order.id,
      total: order.total,
      paymentIntentId: intent.id,
    }
  }
  if (intent.status === "requires_action" && intent.clientSecret) {
    return {
      status: "requires_action",
      orderId: order.id,
      paymentIntentId: intent.id,
      clientSecret: intent.clientSecret,
    }
  }

  const customer = await loadCustomer(order.customerId, deps)
  const failure = intent.lastPaymentError
    ? classifyPaymentFailure(
        new StripeGatewayError(intent.lastPaymentError.message, {
          code: intent.lastPaymentError.code,
          declineCode: intent.lastPaymentError.declineCode,
        }),
      )
    : localFailure("authentication_required", { requiresAction: true })
  await recordFailedCharge(order, customer, failure, deps)
  return { status: "failed", orderId: order.id, failure }
}

/**
 * The webhook's entry point for `payment_intent.succeeded`: finds the order the intent
 * belongs to and settles it. A no-op when the intent is not one of ours.
 */
export async function settlePaymentIntent(
  intent: StripePaymentIntent,
  override: BillingDepsOverride = {},
): Promise<OrderRecord | null> {
  const deps = await resolveDeps(override)
  const order = await deps.store.findOrderByPaymentIntent(intent.id)
  if (!order) return null
  return markOrderPaid(order.id, intent, deps)
}

/**
 * Marker on `orders.completedSteps` saying the order's credit has already been spent.
 *
 * It deliberately lives next to the provisioning steps: that column is the one place an
 * order records "this side effect already happened", and it is what makes every retry
 * safe. It is not a `ProvisionStep`, so `nextProvisionStep` and `isProvisionComplete`
 * ignore it — they only look for members of `PROVISION_STEPS`.
 */
export const CREDIT_CONSUMED_STEP = "credit_consumed"

/** Spends the order's credit exactly once, however many times the charge is retried. */
async function consumeOrderCredit(order: OrderRecord, deps: BillingDeps): Promise<void> {
  if (order.creditApplied <= 0) return
  if (order.completedSteps.includes(CREDIT_CONSUMED_STEP)) return

  const taken = await deps.store.consumeCredit(order.customerId, order.creditApplied, order.id)
  if (taken < order.creditApplied) {
    await deps.store.updateOrder(order.id, {
      error: "el crédito disponible cambió mientras se cobraba el pedido",
      errorCode: "price_mismatch",
    })
    throw new DomainError("price_mismatch", {
      detail: `credit shortfall: wanted ${order.creditApplied}, took ${taken}`,
    })
  }

  await deps.store.updateOrder(order.id, {
    completedSteps: [...order.completedSteps, CREDIT_CONSUMED_STEP],
  })
}

/** The card an off-session charge will use. */
async function defaultCardFor(customerId: string, deps: BillingDeps) {
  const methods = await deps.store.listPaymentMethods(customerId)
  return methods.find((method) => method.isDefault) ?? methods[0] ?? null
}

// ─── settling ────────────────────────────────────────────────────────────────

/**
 * Credit covered the order: no Stripe call at all.
 *
 * The invoice is still issued, with the credit as a discount line, because credit is a
 * discount and never a standalone credit invoice.
 */
async function settleWithCredit(
  order: OrderRecord,
  customer: BillingCustomer,
  deps: BillingDeps,
): Promise<void> {
  await consumeOrderCredit(order, deps)

  const items = order.items as Partial<OrderItems>
  const planName = typeof items.planName === "string" ? items.planName : "OLA VPS"
  const whmcsInvoiceId = await issueCreditDiscountInvoice(order, customer, planName, deps)

  const completed = new Set(order.completedSteps)
  if (order.creditApplied > 0) completed.add(CREDIT_CONSUMED_STEP)
  if (whmcsInvoiceId !== null) {
    // The provisioning job must not issue a second invoice for this order.
    completed.add("whmcs_invoice")
    completed.add("whmcs_payment")
  }

  await deps.store.updateOrder(order.id, {
    status: "paid",
    paidAt: deps.now(),
    completedSteps: [...completed],
    ...(whmcsInvoiceId === null ? {} : { whmcsInvoiceId }),
  })

  // A zero-euro order is NOT a real payment: `firstPaidAt` stays null and the trial
  // limits keep applying. That is the whole point of the welcome credit.
  await deps.store.insertPayment({
    customerId: order.customerId,
    orderId: order.id,
    invoiceId: null,
    stripePaymentIntentId: null,
    amount: 0,
    status: "succeeded",
    failureCode: null,
    failureMessage: null,
    settledAt: deps.now(),
  })

  await deps.audit.record({
    actorType: "system",
    entity: "order",
    entityId: order.id,
    action: "order_paid_with_credit",
    diff: { creditApplied: order.creditApplied, whmcsInvoiceId },
  })

  await deps.events.emit({
    name: BILLING_EVENTS.orderPaid,
    data: {
      orderId: order.id,
      // There is no Stripe transaction: credit covered the order. WHMCS still needs a
      // unique transaction reference, and this one is stable and obvious in the books.
      stripePaymentIntentId: `credit:${order.id}`,
      paidAt: deps.now().toISOString(),
      correlationId: `order-${order.id}`,
    },
  })

  await sendOrderReceived(order, customer, planName, deps)
}

async function issueCreditDiscountInvoice(
  order: OrderRecord,
  customer: BillingCustomer,
  planName: string,
  deps: BillingDeps,
): Promise<number | null> {
  const whmcsClientId = await deps.ledger.ensureClient(order.customerId)
  if (whmcsClientId === null) {
    // WHMCS does not know this customer yet; the `whmcs_invoice` provisioning step will
    // issue it, discount line included, from `orders.items`.
    await deps.audit.record({
      actorType: "system",
      entity: "order",
      entityId: order.id,
      action: "credit_invoice_deferred",
      diff: { reason: "the customer has no WHMCS client yet" },
    })
    return null
  }

  const treatment = vatTreatment(vatContextFor(customer))
  try {
    const created = await deps.ledger.createInvoice({
      whmcsClientId,
      status: "Paid",
      taxRatePercent: treatment.rate > 0 ? Math.round(treatment.rate * 100) : null,
      lines: [
        {
          description: `${planName} · ${termLabelFor(order.term)}`,
          amount: order.subtotal,
          taxed: treatment.rate > 0,
        },
        {
          description: "Crédito de bienvenida aplicado",
          amount: -order.creditApplied,
          taxed: treatment.rate > 0,
        },
      ],
      notes: `Pedido ${orderRef(order.id)} cubierto íntegramente con crédito.`,
    })

    await deps.store.insertInvoice({
      customerId: order.customerId,
      serviceId: null,
      orderId: order.id,
      whmcsInvoiceId: created.invoiceId,
      number: null,
      status: "paid",
      subtotal: order.subtotal,
      tax: order.tax,
      credit: order.creditApplied,
      total: order.total,
      dueAt: null,
      paidAt: deps.now(),
    })
    return created.invoiceId
  } catch (error) {
    // The money did not move, so a billing outage must not fail the order.
    await deps.audit.record({
      actorType: "system",
      entity: "order",
      entityId: order.id,
      action: "credit_invoice_failed",
      diff: { error: error instanceof Error ? error.message : String(error) },
    })
    return null
  }
}

/**
 * The `payment_intent.succeeded` path, shared by the inline confirmation and the webhook.
 * Idempotent: a repeat does nothing.
 */
export async function markOrderPaid(
  orderId: string,
  intent: StripePaymentIntent,
  deps: BillingDeps,
): Promise<OrderRecord> {
  const order = await deps.store.getOrder(orderId)
  if (!order) throw new DomainError("internal", { detail: `unknown order ${orderId}` })
  if (order.paidAt !== null) return order
  if (!canTransitionOrder(order.status, "paid")) return order

  const customer = await loadCustomer(order.customerId, deps)

  const existingPayment = await deps.store.findPaymentByPaymentIntent(intent.id)
  if (!existingPayment) {
    await deps.store.insertPayment({
      customerId: order.customerId,
      orderId: order.id,
      invoiceId: null,
      stripePaymentIntentId: intent.id,
      amount: intent.amount,
      status: "succeeded",
      failureCode: null,
      failureMessage: null,
      settledAt: deps.now(),
    })
  }

  const updated = await deps.store.updateOrder(order.id, {
    status: "paid",
    paidAt: deps.now(),
    stripePaymentIntentId: intent.id,
    error: null,
    errorCode: null,
  })

  // The first real money lifts the trial limits.
  if (intent.amount > 0) await deps.store.setFirstPaidAt(order.customerId, deps.now())

  await deps.audit.record({
    actorType: "webhook",
    entity: "order",
    entityId: order.id,
    action: "order_paid",
    diff: { amount: intent.amount, paymentIntentId: intent.id },
  })

  await deps.events.emit({
    name: BILLING_EVENTS.orderPaid,
    data: {
      orderId: order.id,
      stripePaymentIntentId: intent.id,
      paidAt: deps.now().toISOString(),
      correlationId: `order-${order.id}`,
    },
  })

  const items = order.items as Partial<OrderItems>
  await sendOrderReceived(
    updated,
    customer,
    typeof items.planName === "string" ? items.planName : "OLA VPS",
    deps,
  )

  return updated
}

async function sendOrderReceived(
  order: OrderRecord,
  customer: BillingCustomer,
  planName: string,
  deps: BillingDeps,
): Promise<void> {
  try {
    await deps.notifier.orderReceived({
      to: customer.email,
      name: customer.legalName,
      orderRef: orderRef(order.id),
      planName,
      amountCents: order.total,
      termLabel: termLabelFor(order.term),
      orderUrl: `${deps.siteUrl}/app/servers/new/${order.id}`,
    })
  } catch (error) {
    // An email failure must never roll back a paid order.
    console.error("[billing] could not send order-received", {
      orderId: order.id,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

async function recordFailedCharge(
  order: OrderRecord,
  customer: BillingCustomer,
  failure: PaymentFailure,
  deps: BillingDeps,
): Promise<void> {
  await deps.store.insertPayment({
    customerId: order.customerId,
    orderId: order.id,
    invoiceId: null,
    stripePaymentIntentId: order.stripePaymentIntentId,
    amount: order.total,
    status: "failed",
    failureCode: failure.stripeCode ?? failure.reason,
    failureMessage: failure.customerMessage,
    settledAt: null,
  })

  await deps.audit.record({
    actorType: "system",
    entity: "order",
    entityId: order.id,
    action: "order_charge_failed",
    diff: {
      reason: failure.reason,
      retryable: failure.retryable,
      stripeCode: failure.stripeCode,
    },
  })

  await deps.events.emit({
    name: BILLING_EVENTS.paymentFailed,
    data: {
      customerId: customer.id,
      amountCents: order.total,
      failureCode: failure.stripeCode ?? failure.reason,
      failureMessage: failure.customerMessage,
      correlationId: `order-${order.id}`,
    },
  })
}

/** The `payment_intent.payment_failed` path. The order stays payable so a retry can work. */
export async function markOrderPaymentFailed(
  paymentIntentId: string,
  error: { code: string | null; declineCode: string | null; message: string } | null,
  override: BillingDepsOverride = {},
): Promise<void> {
  const deps = await resolveDeps(override)
  const order = await deps.store.findOrderByPaymentIntent(paymentIntentId)
  if (!order) return
  if (order.paidAt !== null) return

  const existing = await deps.store.findPaymentByPaymentIntent(paymentIntentId)
  if (existing) {
    await deps.store.updatePayment(existing.id, {
      status: "failed",
      failureCode: error?.code ?? "payment_failed",
      failureMessage: error?.message ?? "No hemos podido completar el cobro con tu tarjeta.",
    })
  } else {
    await deps.store.insertPayment({
      customerId: order.customerId,
      orderId: order.id,
      invoiceId: null,
      stripePaymentIntentId: paymentIntentId,
      amount: order.total,
      status: "failed",
      failureCode: error?.code ?? "payment_failed",
      failureMessage: error?.message ?? "No hemos podido completar el cobro con tu tarjeta.",
      settledAt: null,
    })
  }

  await deps.store.updateOrder(order.id, {
    error: error?.message ?? "El cobro ha sido rechazado.",
    errorCode: "payment_failed",
  })

  await deps.audit.record({
    actorType: "webhook",
    entity: "order",
    entityId: order.id,
    action: "order_payment_failed",
    diff: { code: error?.code ?? null, declineCode: error?.declineCode ?? null },
  })

  await deps.events.emit({
    name: BILLING_EVENTS.paymentFailed,
    data: {
      customerId: order.customerId,
      amountCents: order.total,
      failureCode: error?.code ?? "payment_failed",
      failureMessage: error?.message ?? "El cobro ha sido rechazado.",
      correlationId: `order-${order.id}`,
    },
  })
}

// ─── refunds ────────────────────────────────────────────────────────────────

export interface RefundResult {
  orderId: string
  refunded: Cents
  /** `null` when there was nothing to refund (a credit-only order). */
  refundId: string | null
  status: "refunded" | "nothing_to_refund"
}

/**
 * Full refund of a paid order. Called by the jobs layer when provisioning gives up, and by
 * an admin. The order ends as `failed`, which is terminal: nothing retries it afterwards.
 */
export async function refundOrder(
  orderId: string,
  reason: string,
  override: BillingDepsOverride = {},
): Promise<RefundResult> {
  const deps = await resolveDeps(override)
  const order = await deps.store.getOrder(orderId)
  if (!order) throw new DomainError("internal", { detail: `unknown order ${orderId}` })

  const customer = await loadCustomer(order.customerId, deps)
  const paymentIntentId = order.stripePaymentIntentId
  const payment = paymentIntentId
    ? await deps.store.findPaymentByPaymentIntent(paymentIntentId)
    : null

  let refundId: string | null = null
  let refunded: Cents = 0

  if (paymentIntentId && payment && payment.amount > 0 && payment.refundedAmount === 0) {
    const refund = await deps.stripe.createRefund({
      paymentIntentId,
      reason: "requested_by_customer",
      // Derived from the order key, so a retried job cannot refund twice.
      idempotencyKey: `${order.idempotencyKey}:refund`,
      metadata: { ola_order_id: order.id },
    })
    refundId = refund.id
    refunded = refund.amount
    await deps.store.updatePayment(payment.id, {
      status: "refunded",
      refundedAmount: refund.amount,
    })
  }

  // `failed` is only reachable from pending_payment / paid / provisioning / delayed.
  if (canTransitionOrder(order.status, "failed")) {
    await deps.store.updateOrder(order.id, {
      status: "failed",
      error: reason,
      errorCode: "refunded",
    })
  } else {
    await deps.store.updateOrder(order.id, { error: reason, errorCode: "refunded" })
  }

  await deps.audit.record({
    actorType: "system",
    entity: "order",
    entityId: order.id,
    action: "order_refunded",
    diff: { reason, refunded, refundId, previousStatus: order.status },
  })

  await deps.events.emit({
    name: BILLING_EVENTS.alertRaise,
    data: {
      severity: "warning",
      title: "Pedido reembolsado",
      entity: "order",
      entityId: order.id,
      detail: `reason=${reason} refunded=${refunded} previousStatus=${order.status}`,
      correlationId: `order-${order.id}`,
    },
  })

  const items = order.items as Partial<OrderItems>
  try {
    await deps.notifier.orderRefunded({
      to: customer.email,
      name: customer.legalName,
      orderRef: orderRef(order.id),
      planName: typeof items.planName === "string" ? items.planName : null,
      refundedCents: refunded,
      supportUrl: `${deps.siteUrl}/contact`,
    })
  } catch (error) {
    console.error("[billing] could not send the refund email", {
      orderId: order.id,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  return {
    orderId: order.id,
    refunded,
    refundId,
    status: refundId === null ? "nothing_to_refund" : "refunded",
  }
}

/** The `charge.refunded` webhook: Stripe tells us about a refund we may not have started. */
export async function recordExternalRefund(
  paymentIntentId: string,
  amountRefunded: Cents,
  override: BillingDepsOverride = {},
): Promise<void> {
  const deps = await resolveDeps(override)
  const payment = await deps.store.findPaymentByPaymentIntent(paymentIntentId)
  if (!payment) return
  if (payment.refundedAmount >= amountRefunded) return

  await deps.store.updatePayment(payment.id, {
    refundedAmount: amountRefunded,
    status: amountRefunded >= payment.amount ? "refunded" : "partially_refunded",
  })

  await deps.audit.record({
    actorType: "webhook",
    entity: "payment",
    entityId: payment.id,
    action: "refund_recorded",
    diff: { amountRefunded },
  })
}

/**
 * `charge.dispute.created`: a chargeback. The customer goes under manual review so no new
 * order or provisioning starts while we work out what happened. Nothing is cancelled
 * automatically — that decision is a human's.
 */
export async function flagDisputedPayment(
  paymentIntentId: string | null,
  reason: string,
  override: BillingDepsOverride = {},
): Promise<{ customerId: string | null }> {
  const deps = await resolveDeps(override)
  const payment = paymentIntentId
    ? await deps.store.findPaymentByPaymentIntent(paymentIntentId)
    : null
  if (!payment) return { customerId: null }

  await deps.store.flagCustomerForReview(
    payment.customerId,
    `Disputa de pago (${reason}) sobre ${formatCents(payment.amount)}`,
  )

  await deps.audit.record({
    actorType: "webhook",
    entity: "customer",
    entityId: payment.customerId,
    action: "dispute_opened",
    diff: { paymentId: payment.id, reason, amount: payment.amount },
  })

  await deps.events.emit({
    name: BILLING_EVENTS.alertRaise,
    data: {
      severity: "critical",
      title: "Disputa de pago abierta",
      entity: "customer",
      entityId: payment.customerId,
      detail: `reason=${reason} paymentId=${payment.id} amount=${payment.amount}`,
      correlationId: `dispute-${payment.id}`,
    },
  })

  return { customerId: payment.customerId }
}

// ─── renewals ────────────────────────────────────────────────────────────────

export type RenewalChargeResult =
  | {
      ok: true
      serviceId: string
      invoiceId: string
      paymentId: string
      stripePaymentIntentId: string
      amount: Cents
    }
  | {
      ok: false
      serviceId: string
      invoiceId: string | null
      paymentId: string | null
      failure: PaymentFailure
    }

/** Service statuses a renewal may be charged for. */
const CHARGEABLE_SERVICE_STATUSES: ReadonlySet<string> = new Set([
  "active",
  "stopped",
  "suspended",
])

/**
 * Off-session charge of a service's renewal invoice.
 *
 * Returns a typed result instead of throwing, because the dunning job needs to branch on
 * `failure.retryable` and `failure.requiresAction` rather than catch an exception. On
 * success the payment is registered in WHMCS, which is the book of record.
 */
export async function chargeRenewal(
  serviceId: string,
  override: BillingDepsOverride = {},
): Promise<RenewalChargeResult> {
  const deps = await resolveDeps(override)

  const service = await deps.store.getService(serviceId)
  if (!service) {
    return {
      ok: false,
      serviceId,
      invoiceId: null,
      paymentId: null,
      failure: localFailure("not_chargeable"),
    }
  }
  if (!CHARGEABLE_SERVICE_STATUSES.has(service.status)) {
    return {
      ok: false,
      serviceId,
      invoiceId: null,
      paymentId: null,
      failure: localFailure("not_chargeable"),
    }
  }

  const invoice = await deps.store.findUnpaidInvoiceForService(serviceId)
  if (!invoice) {
    return {
      ok: false,
      serviceId,
      invoiceId: null,
      paymentId: null,
      // Retryable: the dunning job issues the invoice at T-7 and comes back.
      failure: localFailure("no_invoice", { retryable: true }),
    }
  }

  const customer = await loadCustomer(service.customerId, deps)
  const method = await defaultCardFor(service.customerId, deps)
  if (!method || !customer.stripeCustomerId) {
    const failure = noPaymentMethodFailure()
    const paymentId = await recordRenewalFailure(service, invoice, customer, failure, deps)
    return { ok: false, serviceId, invoiceId: invoice.id, paymentId, failure }
  }

  let intent: StripePaymentIntent
  try {
    intent = await deps.stripe.createPaymentIntent({
      amount: invoice.total,
      stripeCustomerId: customer.stripeCustomerId,
      paymentMethodId: method.stripePaymentMethodId,
      // One key per invoice: a retried job cannot charge the same renewal twice.
      idempotencyKey: `renew_${invoice.id}`,
      offSession: true,
      confirm: true,
      description: `OLA VPS · renovación factura ${invoice.number ?? invoice.whmcsInvoiceId}`,
      metadata: {
        ola_service_id: service.id,
        ola_invoice_id: invoice.id,
        ola_customer_id: customer.id,
      },
    })
  } catch (error) {
    const failure = classifyPaymentFailure(error)
    const paymentId = await recordRenewalFailure(service, invoice, customer, failure, deps)
    return { ok: false, serviceId, invoiceId: invoice.id, paymentId, failure }
  }

  if (intent.status !== "succeeded") {
    const failure =
      intent.status === "requires_action"
        ? localFailure("authentication_required", { requiresAction: true })
        : localFailure("processing_error", { retryable: true })
    const paymentId = await recordRenewalFailure(service, invoice, customer, failure, deps)
    return { ok: false, serviceId, invoiceId: invoice.id, paymentId, failure }
  }

  const payment = await deps.store.insertPayment({
    customerId: customer.id,
    orderId: null,
    invoiceId: invoice.id,
    stripePaymentIntentId: intent.id,
    amount: intent.amount,
    status: "succeeded",
    failureCode: null,
    failureMessage: null,
    settledAt: deps.now(),
  })

  await deps.store.updateInvoice(invoice.id, { status: "paid", paidAt: deps.now() })
  await deps.store.setFirstPaidAt(customer.id, deps.now())

  await deps.audit.record({
    actorType: "system",
    entity: "service",
    entityId: service.id,
    action: "renewal_charged",
    diff: { invoiceId: invoice.id, amount: intent.amount },
  })

  /*
   * Billing charges; it does not book.
   *
   * `ola/payment.succeeded` is the SINGLE writer that registers a renewal in WHMCS, moves
   * the due date and brings a suspended server back. It is the same funnel bank transfers
   * arrive through (the WHMCS webhook emits it with `source: "whmcs"`), so one owner means
   * the book of record can never be written twice or disagree with itself. Billing used to
   * call `whmcs().recordPayment` here as well, which only worked because WHMCS happens to
   * reject a duplicate transaction id — a guard that breaks the day WHMCS rephrases that
   * error. A delayed booking is recoverable; a double booking corrupts the accounts.
   *
   * Which makes this emission load-bearing: if it does not reach the queue, the money has
   * moved and nothing will book it. That is not a log line, it is a page.
   */
  const enqueued = await deps.events.emit({
    name: BILLING_EVENTS.paymentSucceeded,
    data: {
      customerId: customer.id,
      serviceId: service.id,
      invoiceId: invoice.id,
      whmcsInvoiceId: invoice.whmcsInvoiceId,
      stripePaymentIntentId: intent.id,
      amountCents: intent.amount,
      paidAt: deps.now().toISOString(),
      source: "stripe",
      correlationId: `renewal-${invoice.id}`,
    },
  })

  if (!enqueued) {
    await reportUnbookedRenewal(service.id, invoice, intent.id, deps)
  }

  return {
    ok: true,
    serviceId,
    invoiceId: invoice.id,
    paymentId: payment.id,
    stripePaymentIntentId: intent.id,
    amount: intent.amount,
  }
}

/**
 * Money taken, booking not queued. Three channels on purpose, because this is the one
 * failure that silently loses accounting: the audit row for the paper trail, a critical
 * alert for whoever is on call, and stderr in case the alert is itself what is broken.
 */
async function reportUnbookedRenewal(
  serviceId: string,
  invoice: InvoiceRecord,
  paymentIntentId: string,
  deps: BillingDeps,
): Promise<void> {
  const detail = `paymentIntent=${paymentIntentId} amount=${invoice.total} whmcsInvoiceId=${invoice.whmcsInvoiceId}`

  await deps.audit.record({
    actorType: "system",
    entity: "invoice",
    entityId: invoice.id,
    action: "renewal_booking_not_queued",
    diff: {
      paymentIntentId,
      whmcsInvoiceId: invoice.whmcsInvoiceId,
      amount: invoice.total,
      serviceId,
    },
  })

  await deps.events.emit({
    name: BILLING_EVENTS.alertRaise,
    data: {
      severity: "critical",
      title: "Cobro realizado sin encolar el registro en WHMCS",
      entity: "invoice",
      entityId: invoice.id,
      detail,
      correlationId: `renewal-${invoice.id}`,
    },
  })

  console.error("[billing] renewal charged but ola/payment.succeeded was not enqueued", {
    serviceId,
    invoiceId: invoice.id,
    whmcsInvoiceId: invoice.whmcsInvoiceId,
    paymentIntentId,
    amount: invoice.total,
  })
}

async function recordRenewalFailure(
  service: { id: string; customerId: string; displayName: string | null },
  invoice: InvoiceRecord,
  customer: BillingCustomer,
  failure: PaymentFailure,
  deps: BillingDeps,
): Promise<string> {
  const payment = await deps.store.insertPayment({
    customerId: customer.id,
    orderId: null,
    invoiceId: invoice.id,
    stripePaymentIntentId: null,
    amount: invoice.total,
    status: "failed",
    failureCode: failure.stripeCode ?? failure.reason,
    failureMessage: failure.customerMessage,
    settledAt: null,
  })

  await deps.audit.record({
    actorType: "system",
    entity: "service",
    entityId: service.id,
    action: "renewal_charge_failed",
    diff: {
      invoiceId: invoice.id,
      reason: failure.reason,
      retryable: failure.retryable,
      stripeCode: failure.stripeCode,
    },
  })

  await deps.events.emit({
    name: BILLING_EVENTS.paymentFailed,
    data: {
      customerId: customer.id,
      serviceId: service.id,
      invoiceId: invoice.id,
      whmcsInvoiceId: invoice.whmcsInvoiceId,
      amountCents: invoice.total,
      failureCode: failure.stripeCode ?? failure.reason,
      failureMessage: failure.customerMessage,
      correlationId: `renewal-${invoice.id}`,
    },
  })

  // The dunning calendar is stated up front, so nothing later comes as a surprise.
  const schedule = dunningSchedule(invoice.dueAt ?? deps.now())
  const dateOf = (stage: string, fallback: Date): Date =>
    schedule.find((step) => step.stage === stage)?.at ?? fallback

  try {
    const card = await defaultCardFor(customer.id, deps)
    await deps.notifier.paymentFailed({
      to: customer.email,
      name: customer.legalName,
      serviceName: service.displayName ?? "tu servidor",
      invoiceRef: invoice.number ?? String(invoice.whmcsInvoiceId),
      amountCents: invoice.total,
      retryDate: dateOf("retry_1", deps.now()),
      suspendDate: dateOf("suspended", deps.now()),
      deletionDate: dateOf("terminating", deps.now()),
      updateCardUrl: `${deps.siteUrl}/app/billing/metodos-de-pago`,
      cardBrand: card?.brand ?? null,
      cardLast4: card?.last4 ?? null,
    })
  } catch (error) {
    console.error("[billing] could not send payment-failed", {
      serviceId: service.id,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  return payment.id
}

/**
 * Adapter for `AdminBillingPort.chargeRenewal` in `src/server/admin/deps.ts`, which wants a
 * flat shape. Kept here so the admin panel does not have to re-derive it.
 */
export function toAdminChargeResult(result: RenewalChargeResult): {
  charged: Cents
  paymentIntentId: string | null
  /**
   * Why it did not go through, for the operator: Stripe's decline code when there is one
   * (the most specific — `insufficient_funds` beats `card_declined`), then Stripe's error
   * code, then our own reason for failures that never reached Stripe (`no_invoice`,
   * `no_payment_method`). `null` on success.
   */
  declined: string | null
} {
  if (result.ok) {
    return { charged: result.amount, paymentIntentId: result.stripePaymentIntentId, declined: null }
  }
  const { failure } = result
  return {
    charged: 0,
    paymentIntentId: null,
    declined: failure.stripeDeclineCode ?? failure.stripeCode ?? failure.reason,
  }
}

/** Spanish, pre-formatted amounts for a server-rendered summary. */
export function formatCheckoutAmount(value: Cents): string {
  return formatCents(value)
}
