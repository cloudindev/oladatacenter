/**
 * The real Stripe adapter. The SDK is imported here and nowhere else.
 *
 * Every method narrows the SDK's wide response objects down to the port DTOs, so a field
 * we do not use cannot leak into a database row, a log line or a Client Component.
 */
import Stripe from "stripe"

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
  type StripePaymentMethod,
  type StripeRefund,
  type StripeSetupIntent,
  type StripeWebhookEvent,
} from "./types"

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null
  return typeof value === "string" ? value : value.id
}

function toCard(method: Stripe.PaymentMethod): StripeCardDetails | null {
  const card = method.card
  if (!card) return null
  return {
    brand: card.brand,
    last4: card.last4,
    expMonth: card.exp_month,
    expYear: card.exp_year,
    fingerprint: card.fingerprint ?? null,
  }
}

function toPaymentMethod(method: Stripe.PaymentMethod): StripePaymentMethod {
  return { id: method.id, customerId: idOf(method.customer), card: toCard(method) }
}

function toSetupIntent(intent: Stripe.SetupIntent): StripeSetupIntent {
  return {
    id: intent.id,
    clientSecret: intent.client_secret ?? null,
    status: intent.status,
    customerId: idOf(intent.customer),
    paymentMethodId: idOf(intent.payment_method),
  }
}

function toPaymentIntent(intent: Stripe.PaymentIntent): StripePaymentIntent {
  const error = intent.last_payment_error
  return {
    id: intent.id,
    status: intent.status,
    amount: intent.amount,
    currency: intent.currency,
    clientSecret: intent.client_secret ?? null,
    customerId: idOf(intent.customer),
    paymentMethodId: idOf(intent.payment_method),
    latestChargeId: idOf(intent.latest_charge),
    lastPaymentError: error
      ? {
          code: error.code ?? null,
          declineCode: error.decline_code ?? null,
          message: error.message ?? "La tarjeta ha sido rechazada.",
        }
      : null,
  }
}

/** Turns anything the SDK throws into the port's own error type. */
function rethrow(error: unknown): never {
  if (error instanceof Stripe.errors.StripeError) {
    throw new StripeGatewayError(error.message, {
      code: error.code ?? null,
      declineCode: error.decline_code ?? null,
      stripeType: error.type ?? null,
      cause: error,
    })
  }
  throw new StripeGatewayError(error instanceof Error ? error.message : String(error), {
    cause: error,
  })
}

export class HttpStripeGateway implements StripeGateway {
  private readonly stripe: Stripe
  private readonly webhookSecret: string | null

  constructor(stripe: Stripe, options: { webhookSecret?: string | null } = {}) {
    this.stripe = stripe
    this.webhookSecret = options.webhookSecret ?? null
  }

  async ensureCustomer(input: EnsureCustomerInput): Promise<{ id: string }> {
    try {
      if (input.stripeCustomerId) {
        const existing = await this.stripe.customers.retrieve(input.stripeCustomerId)
        if (!existing.deleted) return { id: existing.id }
      }
      const created = await this.stripe.customers.create({
        email: input.email,
        ...(input.name ? { name: input.name } : {}),
        ...(input.metadata ? { metadata: { ...input.metadata } } : {}),
      })
      return { id: created.id }
    } catch (error) {
      return rethrow(error)
    }
  }

  async createSetupIntent(input: CreateSetupIntentInput): Promise<StripeSetupIntent> {
    try {
      const intent = await this.stripe.setupIntents.create(
        {
          customer: input.stripeCustomerId,
          payment_method_types: ["card"],
          usage: "off_session",
          // The card is authenticated once, now, so later renewals do not need the customer.
          payment_method_options: { card: { request_three_d_secure: "any" } },
          ...(input.metadata ? { metadata: { ...input.metadata } } : {}),
        },
        input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined,
      )
      return toSetupIntent(intent)
    } catch (error) {
      return rethrow(error)
    }
  }

  async retrieveSetupIntent(id: string): Promise<StripeSetupIntent> {
    try {
      return toSetupIntent(await this.stripe.setupIntents.retrieve(id))
    } catch (error) {
      return rethrow(error)
    }
  }

  async retrievePaymentMethod(id: string): Promise<StripePaymentMethod> {
    try {
      return toPaymentMethod(await this.stripe.paymentMethods.retrieve(id))
    } catch (error) {
      return rethrow(error)
    }
  }

  async detachPaymentMethod(id: string): Promise<void> {
    try {
      await this.stripe.paymentMethods.detach(id)
    } catch (error) {
      rethrow(error)
    }
  }

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<StripePaymentIntent> {
    try {
      const intent = await this.stripe.paymentIntents.create(
        {
          amount: input.amount,
          currency: STRIPE_CURRENCY,
          customer: input.stripeCustomerId,
          payment_method: input.paymentMethodId,
          payment_method_types: ["card"],
          confirm: input.confirm,
          off_session: input.offSession,
          description: input.description,
          ...(input.metadata ? { metadata: { ...input.metadata } } : {}),
        },
        { idempotencyKey: input.idempotencyKey },
      )
      return toPaymentIntent(intent)
    } catch (error) {
      return rethrow(error)
    }
  }

  async confirmPaymentIntent(
    id: string,
    input: ConfirmPaymentIntentInput = {},
  ): Promise<StripePaymentIntent> {
    try {
      const intent = await this.stripe.paymentIntents.confirm(
        id,
        input.paymentMethodId ? { payment_method: input.paymentMethodId } : {},
        input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined,
      )
      return toPaymentIntent(intent)
    } catch (error) {
      return rethrow(error)
    }
  }

  async retrievePaymentIntent(id: string): Promise<StripePaymentIntent> {
    try {
      return toPaymentIntent(await this.stripe.paymentIntents.retrieve(id))
    } catch (error) {
      return rethrow(error)
    }
  }

  async createRefund(input: CreateRefundInput): Promise<StripeRefund> {
    try {
      const refund = await this.stripe.refunds.create(
        {
          payment_intent: input.paymentIntentId,
          ...(input.reason ? { reason: input.reason } : {}),
          ...(input.metadata ? { metadata: { ...input.metadata } } : {}),
        },
        input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined,
      )
      return {
        id: refund.id,
        paymentIntentId: idOf(refund.payment_intent) ?? input.paymentIntentId,
        amount: refund.amount,
        status: refund.status ?? "unknown",
      }
    } catch (error) {
      return rethrow(error)
    }
  }

  constructWebhookEvent(rawBody: string, signatureHeader: string | null): StripeWebhookEvent {
    if (!this.webhookSecret) {
      throw new StripeSignatureError("STRIPE_WEBHOOK_SECRET is not configured")
    }
    if (!signatureHeader) throw new StripeSignatureError("missing Stripe-Signature header")
    try {
      const event = this.stripe.webhooks.constructEvent(
        rawBody,
        signatureHeader,
        this.webhookSecret,
      )
      const object = event.data.object as unknown
      return {
        id: event.id,
        type: event.type,
        object:
          typeof object === "object" && object !== null
            ? (object as Record<string, unknown>)
            : {},
      }
    } catch (error) {
      throw new StripeSignatureError(
        error instanceof Error ? error.message : "signature verification failed",
      )
    }
  }
}
