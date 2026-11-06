import { describe, expect, it } from "vitest"
import {
  actionStatusFromOvhTask,
  allowedActions,
  applyVat,
  assertOrderTransition,
  assertServiceTransition,
  availableCredit,
  canReactivate,
  canTransitionOrder,
  canTransitionService,
  checkTrialLimits,
  customerMessageFor,
  daysBetween,
  decideWelcomeCredit,
  deliveryState,
  DomainError,
  dunningSchedule,
  expiringSoon,
  isAccountVerified,
  isActionAllowed,
  isOvhTaskTerminal,
  isProvisionComplete,
  isTerminalOrderStatus,
  nextDueDate,
  nextProvisionStep,
  OrderTransitionError,
  pendingStep,
  prorateAddon,
  prorateUpgrade,
  ServiceTransitionError,
  vatTreatment,
  WELCOME_CREDIT_CENTS,
} from "../src/index.js"

const DAY = 24 * 60 * 60 * 1000

describe("order state machine", () => {
  it("walks the happy path", () => {
    expect(canTransitionOrder("draft", "pending_payment")).toBe(true)
    expect(canTransitionOrder("pending_payment", "paid")).toBe(true)
    expect(canTransitionOrder("paid", "provisioning")).toBe(true)
    expect(canTransitionOrder("provisioning", "delivered")).toBe(true)
  })

  it("refuses to skip payment", () => {
    expect(canTransitionOrder("draft", "paid")).toBe(false)
    expect(() => assertOrderTransition("draft", "provisioning")).toThrow(OrderTransitionError)
  })

  it("treats delivered, failed and cancelled as terminal", () => {
    expect(isTerminalOrderStatus("delivered")).toBe(true)
    // An admin retry resumes a failed order, so it is not terminal.
    expect(isTerminalOrderStatus("failed")).toBe(false)
    expect(isTerminalOrderStatus("cancelled")).toBe(true)
    expect(isTerminalOrderStatus("paid")).toBe(false)
  })

  it("allows a delayed order to recover", () => {
    expect(canTransitionOrder("provisioning", "delayed")).toBe(true)
    expect(canTransitionOrder("delayed", "delivered")).toBe(true)
  })
})

describe("provisioning steps", () => {
  it("resumes at the first unfinished step", () => {
    expect(nextProvisionStep([])).toBe("whmcs_client")
    expect(nextProvisionStep(["whmcs_client", "whmcs_order"])).toBe("whmcs_invoice")
  })

  it("knows when nothing is left", () => {
    const all = [
      "whmcs_client", "whmcs_order", "whmcs_invoice", "whmcs_payment",
      "ovh_cart", "ovh_configure", "ovh_price_check", "ovh_checkout",
      "ovh_delivery", "ovh_first_boot", "service_active",
    ] as const
    expect(isProvisionComplete(all)).toBe(true)
    expect(nextProvisionStep(all)).toBeNull()
  })
})

describe("delivery SLA", () => {
  const paidAt = new Date("2026-11-05T10:00:00Z")
  it("flags late and timed-out deliveries", () => {
    expect(deliveryState(paidAt, new Date("2026-11-05T11:00:00Z"))).toBe("on_time")
    expect(deliveryState(paidAt, new Date("2026-11-05T13:00:00Z"))).toBe("late")
    expect(deliveryState(paidAt, new Date("2026-11-06T11:00:00Z"))).toBe("timed_out")
  })
})

describe("service state machine", () => {
  it("allows the power cycle", () => {
    expect(canTransitionService("active", "stopped")).toBe(true)
    expect(canTransitionService("stopped", "active")).toBe(true)
  })

  it("allows suspension and reactivation", () => {
    expect(canTransitionService("active", "suspended")).toBe(true)
    expect(canTransitionService("suspended", "active")).toBe(true)
  })

  it("refuses to resurrect a terminated service", () => {
    expect(canTransitionService("terminated", "active")).toBe(false)
    expect(() => assertServiceTransition("terminated", "active")).toThrow(ServiceTransitionError)
  })

  it("gives a suspended server no actions at all", () => {
    expect(allowedActions("suspended")).toEqual([])
    expect(isActionAllowed("suspended", "start")).toBe(false)
    expect(isActionAllowed("active", "reboot")).toBe(true)
  })

  it("lets a stopped server be started or reinstalled but not rebooted", () => {
    expect(isActionAllowed("stopped", "start")).toBe(true)
    expect(isActionAllowed("stopped", "reinstall")).toBe(true)
    expect(isActionAllowed("stopped", "reboot")).toBe(false)
  })
})

