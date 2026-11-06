/**
 * In-memory Stripe. Used by the whole test suite and by local development whenever
 * `USE_MOCK_PROVIDERS=true`, so the checkout, the 3DS branch, the refund path and the
 * webhook can all be exercised with no network and no Stripe key.
 *
 * Behaviour is driven by the payment method id, so a test picks an outcome by choosing a
 * card. The ids match Stripe's own test-card tokens on purpose.
 */
import { createHmac, timingSafeEqual } from "node:crypto"

import {
  STRIPE_CURRENCY,
  StripeGatewayError,
  StripeSignatureError,
  type ConfirmPaymentIntentInput,
  type CreatePaymentIntentInput,
  type CreateRefundInput,
  type CreateSetupIntentInput,
  type EnsureCustomerInput,
  type StripeCardDetails,
  type StripeGateway,
  type StripePaymentIntent,
  type StripePaymentIntentStatus,
  type StripePaymentMethod,
  type StripeRefund,
  type StripeSetupIntent,
  type StripeWebhookEvent,
} from "./types"

/** Cards whose confirmation fails, keyed by the id a test passes in. */
const DECLINING_CARDS: Readonly<Record<string, { code: string; declineCode: string }>> = {
  pm_card_declined: { code: "card_declined", declineCode: "generic_decline" },
  pm_card_insufficientFunds: { code: "card_declined", declineCode: "insufficient_funds" },
  pm_card_expired: { code: "expired_card", declineCode: "expired_card" },
  pm_card_processingError: { code: "processing_error", declineCode: "processing_error" },
}

/** Cards that need a 3DS challenge before the money moves. */
const AUTHENTICATION_CARDS: ReadonlySet<string> = new Set([
  "pm_card_authenticationRequired",
  "pm_card_threeDSecure2Required",
])

const DEFAULT_CARD: StripeCardDetails = {
  brand: "visa",
  last4: "4242",
  expMonth: 12,
  expYear: 2030,
  fingerprint: null,
}

export interface MockStripeOptions {
  /** Endpoint secret used by `constructWebhookEvent` and by `signWebhookPayload`. */
  webhookSecret?: string
  /** Fixed clock, so an assertion on a timestamp is stable. */
  now?: () => Date
}

interface MockPaymentMethodState {
  id: string
  customerId: string | null
  card: StripeCardDetails
  detached: boolean
}

/**
 * Deterministic card fingerprint: the same payment method id always yields the same value,
 * and two different ids of the same test card family share one, which is what the
 * welcome-credit fraud check needs to see.
 */
export function mockFingerprint(paymentMethodId: string): string {
  const family = paymentMethodId.replace(/_[0-9]+$/, "")
  return createHmac("sha256", "mock-stripe-fingerprint").update(family).digest("hex").slice(0, 16)
}

export class MockStripe implements StripeGateway {
  readonly webhookSecret: string

  /** Every call, in order, for assertions. Never contains a secret or a card number. */
  readonly calls: { method: string; detail: string }[] = []

  private readonly customers = new Map<string, { email: string; name: string | null }>()
  private readonly paymentMethods = new Map<string, MockPaymentMethodState>()
  private readonly setupIntents = new Map<string, StripeSetupIntent>()
  private readonly paymentIntents = new Map<string, StripePaymentIntent>()
  private readonly refunds = new Map<string, StripeRefund>()
  /** idempotency key -> the id of the object the first call produced. */
  private readonly idempotency = new Map<string, string>()
  private readonly now: () => Date
  private counter = 0

  constructor(options: MockStripeOptions = {}) {
    this.webhookSecret = options.webhookSecret ?? "whsec_mock"
    this.now = options.now ?? (() => new Date())
  }

