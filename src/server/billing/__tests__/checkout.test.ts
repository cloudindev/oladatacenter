import { describe, expect, it } from "vitest"

import { checkoutTotals, DomainError, WELCOME_CREDIT_CENTS } from "@ola/core"

import { createOrderDraft, payOrder, previewCheckout, refundOrder } from "../checkout"
import {
  DEFAULT_CONFIGURATION,
  NOW,
  card,
  harness,
  quoteFor,
  reverseChargeCompany,
  sessionFor,
  spanishCompany,
} from "./harness"
import type { CreditRecord } from "../data"

function creditOf(amount: number, overrides: Partial<CreditRecord> = {}): CreditRecord {
  return {
    id: "cr_welcome",
    customerId: "cust_es",
    amount,
    consumed: 0,
    reason: "welcome",
    note: "Crédito de bienvenida",
    expiresAt: new Date("2026-12-06T10:00:00.000Z"),
    signals: null,
    createdAt: NOW,
    ...overrides,
  }
}

/** The published price of the entry plan plus its mandatory backup: 7,99 + 0,99. */
const SUBTOTAL = 898

/** Amounts Stripe was actually asked to charge, read back off the mock's call log. */
function chargedAmounts(stripeCalls: readonly { method: string; detail: string }[]): number[] {
  return stripeCalls
    .filter((call) => call.method === "createPaymentIntent" && call.detail !== "replayed")
    .map((call) => Number(call.detail.split(":")[1]))
}

describe("the amount charged is always the one `checkoutTotals` computed", () => {
  it("charges a Spanish customer the net plus 21 % VAT", async () => {
    const customer = spanishCompany()
    const kit = harness({ customers: [customer], paymentMethods: [card()] })

    const expected = checkoutTotals(quoteFor(DEFAULT_CONFIGURATION), 0, {
      country: "ES",
      kind: "company",
      hasValidEuVatNumber: true,
    })
    expect(expected.subtotal).toBe(SUBTOTAL)
    expect(expected.tax).toBe(189)
    expect(expected.total).toBe(1087)

    const order = await createOrderDraft(
      sessionFor(customer),
      DEFAULT_CONFIGURATION,
      kit.deps,
    )
    expect(order.subtotal).toBe(expected.subtotal)
    expect(order.tax).toBe(expected.tax)
    expect(order.total).toBe(expected.total)

    const result = await payOrder(order.id, kit.deps)
    expect(result.status).toBe("paid")

    // What Stripe was actually asked to charge.
    expect(chargedAmounts(kit.stripe.calls)).toEqual([expected.total])
  })

  it("charges a reverse-charge EU company the net with no VAT at all", async () => {
    const customer = reverseChargeCompany()
    const kit = harness({
      customers: [customer],
      paymentMethods: [card({ customerId: customer.id })],
    })

    const expected = checkoutTotals(quoteFor(DEFAULT_CONFIGURATION), 0, {
      country: "DE",
      kind: "company",
      hasValidEuVatNumber: true,
    })
    expect(expected.tax).toBe(0)
    expect(expected.total).toBe(SUBTOTAL)

    const order = await createOrderDraft(sessionFor(customer), DEFAULT_CONFIGURATION, kit.deps)
    expect(order.tax).toBe(0)
    expect(order.total).toBe(SUBTOTAL)

    const preview = await previewCheckout(customer.id, DEFAULT_CONFIGURATION, kit.deps)
    expect(preview.vat.kind).toBe("reverse_charge")
    expect(preview.vat.label).toBe("Inversión del sujeto pasivo")

    await payOrder(order.id, kit.deps)
    expect(chargedAmounts(kit.stripe.calls)).toEqual([SUBTOTAL])
  })

  it("prices the 12-month term as twelve cycles, not one month", async () => {
    const customer = spanishCompany()
    const kit = harness({ customers: [customer], paymentMethods: [card()] })
    const annual = { ...DEFAULT_CONFIGURATION, term: "P12M" as const }

    const order = await createOrderDraft(sessionFor(customer), annual, kit.deps)
    const expected = checkoutTotals(quoteFor(annual), 0, {
      country: "ES",
      kind: "company",
      hasValidEuVatNumber: true,
    })
    expect(order.subtotal).toBe(expected.subtotal)
    expect(order.total).toBe(expected.total)
    expect(order.subtotal).toBe(quoteFor(annual).monthlyPrice * 12)
  })
})

