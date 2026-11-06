import { describe, expect, it } from "vitest"

import { chargeRenewal, toAdminChargeResult } from "../checkout"
import {
  NOW,
  activeService,
  card,
  harness,
  spanishCompany,
  unpaidInvoice,
} from "./harness"

describe("a successful renewal", () => {
  it("charges off-session, marks the invoice paid and emits ola/payment.succeeded without calling WHMCS", async () => {
    const customer = spanishCompany()
    const kit = harness({
      customers: [customer],
      services: [activeService()],
      paymentMethods: [card()],
      invoices: [unpaidInvoice()],
    })

    const result = await chargeRenewal("svc_1", kit.deps)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("expected a successful charge")
    expect(result.amount).toBe(1087)
    expect(kit.store.invoices[0]?.status).toBe("paid")
    expect(kit.store.invoices[0]?.paidAt).toEqual(NOW)

    // The event is the ONLY path that books the payment in WHMCS. It carries everything
    // the jobs layer's handler needs, with the PaymentIntent as the transaction id.
    const succeeded = kit.events.emitted.filter((event) => event.name === "ola/payment.succeeded")
    expect(succeeded).toHaveLength(1)
    expect(succeeded[0]?.data).toMatchObject({
      serviceId: "svc_1",
      invoiceId: "inv_1",
      whmcsInvoiceId: 9001,
      stripePaymentIntentId: result.stripePaymentIntentId,
      amountCents: 1087,
      source: "stripe",
    })

    // Billing does not touch WHMCS on this path: the ledger port no longer has a way to
    // book a payment, and nothing was invoiced either.
    expect("recordPayment" in kit.ledger).toBe(false)
    expect(kit.ledger.invoicesCreated).toHaveLength(0)

    // And nothing alarming happened.
    expect(kit.events.emitted.some((event) => event.name === "ola/alert.raise")).toBe(false)
  })

  it("raises a critical alert with the PaymentIntent id when the booking event cannot be enqueued", async () => {
    const customer = spanishCompany()
    const kit = harness(
      {
        customers: [customer],
        services: [activeService()],
        paymentMethods: [card()],
        invoices: [unpaidInvoice()],
      },
      { failingEvents: ["ola/payment.succeeded"] },
    )

    const result = await chargeRenewal("svc_1", kit.deps)

    // The money moved, so the charge itself is still a success: failing it now would
    // invite a retry that charges the customer twice.
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("expected a successful charge")
    expect(kit.store.invoices[0]?.status).toBe("paid")

    // The booking event was attempted and lost.
    expect(kit.events.dropped.map((event) => event.name)).toEqual(["ola/payment.succeeded"])

    // ...which is loud, not silent: a critical alert naming the PaymentIntent.
    const alert = kit.events.emitted.find((event) => event.name === "ola/alert.raise")
    expect(alert?.data).toMatchObject({
      severity: "critical",
      entity: "invoice",
      entityId: "inv_1",
    })
    expect(alert?.name === "ola/alert.raise" && alert.data.detail).toContain(
      result.stripePaymentIntentId,
    )

    // ...and a paper trail for reconciliation.
    expect(kit.audit.entries).toContainEqual({
      entity: "invoice",
      action: "renewal_booking_not_queued",
    })
  })

  it("uses one idempotency key per invoice, so a retried job charges once", async () => {
    const customer = spanishCompany()
    const kit = harness({
      customers: [customer],
      services: [activeService()],
      paymentMethods: [card()],
      invoices: [unpaidInvoice()],
    })

    await chargeRenewal("svc_1", kit.deps)
    // The invoice is paid now, so the second call stops before Stripe. Force the race by
    // putting it back to unpaid: the same idempotency key must replay, not re-charge.
    await kit.store.updateInvoice("inv_1", { status: "unpaid", paidAt: null })
    await chargeRenewal("svc_1", kit.deps)

    expect(kit.stripe.paymentIntentCount).toBe(1)
  })
})

