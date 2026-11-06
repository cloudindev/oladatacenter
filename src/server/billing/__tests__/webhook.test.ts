import { describe, expect, it } from "vitest"

import { createOrderDraft } from "../checkout"
import { handleStripeWebhook } from "../webhook"
import { DEFAULT_CONFIGURATION, card, harness, sessionFor, spanishCompany } from "./harness"

function paymentIntentSucceeded(
  eventId: string,
  intentId: string,
  amount: number,
): Record<string, unknown> {
  return {
    id: eventId,
    type: "payment_intent.succeeded",
    data: {
      object: {
        id: intentId,
        status: "succeeded",
        amount,
        currency: "eur",
        customer: "cus_es",
        payment_method: "pm_card_visa",
        latest_charge: "ch_123",
      },
    },
  }
}

describe("signature verification", () => {
  it("rejects a body whose signature does not match, and writes nothing", async () => {
    const kit = harness({ customers: [spanishCompany()] })
    const body = JSON.stringify(paymentIntentSucceeded("evt_1", "pi_1", 1087))

    const outcome = await handleStripeWebhook(body, "t=1,v1=deadbeef", kit.deps)

    expect(outcome.status).toBe(400)
    expect(outcome.result).toBe("invalid_signature")
    expect(kit.store.webhooks).toHaveLength(0)
  })

  it("rejects a missing signature header", async () => {
    const kit = harness({ customers: [spanishCompany()] })
    const body = JSON.stringify(paymentIntentSucceeded("evt_2", "pi_2", 1087))

    const outcome = await handleStripeWebhook(body, null, kit.deps)
    expect(outcome.status).toBe(400)
    expect(outcome.result).toBe("invalid_signature")
  })

  it("rejects a body that was re-serialised after signing", async () => {
    const kit = harness({ customers: [spanishCompany()] })
    const raw = JSON.stringify(paymentIntentSucceeded("evt_3", "pi_3", 1087))
    const signature = kit.stripe.signWebhookPayload(raw)

    // Same data, different bytes: this is exactly what parsing-then-verifying would do.
    const reserialised = JSON.stringify(JSON.parse(raw), null, 2)
    const outcome = await handleStripeWebhook(reserialised, signature, kit.deps)

    expect(outcome.status).toBe(400)
    expect(outcome.result).toBe("invalid_signature")
  })
})

describe("idempotency", () => {
  it("processes an event once and no-ops on the redelivery", async () => {
    const customer = spanishCompany({ firstPaidAt: null })
    const kit = harness({ customers: [customer], paymentMethods: [card()] })

    const order = await createOrderDraft(sessionFor(customer), DEFAULT_CONFIGURATION, kit.deps)
    // Pretend the PaymentIntent was created and is now reported succeeded.
    await kit.store.updateOrder(order.id, { stripePaymentIntentId: "pi_hook" })

    const body = JSON.stringify(paymentIntentSucceeded("evt_dup", "pi_hook", order.total))
    const signature = kit.stripe.signWebhookPayload(body)

    const first = await handleStripeWebhook(body, signature, kit.deps)
    expect(first.status).toBe(200)
    expect(first.result).toBe("ok")
    expect(kit.store.orders.get(order.id)?.status).toBe("paid")

    const second = await handleStripeWebhook(body, signature, kit.deps)
    expect(second.status).toBe(200)
    expect(second.result).toBe("duplicate")

    // One webhook row, one payment, one handover to provisioning.
    expect(kit.store.webhooks).toHaveLength(1)
    expect(kit.store.payments.filter((p) => p.status === "succeeded")).toHaveLength(1)
    expect(kit.events.emitted.filter((e) => e.name === "ola/order.paid")).toHaveLength(1)
  })

  it("answers 200 for an event type we do not handle and marks it processed", async () => {
    const kit = harness({ customers: [spanishCompany()] })
    const body = JSON.stringify({ id: "evt_ignored", type: "invoice.upcoming", data: { object: {} } })
    const signature = kit.stripe.signWebhookPayload(body)

    const outcome = await handleStripeWebhook(body, signature, kit.deps)
    expect(outcome.status).toBe(200)
    expect(outcome.result).toBe("ignored")
    expect(kit.store.webhooks[0]?.processedAt).not.toBeNull()
  })

  it("ignores a PaymentIntent that belongs to nobody", async () => {
    const kit = harness({ customers: [spanishCompany()] })
    const body = JSON.stringify(paymentIntentSucceeded("evt_orphan", "pi_unknown", 500))
    const signature = kit.stripe.signWebhookPayload(body)

    const outcome = await handleStripeWebhook(body, signature, kit.deps)
    expect(outcome.status).toBe(200)
    expect(outcome.result).toBe("ok")
    expect(kit.store.payments).toHaveLength(0)
  })
})