describe("OVH task mapping", () => {
  it("maps every documented state", () => {
    expect(actionStatusFromOvhTask("done")).toBe("done")
    expect(actionStatusFromOvhTask("error")).toBe("error")
    expect(actionStatusFromOvhTask("cancelled")).toBe("error")
    expect(actionStatusFromOvhTask("doing")).toBe("running")
    expect(actionStatusFromOvhTask("waitingAck")).toBe("running")
    expect(actionStatusFromOvhTask("todo")).toBe("queued")
    expect(actionStatusFromOvhTask("paused")).toBe("queued")
    expect(actionStatusFromOvhTask("blocked")).toBe("queued")
  })

  it("knows which states are terminal", () => {
    expect(isOvhTaskTerminal("done")).toBe(true)
    expect(isOvhTaskTerminal("error")).toBe(true)
    expect(isOvhTaskTerminal("doing")).toBe(false)
  })
})

describe("VAT", () => {
  it("charges 21 % in Spain", () => {
    expect(vatTreatment({ country: "ES", kind: "company", hasValidEuVatNumber: true }).rate).toBe(0.21)
  })

  it("reverse-charges an EU company with a validated VAT number", () => {
    const treatment = vatTreatment({ country: "DE", kind: "company", hasValidEuVatNumber: true })
    expect(treatment.kind).toBe("reverse_charge")
    expect(treatment.rate).toBe(0)
  })

  it("still charges an EU company whose VAT number is not validated", () => {
    expect(vatTreatment({ country: "DE", kind: "company", hasValidEuVatNumber: false }).rate).toBe(0.21)
  })

  it("charges EU consumers and exempts the rest of the world", () => {
    expect(vatTreatment({ country: "FR", kind: "individual", hasValidEuVatNumber: false }).rate).toBe(0.21)
    expect(vatTreatment({ country: "US", kind: "company", hasValidEuVatNumber: false }).kind).toBe("exempt")
  })

  it("adds tax on top of a net amount", () => {
    const taxed = applyVat(1000, { country: "ES", kind: "individual", hasValidEuVatNumber: false })
    expect(taxed).toMatchObject({ net: 1000, tax: 210, gross: 1210 })
  })
})

describe("proration", () => {
  const cycleStart = new Date("2026-11-01T00:00:00Z")
  const cycleEnd = new Date("2026-12-01T00:00:00Z")

  it("charges the difference for the days left", () => {
    const result = prorateUpgrade({
      currentMonthlyPrice: 799,
      targetMonthlyPrice: 1499,
      cycleStart,
      cycleEnd,
      now: new Date("2026-11-16T00:00:00Z"),
    })
    expect(result.cycleDays).toBe(30)
    expect(result.remainingDays).toBe(15)
    expect(result.unusedCredit).toBe(400)
    expect(result.remainingCharge).toBe(750)
    expect(result.amountDue).toBe(350)
  })

  it("never refunds on a cheaper target", () => {
    const result = prorateUpgrade({
      currentMonthlyPrice: 1499,
      targetMonthlyPrice: 799,
      cycleStart,
      cycleEnd,
      now: new Date("2026-11-16T00:00:00Z"),
    })
    expect(result.amountDue).toBe(0)
  })

  it("charges nothing once the cycle is over", () => {
    const result = prorateUpgrade({
      currentMonthlyPrice: 799,
      targetMonthlyPrice: 1499,
      cycleStart,
      cycleEnd,
      now: new Date("2026-12-15T00:00:00Z"),
    })
    expect(result.remainingDays).toBe(0)
    expect(result.amountDue).toBe(0)
  })

  it("prices an addon added mid-cycle", () => {
    const result = prorateAddon(99, cycleStart, cycleEnd, new Date("2026-11-16T00:00:00Z"))
    expect(result.amountDue).toBe(50)
  })

  it("rejects an inverted cycle", () => {
    expect(() =>
      prorateUpgrade({
        currentMonthlyPrice: 1,
        targetMonthlyPrice: 2,
        cycleStart: cycleEnd,
        cycleEnd: cycleStart,
        now: cycleStart,
      }),
    ).toThrow()
  })

  it("counts whole days and never goes negative", () => {
    expect(daysBetween(new Date("2026-11-01"), new Date("2026-11-04"))).toBe(3)
    expect(daysBetween(new Date("2026-11-04"), new Date("2026-11-01"))).toBe(0)
  })
})

