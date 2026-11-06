import { describe, expect, it } from "vitest"

import { WELCOME_CREDIT_CENTS } from "@ola/core"

import { consumeCredit, creditSummary, customerCredit, grantWelcomeCredit } from "../credit"
import {
  confirmCardSetup,
  detachPaymentMethod,
  setDefaultPaymentMethod,
  startCardSetup,
} from "../payment-methods"
import { NOW, activeService, card, harness, spanishCompany } from "./harness"
import type { CreditRecord } from "../data"

const DAY = 24 * 60 * 60 * 1000

function credit(overrides: Partial<CreditRecord> = {}): CreditRecord {
  return {
    id: "cr_1",
    customerId: "cust_es",
    amount: 1000,
    consumed: 0,
    reason: "welcome",
    note: null,
    expiresAt: null,
    signals: null,
    createdAt: NOW,
    ...overrides,
  }
}

describe("customerCredit", () => {
  it("is the granted amount minus what was consumed", async () => {
    const kit = harness({
      customers: [spanishCompany()],
      credits: [credit({ amount: 1000, consumed: 250 })],
    })
    expect(await customerCredit("cust_es", kit.deps)).toBe(750)
  })

  it("ignores expired entries", async () => {
    const kit = harness({
      customers: [spanishCompany()],
      credits: [
        credit({ id: "cr_live", amount: 500, expiresAt: new Date(NOW.getTime() + 5 * DAY) }),
        credit({ id: "cr_dead", amount: 900, expiresAt: new Date(NOW.getTime() - DAY) }),
      ],
    })
    expect(await customerCredit("cust_es", kit.deps)).toBe(500)
  })

  it("is zero for a customer with nothing", async () => {
    const kit = harness({ customers: [spanishCompany()] })
    expect(await customerCredit("cust_es", kit.deps)).toBe(0)
  })
})

describe("creditSummary", () => {
  it("flags credit that expires within seven days", async () => {
    const expiresAt = new Date(NOW.getTime() + 3 * DAY)
    const kit = harness({
      customers: [spanishCompany()],
      credits: [credit({ amount: 1000, expiresAt })],
    })

    const summary = await creditSummary("cust_es", kit.deps)
    expect(summary.balance).toBe(1000)
    expect(summary.expiringSoon).toBe(true)
    expect(summary.expiringAmount).toBe(1000)
    expect(summary.expiringAt).toEqual(expiresAt)
  })

  it("does not flag credit that expires later", async () => {
    const kit = harness({
      customers: [spanishCompany()],
      credits: [credit({ amount: 1000, expiresAt: new Date(NOW.getTime() + 20 * DAY) })],
    })

    const summary = await creditSummary("cust_es", kit.deps)
    expect(summary.expiringSoon).toBe(false)
    expect(summary.expiringAmount).toBe(0)
  })
})

describe("consumeCredit", () => {
  it("spends the entry that expires first", async () => {
    const kit = harness({
      customers: [spanishCompany()],
      credits: [
        credit({ id: "cr_late", amount: 400, expiresAt: new Date(NOW.getTime() + 30 * DAY) }),
        credit({ id: "cr_soon", amount: 300, expiresAt: new Date(NOW.getTime() + 2 * DAY) }),
      ],
    })

    const taken = await consumeCredit("cust_es", 500, "ord_1", kit.deps)
    expect(taken).toBe(500)
    expect(kit.store.credits.find((c) => c.id === "cr_soon")?.consumed).toBe(300)
    expect(kit.store.credits.find((c) => c.id === "cr_late")?.consumed).toBe(200)
    expect(await customerCredit("cust_es", kit.deps)).toBe(200)
  })

  it("never hands out more than there is", async () => {
    const kit = harness({ customers: [spanishCompany()], credits: [credit({ amount: 300 })] })
    expect(await consumeCredit("cust_es", 1000, "ord_1", kit.deps)).toBe(300)
    expect(await customerCredit("cust_es", kit.deps)).toBe(0)
  })

  it("refuses a negative amount and does nothing for zero", async () => {
    const kit = harness({ customers: [spanishCompany()], credits: [credit()] })
    await expect(consumeCredit("cust_es", -1, "ord_1", kit.deps)).rejects.toThrow()
    expect(await consumeCredit("cust_es", 0, "ord_1", kit.deps)).toBe(0)
  })
})