describe("a failed renewal returns the typed failure the dunning job acts on", () => {
  it("classifies a soft decline as retryable", async () => {
    const customer = spanishCompany()
    const kit = harness({
      customers: [customer],
      services: [activeService()],
      paymentMethods: [card({ stripePaymentMethodId: "pm_card_insufficientFunds" })],
      invoices: [unpaidInvoice()],
    })

    const result = await chargeRenewal("svc_1", kit.deps)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("expected a failure")
    expect(result.failure).toMatchObject({
      reason: "insufficient_funds",
      retryable: true,
      requiresAction: false,
      stripeCode: "card_declined",
      stripeDeclineCode: "insufficient_funds",
    })
    expect(result.failure.customerMessage).toBe("La tarjeta no tiene saldo suficiente.")
    expect(result.invoiceId).toBe("inv_1")
    expect(result.paymentId).not.toBeNull()

    // The invoice stays unpaid, a failed payment is on file, and the job is told.
    expect(kit.store.invoices[0]?.status).toBe("unpaid")
    expect(kit.store.payments.at(-1)?.status).toBe("failed")
    const failed = kit.events.emitted.find((event) => event.name === "ola/payment.failed")
    expect(failed?.data).toMatchObject({
      serviceId: "svc_1",
      invoiceId: "inv_1",
      amountCents: 1087,
      failureCode: "card_declined",
    })

    // And the customer gets the dunning calendar up front.
    expect(kit.notifier.sent.map((mail) => mail.template)).toContain("payment-failed")
  })

  it("classifies a hard decline as not retryable", async () => {
    const customer = spanishCompany()
    const kit = harness({
      customers: [customer],
      services: [activeService()],
      paymentMethods: [card({ stripePaymentMethodId: "pm_card_expired" })],
      invoices: [unpaidInvoice()],
    })

    const result = await chargeRenewal("svc_1", kit.deps)
    if (result.ok) throw new Error("expected a failure")
    expect(result.failure.reason).toBe("expired_card")
    expect(result.failure.retryable).toBe(false)
  })

  it("flags a 3DS challenge as requiring the customer, not as a retry", async () => {
    const customer = spanishCompany()
    const kit = harness({
      customers: [customer],
      services: [activeService()],
      paymentMethods: [card({ stripePaymentMethodId: "pm_card_authenticationRequired" })],
      invoices: [unpaidInvoice()],
    })

    const result = await chargeRenewal("svc_1", kit.deps)
    if (result.ok) throw new Error("expected a failure")
    expect(result.failure).toMatchObject({
      reason: "authentication_required",
      requiresAction: true,
      retryable: false,
    })
  })

  it("reports a missing card without touching Stripe", async () => {
    const customer = spanishCompany()
    const kit = harness({
      customers: [customer],
      services: [activeService()],
      invoices: [unpaidInvoice()],
    })

    const result = await chargeRenewal("svc_1", kit.deps)
    if (result.ok) throw new Error("expected a failure")
    expect(result.failure.reason).toBe("no_payment_method")
    expect(result.failure.retryable).toBe(false)
    expect(kit.stripe.paymentIntentCount).toBe(0)
  })

  it("reports a renewal with no invoice yet as retryable", async () => {
    const customer = spanishCompany()
    const kit = harness({
      customers: [customer],
      services: [activeService()],
      paymentMethods: [card()],
    })

    const result = await chargeRenewal("svc_1", kit.deps)
    if (result.ok) throw new Error("expected a failure")
    expect(result.failure.reason).toBe("no_invoice")
    expect(result.failure.retryable).toBe(true)
    expect(result.invoiceId).toBeNull()
  })

  it("refuses to charge a terminated service", async () => {
    const customer = spanishCompany()
    const kit = harness({
      customers: [customer],
      services: [activeService({ status: "terminated" })],
      paymentMethods: [card()],
      invoices: [unpaidInvoice()],
    })

    const result = await chargeRenewal("svc_1", kit.deps)
    if (result.ok) throw new Error("expected a failure")
    expect(result.failure.reason).toBe("not_chargeable")
    expect(kit.stripe.paymentIntentCount).toBe(0)
  })

  it("reports an unknown service instead of throwing", async () => {
    const kit = harness({ customers: [spanishCompany()] })
    const result = await chargeRenewal("svc_nope", kit.deps)
    expect(result.ok).toBe(false)
  })
})

describe("the flat shape the admin panel's port wants", () => {
  it("maps a success and a failure", async () => {
    const customer = spanishCompany()
    const kit = harness({
      customers: [customer],
      services: [activeService()],
      paymentMethods: [card()],
      invoices: [unpaidInvoice()],
    })

    const ok = await chargeRenewal("svc_1", kit.deps)
    expect(toAdminChargeResult(ok)).toEqual({
      charged: 1087,
      paymentIntentId: ok.ok ? ok.stripePaymentIntentId : null,
      declined: null,
    })

    // A failure that never reached Stripe reports our own reason.
    const failed = await chargeRenewal("svc_nope", kit.deps)
    expect(toAdminChargeResult(failed)).toEqual({
      charged: 0,
      paymentIntentId: null,
      declined: "not_chargeable",
    })
  })

  it("reports Stripe's most specific decline code to the operator", async () => {
    const kit = harness({
      customers: [spanishCompany()],
      services: [activeService()],
      paymentMethods: [card({ stripePaymentMethodId: "pm_card_insufficientFunds" })],
      invoices: [unpaidInvoice()],
    })

    const result = await chargeRenewal("svc_1", kit.deps)
    expect(toAdminChargeResult(result)).toEqual({
      charged: 0,
      paymentIntentId: null,
      declined: "insufficient_funds",
    })
  })
})

describe("a suspended server can still be renewed", () => {
  it("charges it, so the dunning job can bring it back", async () => {
    const customer = spanishCompany()
    const kit = harness({
      customers: [customer],
      services: [activeService({ status: "suspended" })],
      paymentMethods: [card()],
      invoices: [unpaidInvoice()],
    })

    const result = await chargeRenewal("svc_1", kit.deps)
    expect(result.ok).toBe(true)
  })
})
