import {
  DomainError,
  OVH_PRICING_MODE,
  PLAN_BRANDING,
  PROVISION_STEPS,
  SELLABLE_DATACENTERS,
  TERM_MONTHS,
  assertOrderTransition,
  assertServiceTransition,
  catalogPriceToCents,
  deliveryState,
  eurosToCents,
  isDomainError,
  nextDueDate,
  nextProvisionStep,
  type Cents,
  type ErrorCode,
  type ProvisionStep,
  type Term,
} from "@ola/core"
import type { GenericProductDefinition, OrderPrice, VpsSummary, VpsTask } from "@ola/ovh"
import type { StepTools } from "../steps"
import {
  orderItemsSchema,
  type CustomerRecord,
  type JobDeps,
  type OrderItems,
  type OrderRecord,
  type OvhJobs,
  type ServiceRecord,
} from "../ports"

/**
 * The provisioning job: money has already moved, so this code may never lose progress.
 *
 * Contract:
 *  - the step list is `PROVISION_STEPS` from `@ola/core`; the next step to run is always
 *    `nextProvisionStep(order.completedSteps)`, so a retry resumes where it stopped;
 *  - every step re-checks the database for evidence that its paid action already happened
 *    (`orders.whmcsOrderId`, `orders.ovhCartId`, `orders.ovhOrderId`, the `services` row)
 *    before doing anything, because a step that crashes between the external call and the
 *    marker write WILL run again;
 *  - the marker is written inside the same unit of work, immediately after the action;
 *  - `POST /order/cart/{cartId}/checkout` is never retried: if it may have gone through we
 *    ask OVH for our recent orders and adopt the matching one.
 */

const WHMCS_GATEWAY = "stripe"
const DELIVERY_POLL_MS = 60_000
/** 24 h of 60 s polls. `deliveryState` is still the authority on the SLA. */
const DELIVERY_MAX_POLLS = 24 * 60

export interface ProvisionInput {
  orderId: string
  stripePaymentIntentId?: string
  paidAt?: string
  correlationId: string
}

export type ProvisionOutcome =
  | { status: "delivered"; serviceId: string }
  | { status: "failed"; code: ErrorCode; step: ProvisionStep | null; detail: string }
  | { status: "skipped"; reason: string }

interface StepContext {
  order: OrderRecord
  items: OrderItems
  customer: CustomerRecord
  input: ProvisionInput
  /** Payment timestamp used for the delivery SLA. */
  paidAt: Date
}

/* -------------------------------------------------------------------------- */
/* helpers                                                                    */
/* -------------------------------------------------------------------------- */

function billingCycleForTerm(term: Term): "monthly" | "annually" {
  return term === "P12M" ? "annually" : "monthly"
}

function pricingModeForTerm(term: Term): string {
  return OVH_PRICING_MODE[term]
}

/**
 * The `duration` OVH expects for a plan code in this cart, read from the cart offers so
 * we never guess an ISO period. Throws when the offer or the pricing mode has vanished.
 */
function durationOf(
  offers: readonly GenericProductDefinition[],
  planCode: string,
  term: Term,
): string {
  const offer = offers.find((candidate) => candidate.planCode === planCode)
  if (!offer) {
    throw new DomainError("catalog_out_of_sync", {
      detail: `plan ${planCode} is not orderable in this cart`,
    })
  }
  const mode = pricingModeForTerm(term)
  const price =
    offer.prices.find(
      (candidate) => candidate.pricingMode === mode && candidate.capacities.includes("renew"),
    ) ?? offer.prices.find((candidate) => candidate.pricingMode === mode)
  if (!price) {
    throw new DomainError("catalog_out_of_sync", {
      detail: `plan ${planCode} has no ${mode} price in this cart`,
    })
  }
  return price.duration
}

/** OVH prices are euros in `value` and 1e-8 EUR in `priceInUcents`; prefer the exact one. */
export function priceToCents(price: OrderPrice): Cents {
  return price.priceInUcents != null && price.priceInUcents !== 0
    ? catalogPriceToCents(price.priceInUcents)
    : eurosToCents(price.value)
}

/** "Gravelines, Francia" — the customer never sees an OVH datacenter code. */
export function datacenterLabel(code: string): string {
  const match = SELLABLE_DATACENTERS.find((datacenter) => datacenter.code === code)
  return match ? `${match.city}, ${match.country}` : code
}