describe("grantWelcomeCredit", () => {
  const signals = {
    cardFingerprint: "fp_visa",
    phoneNumber: "+34600000000",
    deviceFingerprint: "dev_1",
    ipAddress: "88.1.2.3",
  }

  it("grants it once to a fully verified account with a verified card", async () => {
    const kit = harness({ customers: [spanishCompany()], paymentMethods: [card()] })

    const result = await grantWelcomeCredit("cust_es", signals, kit.deps)
    expect(result.decision.granted).toBe(true)
    expect(result.credit?.amount).toBe(WELCOME_CREDIT_CENTS)
    expect(result.credit?.expiresAt).toEqual(new Date(NOW.getTime() + 30 * DAY))
    expect(await customerCredit("cust_es", kit.deps)).toBe(WELCOME_CREDIT_CENTS)
  })

  it("is idempotent: a second call grants nothing", async () => {
    const kit = harness({ customers: [spanishCompany()], paymentMethods: [card()] })

    await grantWelcomeCredit("cust_es", signals, kit.deps)
    const second = await grantWelcomeCredit("cust_es", signals, kit.deps)

    expect(second.decision.granted).toBe(false)
    expect(second.decision.granted === false && second.decision.reason).toBe("already_granted")
    expect(second.credit).toBeNull()
    expect(kit.store.credits).toHaveLength(1)
    expect(await customerCredit("cust_es", kit.deps)).toBe(WELCOME_CREDIT_CENTS)
  })

  it("refuses an account that has not verified its phone", async () => {
    const kit = harness({
      customers: [spanishCompany({ phoneVerifiedAt: null })],
      paymentMethods: [card()],
    })
    const result = await grantWelcomeCredit("cust_es", signals, kit.deps)
    expect(result.decision.granted === false && result.decision.reason).toBe("not_verified")
  })

  it("refuses an account with no verified card", async () => {
    const kit = harness({ customers: [spanishCompany()] })
    const result = await grantWelcomeCredit("cust_es", signals, kit.deps)
    expect(result.decision.granted === false && result.decision.reason).toBe("not_verified")
  })

  it("refuses a second person using the same card fingerprint", async () => {
    const first = spanishCompany()
    const second = spanishCompany({
      id: "cust_two",
      userId: "user_two",
      email: "otro@example.es",
      stripeCustomerId: "cus_two",
    })
    const kit = harness({
      customers: [first, second],
      paymentMethods: [card(), card({ id: "pm_row_2", customerId: "cust_two" })],
    })

    await grantWelcomeCredit("cust_es", signals, kit.deps)
    const result = await grantWelcomeCredit(
      "cust_two",
      { ...signals, phoneNumber: "+34611111111", deviceFingerprint: "dev_2", ipAddress: "9.9.9.9" },
      kit.deps,
    )

    expect(result.decision.granted === false && result.decision.reason).toBe("duplicate_signal")
  })
})

describe("cards on file", () => {
  it("creates a 3DS SetupIntent and reuses the Stripe customer", async () => {
    const kit = harness({ customers: [spanishCompany()] })

    const ticket = await startCardSetup("cust_es", kit.deps)
    expect(ticket.stripeCustomerId).toBe("cus_es")
    expect(ticket.clientSecret).toContain("_secret_")
    expect(kit.stripe.calls).toContainEqual({ method: "ensureCustomer", detail: "reused" })
  })

  it("stores the fingerprint and marks the first card default and verified", async () => {
    const kit = harness({ customers: [spanishCompany()] })

    const ticket = await startCardSetup("cust_es", kit.deps)
    kit.stripe.completeSetupIntent(ticket.setupIntentId, "pm_card_visa")
    const stored = await confirmCardSetup(ticket.setupIntentId, kit.deps)

    expect(stored.isDefault).toBe(true)
    expect(stored.verifiedAt).toEqual(NOW)
    expect(stored.fingerprint).toBeTruthy()
    expect(stored.last4).toBe("4242")

    // Calling it again (browser plus webhook) does not duplicate the row.
    const again = await confirmCardSetup(ticket.setupIntentId, kit.deps)
    expect(again.id).toBe(stored.id)
    expect(kit.store.paymentMethods).toHaveLength(1)
  })

  it("moves the default to the chosen card", async () => {
    const kit = harness({
      customers: [spanishCompany()],
      paymentMethods: [
        card(),
        card({ id: "pm_row_2", stripePaymentMethodId: "pm_card_two", isDefault: false }),
      ],
    })

    await setDefaultPaymentMethod("cust_es", "pm_row_2", kit.deps)
    const methods = await kit.store.listPaymentMethods("cust_es")
    expect(methods.find((m) => m.id === "pm_row_2")?.isDefault).toBe(true)
    expect(methods.find((m) => m.id === "pm_row_1")?.isDefault).toBe(false)
  })

  it("refuses to detach the only card while a server is active", async () => {
    const kit = harness({
      customers: [spanishCompany()],
      paymentMethods: [card()],
      services: [activeService()],
    })

    await expect(detachPaymentMethod("cust_es", "pm_row_1", kit.deps)).rejects.toThrow(
      /no está disponible|Esta acción/,
    )
    expect(kit.store.paymentMethods[0]?.detachedAt).toBeNull()
  })

  it("detaches the only card when there is no server", async () => {
    const kit = harness({ customers: [spanishCompany()], paymentMethods: [card()] })

    await detachPaymentMethod("cust_es", "pm_row_1", kit.deps)
    expect(kit.store.paymentMethods[0]?.detachedAt).toEqual(NOW)
    expect(kit.stripe.calls).toContainEqual({
      method: "detachPaymentMethod",
      detail: "pm_card_visa",
    })
  })

  it("promotes another card when the default is removed", async () => {
    const kit = harness({
      customers: [spanishCompany()],
      paymentMethods: [
        card(),
        card({ id: "pm_row_2", stripePaymentMethodId: "pm_card_two", isDefault: false }),
      ],
      services: [activeService()],
    })

    await detachPaymentMethod("cust_es", "pm_row_1", kit.deps)
    const remaining = await kit.store.listPaymentMethods("cust_es")
    expect(remaining).toHaveLength(1)
    expect(remaining[0]?.id).toBe("pm_row_2")
    expect(remaining[0]?.isDefault).toBe(true)
  })

  it("refuses to touch a card that belongs to somebody else", async () => {
    const kit = harness({ customers: [spanishCompany()], paymentMethods: [card()] })
    await expect(setDefaultPaymentMethod("cust_other", "pm_row_1", kit.deps)).rejects.toThrow()
  })
})