describe("credit larger than the order", () => {
  it("produces a 0 € charge, never a negative one, and never calls Stripe", async () => {
    const customer = spanishCompany({ firstPaidAt: null })
    const kit = harness({
      customers: [customer],
      paymentMethods: [card()],
      credits: [creditOf(5000)],
    })

    const order = await createOrderDraft(sessionFor(customer), DEFAULT_CONFIGURATION, kit.deps)
    expect(order.creditApplied).toBe(SUBTOTAL)
    expect(order.tax).toBe(0)
    expect(order.total).toBe(0)
    expect(order.total).toBeGreaterThanOrEqual(0)

    const result = await payOrder(order.id, kit.deps)
    expect(result.status).toBe("paid")
    expect(result.status === "paid" && result.paymentIntentId).toBeNull()

    // The whole point: Stripe is not involved.
    expect(kit.stripe.paymentIntentCount).toBe(0)
    expect(kit.stripe.calls.filter((call) => call.method === "createPaymentIntent")).toHaveLength(0)

    // The credit is spent, exactly once, up to the subtotal.
    expect(kit.store.credits[0]?.consumed).toBe(SUBTOTAL)

    // And it is invoiced as a DISCOUNT line, not as a standalone credit invoice.
    expect(kit.ledger.invoicesCreated).toHaveLength(1)
    const invoice = kit.ledger.invoicesCreated[0]
    expect(invoice?.status).toBe("Paid")
    expect(invoice?.lines.map((line) => line.amount)).toEqual([SUBTOTAL, -SUBTOTAL])

    // A credit-covered order is not real money: the trial limits still apply.
    expect(kit.store.customers.get(customer.id)?.firstPaidAt).toBeNull()
  })

  it("caps the discount at the subtotal when the welcome credit is smaller", async () => {
    const customer = spanishCompany()
    const kit = harness({
      customers: [customer],
      paymentMethods: [card()],
      credits: [creditOf(WELCOME_CREDIT_CENTS)],
    })

    const order = await createOrderDraft(sessionFor(customer), DEFAULT_CONFIGURATION, kit.deps)
    // 10,00 € against an 8,98 € net: the discount stops at the subtotal.
    expect(order.creditApplied).toBe(SUBTOTAL)
    expect(order.total).toBe(0)
  })

  it("applies the credit BEFORE VAT, so VAT is charged on the discounted base", async () => {
    const customer = spanishCompany()
    const kit = harness({
      customers: [customer],
      paymentMethods: [card()],
      credits: [creditOf(500)],
    })

    const order = await createOrderDraft(sessionFor(customer), DEFAULT_CONFIGURATION, kit.deps)
    expect(order.subtotal).toBe(SUBTOTAL)
    expect(order.creditApplied).toBe(500)
    // 21 % of 398, not of 898.
    expect(order.tax).toBe(84)
    expect(order.total).toBe(482)
  })
})

describe("nothing the client sends about money is read", () => {
  it("ignores a price, a total and an amount posted alongside the configuration", async () => {
    const customer = spanishCompany()
    const kit = harness({ customers: [customer], paymentMethods: [card()] })

    const tampered = {
      ...DEFAULT_CONFIGURATION,
      total: 1,
      amount: 1,
      price: 1,
      subtotal: 1,
      tax: 0,
      creditApplied: 99_999,
      expectedCost: 0,
    }

    const order = await createOrderDraft(sessionFor(customer), tampered, kit.deps)
    expect(order.subtotal).toBe(SUBTOTAL)
    expect(order.tax).toBe(189)
    expect(order.creditApplied).toBe(0)
    expect(order.total).toBe(1087)

    await payOrder(order.id, kit.deps)
    expect(chargedAmounts(kit.stripe.calls)).toEqual([1087])
  })

  it("refuses a configuration that is not a valid shape at all", async () => {
    const customer = spanishCompany()
    const kit = harness({ customers: [customer], paymentMethods: [card()] })

    await expect(
      createOrderDraft(sessionFor(customer), { plan: 7, term: "P1M" }, kit.deps),
    ).rejects.toBeInstanceOf(DomainError)
  })
})

describe("one order, one charge", () => {
  it("replays the first PaymentIntent when the same order is submitted twice", async () => {
    const customer = spanishCompany()
    const kit = harness({ customers: [customer], paymentMethods: [card()] })

    const order = await createOrderDraft(sessionFor(customer), DEFAULT_CONFIGURATION, kit.deps)

    const first = await payOrder(order.id, kit.deps)
    const second = await payOrder(order.id, kit.deps)

    expect(first.status).toBe("paid")
    expect(second.status).toBe("paid")
    // Exactly one PaymentIntent exists for the order's idempotency key.
    expect(kit.stripe.paymentIntentCount).toBe(1)
    expect(kit.store.payments.filter((p) => p.status === "succeeded")).toHaveLength(1)
  })

  it("passes the order's own idempotency key to Stripe", async () => {
    const customer = spanishCompany()
    const kit = harness({ customers: [customer], paymentMethods: [card()] })
    const order = await createOrderDraft(sessionFor(customer), DEFAULT_CONFIGURATION, kit.deps)

    expect(order.idempotencyKey).toMatch(/^ord_/)

    // A second, independent order gets its own key, so both can be charged.
    const other = await createOrderDraft(sessionFor(customer), DEFAULT_CONFIGURATION, kit.deps)
    expect(other.idempotencyKey).not.toBe(order.idempotencyKey)

    await payOrder(order.id, kit.deps)
    await payOrder(other.id, kit.deps)
    expect(kit.stripe.paymentIntentCount).toBe(2)
  })
})