function parseItems(order: OrderRecord): OrderItems {
  const parsed = orderItemsSchema.safeParse(order.items)
  if (!parsed.success) {
    throw new DomainError("internal", {
      detail: `orders.items is not a usable quote: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")} ${issue.message}`)
        .join("; ")}`,
    })
  }
  return parsed.data
}

function technicalDetail(error: unknown): string {
  if (isDomainError(error)) return error.detail ?? error.code
  if (error instanceof Error) return `${error.name}: ${error.message}`
  return String(error)
}

function codeOf(error: unknown): ErrorCode {
  return isDomainError(error) ? error.code : "internal"
}

/** Names WHMCS insists on. Our customers are identified by email, not by a legal name. */
function nameParts(customer: CustomerRecord): { firstName: string; lastName: string } {
  const legal = customer.legalName?.trim() ?? ""
  if (legal !== "") {
    const parts = legal.split(/\s+/)
    return {
      firstName: parts[0] ?? legal,
      lastName: parts.slice(1).join(" ") || parts[0] || legal,
    }
  }
  const local = customer.email.split("@")[0] ?? "cliente"
  return { firstName: local, lastName: "OLA" }
}

/* -------------------------------------------------------------------------- */
/* the driver                                                                 */
/* -------------------------------------------------------------------------- */

export async function runProvisioning(
  deps: JobDeps,
  step: StepTools,
  input: ProvisionInput,
): Promise<ProvisionOutcome> {
  const log = deps.log(input.correlationId, { job: "provision", orderId: input.orderId })

  const order = await deps.db.getOrder(input.orderId)
  if (!order) {
    await deps.alerts.raise({
      severity: "critical",
      title: "Pedido no encontrado al aprovisionar",
      entity: "order",
      entityId: input.orderId,
      detail: "the provisioning job was triggered for an order that does not exist",
      correlationId: input.correlationId,
    })
    return { status: "skipped", reason: "order_not_found" }
  }

  if (order.status === "delivered") return { status: "skipped", reason: "already_delivered" }
  if (order.status === "cancelled") return { status: "skipped", reason: "cancelled" }

  const customer = await deps.db.getCustomer(order.customerId)
  if (!customer) {
    await failOrder(deps, order, null, new DomainError("internal", { detail: "customer missing" }), input)
    return { status: "failed", code: "internal", step: null, detail: "customer missing" }
  }

  let items: OrderItems
  try {
    items = parseItems(order)
  } catch (error) {
    await failOrder(deps, order, null, error, input)
    return { status: "failed", code: codeOf(error), step: null, detail: technicalDetail(error) }
  }

  const paidAt = input.paidAt ? new Date(input.paidAt) : (order.paidAt ?? deps.now())

  // paid -> provisioning. A resumed run is already in `provisioning` or `delayed`.
  if (order.status === "paid") {
    assertOrderTransition(order.status, "provisioning")
    await deps.db.updateOrder(order.id, { status: "provisioning", error: null, errorCode: null })
    await deps.audit.record({
      entity: "order",
      entityId: order.id,
      action: "order.provisioning.started",
      correlationId: input.correlationId,
      diff: { status: { from: order.status, to: "provisioning" } },
    })
    order.status = "provisioning"
  } else if (order.status === "failed") {
    // A manual retry of a failed order: back to provisioning, clear the error and continue
    // from the markers. Staying in `failed` would make the final `delivered` impossible.
    assertOrderTransition(order.status, "provisioning")
    await deps.db.updateOrder(order.id, {
      status: "provisioning",
      error: null,
      errorCode: null,
    })
    await deps.audit.record({
      entity: "order",
      entityId: order.id,
      action: "order.provisioning.resumed",
      correlationId: input.correlationId,
      diff: { status: { from: order.status, to: "provisioning" } },
    })
    order.status = "provisioning"
  }

  let completed = order.completedSteps
  for (let guard = 0; guard <= PROVISION_STEPS.length; guard += 1) {
    const next = nextProvisionStep(completed)
    if (next === null) break

    const fresh = await deps.db.getOrder(order.id)
    if (!fresh) return { status: "skipped", reason: "order_vanished" }
    const context: StepContext = { order: fresh, items, customer, input, paidAt }

    log.info({ step: next, completed: completed.length }, "provision step starting")

    try {
      const outcome = await runStep(deps, step, next, context)
      if (outcome !== null) return outcome
    } catch (error) {
      log.error({ step: next, error: technicalDetail(error) }, "provision step failed")
      await failOrder(deps, fresh, next, error, input)
      return { status: "failed", code: codeOf(error), step: next, detail: technicalDetail(error) }
    }

    completed = await deps.db.markOrderStepComplete(order.id, next)
    log.info({ step: next }, "provision step completed")
  }

  const service = await deps.db.findServiceByOrderId(order.id)
  return service
    ? { status: "delivered", serviceId: service.id }
    : { status: "skipped", reason: "no_service" }
}

/**
 * Runs one step. Returns `null` to continue, or an outcome that stops the whole job
 * (a price mismatch or a delivery timeout stops before anything else is spent).
 */
async function runStep(
  deps: JobDeps,
  step: StepTools,
  name: ProvisionStep,
  context: StepContext,
): Promise<ProvisionOutcome | null> {
  switch (name) {
    case "whmcs_client":
      await step.run("whmcs-client", () => ensureWhmcsClient(deps, context))
      return null
    case "whmcs_order":
      await step.run("whmcs-order", () => createWhmcsOrder(deps, context))
      return null
    case "whmcs_invoice":
      await step.run("whmcs-invoice", () => acceptWhmcsOrder(deps, context))
      return null
    case "whmcs_payment":
      await step.run("whmcs-payment", () => recordWhmcsPayment(deps, context))
      return null
    case "ovh_cart":
      await step.run("ovh-cart", () => ensureOvhCart(deps, context))
      return null
    case "ovh_configure":
      await step.run("ovh-configure", () => configureOvhCart(deps, context))
      return null
    case "ovh_price_check":
      return step.run("ovh-price-check", () => checkOvhPrice(deps, context))
    case "ovh_checkout":
      return step.run("ovh-checkout", () => checkoutOvhCart(deps, context))
    case "ovh_delivery":
      return pollOvhDelivery(deps, step, context)
    case "ovh_first_boot":
      await step.run("ovh-first-boot", () => firstBoot(deps, context))
      return null
    case "service_active":
      await step.run("service-active", () => activateService(deps, context))
      return null
  }
}

/* -------------------------------------------------------------------------- */
/* step: whmcs_client                                                         */
/* -------------------------------------------------------------------------- */

async function ensureWhmcsClient(deps: JobDeps, context: StepContext): Promise<null> {
  const { customer, input } = context
  if (customer.whmcsClientId !== null) return null

  const whmcs = deps.whmcs()
  const existing = await whmcs.findClientByEmail(customer.email)
  let clientId = existing?.clientId ?? null

  if (clientId === null) {
    if (!customer.addressLine1 || !customer.city || !customer.postalCode || !customer.country) {
      throw new DomainError("billing_unavailable", {
        detail: `customer ${customer.id} has no complete billing address; WHMCS requires address1/city/postcode/country`,
      })
    }
    const { firstName, lastName } = nameParts(customer)
    const created = await whmcs.createClient({
      firstName,
      lastName,
      email: customer.email,
      companyName: customer.kind === "company" ? (customer.legalName ?? undefined) : undefined,
      address1: customer.addressLine1,
      city: customer.city,
      postcode: customer.postalCode,
      country: customer.country,
      phoneNumber: customer.phone ?? undefined,
      taxId: customer.taxIdValidated ? (customer.taxId ?? undefined) : undefined,
      currencyCode: "EUR",
      language: "spanish",
    })
    clientId = created.clientId
  }

  await deps.db.setCustomerWhmcsClientId(customer.id, clientId)
  customer.whmcsClientId = clientId
  await deps.audit.record({
    entity: "customer",
    entityId: customer.id,
    action: existing ? "whmcs.client.linked" : "whmcs.client.created",
    diff: { whmcsClientId: clientId },
    correlationId: input.correlationId,
  })
  return null
}

/* -------------------------------------------------------------------------- */
/* step: whmcs_order                                                          */
/* -------------------------------------------------------------------------- */

/** WHMCS needs a non-empty "domain" per line; our order id is the stable label. */
function whmcsDomainLabel(order: OrderRecord, items: OrderItems): string {
  return items.whmcs?.domainLabel ?? `ola-${order.id}`
}

function numericKeys(
  options: Readonly<Record<string, string | number>>,
): Record<number, string | number> {
  const result: Record<number, string | number> = {}
  for (const [key, value] of Object.entries(options)) {
    const id = Number(key)
    if (Number.isInteger(id)) result[id] = value
  }
  return result
}

async function createWhmcsOrder(deps: JobDeps, context: StepContext): Promise<null> {
  const { order, items, customer, input } = context
  if (order.whmcsOrderId !== null) return null

  const clientId = customer.whmcsClientId
  if (clientId === null) {
    throw new DomainError("billing_unavailable", { detail: "whmcs client id missing" })
  }
  const whmcsSetup = items.whmcs
  if (!whmcsSetup) {
    throw new DomainError("billing_unavailable", {
      detail: "orders.items.whmcs.productId is missing; the checkout layer must resolve it",
    })
  }

  const whmcs = deps.whmcs()
  const label = whmcsDomainLabel(order, items)

  // `createOrder` is NOT retryable: WHMCS may have created the order before the socket
  // died. Re-check by the label we own before creating a second one.
  const services = await whmcs.listServices(clientId)
  const mirrored = services.find((service) => service.domain === label)
  if (mirrored?.orderId != null) {
    const unpaid = await whmcs.listInvoices({ clientId, status: "Unpaid", limit: 25 })
    const match = unpaid.find((invoice) => invoice.totalCents === order.total)
    await deps.db.updateOrder(order.id, {
      whmcsOrderId: mirrored.orderId,
      whmcsInvoiceId: match?.invoiceId ?? null,
    })
    if (!match) {
      await deps.alerts.raise({
        severity: "warning",
        title: "Pedido WHMCS recuperado sin factura",
        entity: "order",
        entityId: order.id,
        detail: `adopted WHMCS order ${mirrored.orderId} but found no unpaid invoice of ${order.total} cents`,
        correlationId: input.correlationId,
      })
    }
    await deps.audit.record({
      entity: "order",
      entityId: order.id,
      action: "whmcs.order.adopted",
      diff: { whmcsOrderId: mirrored.orderId, whmcsInvoiceId: match?.invoiceId ?? null },
      correlationId: input.correlationId,
    })
    return null
  }

  const created = await whmcs.createOrder({
    clientId,
    pid: whmcsSetup.productId,
    billingcycle: billingCycleForTerm(order.term),
    configoptions: numericKeys(whmcsSetup.configOptions),
    customfields: numericKeys(whmcsSetup.customFields),
    paymentmethod: WHMCS_GATEWAY,
    noemail: true,
    domain: label,
    priceOverrideCents: order.subtotal,
  })

  await deps.db.updateOrder(order.id, {
    whmcsOrderId: created.orderId,
    whmcsInvoiceId: created.invoiceId,
  })
  await deps.db.upsertInvoice({
    customerId: order.customerId,
    orderId: order.id,
    whmcsInvoiceId: created.invoiceId,
    status: "unpaid",
    subtotal: order.subtotal,
    tax: order.tax,
    credit: order.creditApplied,
    total: order.total,
  })
  await deps.audit.record({
    entity: "order",
    entityId: order.id,
    action: "whmcs.order.created",
    diff: { whmcsOrderId: created.orderId, whmcsInvoiceId: created.invoiceId },
    correlationId: input.correlationId,
  })
  return null
}

/* -------------------------------------------------------------------------- */
/* step: whmcs_invoice                                                        */
/* -------------------------------------------------------------------------- */

function mentionsAlreadyDone(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return message.includes("already") || message.includes("duplicate")
}

async function acceptWhmcsOrder(deps: JobDeps, context: StepContext): Promise<null> {
  const { order, input } = context
  if (order.whmcsOrderId === null) {
    throw new DomainError("billing_unavailable", { detail: "whmcs order id missing" })
  }
  try {
    await deps.whmcs().acceptOrder(order.whmcsOrderId)
  } catch (error) {
    // Accepting twice is harmless: WHMCS says the order is already active.
    if (!mentionsAlreadyDone(error)) throw error
    deps
      .log(input.correlationId, { orderId: order.id })
      .warn({ whmcsOrderId: order.whmcsOrderId }, "whmcs order was already accepted")
  }
  await deps.audit.record({
    entity: "order",
    entityId: order.id,
    action: "whmcs.order.accepted",
    diff: { whmcsOrderId: order.whmcsOrderId },
    correlationId: input.correlationId,
  })
  return null
}

/* -------------------------------------------------------------------------- */
/* step: whmcs_payment                                                        */
/* -------------------------------------------------------------------------- */

async function recordWhmcsPayment(deps: JobDeps, context: StepContext): Promise<null> {
  const { order, input, paidAt } = context
  const transactionId = input.stripePaymentIntentId ?? order.stripePaymentIntentId
  if (order.whmcsInvoiceId === null) {
    throw new DomainError("billing_unavailable", { detail: "whmcs invoice id missing" })
  }
  if (order.total === 0) {
    // Fully covered by credit: there is no Stripe payment to register.
    await deps.audit.record({
      entity: "order",
      entityId: order.id,
      action: "whmcs.payment.skipped",
      diff: { reason: "total_is_zero", creditApplied: order.creditApplied },
      correlationId: input.correlationId,
    })
    return null
  }
  if (!transactionId) {
    throw new DomainError("payment_failed", {
      detail: "no Stripe PaymentIntent id on the order or the event",
    })
  }

  try {
    await deps.whmcs().recordPayment({
      invoiceId: order.whmcsInvoiceId,
      amount: order.total,
      transactionId,
      gateway: WHMCS_GATEWAY,
      date: paidAt,
    })
  } catch (error) {
    // WHMCS refuses a duplicate transaction id: that is exactly our idempotency.
    if (!mentionsAlreadyDone(error)) throw error
    deps
      .log(input.correlationId, { orderId: order.id })
      .warn({ whmcsInvoiceId: order.whmcsInvoiceId }, "payment was already registered in WHMCS")
  }

  const invoice = await deps.db.findInvoiceByWhmcsId(order.whmcsInvoiceId)
  if (invoice) await deps.db.updateInvoice(invoice.id, { status: "paid", paidAt })
  await deps.audit.record({
    entity: "order",
    entityId: order.id,
    action: "whmcs.payment.recorded",
    diff: { whmcsInvoiceId: order.whmcsInvoiceId, amount: order.total },
    correlationId: input.correlationId,
  })
  return null
}

/* -------------------------------------------------------------------------- */
/* step: ovh_cart                                                             */
/* -------------------------------------------------------------------------- */

async function ensureOvhCart(deps: JobDeps, context: StepContext): Promise<null> {
  const { order, input } = context
  // A stored cart is ALWAYS reused: a second cart would be a second order waiting to happen.
  if (order.ovhCartId !== null) return null

  const ovh = deps.ovh()
  const cart = await ovh.createCart({ description: `ola-order-${order.id}` })
  await ovh.assignCart(cart.cartId)
  await deps.db.updateOrder(order.id, { ovhCartId: cart.cartId })
  await deps.audit.record({
    entity: "order",
    entityId: order.id,
    action: "ovh.cart.created",
    diff: { ovhCartId: cart.cartId },
    correlationId: input.correlationId,
  })
  return null
}

/* -------------------------------------------------------------------------- */
/* step: ovh_configure                                                        */
/* -------------------------------------------------------------------------- */

/** How many lines the finished cart must have: the plan plus every option. */
function expectedCartLines(items: OrderItems): number {
  return 1 + items.addonCodes.length
}

async function cartLineCount(ovh: OvhJobs, cartId: string): Promise<number> {
  try {
    const preview = await ovh.getCheckoutPreview(cartId)
    return preview.details?.length ?? 0
  } catch {
    // An empty cart has no checkout preview. Treat it as "nothing configured yet".
    return 0
  }
}

async function configureOvhCart(deps: JobDeps, context: StepContext): Promise<null> {
  const { order, items, input } = context
  const cartId = order.ovhCartId
  if (cartId === null) throw new DomainError("internal", { detail: "ovh cart id missing" })

  const ovh = deps.ovh()

  // This step may run again after a crash. The cart is free until checkout, but adding the
  // same option twice would double the bill, so a cart that already holds every expected
  // line is left alone.
  if ((await cartLineCount(ovh, cartId)) >= expectedCartLines(items)) {
    deps
      .log(input.correlationId, { orderId: order.id })
      .warn({ cartId }, "ovh cart already configured; skipping")
    return null
  }

  const offers = await ovh.listCartVpsOffers(cartId)
  const duration = durationOf(offers, items.planCode, order.term)
  const pricingMode = pricingModeForTerm(order.term)

  const item = await ovh.addVpsToCart({
    cartId,
    planCode: items.planCode,
    duration,
    pricingMode,
    quantity: 1,
  })

  // `vps_datacenter` is required; `vps_os` is the image OVH installs at delivery.
  await ovh.configureItem({
    cartId,
    itemId: item.itemId,
    label: "vps_datacenter",
    value: items.datacenter,
  })
  await ovh.configureItem({
    cartId,
    itemId: item.itemId,
    label: "vps_os",
    value: items.operatingSystem,
  })

  if (items.addonCodes.length > 0) {
    const options = await ovh.listCartOptions(cartId, items.planCode)
    for (const planCode of items.addonCodes) {
      const optionDuration = durationOf(options, planCode, order.term)
      await ovh.addOption({
        cartId,
        itemId: item.itemId,
        planCode,
        duration: optionDuration,
        pricingMode,
        quantity: 1,
      })
    }
  }

  await deps.audit.record({
    entity: "order",
    entityId: order.id,
    action: "ovh.cart.configured",
    diff: {
      cartId,
      planCode: items.planCode,
      datacenter: items.datacenter,
      os: items.operatingSystem,
      options: items.addonCodes,
    },
    correlationId: input.correlationId,
  })
  return null
}

/* -------------------------------------------------------------------------- */
/* step: ovh_price_check                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Zero tolerance. If OVH would charge us one cent more than the order expected, the order
 * stops here: nothing is checked out, the customer is refunded and an admin is woken up.
 */
async function checkOvhPrice(deps: JobDeps, context: StepContext): Promise<ProvisionOutcome | null> {
  const { order, input } = context
  const cartId = order.ovhCartId
  if (cartId === null) throw new DomainError("internal", { detail: "ovh cart id missing" })

  const preview = await deps.ovh().getCheckoutPreview(cartId)
  const actual = priceToCents(preview.prices.withoutTax)

  if (actual === order.expectedCost) {
    await deps.audit.record({
      entity: "order",
      entityId: order.id,
      action: "ovh.price_check.ok",
      diff: { expectedCost: order.expectedCost, actual },
      correlationId: input.correlationId,
    })
    return null
  }

  const error = new DomainError("price_mismatch", {
    detail: `OVH checkout preview is ${actual} cents, the order expected ${order.expectedCost} cents`,
  })
  await failOrder(deps, order, "ovh_price_check", error, input)
  await deps.events.send("ola/order.refund.requested", {
    orderId: order.id,
    amountCents: order.total,
    reason: "price_mismatch",
    detail: error.detail,
    correlationId: input.correlationId,
  })
  return {
    status: "failed",
    code: "price_mismatch",
    step: "ovh_price_check",
    detail: error.detail ?? "price mismatch",
  }
}

/* -------------------------------------------------------------------------- */
/* step: ovh_checkout                                                         */
/* -------------------------------------------------------------------------- */

/** Audit action written immediately BEFORE the checkout POST. */
export const CHECKOUT_ATTEMPT_ACTION = "ovh.checkout.attempt"

/** Audit action an admin writes to hand a specific VPS to an order (see `assignOrderVps`). */
export const DELIVERY_ASSIGNED_ACTION = "ovh.delivery.assigned"

/**
 * VPS names OVH knows and we do not. A checkout that may have gone through shows up here
 * as a server appearing out of nowhere. Servers the account already held before this
 * order's checkout (the inventory stored in the checkout marker) are never counted: the
 * OVH account also holds the operator's own servers, which are not ours to hand out.
 */
async function unknownVpsNames(
  deps: JobDeps,
  ovh: OvhJobs,
  orderId: string,
): Promise<readonly string[]> {
  const [names, before] = await Promise.all([ovh.listVps(), inventoryBeforeCheckout(deps, orderId)])
  const unknown: string[] = []
  for (const name of names) {
    if (before?.has(name)) continue
    if ((await deps.db.findServiceByOvhName(name)) === null) unknown.push(name)
  }
  return unknown
}

/** The VPS list stored right before the checkout POST; null for orders checked out earlier. */
async function inventoryBeforeCheckout(
  deps: JobDeps,
  orderId: string,
): Promise<Set<string> | null> {
  const diff = await deps.db.latestAuditDiff("order", orderId, CHECKOUT_ATTEMPT_ACTION)
  const names = diff?.["inventoryBefore"]
  if (!Array.isArray(names)) return null
  return new Set(names.filter((name): name is string => typeof name === "string"))
}

/** The VPS an admin assigned to this order by hand, if any. */
async function assignedServiceName(deps: JobDeps, orderId: string): Promise<string | null> {
  const diff = await deps.db.latestAuditDiff("order", orderId, DELIVERY_ASSIGNED_ACTION)
  // Admin audit rows keep their facts under `context`.
  const context = diff?.["context"]
  const value =
    context && typeof context === "object" && "serviceName" in context
      ? (context as { serviceName: unknown }).serviceName
      : diff?.["serviceName"]
  return typeof value === "string" && value.length > 0 ? value : null
}

/**
 * OVH zones read like `Region OpenStack: os-gra8`. Only prefixes seen on real servers are
 * mapped (verified 2026-11-06 on the account's own VPS); any other zone returns null and
 * is never used to rule a server out.
 */
const ZONE_DATACENTERS: Readonly<Record<string, string>> = {
  gra: "GRA",
  sbg: "SBG",
  de: "DE",
  uk: "UK",
}

export function datacenterOfZone(zone: string): string | null {
  const match = /(?:^|os-)([a-z]+)\d*$/i.exec(zone.trim())
  const prefix = match?.[1]?.toLowerCase()
  return prefix ? (ZONE_DATACENTERS[prefix] ?? null) : null
}

/**
 * False only when the server provably is not what the order bought: a different number of
 * vCores or amount of RAM than the plan, or a zone in another datacenter. Anything we
 * cannot tell keeps the server in the running; the "exactly one candidate" rule decides.
 */
export function vpsMatchesOrder(vps: VpsSummary, items: OrderItems): boolean {
  const plan = PLAN_BRANDING[items.planCode]
  if (plan) {
    if (Number(vps.model.vcore) !== plan.vcores) return false
    if (Number(vps.model.memory) !== plan.ramGb * 1024) return false
  }
  const datacenter = datacenterOfZone(vps.zone)
  return datacenter === null || datacenter === items.datacenter
}

/** Unknown VPS that could be this order's server, plus the ones ruled out and why. */
async function deliveryCandidates(
  deps: JobDeps,
  ovh: OvhJobs,
  context: StepContext,
): Promise<{ candidates: string[]; ruledOut: string[] }> {
  const unknown = await unknownVpsNames(deps, ovh, context.order.id)
  const candidates: string[] = []
  const ruledOut: string[] = []
  for (const name of unknown) {
    const vps = await ovh.getVps(name)
    if (vpsMatchesOrder(vps, context.items)) candidates.push(name)
    else ruledOut.push(`${name} (${vps.model.name}, ${vps.zone})`)
  }
  return { candidates, ruledOut }
}

async function checkoutOvhCart(
  deps: JobDeps,
  context: StepContext,
): Promise<ProvisionOutcome | null> {
  const { order, input } = context
  if (order.ovhOrderId !== null) return null

  const cartId = order.ovhCartId
  if (cartId === null) throw new DomainError("internal", { detail: "ovh cart id missing" })

  // Hard gate: a misconfigured environment can never spend money.
  deps.assertOvhOrdersEnabled()

  const ovh = deps.ovh()

  /*
   * `POST /order/cart/{cartId}/checkout` is never repeated. The audit row below is written
   * before the call, so if this step runs again we know the money may already be spent and
   * we ask OVH instead of posting: a VPS we do not know about means the order went
   * through, and provisioning carries on from the delivery step with no order id.
   */
  const attempts = await deps.db.countAuditActions("order", order.id, CHECKOUT_ATTEMPT_ACTION)
  if (attempts > 0) {
    const { candidates: unknown } = await deliveryCandidates(deps, ovh, context)
    if (unknown.length > 0) {
      await deps.alerts.raise({
        severity: "warning",
        title: "Checkout de OVH recuperado sin identificador de pedido",
        entity: "order",
        entityId: order.id,
        detail: `a previous checkout attempt left ${unknown.length} unknown VPS at OVH: ${unknown.join(", ")}`,
        correlationId: input.correlationId,
      })
      await deps.audit.record({
        entity: "order",
        entityId: order.id,
        action: "ovh.checkout.recovered",
        diff: { cartId, candidates: [...unknown] },
        correlationId: input.correlationId,
      })
      return null
    }

    const error = new DomainError("conflict", {
      detail: `checkout was already attempted for cart ${cartId} and no new VPS exists at OVH; a human must confirm the outcome before retrying`,
    })
    await failOrder(deps, order, "ovh_checkout", error, input)
    return {
      status: "failed",
      code: "conflict",
      step: "ovh_checkout",
      detail: error.detail ?? "checkout already attempted",
    }
  }

  // What the account holds right now. Whatever appears later is the only thing this
  // order can have delivered; the operator's own servers stay out of reach.
  const inventoryBefore = await ovh.listVps()
  await deps.audit.record({
    entity: "order",
    entityId: order.id,
    action: CHECKOUT_ATTEMPT_ACTION,
    diff: { cartId, inventoryBefore: [...inventoryBefore] },
    correlationId: input.correlationId,
  })

  const result = await ovh.checkout({
    cartId,
    autoPayWithPreferredPaymentMethod: true,
    waiveRetractationPeriod: true,
  })
  const ovhOrderId = result.orderId ?? null
  if (ovhOrderId === null) {
    const error = new DomainError("provider_rejected", {
      detail: "OVH checkout returned no orderId; verify at OVH before retrying",
    })
    await failOrder(deps, order, "ovh_checkout", error, input)
    return {
      status: "failed",
      code: "provider_rejected",
      step: "ovh_checkout",
      detail: error.detail ?? "checkout without orderId",
    }
  }

  await deps.db.updateOrder(order.id, { ovhOrderId })
  await deps.audit.record({
    entity: "order",
    entityId: order.id,
    action: "ovh.order.checked_out",
    diff: { ovhOrderId, cartId },
    correlationId: input.correlationId,
  })
  return null
}

/* -------------------------------------------------------------------------- */
/* step: ovh_delivery                                                         */
/* -------------------------------------------------------------------------- */

async function pollOvhDelivery(
  deps: JobDeps,
  step: StepTools,
  context: StepContext,
): Promise<ProvisionOutcome | null> {
  const { order, input, paidAt } = context
  const ovhOrderId = order.ovhOrderId

  // A recovered checkout has no order id to poll: the VPS inventory is the only evidence,
  // and `materialiseService` reads it directly.
  if (ovhOrderId === null) {
    await step.run("ovh-delivery-service", () => materialiseService(deps, context))
    return null
  }

  let lateReported = order.status === "delayed"

  for (let attempt = 0; attempt < DELIVERY_MAX_POLLS; attempt += 1) {
    const status = await step.run(`ovh-delivery-status-${attempt}`, () =>
      deps.ovh().getOrderStatus(ovhOrderId),
    )

    if (status === "delivered") {
      await step.run("ovh-delivery-service", () => materialiseService(deps, context))
      return null
    }
    if (status === "cancelled" || status === "notPaid") {
      const error = new DomainError("provider_rejected", {
        detail: `OVH order ${ovhOrderId} ended as ${status}`,
      })
      await failOrder(deps, order, "ovh_delivery", error, input)
      return {
        status: "failed",
        code: "provider_rejected",
        step: "ovh_delivery",
        detail: error.detail ?? status,
      }
    }

    const sla = deliveryState(paidAt, deps.now())
    if (sla === "timed_out") {
      const error = new DomainError("provider_unavailable", {
        detail: `OVH order ${ovhOrderId} not delivered 24 h after payment (last status ${status})`,
      })
      await failOrder(deps, order, "ovh_delivery", error, input)
      await deps.events.send("ola/order.refund.requested", {
        orderId: order.id,
        amountCents: order.total,
        reason: "delivery_timeout",
        detail: error.detail,
        correlationId: input.correlationId,
      })
      return {
        status: "failed",
        code: "provider_unavailable",
        step: "ovh_delivery",
        detail: error.detail ?? "delivery timed out",
      }
    }
    if (sla === "late" && !lateReported) {
      lateReported = true
      await step.run("ovh-delivery-late", () => reportLateDelivery(deps, context, status))
    }

    await step.sleep(`ovh-delivery-wait-${attempt}`, DELIVERY_POLL_MS)
  }

  const error = new DomainError("provider_unavailable", {
    detail: `gave up polling OVH order ${ovhOrderId} after ${DELIVERY_MAX_POLLS} attempts`,
  })
  await failOrder(deps, order, "ovh_delivery", error, input)
  return {
    status: "failed",
    code: "provider_unavailable",
    step: "ovh_delivery",
    detail: error.detail ?? "polling exhausted",
  }
}

/** 2 h after payment: tell the customer in Spanish and wake an admin, keep waiting. */
async function reportLateDelivery(
  deps: JobDeps,
  context: StepContext,
  status: string,
): Promise<null> {
  const { order, customer, input } = context
  if (order.status === "provisioning") {
    assertOrderTransition(order.status, "delayed")
    await deps.db.updateOrder(order.id, { status: "delayed" })
  }
  await deps.alerts.raise({
    severity: "warning",
    title: "Entrega de OVH fuera de SLA (2 h)",
    entity: "order",
    entityId: order.id,
    detail: `ovhOrderId=${order.ovhOrderId ?? "null"} status=${status}`,
    correlationId: input.correlationId,
  })
  await deps.email.send({
    to: customer.email,
    customerId: customer.id,
    correlationId: input.correlationId,
    message: {
      template: "order-delayed",
      props: {
        name: customer.legalName ?? undefined,
        orderRef: order.id,
        elapsedMinutes: Math.round((deps.now().getTime() - context.paidAt.getTime()) / 60_000),
        orderUrl: `${deps.customerAreaUrl}/pedidos/${order.id}`,
        customerAreaUrl: deps.customerAreaUrl,
      },
    },
  })
  await deps.audit.record({
    entity: "order",
    entityId: order.id,
    action: "order.delayed",
    diff: { status: { from: order.status, to: "delayed" }, ovhStatus: status },
    correlationId: input.correlationId,
  })
  return null
}

/**
 * Finds the VPS the order delivered and writes our `services` row.
 *
 * `GET /me/order/{orderId}/details` returns detail *ids*, not service names (see
 * `docs/ovh-api-verified.md`), so the delivered server is identified by inventory: a VPS
 * that appeared after this order's checkout, that we have no row for, and whose plan and
 * datacenter match the order. Exactly one must qualify. Anything else stops the order for
 * an admin to assign by hand: guessing would hand someone else's server to this customer.
 */
async function deliveredServiceName(
  deps: JobDeps,
  ovh: OvhJobs,
  context: StepContext,
): Promise<string> {
  const { order } = context

  const assigned = await assignedServiceName(deps, order.id)
  if (assigned !== null) {
    if (!(await ovh.listVps()).includes(assigned)) {
      throw new DomainError("delivery_review", {
        detail: `the VPS assigned by hand (${assigned}) does not exist in the OVH account`,
      })
    }
    const owner = await deps.db.findServiceByOvhName(assigned)
    if (owner !== null && owner.orderId !== order.id) {
      throw new DomainError("delivery_review", {
        detail: `the VPS assigned by hand (${assigned}) already belongs to service ${owner.id}`,
      })
    }
    return assigned
  }

  const { candidates, ruledOut } = await deliveryCandidates(deps, ovh, context)
  const excluded = ruledOut.length > 0 ? `; ruled out: ${ruledOut.join(", ")}` : ""
  if (candidates.length === 0) {
    throw new DomainError("provider_rejected", {
      detail: `OVH order ${order.ovhOrderId ?? "unknown"} is delivered but no matching new VPS appeared in the account${excluded}`,
    })
  }
  if (candidates.length > 1) {
    throw new DomainError("delivery_review", {
      detail: `several new VPS could be this order's server: ${candidates.join(", ")}${excluded}. Assign the right one by hand from the order page`,
    })
  }
  return candidates[0] as string
}