describe("welcome credit", () => {
  const verified = {
    emailVerifiedAt: new Date("2026-11-01"),
    phoneVerifiedAt: new Date("2026-11-01"),
    hasVerifiedCard: true,
    billingComplete: true,
  }
  const signals = {
    cardFingerprint: "card_1",
    phoneNumber: "+34600000000",
    deviceFingerprint: "dev_1",
    ipAddress: "1.2.3.4",
  }
  const now = new Date("2026-11-05T00:00:00Z")

  it("grants once to a fully verified account", () => {
    const decision = decideWelcomeCredit({
      verification: verified,
      signals,
      priorGrantsForCustomer: 0,
      priorGrants: [],
      now,
    })
    expect(decision).toMatchObject({ granted: true, amount: WELCOME_CREDIT_CENTS })
    if (decision.granted) {
      expect(decision.expiresAt.getTime()).toBe(now.getTime() + 30 * DAY)
    }
  })

  it("refuses an unverified account", () => {
    const decision = decideWelcomeCredit({
      verification: { ...verified, hasVerifiedCard: false },
      signals,
      priorGrantsForCustomer: 0,
      priorGrants: [],
      now,
    })
    expect(decision).toEqual({ granted: false, reason: "not_verified" })
  })

  it("refuses a second grant to the same customer", () => {
    const decision = decideWelcomeCredit({
      verification: verified,
      signals,
      priorGrantsForCustomer: 1,
      priorGrants: [],
      now,
    })
    expect(decision).toEqual({ granted: false, reason: "already_granted" })
  })

  it("refuses when any fraud signal was already used", () => {
    for (const key of ["cardFingerprint", "phoneNumber", "deviceFingerprint", "ipAddress"] as const) {
      const decision = decideWelcomeCredit({
        verification: verified,
        signals,
        priorGrantsForCustomer: 0,
        priorGrants: [
          {
            grantedAt: new Date("2026-10-20"),
            signals: {
              cardFingerprint: null,
              phoneNumber: null,
              deviceFingerprint: null,
              ipAddress: null,
              [key]: signals[key],
            },
          },
        ],
        now,
      })
      expect(decision, key).toEqual({ granted: false, reason: "duplicate_signal" })
    }
  })

  it("ignores signals older than the look-back window", () => {
    const decision = decideWelcomeCredit({
      verification: verified,
      signals,
      priorGrantsForCustomer: 0,
      priorGrants: [{ grantedAt: new Date("2026-01-01"), signals }],
      now,
    })
    expect(decision.granted).toBe(true)
  })

  it("does not match two nulls as the same person", () => {
    const empty = { cardFingerprint: null, phoneNumber: null, deviceFingerprint: null, ipAddress: null }
    const decision = decideWelcomeCredit({
      verification: verified,
      signals: empty,
      priorGrantsForCustomer: 0,
      priorGrants: [{ grantedAt: new Date("2026-11-01"), signals: empty }],
      now,
    })
    expect(decision.granted).toBe(true)
  })
})

describe("credit ledger", () => {
  const now = new Date("2026-11-05T00:00:00Z")

  it("ignores expired and consumed credit", () => {
    const total = availableCredit(
      [
        { amount: 1000, reason: "welcome", expiresAt: new Date("2026-11-20"), consumed: 300 },
        { amount: 500, reason: "manual", expiresAt: new Date("2026-10-01"), consumed: 0 },
        { amount: 200, reason: "refund", expiresAt: null, consumed: 200 },
      ],
      now,
    )
    expect(total).toBe(700)
  })

  it("lists credit about to expire", () => {
    const soon = expiringSoon(
      [
        { amount: 1000, reason: "welcome", expiresAt: new Date("2026-11-08"), consumed: 0 },
        { amount: 1000, reason: "welcome", expiresAt: new Date("2026-12-20"), consumed: 0 },
      ],
      now,
    )
    expect(soon).toHaveLength(1)
  })

  it("knows a verified account", () => {
    expect(isAccountVerified({
      emailVerifiedAt: now, phoneVerifiedAt: now, hasVerifiedCard: true, billingComplete: true,
    })).toBe(true)
    expect(isAccountVerified({
      emailVerifiedAt: null, phoneVerifiedAt: now, hasVerifiedCard: true, billingComplete: true,
    })).toBe(false)
  })
})