  // ─── test seams ────────────────────────────────────────────────────────────
  /** Registers a card so `retrievePaymentMethod` and a confirmation can find it. */
  seedPaymentMethod(
    id: string,
    customerId: string | null = null,
    card: Partial<StripeCardDetails> = {},
  ): StripePaymentMethod {
    const state: MockPaymentMethodState = {
      id,
      customerId,
      card: { ...DEFAULT_CARD, ...card, fingerprint: card.fingerprint ?? mockFingerprint(id) },
      detached: false,
    }
    this.paymentMethods.set(id, state)
    return { id, customerId, card: state.card }
  }

  /** Number of PaymentIntents actually created. The double-charge test asserts on this. */
  get paymentIntentCount(): number {
    return this.paymentIntents.size
  }

  reset(): void {
    this.calls.length = 0
    this.customers.clear()
    this.paymentMethods.clear()
    this.setupIntents.clear()
    this.paymentIntents.clear()
    this.refunds.clear()
    this.idempotency.clear()
    this.counter = 0
  }

  /** Builds the `Stripe-Signature` header a valid webhook would carry. */
  signWebhookPayload(rawBody: string, timestampSeconds?: number): string {
    const timestamp = timestampSeconds ?? Math.floor(this.now().getTime() / 1000)
    const signature = createHmac("sha256", this.webhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex")
    return `t=${timestamp},v1=${signature}`
  }

  // ─── customers ─────────────────────────────────────────────────────────────
  async ensureCustomer(input: EnsureCustomerInput): Promise<{ id: string }> {
    if (input.stripeCustomerId && this.customers.has(input.stripeCustomerId)) {
      this.calls.push({ method: "ensureCustomer", detail: "reused" })
      return { id: input.stripeCustomerId }
    }
    const id = input.stripeCustomerId ?? this.nextId("cus")
    this.customers.set(id, { email: input.email, name: input.name ?? null })
    this.calls.push({ method: "ensureCustomer", detail: "created" })
    return { id }
  }

  // ─── setup intents ─────────────────────────────────────────────────────────
  async createSetupIntent(input: CreateSetupIntentInput): Promise<StripeSetupIntent> {
    const replayed = input.idempotencyKey
      ? this.setupIntents.get(this.idempotency.get(input.idempotencyKey) ?? "")
      : undefined
    if (replayed) {
      this.calls.push({ method: "createSetupIntent", detail: "replayed" })
      return replayed
    }

    const id = this.nextId("seti")
    const intent: StripeSetupIntent = {
      id,
      clientSecret: `${id}_secret_mock`,
      status: "requires_payment_method",
      customerId: input.stripeCustomerId,
      paymentMethodId: null,
    }
    this.setupIntents.set(id, intent)
    if (input.idempotencyKey) this.idempotency.set(input.idempotencyKey, id)
    this.calls.push({ method: "createSetupIntent", detail: id })
    return intent
  }

  async retrieveSetupIntent(id: string): Promise<StripeSetupIntent> {
    const intent = this.setupIntents.get(id)
    if (!intent) throw new StripeGatewayError(`no such setup intent: ${id}`, { code: "resource_missing" })
    this.calls.push({ method: "retrieveSetupIntent", detail: id })
    return intent
  }

  /**
   * Stands in for the browser completing the SetupIntent: attaches the card and marks the
   * intent succeeded, which is what `confirmCardSetup` then reads.
   */
  completeSetupIntent(setupIntentId: string, paymentMethodId: string): StripeSetupIntent {
    const intent = this.setupIntents.get(setupIntentId)
    if (!intent) throw new StripeGatewayError(`no such setup intent: ${setupIntentId}`)
    if (!this.paymentMethods.has(paymentMethodId)) {
      this.seedPaymentMethod(paymentMethodId, intent.customerId)
    }
    const state = this.paymentMethods.get(paymentMethodId)
    if (state) state.customerId = intent.customerId
    const updated: StripeSetupIntent = { ...intent, status: "succeeded", paymentMethodId }
    this.setupIntents.set(setupIntentId, updated)
    return updated
  }

  // ─── payment methods ───────────────────────────────────────────────────────
  async retrievePaymentMethod(id: string): Promise<StripePaymentMethod> {
    const state = this.paymentMethods.get(id)
    if (!state) throw new StripeGatewayError(`no such payment method: ${id}`, { code: "resource_missing" })
    this.calls.push({ method: "retrievePaymentMethod", detail: id })
    return { id: state.id, customerId: state.customerId, card: state.card }
  }

  async detachPaymentMethod(id: string): Promise<void> {
    const state = this.paymentMethods.get(id)
    if (state) {
      state.detached = true
      state.customerId = null
    }
    this.calls.push({ method: "detachPaymentMethod", detail: id })
  }

  // ─── payment intents ───────────────────────────────────────────────────────
  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<StripePaymentIntent> {
    if (!Number.isInteger(input.amount) || input.amount <= 0) {
      throw new StripeGatewayError(`amount must be a positive integer of cents: ${input.amount}`, {
        code: "parameter_invalid_integer",
      })
    }

    const replayedId = this.idempotency.get(input.idempotencyKey)
    if (replayedId) {
      const replayed = this.paymentIntents.get(replayedId)
      if (replayed) {
        this.calls.push({ method: "createPaymentIntent", detail: "replayed" })
        return replayed
      }
    }

    const id = this.nextId("pi")
    const intent: StripePaymentIntent = {
      id,
      status: "requires_confirmation",
      amount: input.amount,
      currency: STRIPE_CURRENCY,
      clientSecret: `${id}_secret_mock`,
      customerId: input.stripeCustomerId,
      paymentMethodId: input.paymentMethodId,
      latestChargeId: null,
      lastPaymentError: null,
    }
    this.paymentIntents.set(id, intent)
    this.idempotency.set(input.idempotencyKey, id)
    this.calls.push({ method: "createPaymentIntent", detail: `${id}:${input.amount}` })

    if (!input.confirm) return intent
    return this.settle(id, input.paymentMethodId)
  }

  async confirmPaymentIntent(
    id: string,
    input: ConfirmPaymentIntentInput = {},
  ): Promise<StripePaymentIntent> {
    const intent = this.paymentIntents.get(id)
    if (!intent) throw new StripeGatewayError(`no such payment intent: ${id}`, { code: "resource_missing" })
    this.calls.push({ method: "confirmPaymentIntent", detail: id })
    if (intent.status === "succeeded") return intent
    return this.settle(id, input.paymentMethodId ?? intent.paymentMethodId)
  }

  async retrievePaymentIntent(id: string): Promise<StripePaymentIntent> {
    const intent = this.paymentIntents.get(id)
    if (!intent) throw new StripeGatewayError(`no such payment intent: ${id}`, { code: "resource_missing" })
    this.calls.push({ method: "retrievePaymentIntent", detail: id })
    return intent
  }

  /** Stands in for the customer finishing the 3DS challenge in the browser. */
  completeThreeDSecure(paymentIntentId: string): StripePaymentIntent {
    const intent = this.paymentIntents.get(paymentIntentId)
    if (!intent) throw new StripeGatewayError(`no such payment intent: ${paymentIntentId}`)
    const succeeded: StripePaymentIntent = {
      ...intent,
      status: "succeeded",
      latestChargeId: this.nextId("ch"),
      lastPaymentError: null,
    }
    this.paymentIntents.set(paymentIntentId, succeeded)
    return succeeded
  }

  private settle(id: string, paymentMethodId: string | null): StripePaymentIntent {
    const intent = this.paymentIntents.get(id)
    if (!intent) throw new StripeGatewayError(`no such payment intent: ${id}`)
    const card = paymentMethodId ?? ""

    if (AUTHENTICATION_CARDS.has(card)) {
      const requiresAction: StripePaymentIntent = { ...intent, status: "requires_action" }
      this.paymentIntents.set(id, requiresAction)
      return requiresAction
    }

    const decline = DECLINING_CARDS[card]
    if (decline) {
      const failed: StripePaymentIntent = {
        ...intent,
        status: "requires_payment_method",
        lastPaymentError: {
          code: decline.code,
          declineCode: decline.declineCode,
          message: "La tarjeta ha sido rechazada.",
        },
      }
      this.paymentIntents.set(id, failed)
      throw new StripeGatewayError("La tarjeta ha sido rechazada.", {
        code: decline.code,
        declineCode: decline.declineCode,
        stripeType: "StripeCardError",
      })
    }

    const succeeded: StripePaymentIntent = {
      ...intent,
      status: "succeeded" satisfies StripePaymentIntentStatus,
      latestChargeId: this.nextId("ch"),
      lastPaymentError: null,
    }
    this.paymentIntents.set(id, succeeded)
    return succeeded
  }

  // ─── refunds ───────────────────────────────────────────────────────────────
  async createRefund(input: CreateRefundInput): Promise<StripeRefund> {
    const intent = this.paymentIntents.get(input.paymentIntentId)
    if (!intent) {
      throw new StripeGatewayError(`no such payment intent: ${input.paymentIntentId}`, {
        code: "resource_missing",
      })
    }
    if (input.idempotencyKey) {
      const replayedId = this.idempotency.get(input.idempotencyKey)
      const replayed = replayedId ? this.refunds.get(replayedId) : undefined
      if (replayed) {
        this.calls.push({ method: "createRefund", detail: "replayed" })
        return replayed
      }
    }
    const id = this.nextId("re")
    const refund: StripeRefund = {
      id,
      paymentIntentId: intent.id,
      amount: intent.amount,
      status: "succeeded",
    }
    this.refunds.set(id, refund)
    if (input.idempotencyKey) this.idempotency.set(input.idempotencyKey, id)
    this.calls.push({ method: "createRefund", detail: id })
    return refund
  }

  // ─── webhooks ──────────────────────────────────────────────────────────────
  constructWebhookEvent(rawBody: string, signatureHeader: string | null): StripeWebhookEvent {
    if (!signatureHeader) throw new StripeSignatureError("missing Stripe-Signature header")

    const parts = new Map<string, string[]>()
    for (const piece of signatureHeader.split(",")) {
      const [key, value] = piece.split("=", 2)
      if (!key || value === undefined) continue
      const bucket = parts.get(key.trim())
      if (bucket) bucket.push(value.trim())
      else parts.set(key.trim(), [value.trim()])
    }

    const timestamp = parts.get("t")?.[0]
    const signatures = parts.get("v1") ?? []
    if (!timestamp || signatures.length === 0) {
      throw new StripeSignatureError("malformed Stripe-Signature header")
    }

    const expected = createHmac("sha256", this.webhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex")
    const matches = signatures.some((candidate) => safeEqualHex(candidate, expected))
    if (!matches) throw new StripeSignatureError("signature does not match the raw body")

    return parseWebhookBody(rawBody)
  }

  private nextId(prefix: string): string {
    this.counter += 1
    return `${prefix}_mock${String(this.counter).padStart(6, "0")}`
  }
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"))
  } catch {
    return false
  }
}

/** Shared by the mock and the real adapter: the shape we hand the webhook handler. */
export function parseWebhookBody(rawBody: string): StripeWebhookEvent {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    throw new StripeSignatureError("webhook body is not JSON")
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new StripeSignatureError("webhook body is not an object")
  }
  const body = parsed as Record<string, unknown>
  const id = typeof body.id === "string" ? body.id : null
  const type = typeof body.type === "string" ? body.type : null
  if (!id || !type) throw new StripeSignatureError("webhook body has no id or type")

  const data = typeof body.data === "object" && body.data !== null
    ? (body.data as Record<string, unknown>)
    : {}
  const object = typeof data.object === "object" && data.object !== null
    ? (data.object as Record<string, unknown>)
    : {}

  return { id, type, object }
}