async function materialiseService(deps: JobDeps, context: StepContext): Promise<null> {
  const { order, items, input } = context
  const ovh = deps.ovh()

  const serviceName = await deliveredServiceName(deps, ovh, context)

  const [vps, ips] = await Promise.all([ovh.getVps(serviceName), ovh.getVpsIps(serviceName)])
  const ipv4 = ips.find((ip) => ip.version === 4 && !ip.isBlock)?.address ?? null
  const ipv6 = ips.find((ip) => ip.version === 6)?.address ?? null

  const plan = await deps.db.findPlanByOvhCode(items.planCode)
  if (!plan) {
    throw new DomainError("catalog_out_of_sync", {
      detail: `no plans row for OVH plan code ${items.planCode}`,
    })
  }

  const monthlyPrice =
    items.monthlyPrice ?? Math.round(order.subtotal / Math.max(1, TERM_MONTHS[order.term]))

  const existing =
    (await deps.db.findServiceByOrderId(order.id)) ??
    (await deps.db.findServiceByOvhName(serviceName))

  let service: ServiceRecord
  if (existing) {
    await deps.db.updateService(existing.id, {
      ovhServiceName: serviceName,
      ipv4,
      ipv6,
      displayName: items.displayName ?? existing.displayName,
    })
    service = { ...existing, ovhServiceName: serviceName, ipv4, ipv6 }
  } else {
    service = await deps.db.createService({
        customerId: order.customerId,
        planId: plan.id,
        orderId: order.id,
        displayName: items.displayName ?? null,
        ovhServiceName: serviceName,
        datacenter: items.datacenter,
        os: items.operatingSystem,
        ipv4,
        ipv6,
      term: order.term,
      monthlyPrice,
      status: "provisioning",
    })
  }

  await deps.db.updateOrder(order.id, { serviceId: service.id })
  await deps.audit.record({
    entity: "service",
    entityId: service.id,
    action: "service.delivered",
    diff: { ovhServiceName: serviceName, ipv4, ipv6, state: vps.state, orderId: order.id },
    correlationId: input.correlationId,
  })
  return null
}