describe("credit is spent exactly once", () => {
  it("does not spend it again when the charge is retried after a 3DS challenge", async () => {
    const customer = spanishCompany()
    const kit = harness({
      customers: [customer],
      paymentMethods: [card({ stripePaymentMethodId: "pm_card_authenticationRequired" })],
      credits: [creditOf(500)],
    })

    const order = await createOrderDraft(sessionFor(customer), DEFAULT_CONFIGURATION, kit.deps)
    expect(order.creditApplied).toBe(500)

    const first = await payOrder(order.id, kit.deps)
    expect(first.status).toBe("requires_action")
    expect(kit.store.credits[0]?.consumed).toBe(500)

    // The customer gave up and pressed the button again.
    const second = await payOrder(order.id, kit.deps)
    expect(second.status).toBe("requires_action")
    expect(kit.store.credits[0]?.consumed).toBe(500)
  })

  it("refuses the order when a parallel order drained the credit first", async () => {
    const customer = spanishCompany()
    const kit = harness({
      customers: [customer],
      paymentMethods: [card()],
      credits: [creditOf(500)],
    })

    const order = await createOrderDraft(sessionFor(customer), DEFAULT_CONFIGURATION, kit.deps)
    // Somebody else spent it between the draft and the charge.
    await kit.store.consumeCredit(customer.id, 500, "ord_other")

    await expect(payOrder(order.id, kit.deps)).rejects.toBeInstanceOf(DomainError)
    expect(kit.stripe.paymentIntentCount).toBe(0)
    expect(kit.store.orders.get(order.id)?.errorCode).toBe("price_mismatch")
  })
})

describe("3D Secure", () => {
  it("returns the client secret so the browser can run the challenge", async () => {
    const customer = spanishCompany()
    const kit = harness({
      customers: [customer],
      paymentMethods: [card({ stripePaymentMethodId: "pm_card_authenticationRequired" })],
    })

    const order = await createOrderDraft(sessionFor(customer), DEFAULT_CONFIGURATION, kit.deps)
    const result = await payOrder(order.id, kit.deps)

    expect(result.status).toBe("requires_action")
    if (result.status !== "requires_action") throw new Error("expected requires_action")
    expect(result.clientSecret).toContain("_secret_")
    // Not paid yet, and nothing was emitted to the jobs layer.
    expect(kit.store.orders.get(order.id)?.paidAt).toBeNull()
    expect(kit.events.emitted).toHaveLength(0)
  })
})

describe("declines", () => {
  it("returns a typed failure, records it and tells the jobs layer", async () => {
    const customer = spanishCompany()
    const kit = harness({
      customers: [customer],
      paymentMethods: [card({ stripePaymentMethodId: "pm_card_declined" })],
    })

    const order = await createOrderDraft(sessionFor(customer), DEFAULT_CONFIGURATION, kit.deps)
    const result = await payOrder(order.id, kit.deps)

    expect(result.status).toBe("failed")
    if (result.status !== "failed") throw new Error("expected failed")
    expect(result.failure.reason).toBe("card_declined")
    expect(result.failure.customerMessage).toBe("El banco ha rechazado el cargo.")
    expect(kit.store.payments.at(-1)?.status).toBe("failed")
    expect(kit.events.emitted.map((event) => event.name)).toContain("ola/payment.failed")
  })

  it("fails cleanly when there is no card on file", async () => {
    const customer = spanishCompany()
    const kit = harness({ customers: [customer] })

    const order = await createOrderDraft(sessionFor(customer), DEFAULT_CONFIGURATION, kit.deps)
    const result = await payOrder(order.id, kit.deps)

    expect(result.status).toBe("failed")
    if (result.status !== "failed") throw new Error("expected failed")
    expect(result.failure.reason).toBe("no_payment_method")
    expect(kit.stripe.paymentIntentCount).toBe(0)
  })
})

