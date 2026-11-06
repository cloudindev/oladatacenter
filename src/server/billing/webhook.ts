import { z } from "zod"

import { StripeSignatureError, type StripePaymentIntent } from "@/lib/stripe/types"

import {
  flagDisputedPayment,
  markOrderPaymentFailed,
  recordExternalRefund,
  settlePaymentIntent,
} from "./checkout"
import { confirmCardSetup } from "./payment-methods"
import { resolveDeps } from "./deps"
import type { BillingDepsOverride } from "./ports"

/**
 * The Stripe webhook, as a plain function.
 *
 * Three guarantees, in this order:
 *
 *  1. **The signature is verified against the RAW body.** Not the parsed JSON — a re-encoded
 *     body has a different byte sequence and would never match. A bad signature is a 400
 *     and nothing is written.
 *  2. **Every event is recorded in `webhookEvents`, unique on (provider, eventId).** A
 *     redelivery finds the row already there and no-ops with 200, so Stripe stops retrying.
 *  3. **An event we do not handle still answers 200.** Anything else makes Stripe retry
 *     forever and eventually disable the endpoint.
 *
 * A handler that throws answers 500 on purpose: Stripe's retry is how we recover, and the
 * event row keeps the error for the admin view.
 */

export const HANDLED_STRIPE_EVENTS = [
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "setup_intent.succeeded",
  "charge.refunded",
  "charge.dispute.created",
] as const
export type HandledStripeEvent = (typeof HANDLED_STRIPE_EVENTS)[number]

export interface WebhookOutcome {
  status: number
  /** What goes in the JSON body. Never an exception message from Stripe. */
  result: "ok" | "duplicate" | "ignored" | "invalid_signature" | "error"
  eventId: string | null
  eventType: string | null
  detail?: string
}

// ─── payload schemas ─────────────────────────────────────────────────────────
// Only the fields we act on. Everything else in the object is ignored.

const idRef = z.union([z.string(), z.object({ id: z.string() }).transform((value) => value.id)])

const paymentIntentSchema = z.object({
  id: z.string(),
  status: z.enum([
    "requires_payment_method",
    "requires_confirmation",
    "requires_action",
    "processing",
    "requires_capture",
    "canceled",
    "succeeded",
  ]),
  amount: z.number().int(),
  currency: z.string().default("eur"),
  client_secret: z.string().nullable().optional(),
  customer: idRef.nullable().optional(),
  payment_method: idRef.nullable().optional(),
  latest_charge: idRef.nullable().optional(),
  last_payment_error: z
    .object({
      code: z.string().nullable().optional(),
      decline_code: z.string().nullable().optional(),
      message: z.string().nullable().optional(),
    })
    .nullish(),
})

const setupIntentSchema = z.object({ id: z.string() })

const chargeSchema = z.object({
  id: z.string(),
  payment_intent: idRef.nullable().optional(),
  amount_refunded: z.number().int().default(0),
})

const disputeSchema = z.object({
  id: z.string(),
  charge: idRef.nullable().optional(),
  payment_intent: idRef.nullable().optional(),
  reason: z.string().default("unknown"),
})

function toPaymentIntent(parsed: z.infer<typeof paymentIntentSchema>): StripePaymentIntent {
  const error = parsed.last_payment_error
  return {
    id: parsed.id,
    status: parsed.status,
    amount: parsed.amount,
    currency: parsed.currency,
    clientSecret: parsed.client_secret ?? null,
    customerId: parsed.customer ?? null,
    paymentMethodId: parsed.payment_method ?? null,
    latestChargeId: parsed.latest_charge ?? null,
    lastPaymentError: error
      ? {
          code: error.code ?? null,
          declineCode: error.decline_code ?? null,
          message: error.message ?? "La tarjeta ha sido rechazada.",
        }
      : null,
  }
}

// ─── the handler ─────────────────────────────────────────────────────────────

export async function handleStripeWebhook(
  rawBody: string,
  signatureHeader: string | null,
  override: BillingDepsOverride = {},
): Promise<WebhookOutcome> {
  const deps = await resolveDeps(override)

  let event
  try {
    event = deps.stripe.constructWebhookEvent(rawBody, signatureHeader)
  } catch (error) {
    // Never echo the reason back to the caller; it goes to the log only.
    console.error("[stripe-webhook] signature verification failed", {
      reason:
        error instanceof StripeSignatureError
          ? error.message
          : error instanceof Error
            ? error.message
            : "unknown",
    })
    return {
      status: 400,
      result: "invalid_signature",
      eventId: null,
      eventType: null,
      detail: "firma no válida",
    }
  }

  // Unique on (provider, eventId): a redelivery stops right here.
  const recorded = await deps.store.recordWebhookEvent({
    provider: "stripe",
    eventId: event.id,
    eventType: event.type,
    payload: event.object,
  })
  if (!recorded.fresh) {
    return { status: 200, result: "duplicate", eventId: event.id, eventType: event.type }
  }

  if (!isHandled(event.type)) {
    await deps.store.markWebhookProcessed("stripe", event.id)
    return { status: 200, result: "ignored", eventId: event.id, eventType: event.type }
  }

  try {
    await dispatch(event.type, event.object, override)
    await deps.store.markWebhookProcessed("stripe", event.id)
    return { status: 200, result: "ok", eventId: event.id, eventType: event.type }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await deps.store.markWebhookFailed("stripe", event.id, message)
    console.error("[stripe-webhook] handler failed", { type: event.type, error: message })
    // 500 so Stripe retries. The event row is already there, and the retry finds it is not
    // processed yet, so the work happens exactly once.
    return {
      status: 500,
      result: "error",
      eventId: event.id,
      eventType: event.type,
      detail: "no hemos podido procesar el evento",
    }
  }
}

function isHandled(type: string): type is HandledStripeEvent {
  return (HANDLED_STRIPE_EVENTS as readonly string[]).includes(type)
}

async function dispatch(
  type: HandledStripeEvent,
  object: Record<string, unknown>,
  override: BillingDepsOverride,
): Promise<void> {
  switch (type) {
    case "payment_intent.succeeded": {
      const intent = paymentIntentSchema.parse(object)
      await settlePaymentIntent(toPaymentIntent(intent), override)
      return
    }

    case "payment_intent.payment_failed": {
      const intent = paymentIntentSchema.parse(object)
      const error = intent.last_payment_error
      await markOrderPaymentFailed(
        intent.id,
        error
          ? {
              code: error.code ?? null,
              declineCode: error.decline_code ?? null,
              message: error.message ?? "El cobro ha sido rechazado.",
            }
          : null,
        override,
      )
      return
    }

    case "setup_intent.succeeded": {
      const intent = setupIntentSchema.parse(object)
      // Idempotent: the browser usually got there first and this finds the stored card.
      await confirmCardSetup(intent.id, override)
      return
    }

    case "charge.refunded": {
      const charge = chargeSchema.parse(object)
      if (charge.payment_intent) {
        await recordExternalRefund(charge.payment_intent, charge.amount_refunded, override)
      }
      return
    }

    case "charge.dispute.created": {
      const dispute = disputeSchema.parse(object)
      await flagDisputedPayment(dispute.payment_intent ?? null, dispute.reason, override)
      return
    }
  }
}