/* -------------------------------------------------------------------------- */
/* step: ovh_first_boot                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Sets the root password from our side instead of OVH's `setPassword`, which generates a
 * password AND emails it to the account contact. We own every customer email, so the
 * rebuild runs with `doNotSendPassword` and a tiny post-install script.
 */
function rootPasswordScript(password: string): string {
  return ["#!/bin/sh", "set -e", `printf 'root:%s' '${password}' | chpasswd`].join("\n")
}

async function firstBoot(deps: JobDeps, context: StepContext): Promise<null> {
  const { order, items, customer, input } = context
  const service = await deps.db.findServiceByOrderId(order.id)
  if (!service?.ovhServiceName) {
    throw new DomainError("service_not_found", { detail: `no delivered service for order ${order.id}` })
  }
  const serviceName = service.ovhServiceName
  const ovh = deps.ovh()

  /*
   * `GET /vps/{serviceName}/images/available` returns image IDS only, so an OS name cannot
   * be resolved here. The configurator stores the chosen image id on the order; without it
   * we reinstall the image OVH already delivered (`vps_os` was set in the cart), which is
   * the same operating system the customer picked.
   */
  const imageId = items.imageId ?? (await ovh.getCurrentImage(serviceName)).id

  const keys = await deps.db.listSshKeys(customer.id)
  const chosen = items.sshKeyId ? keys.find((key) => key.id === items.sshKeyId) : keys[0]

  let task: VpsTask
  if (chosen) {
    task = await ovh.rebuild({
      serviceName,
      imageId,
      publicSshKey: chosen.publicKey,
      doNotSendPassword: true,
    })
  } else {
    // The password is stored BEFORE the rebuild: a crash afterwards must not leave a
    // server whose password nobody knows.
    const password = deps.generatePassword()
    await deps.storeRootPasswordOnce(service.id, password)
    task = await ovh.rebuild({
      serviceName,
      imageId,
      doNotSendPassword: true,
      postInstallScript: rootPasswordScript(password),
    })
  }

  await deps.db.recordAction({
    serviceId: service.id,
    type: "first_boot",
    status: "running",
    ovhTaskId: task.id,
    payload: { imageId, sshKeyId: chosen?.id ?? null, withPassword: !chosen },
  })
  await deps.audit.record({
    entity: "service",
    entityId: service.id,
    action: "service.first_boot",
    diff: { imageId, sshKeyId: chosen?.id ?? null, ovhTaskId: task.id },
    correlationId: input.correlationId,
  })
  return null
}