describe("gates", () => {
  it("blocks an unverified account and points it at the onboarding", async () => {
    const customer = spanishCompany({ status: "unverified" })
    const kit = harness({ customers: [customer], paymentMethods: [card()] })

    const preview = await previewCheckout(customer.id, DEFAULT_CONFIGURATION, kit.deps)
    expect(preview.block?.kind).toBe("not_verified")
    expect(preview.block && "href" in preview.block && preview.block.href).toBe("/onboarding")

    await expect(
      createOrderDraft(sessionFor(customer), DEFAULT_CONFIGURATION, kit.deps),
    ).rejects.toBeInstanceOf(DomainError)
  })

  it("blocks a second server before the first real payment", async () => {
    const customer = spanishCompany({ firstPaidAt: null })
    const kit = harness({
      customers: [customer],
      paymentMethods: [card()],
      services: [
        {
          id: "svc_existing",
          customerId: customer.id,
          status: "active",
          displayName: "el primero",
          term: "P1M",
          monthlyPrice: 898,
          nextDueAt: null,
          whmcsServiceId: 1,
        },
      ],
    })

    const preview = await previewCheckout(customer.id, DEFAULT_CONFIGURATION, kit.deps)
    expect(preview.block?.kind).toBe("trial_limit")
    expect(preview.block?.message).toContain("solo puedes tener 1 servidor")
  })

  it("blocks a plan above the entry one before the first real payment", async () => {
    const customer = spanishCompany({ firstPaidAt: null })
    const kit = harness({ customers: [customer], paymentMethods: [card()] })

    const preview = await previewCheckout(
      customer.id,
      { ...DEFAULT_CONFIGURATION, plan: "l" },
      kit.deps,
    )
    expect(preview.block?.kind).toBe("trial_limit")
    expect(preview.block?.message).toContain("plan de entrada")
  })

  it("lets a paying customer buy the big plan", async () => {
    const customer = spanishCompany()
    const kit = harness({ customers: [customer], paymentMethods: [card()] })

    const preview = await previewCheckout(
      customer.id,
      { ...DEFAULT_CONFIGURATION, plan: "xl" },
      kit.deps,
    )
    expect(preview.block).toBeNull()
  })
})

describe("the paid order hands over to provisioning", () => {
  it("emits ola/order.paid with the PaymentIntent and sends order-received", async () => {
    const customer = spanishCompany({ firstPaidAt: null })
    const kit = harness({ customers: [customer], paymentMethods: [card()] })

    const order = await createOrderDraft(sessionFor(customer), DEFAULT_CONFIGURATION, kit.deps)
    await payOrder(order.id, kit.deps)

    const paid = kit.events.emitted.find((event) => event.name === "ola/order.paid")
    expect(paid).toBeDefined()
    expect(paid?.data).toMatchObject({ orderId: order.id })
    expect(kit.notifier.sent.map((mail) => mail.template)).toContain("order-received")

    // Real money: the trial limits are lifted.
    expect(kit.store.customers.get(customer.id)?.firstPaidAt).toEqual(NOW)
    expect(kit.store.orders.get(order.id)?.status).toBe("paid")
  })

  it("names a credit-covered order's transaction `credit:<orderId>`", async () => {
    const customer = spanishCompany()
    const kit = harness({
      customers: [customer],
      paymentMethods: [card()],
      credits: [creditOf(5000)],
    })

    const order = await createOrderDraft(sessionFor(customer), DEFAULT_CONFIGURATION, kit.deps)
    await payOrder(order.id, kit.deps)

    const paid = kit.events.emitted.find((event) => event.name === "ola/order.paid")
    expect(paid?.data).toMatchObject({ stripePaymentIntentId: `credit:${order.id}` })
  })
})

describe("refunds", () => {
  it("refunds the full charge once and leaves the order failed", async () => {
    const customer = spanishCompany()
    const kit = harness({ customers: [customer], paymentMethods: [card()] })

    const order = await createOrderDraft(sessionFor(customer), DEFAULT_CONFIGURATION, kit.deps)
    await payOrder(order.id, kit.deps)

    const result = await refundOrder(order.id, "provisioning_failed", kit.deps)
    expect(result.status).toBe("refunded")
    expect(result.refunded).toBe(1087)
    expect(kit.store.orders.get(order.id)?.status).toBe("failed")
    expect(kit.store.payments.at(-1)?.refundedAmount).toBe(1087)
    expect(kit.notifier.sent.map((mail) => mail.template)).toContain("order-failed")

    // A retried job must not refund twice.
    const again = await refundOrder(order.id, "provisioning_failed", kit.deps)
    expect(again.status).toBe("nothing_to_refund")
  })

  it("has nothing to refund on a credit-covered order", async () => {
    const customer = spanishCompany()
    const kit = harness({
      customers: [customer],
      paymentMethods: [card()],
      credits: [creditOf(5000)],
    })

    const order = await createOrderDraft(sessionFor(customer), DEFAULT_CONFIGURATION, kit.deps)
    await payOrder(order.id, kit.deps)

    const result = await refundOrder(order.id, "provisioning_failed", kit.deps)
    expect(result.status).toBe("nothing_to_refund")
    expect(result.refunded).toBe(0)
  })
})
