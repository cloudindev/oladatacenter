import { describe, expect, it } from "vitest"
import { cardExpiresSoon, invoiceTotals, parsePeriod, periodRange, renewalState } from "./model"

const NOW = new Date("2026-11-07T10:00:00Z")
const DUE = new Date("2026-12-01T00:00:00Z")

describe("renewalState", () => {
  const base = { status: "active", autoRenew: true, dunningStage: "scheduled", nextDueAt: DUE }

  it("reads an active, auto-renewing service as fine", () => {
    expect(renewalState(base)).toMatchObject({ label: "Renovación automática", tone: "ok", date: DUE })
  })

  it("flags an overdue charge and a cancelled renewal", () => {
    expect(renewalState({ ...base, dunningStage: "retry_1" }).tone).toBe("danger")
    expect(renewalState({ ...base, autoRenew: false })).toMatchObject({
      label: "Renovación cancelada",
      tone: "warn",
    })
  })

  it("lets the service status win over the renewal settings", () => {
    expect(renewalState({ ...base, status: "suspended" }).label).toBe("Suspendido por impago")
    expect(renewalState({ ...base, status: "terminated" })).toMatchObject({ label: "Dado de baja", date: null })
  })
})

describe("invoice totals", () => {
  const invoices = [
    { issuedAt: new Date("2026-10-03T09:00:00Z"), status: "paid" as const, total: 1087 },
    { issuedAt: new Date("2026-10-20T09:00:00Z"), status: "unpaid" as const, total: 2659 },
    { issuedAt: new Date("2026-10-21T09:00:00Z"), status: "cancelled" as const, total: 9999 },
    { issuedAt: new Date("2026-11-02T09:00:00Z"), status: "paid" as const, total: 500 },
    { issuedAt: new Date("2025-10-02T09:00:00Z"), status: "paid" as const, total: 700 },
  ]

  it("sums last month without cancelled invoices and reports what is unpaid", () => {
    expect(invoiceTotals(invoices, "mes-pasado", NOW)).toEqual({ total: 3746, count: 2, unpaid: 2659 })
  })

  it("covers this month and the last twelve months", () => {
    expect(invoiceTotals(invoices, "mes", NOW).total).toBe(500)
    expect(invoiceTotals(invoices, "12-meses", NOW).total).toBe(4246)
  })

  it("crosses the year boundary", () => {
    const january = new Date("2027-01-15T00:00:00Z")
    expect(periodRange("mes-pasado", january).from.toISOString()).toBe("2026-12-01T00:00:00.000Z")
  })

  it("defaults to last month for an unknown period", () => {
    expect(parsePeriod("whatever")).toBe("mes-pasado")
    expect(parsePeriod("12-meses")).toBe("12-meses")
  })
})

describe("cardExpiresSoon", () => {
  it("warns within the window and not before", () => {
    expect(cardExpiresSoon({ expMonth: 11, expYear: 2026 }, NOW)).toBe(true)
    expect(cardExpiresSoon({ expMonth: 12, expYear: 2027 }, NOW)).toBe(false)
    expect(cardExpiresSoon({ expMonth: null, expYear: null }, NOW)).toBe(false)
  })
})