/* -------------------------------------------------------------------------- */
/* step: service_active                                                       */
/* -------------------------------------------------------------------------- */

async function activateService(deps: JobDeps, context: StepContext): Promise<null> {
  const { order, items, customer, input, paidAt } = context
  const service = await deps.db.findServiceByOrderId(order.id)
  if (!service) {
    throw new DomainError("service_not_found", { detail: `no service for order ${order.id}` })
  }

  if (service.status !== "active") {
    assertServiceTransition(service.status, "active")
  }
  const due = nextDueDate(paidAt, TERM_MONTHS[order.term])
  await deps.db.updateService(service.id, {
    status: "active",
    nextDueAt: due,
    lastSyncedAt: deps.now(),
  })
  await deps.db.resetDunning(service.id, "scheduled")

  const plan = await deps.db.findPlanByOvhCode(items.planCode)
  // The customer never sees an OVH name: the email carries our commercial plan name and
  // the datacenter city, never `ovhServiceName`. The root password is not emailed either —
  // the customer area reveals it once (see `src/server/jobs/secrets.ts`).
  await deps.email.send({
    to: customer.email,
    customerId: customer.id,
    correlationId: input.correlationId,
    message: {
      template: "server-ready",
      props: {
        name: customer.legalName ?? undefined,
        serverName: service.displayName ?? items.displayName ?? "tu servidor",
        planName: plan?.name ?? "OLA VPS",
        ipv4: service.ipv4 ?? "",
        ipv6: service.ipv6 ?? undefined,
        datacenter: datacenterLabel(service.datacenter),
        os: service.os,
        panelUrl: `${deps.customerAreaUrl}/servidores/${service.id}`,
        customerAreaUrl: deps.customerAreaUrl,
      },
    },
  })

  if (order.status !== "delivered") {
    assertOrderTransition(order.status, "delivered")
    await deps.db.updateOrder(order.id, { status: "delivered", deliveredAt: deps.now() })
  }

  await deps.audit.record({
    entity: "service",
    entityId: service.id,
    action: "service.activated",
    diff: { status: "active", nextDueAt: due.toISOString(), orderId: order.id },
    correlationId: input.correlationId,
  })
  return null
}

