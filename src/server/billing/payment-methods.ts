import { DomainError } from "@ola/core"

import { resolveDeps } from "./deps"
import type { PaymentMethodRecord } from "./data"
import type { BillingDeps, BillingDepsOverride } from "./ports"

/**
 * Cards on file.
 *
 * The card itself never touches our servers: the browser sends it straight to Stripe with a
 * SetupIntent client secret, and all we ever persist is the brand, the last four digits, the
 * expiry and Stripe's fingerprint. The fingerprint is one of the four welcome-credit fraud
 * signals, which is the whole reason we store it.
 *
 * 3D Secure is requested on every setup (`request_three_d_secure: "any"`), so the card is
 * authenticated once while the customer is present and later renewals can be charged
 * off-session without a challenge.
 */

/**
 * Refusing to remove the only card while a server is running deserves its own message:
 * the generic "esta acción no está disponible" does not tell the customer what to do.
 */
export class LastCardError extends DomainError {
  constructor() {
    super("action_not_allowed", {
      detail: "refusing to detach the only card while a service is active",
    })
    this.name = "LastCardError"
  }

  override get customerMessage(): string {
    return "No puedes quitar tu única tarjeta mientras tengas un servidor activo. Añade otra antes de quitar esta."
  }
}

/** What the checkout page hands to Stripe.js. The client secret authorises this intent only. */
export interface CardSetupTicket {
  setupIntentId: string
  clientSecret: string
  stripeCustomerId: string
}

export async function startCardSetup(
  customerId: string,
  override: BillingDepsOverride = {},
): Promise<CardSetupTicket> {
  const deps = await resolveDeps(override)
  const customer = await deps.store.getCustomer(customerId)
  if (!customer) throw new DomainError("internal", { detail: `unknown customer ${customerId}` })

  const stripeCustomer = await deps.stripe.ensureCustomer({
    stripeCustomerId: customer.stripeCustomerId,
    email: customer.email,
    name: customer.legalName,
    metadata: { ola_customer_id: customer.id },
  })
  if (stripeCustomer.id !== customer.stripeCustomerId) {
    await deps.store.setStripeCustomerId(customer.id, stripeCustomer.id)
  }

  const intent = await deps.stripe.createSetupIntent({
    stripeCustomerId: stripeCustomer.id,
    metadata: { ola_customer_id: customer.id },
  })
  if (!intent.clientSecret) {
    throw new DomainError("payment_failed", { detail: "Stripe returned no client secret" })
  }

  await deps.audit.record({
    actorId: customer.userId,
    actorType: "user",
    entity: "payment_method",
    entityId: null,
    action: "card_setup_started",
    diff: { setupIntentId: intent.id },
  })

  return {
    setupIntentId: intent.id,
    clientSecret: intent.clientSecret,
    stripeCustomerId: stripeCustomer.id,
  }
}

/**
 * Reads the finished SetupIntent and persists the card. Idempotent: a second call for the
 * same SetupIntent returns the row that already exists, which is what lets the browser and
 * the `setup_intent.succeeded` webhook both call it.
 */
export async function confirmCardSetup(
  setupIntentId: string,
  override: BillingDepsOverride = {},
): Promise<PaymentMethodRecord> {
  const deps = await resolveDeps(override)
  const intent = await deps.stripe.retrieveSetupIntent(setupIntentId)

  if (intent.status !== "succeeded") {
    throw new DomainError("payment_failed", {
      detail: `setup intent ${setupIntentId} is ${intent.status}`,
      retryable: intent.status === "processing" || intent.status === "requires_action",
    })
  }
  if (!intent.paymentMethodId) {
    throw new DomainError("payment_failed", { detail: "the setup intent carries no card" })
  }

  const existing = await deps.store.findPaymentMethodByStripeId(intent.paymentMethodId)
  if (existing && existing.detachedAt === null) return existing

  const customerId = await resolveOlaCustomerId(intent.customerId, deps)
  const method = await deps.stripe.retrievePaymentMethod(intent.paymentMethodId)
  const current = await deps.store.listPaymentMethods(customerId)

  const record = await deps.store.insertPaymentMethod({
    customerId,
    stripePaymentMethodId: method.id,
    fingerprint: method.card?.fingerprint ?? null,
    brand: method.card?.brand ?? null,
    last4: method.card?.last4 ?? null,
    expMonth: method.card?.expMonth ?? null,
    expYear: method.card?.expYear ?? null,
    // The SetupIntent succeeded, so the card passed 3D Secure: it is verified.
    verifiedAt: deps.now(),
    isDefault: current.length === 0,
  })

  await deps.audit.record({
    actorType: "system",
    entity: "payment_method",
    entityId: record.id,
    action: "card_added",
    // The fingerprint is not a card number, but it still stays out of the audit diff.
    diff: { brand: record.brand, last4: record.last4, isDefault: record.isDefault },
  })

  return record
}

