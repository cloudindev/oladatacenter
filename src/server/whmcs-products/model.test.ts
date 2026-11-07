import { describe, expect, it } from "vitest"
import {
  addMonthsUtc,
  byRelevance,
  cycleMonths,
  cyclesDue,
  overdueLine,
  cycleLabel,
  domainStatusUi,
  invoiceStatusUi,
  kindOfProduct,
  pendingBalance,
  parseWhmcsDate,
  productStatusUi,
  perYearsLabel,
  stillVisible,
  withGracePeriod,
} from "./model"

describe("WHMCS product classification", () => {
  it("knows the operator's product ids", () => {
    for (const pid of [1, 2, 3, 284, 4, 125, 8, 9, 10]) expect(kindOfProduct(pid)).toBe("web_hosting")
    for (const pid of [85, 14, 15, 5, 41, 42, 63]) expect(kindOfProduct(pid)).toBe("vps")
    expect(kindOfProduct(88)).toBe("plesk_licence")
    expect(kindOfProduct(64)).toBe("ip")
  })

  it("ignores everything else (web design, SEO, snapshots…)", () => {
    for (const pid of [32, 34, 40, 86, 87, 121]) expect(kindOfProduct(pid)).toBeNull()
  })
})

describe("WHMCS labels", () => {
  it("tells live services from finished ones", () => {
    expect(productStatusUi("Active")).toMatchObject({ label: "Activo", live: true })
    expect(productStatusUi("Terminated")).toMatchObject({ label: "Dado de baja", live: false })
    expect(domainStatusUi("Grace").live).toBe(true)
    expect(domainStatusUi("Transferred Away").live).toBe(false)
  })

  it("translates billing cycles and reads WHMCS dates", () => {
    expect(cycleLabel("Annually")).toBe("/año")
    expect(cycleLabel("Monthly")).toBe("/mes")
    expect(cycleLabel("One Time")).toBe("pago único")
    expect(parseWhmcsDate("2026-02-06")?.toISOString()).toBe("2026-02-06T00:00:00.000Z")
    expect(parseWhmcsDate(null)).toBeNull()
  })

  it("orders live first, then by the soonest due date", () => {
    const at = (iso: string | null) => (iso ? new Date(iso) : null)
    const items = [
      { id: "old", live: false, nextDueAt: at("2026-01-01"), registeredAt: null },
      { id: "late", live: true, nextDueAt: at("2027-01-01"), registeredAt: null },
      { id: "soon", live: true, nextDueAt: at("2026-12-01"), registeredAt: null },
    ]
    expect([...items].sort(byRelevance).map((item) => item.id)).toEqual(["soon", "late", "old"])
  })
})

describe("inactive items fade out after a month", () => {
  const now = new Date("2026-11-08T12:00:00Z")
  const ended = (iso: string | null) => ({ live: false, end: iso ? new Date(iso) : null })

  it("always keeps live items", () => {
    expect(stillVisible({ live: true, end: new Date("2020-01-01") }, now)).toBe(true)
  })

  it("keeps an inactive item for a month after it ended, then drops it", () => {
    expect(stillVisible(ended("2026-10-20"), now)).toBe(true)
    expect(stillVisible(ended("2026-10-01"), now)).toBe(false)
    expect(stillVisible(ended("2025-04-03"), now)).toBe(false)
  })

  it("drops an inactive item with no date at all", () => {
    expect(stillVisible(ended(null), now)).toBe(false)
  })
})

describe("grace period", () => {
  const now = new Date("2026-11-08T12:00:00Z")
  const active = productStatusUi("Active")

  it("marks an active service whose due date has passed", () => {
    expect(withGracePeriod(active, "Active", new Date("2026-06-30"), now)).toMatchObject({
      label: "Periodo de gracia",
      tone: "warn",
      live: true,
    })
  })

  it("leaves services due today or later, and other statuses, alone", () => {
    expect(withGracePeriod(active, "Active", new Date("2026-11-08"), now).label).toBe("Activo")
    expect(withGracePeriod(active, "Active", null, now).label).toBe("Activo")
    const suspended = productStatusUi("Suspended")
    expect(withGracePeriod(suspended, "Suspended", new Date("2026-01-01"), now).label).toBe("Suspendido")
  })

  it("prints the renewal period", () => {
    expect(perYearsLabel(1)).toBe("año")
    expect(perYearsLabel(null)).toBe("año")
    expect(perYearsLabel(2)).toBe("2 años")
  })
})

describe("invoices", () => {
  const now = new Date("2026-11-08T12:00:00Z")

  it("labels WHMCS invoices and tells overdue from pending", () => {
    expect(invoiceStatusUi("Paid", null, now)).toMatchObject({ label: "Pagada", owed: false })
    expect(invoiceStatusUi("Unpaid", new Date("2026-11-20"), now)).toMatchObject({ label: "Pendiente", owed: true })
    expect(invoiceStatusUi("Unpaid", new Date("2026-10-01"), now)).toMatchObject({ label: "Vencida", tone: "danger" })
    expect(invoiceStatusUi("Cancelled", null, now).owed).toBe(false)
  })

  it("sums what is owed up to today, not invoices issued ahead", () => {
    const invoices = [
      { owed: true, issuedAt: new Date("2026-01-18"), balanceCents: 12_190 },
      { owed: true, issuedAt: new Date("2026-02-06"), balanceCents: 12_190 },
      { owed: false, issuedAt: new Date("2026-03-01"), balanceCents: 0 },
      { owed: true, issuedAt: new Date("2026-12-01"), balanceCents: 5_000 },
    ]
    expect(pendingBalance(invoices, now)).toEqual({ cents: 24_380, count: 2 })
  })
})

describe("periods owed to be up to date", () => {
  const now = new Date("2026-11-08T12:00:00Z")

  it("counts every renewal date reached, monthly and yearly", () => {
    expect(cyclesDue(new Date("2026-01-18"), 1, now)).toBe(10) // 18 Jan … 18 Oct
    expect(cyclesDue(new Date("2026-06-30"), 12, now)).toBe(1)
    expect(cyclesDue(new Date("2026-12-01"), 1, now)).toBe(0)
  })

  it("keeps month ends sane", () => {
    expect(addMonthsUtc(new Date("2026-01-31"), 1).toISOString()).toBe("2026-02-28T00:00:00.000Z")
  })

  it("leaves the first period to the unpaid invoice and counts the rest", () => {
    const line = overdueLine({
      name: "VPS KVM Starter Int.",
      dueAt: new Date("2026-01-18"),
      months: cycleMonths("Monthly"),
      amountCents: 7_200,
      now,
    })
    expect(line).toMatchObject({ periods: 10, uninvoicedPeriods: 9, amountCents: 7_200 })
  })

  it("ignores one-off products and services not yet due", () => {
    expect(cycleMonths("One Time")).toBeNull()
    expect(overdueLine({ name: "x", dueAt: new Date("2027-01-01"), months: 1, amountCents: 100, now })).toBeNull()
  })
})