/* -------------------------------------------------------------------------- */
/* failure handling                                                           */
/* -------------------------------------------------------------------------- */

/**
 * One readable Spanish sentence for the customer plus the technical detail, both in
 * `orders.error`. Partial progress in `completedSteps` is deliberately kept so a manual
 * retry resumes instead of re-ordering.
 */
export async function failOrder(
  deps: JobDeps,
  order: OrderRecord,
  step: ProvisionStep | null,
  error: unknown,
  input: ProvisionInput,
): Promise<void> {
  const code = codeOf(error)
  const customerMessage = isDomainError(error)
    ? error.customerMessage
    : new DomainError("internal").customerMessage
  const detail = technicalDetail(error)

  if (order.status !== "failed") {
    try {
      assertOrderTransition(order.status, "failed")
    } catch {
      // Already terminal: keep the error text, do not fight the state machine.
    }
  }
  await deps.db.updateOrder(order.id, {
    status: order.status === "delivered" ? undefined : "failed",
    error: `${customerMessage} — ${detail}`,
    errorCode: code,
  })
  await deps.audit.record({
    entity: "order",
    entityId: order.id,
    action: "order.failed",
    diff: { step, code, detail },
    correlationId: input.correlationId,
  })
  await deps.alerts.raise({
    severity: "critical",
    title: `Aprovisionamiento fallido (${step ?? "sin paso"})`,
    entity: "order",
    entityId: order.id,
    detail: `${code}: ${detail}`,
    correlationId: input.correlationId,
  })
}

/** Exposed for the delivery-check fan-out and the admin panel. */
export function remainingSteps(completed: readonly ProvisionStep[]): readonly ProvisionStep[] {
  const done = new Set(completed)
  return PROVISION_STEPS.filter((step) => !done.has(step))
}

/** Exposed for tests and the admin view of a service's first boot. */
export type { ServiceRecord }