describe("trial limits", () => {
  it("lets a paying customer do anything", () => {
    expect(checkTrialLimits({
      hasPaidRealMoney: true, currentServiceCount: 9,
      planCode: "vps-2027-model4", addonFamilies: ["additionalDisk"],
    })).toEqual({ allowed: true })
  })

  it("caps an unpaid account at one entry-level server without extra disk", () => {
    expect(checkTrialLimits({
      hasPaidRealMoney: false, currentServiceCount: 1,
      planCode: "vps-2027-model1", addonFamilies: [],
    }).allowed).toBe(false)

    expect(checkTrialLimits({
      hasPaidRealMoney: false, currentServiceCount: 0,
      planCode: "vps-2027-model3", addonFamilies: [],
    }).allowed).toBe(false)

    expect(checkTrialLimits({
      hasPaidRealMoney: false, currentServiceCount: 0,
      planCode: "vps-2027-model1", addonFamilies: ["additionalDisk"],
    }).allowed).toBe(false)

    expect(checkTrialLimits({
      hasPaidRealMoney: false, currentServiceCount: 0,
      planCode: "vps-2027-model1", addonFamilies: ["snapshot"],
    })).toEqual({ allowed: true })
  })
})

describe("dunning", () => {
  const dueAt = new Date("2026-12-01T00:00:00Z")

  it("issues the invoice seven days early", () => {
    const [first] = dunningSchedule(dueAt)
    expect(first?.stage).toBe("invoiced")
    expect(first?.at.toISOString()).toBe("2026-11-24T00:00:00.000Z")
  })

  it("suspends on T+3 and terminates on T+10", () => {
    const schedule = dunningSchedule(dueAt)
    const suspend = schedule.find((s) => s.stage === "suspended")
    const terminate = schedule.find((s) => s.stage === "terminating")
    expect(suspend?.at.toISOString()).toBe("2026-12-04T00:00:00.000Z")
    expect(terminate?.at.toISOString()).toBe("2026-12-11T00:00:00.000Z")
  })

  it("returns the step that is due and not yet done", () => {
    expect(pendingStep(dueAt, new Date("2026-11-20"), [])).toBeNull()
    expect(pendingStep(dueAt, new Date("2026-11-25"), [])?.stage).toBe("invoiced")
    expect(pendingStep(dueAt, new Date("2026-12-02"), ["invoiced"])?.stage).toBe("charging")
    expect(pendingStep(dueAt, new Date("2026-12-05"), ["invoiced", "charging", "retry_1", "retry_2"])?.stage)
      .toBe("suspended")
  })

  it("reminds the payment at T-3 and warns of the deletion at T+7", () => {
    const schedule = dunningSchedule(dueAt)
    expect(schedule.find((s) => s.stage === "reminded")?.at.toISOString()).toBe(
      "2026-11-28T00:00:00.000Z",
    )
    expect(schedule.find((s) => s.stage === "deletion_warned")?.at.toISOString()).toBe(
      "2026-12-08T00:00:00.000Z",
    )
    expect(pendingStep(dueAt, new Date("2026-11-29"), ["invoiced"])?.stage).toBe("reminded")
    expect(
      pendingStep(dueAt, new Date("2026-12-09"), [
        "invoiced",
        "reminded",
        "charging",
        "retry_1",
        "retry_2",
        "suspended",
      ])?.stage,
    ).toBe("deletion_warned")
  })

  it("skips a notice once the next step is due, instead of sending it late", () => {
    // The cycle started late: at T-0 the reminder is stale and the charge goes first.
    expect(pendingStep(dueAt, new Date("2026-12-01T01:00:00Z"), ["invoiced"])?.stage).toBe(
      "charging",
    )
    expect(
      pendingStep(dueAt, new Date("2026-12-11T01:00:00Z"), [
        "invoiced",
        "charging",
        "retry_1",
        "retry_2",
        "suspended",
      ])?.stage,
    ).toBe("terminating")
  })

  it("advances the due date by the term", () => {
    expect(nextDueDate(dueAt, 1).toISOString()).toBe("2027-01-01T00:00:00.000Z")
    expect(nextDueDate(dueAt, 12).toISOString()).toBe("2027-12-01T00:00:00.000Z")
  })

  it("can save a suspended service but not a terminating one", () => {
    expect(canReactivate("suspended")).toBe(true)
    expect(canReactivate("terminating")).toBe(false)
  })
})

describe("domain errors", () => {
  it("keeps the technical detail out of the customer message", () => {
    const error = new DomainError("price_mismatch", { detail: "OVH says 4.99, we expected 4.49" })
    expect(error.customerMessage).toMatch(/precio ha cambiado/)
    expect(error.customerMessage).not.toMatch(/OVH/)
    expect(error.toJSON()).toEqual({
      code: "price_mismatch",
      message: error.customerMessage,
      retryable: false,
    })
  })

  it("falls back to a generic message for unknown errors", () => {
    expect(customerMessageFor(new Error("boom"))).toMatch(/Algo ha ido mal/)
  })
})