export async function listPaymentMethods(
  customerId: string,
  override: BillingDepsOverride = {},
): Promise<PaymentMethodRecord[]> {
  const deps = await resolveDeps(override)
  return deps.store.listPaymentMethods(customerId)
}

/** The card an off-session charge will use. */
export async function defaultPaymentMethod(
  customerId: string,
  override: BillingDepsOverride = {},
): Promise<PaymentMethodRecord | null> {
  const methods = await listPaymentMethods(customerId, override)
  return methods.find((method) => method.isDefault) ?? methods[0] ?? null
}

export async function setDefaultPaymentMethod(
  customerId: string,
  paymentMethodId: string,
  override: BillingDepsOverride = {},
): Promise<void> {
  const deps = await resolveDeps(override)
  const methods = await deps.store.listPaymentMethods(customerId)
  const target = methods.find((method) => method.id === paymentMethodId)
  if (!target) {
    throw new DomainError("action_not_allowed", {
      detail: `payment method ${paymentMethodId} does not belong to ${customerId}`,
    })
  }

  await deps.store.setDefaultPaymentMethod(customerId, paymentMethodId)
  await deps.audit.record({
    actorType: "user",
    entity: "payment_method",
    entityId: paymentMethodId,
    action: "card_set_default",
  })
}

/**
 * Removes a card. The last usable card is kept while the customer still has a server:
 * a service with nothing to charge goes straight into dunning, which is never what the
 * customer meant by "quitar tarjeta".
 */
export async function detachPaymentMethod(
  customerId: string,
  paymentMethodId: string,
  override: BillingDepsOverride = {},
): Promise<void> {
  const deps = await resolveDeps(override)
  const methods = await deps.store.listPaymentMethods(customerId)
  const target = methods.find((method) => method.id === paymentMethodId)
  if (!target) {
    throw new DomainError("action_not_allowed", {
      detail: `payment method ${paymentMethodId} does not belong to ${customerId}`,
    })
  }

  if (methods.length <= 1) {
    const activeServices = await deps.store.countActiveServices(customerId)
    if (activeServices > 0) throw new LastCardError()
  }

  await deps.stripe.detachPaymentMethod(target.stripePaymentMethodId)
  await deps.store.markPaymentMethodDetached(target.id, deps.now())

  // Keep exactly one default among whatever is left.
  const remaining = (await deps.store.listPaymentMethods(customerId)).filter(
    (method) => method.id !== target.id,
  )
  const next = remaining[0]
  if (target.isDefault && next) {
    await deps.store.setDefaultPaymentMethod(customerId, next.id)
  }

  await deps.audit.record({
    actorType: "user",
    entity: "payment_method",
    entityId: target.id,
    action: "card_detached",
    diff: { brand: target.brand, last4: target.last4 },
  })
}

/** Stripe customer id -> our customer id, for the webhook path where we only have theirs. */
async function resolveOlaCustomerId(
  stripeCustomerId: string | null,
  deps: BillingDeps,
): Promise<string> {
  if (!stripeCustomerId) {
    throw new DomainError("payment_failed", { detail: "the setup intent has no Stripe customer" })
  }
  const customer = await deps.store.findCustomerByStripeId(stripeCustomerId)
  if (customer) return customer.id
  throw new DomainError("internal", {
    detail: `no OLA customer carries the Stripe customer ${stripeCustomerId}`,
  })
}