describe("the events we handle", () => {
  it("records a declined charge from payment_intent.payment_failed", async () => {
    const customer = spanishCompany()
    const kit = harness({ customers: [customer], paymentMethods: [card()] })
    const order = await createOrderDraft(sessionFor(customer), DEFAULT_CONFIGURATION, kit.deps)
    await kit.store.updateOrder(order.id, { stripePaymentIntentId: "pi_failed" })

    const body = JSON.stringify({
      id: "evt_failed",
      type: "payment_intent.payment_failed",
      data: {
        object: {
          id: "pi_failed",
          status: "requires_payment_method",
          amount: order.total,
          currency: "eur",
          last_payment_error: {
            code: "card_declined",
            decline_code: "insufficient_funds",
            message: "Fondos insuficientes.",
          },
        },
      },
    })
    const outcome = await handleStripeWebhook(body, kit.stripe.signWebhookPayload(body), kit.deps)

    expect(outcome.result).toBe("ok")
    expect(kit.store.payments.at(-1)?.status).toBe("failed")
    expect(kit.store.orders.get(order.id)?.errorCode).toBe("payment_failed")
    expect(kit.store.orders.get(order.id)?.paidAt).toBeNull()
  })

  it("stores the card from setup_intent.succeeded, with its fingerprint", async () => {
    const customer = spanishCompany()
    const kit = harness({ customers: [customer] })

    const ticket = await kit.stripe.createSetupIntent({ stripeCustomerId: "cus_es" })
    kit.stripe.completeSetupIntent(ticket.id, "pm_card_visa")

    const body = JSON.stringify({
      id: "evt_setup",
      type: "setup_intent.succeeded",
      data: { object: { id: ticket.id } },
    })
    const outcome = await handleStripeWebhook(body, kit.stripe.signWebhookPayload(body), kit.deps)

    expect(outcome.result).toBe("ok")
    const stored = kit.store.paymentMethods[0]
    expect(stored?.brand).toBe("visa")
    expect(stored?.last4).toBe("4242")
    expect(stored?.fingerprint).toBeTruthy()
    // The first card is the default and is verified, because 3DS was requested.
    expect(stored?.isDefault).toBe(true)
    expect(stored?.verifiedAt).toEqual(expect.any(Date))
  })

  it("records a refund Stripe tells us about", async () => {
    const customer = spanishCompany()
    const kit = harness({ customers: [customer] })
    const payment = await kit.store.insertPayment({
      customerId: customer.id,
      orderId: null,
      invoiceId: null,
      stripePaymentIntentId: "pi_refunded",
      amount: 1087,
      status: "succeeded",
      failureCode: null,
      failureMessage: null,
      settledAt: new Date(),
    })

    const body = JSON.stringify({
      id: "evt_refund",
      type: "charge.refunded",
      data: { object: { id: "ch_1", payment_intent: "pi_refunded", amount_refunded: 1087 } },
    })
    await handleStripeWebhook(body, kit.stripe.signWebhookPayload(body), kit.deps)

    const updated = kit.store.payments.find((item) => item.id === payment.id)
    expect(updated?.refundedAmount).toBe(1087)
    expect(updated?.status).toBe("refunded")
  })

  it("puts the customer under review on charge.dispute.created", async () => {
    const customer = spanishCompany()
    const kit = harness({ customers: [customer] })
    await kit.store.insertPayment({
      customerId: customer.id,
      orderId: null,
      invoiceId: null,
      stripePaymentIntentId: "pi_disputed",
      amount: 1087,
      status: "succeeded",
      failureCode: null,
      failureMessage: null,
      settledAt: new Date(),
    })

    const body = JSON.stringify({
      id: "evt_dispute",
      type: "charge.dispute.created",
      data: { object: { id: "dp_1", payment_intent: "pi_disputed", reason: "fraudulent" } },
    })
    const outcome = await handleStripeWebhook(body, kit.stripe.signWebhookPayload(body), kit.deps)

    expect(outcome.result).toBe("ok")
    expect(kit.store.customers.get(customer.id)?.status).toBe("review")
    const alert = kit.events.emitted.find((event) => event.name === "ola/alert.raise")
    expect(alert?.data).toMatchObject({ severity: "critical", entity: "customer" })
  })
})
