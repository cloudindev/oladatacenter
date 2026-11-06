import { describe, expect, it } from "vitest"
import rawCatalog from "./fixtures/ovh-catalog-vps-es.json" with { type: "json" }
import {
  buildQuote,
  catalogPriceToCents,
  ceilTo99,
  checkoutTotals,
  cheapestAddonOfFamily,
  formatCents,
  marginOf,
  monthlyCostForMode,
  parseCatalog,
  priceFromCost,
  resolvePrice,
  type ParsedCatalog,
} from "../src/index.js"

const catalog: ParsedCatalog = parseCatalog(rawCatalog)

function plan(code: string) {
  const found = catalog.plans.find((candidate) => candidate.planCode === code)
  if (!found) throw new Error(`fixture is missing ${code}`)
  return found
}

describe("catalogPriceToCents", () => {
  it("converts OVH 1e-8 EUR units to cents", () => {
    // Verified against the live catalog on 2026-11-05.
    expect(catalogPriceToCents(449_000_000)).toBe(449)
    expect(catalogPriceToCents(2_349_000_000)).toBe(2349)
    expect(catalogPriceToCents(0)).toBe(0)
  })
})

describe("ceilTo99", () => {
  it("rounds up to the next price ending in ,99", () => {
    expect(ceilTo99(785)).toBe(799)
    expect(ceilTo99(799)).toBe(799)
    expect(ceilTo99(800)).toBe(899)
    expect(ceilTo99(1)).toBe(99)
    expect(ceilTo99(99)).toBe(99)
    expect(ceilTo99(100)).toBe(199)
  })

  it("leaves zero and negatives at zero", () => {
    expect(ceilTo99(0)).toBe(0)
    expect(ceilTo99(-50)).toBe(0)
  })
})

describe("catalog parsing against the real OVH fixture", () => {
  it("finds the four MVP plans", () => {
    expect(catalog.plans.map((p) => p.planCode).sort()).toEqual([
      "vps-2027-model1",
      "vps-2027-model2",
      "vps-2027-model3",
      "vps-2027-model4",
    ])
  })

  it("reads the monthly cost of every plan exactly as published", () => {
    expect(plan("vps-2027-model1").monthlyCost.P1M).toBe(449)
    expect(plan("vps-2027-model2").monthlyCost.P1M).toBe(849)
    expect(plan("vps-2027-model3").monthlyCost.P1M).toBe(1224)
    expect(plan("vps-2027-model4").monthlyCost.P1M).toBe(2349)
  })

  it("reads the 12-month cost as a per-month figure", () => {
    expect(plan("vps-2027-model1").monthlyCost.P12M).toBe(381)
    expect(plan("vps-2027-model2").monthlyCost.P12M).toBe(721)
    expect(plan("vps-2027-model3").monthlyCost.P12M).toBe(1040)
    expect(plan("vps-2027-model4").monthlyCost.P12M).toBe(1996)
  })

  it("normalises addons whose upfront12 price covers the whole year", () => {
    // Plesk publishes upfront12 with interval=12 and price 107.88 EUR for the year.
    const plesk = catalog.addons.find((a) => a.planCode === "option-plesk-webadmin")
    expect(plesk).toBeDefined()
    expect(plesk?.monthlyCost.P1M).toBe(899)
    expect(plesk?.monthlyCost.P12M).toBe(899)
  })

  it("keeps per-month addons untouched", () => {
    const backup = catalog.addons.find((a) => a.planCode === "option-auto-backup-2027-1-model1")
    expect(backup?.monthlyCost.P1M).toBe(35)
    expect(backup?.monthlyCost.P12M).toBe(35)
  })

  it("exposes the datacenters and operating systems OVH offers", () => {
    expect(plan("vps-2027-model1").datacenters).toContain("GRA")
    expect(plan("vps-2027-model1").operatingSystems).toContain("Debian 13")
    // Windows only exists from model2 upwards.
    expect(plan("vps-2027-model1").operatingSystems.some((os) => os.startsWith("Windows"))).toBe(false)
    expect(plan("vps-2027-model2").operatingSystems.some((os) => os.startsWith("Windows"))).toBe(true)
  })

  it("rejects a catalog that lost one of our plans", () => {
    const broken = { ...rawCatalog, plans: rawCatalog.plans.filter((p) => p.planCode !== "vps-2027-model3") }
    expect(() => parseCatalog(broken)).toThrow(/missing expected plan codes/)
  })
})

describe("monthlyCostForMode", () => {
  it("returns null when the mode is not published", () => {
    expect(monthlyCostForMode([], "default")).toBeNull()
  })

  it("ignores installation and upgrade fees", () => {
    const monthly = monthlyCostForMode(
      [
        { mode: "default", interval: 0, price: 500_000_000, capacities: ["installation"] },
        { mode: "default", interval: 1, price: 449_000_000, capacities: ["renew"] },
      ],
      "default",
    )
    expect(monthly).toBe(449)
  })
})

describe("priceFromCost reproduces the published PVP table", () => {
  const MARGIN = 0.75

  it("matches every monthly price in the brief", () => {
    expect(priceFromCost(449, MARGIN)).toBe(799)
    expect(priceFromCost(849, MARGIN)).toBe(1499)
    expect(priceFromCost(1224, MARGIN)).toBe(2199)
    expect(priceFromCost(2349, MARGIN)).toBe(4199)
  })

  it("matches every 12-month price in the brief", () => {
    expect(priceFromCost(381, MARGIN)).toBe(699)
    expect(priceFromCost(721, MARGIN)).toBe(1299)
    expect(priceFromCost(1040, MARGIN)).toBe(1899)
    expect(priceFromCost(1996, MARGIN)).toBe(3499)
  })

  it("refuses a negative margin", () => {
    expect(() => priceFromCost(449, -0.1)).toThrow(RangeError)
  })
})

describe("resolvePrice", () => {
  it("prefers a manual price over the rule", () => {
    const resolved = resolvePrice(449, 0.75, 999)
    expect(resolved.price).toBe(999)
    expect(resolved.source).toBe("manual")
  })

  it("falls back to the margin rule", () => {
    const resolved = resolvePrice(449, 0.75, null)
    expect(resolved.price).toBe(799)
    expect(resolved.source).toBe("rule")
    expect(resolved.effectiveMargin).toBeCloseTo(0.7795, 3)
  })

  it("reports no margin against a zero cost", () => {
    expect(marginOf(0, 100)).toBeNull()
  })
})

describe("buildQuote", () => {
  const base = {
    planCode: "vps-2027-model1",
    term: "P1M" as const,
    datacenter: "GRA",
    operatingSystem: "Debian 13",
  }

  it("adds the mandatory families automatically", () => {
    const quote = buildQuote(catalog, base)
    const families = quote.lines.filter((l) => l.kind === "addon").map((l) => l.family).sort()
    expect(families).toEqual(["automatedBackup", "os", "storage"])
  })

  it("prices the plan at the published PVP and keeps free options free", () => {
    const quote = buildQuote(catalog, base)
    const planLine = quote.lines.find((l) => l.kind === "plan")
    expect(planLine?.monthlyPrice).toBe(799)

    const linux = quote.lines.find((l) => l.code === "option-linux")
    expect(linux?.monthlyCost).toBe(0)
    expect(linux?.monthlyPrice).toBe(0)
  })

  it("charges for the mandatory backup, which OVH does not include", () => {
    const quote = buildQuote(catalog, base)
    const backup = quote.lines.find((l) => l.family === "automatedBackup")
    expect(backup?.code).toBe("option-auto-backup-2027-1-model1")
    expect(backup?.monthlyCost).toBe(35)
    // 35 cents * 1.5 = 52.5 -> ceil to ,99 -> 99
    expect(backup?.monthlyPrice).toBe(99)
  })

  it("tracks the true cost above the bare plan cost", () => {
    const quote = buildQuote(catalog, base)
    expect(quote.monthlyTrueCost).toBe(449 + 35)
    expect(quote.monthlyPrice).toBe(799 + 99)
  })

  it("multiplies by the months of the term", () => {
    const quote = buildQuote(catalog, { ...base, term: "P12M" })
    expect(quote.months).toBe(12)
    expect(quote.cycleNet).toBe(quote.monthlyPrice * 12)
  })

  it("lets the customer upgrade the backup window", () => {
    const quote = buildQuote(catalog, {
      ...base,
      addonCodes: ["option-auto-backup-2027-7-model1"],
    })
    const backups = quote.lines.filter((l) => l.family === "automatedBackup")
    expect(backups).toHaveLength(1)
    expect(backups[0]?.monthlyCost).toBe(110)
  })

  it("adds optional addons on top", () => {
    const quote = buildQuote(catalog, {
      ...base,
      addonCodes: ["option-snapshot-2027-model1", "option-additional-disk-2027-50g"],
    })
    expect(quote.lines.some((l) => l.family === "snapshot")).toBe(true)
    expect(quote.lines.some((l) => l.family === "additionalDisk")).toBe(true)
  })

  it("rejects two addons of the same exclusive family", () => {
    expect(() =>
      buildQuote(catalog, {
        ...base,
        addonCodes: ["option-additional-disk-2027-50g", "option-additional-disk-2027-100g"],
      }),
    ).toThrow(/exclusive family/)
  })

  it("rejects an unknown plan, datacenter, OS or addon", () => {
    expect(() => buildQuote(catalog, { ...base, planCode: "nope" })).toThrow(/unknown plan/)
    expect(() => buildQuote(catalog, { ...base, datacenter: "MARS" })).toThrow(/not available/)
    expect(() => buildQuote(catalog, { ...base, operatingSystem: "TempleOS" })).toThrow(/not available/)
    expect(() => buildQuote(catalog, { ...base, addonCodes: ["option-nope"] })).toThrow(/unknown addon/)
  })

  it("rejects an addon that belongs to a different plan", () => {
    expect(() =>
      buildQuote(catalog, { ...base, addonCodes: ["option-snapshot-2027-model4"] }),
    ).toThrow(/not available for plan/)
  })

  it("honours admin overrides", () => {
    const quote = buildQuote(catalog, base, { manualPlanPrice: { P1M: 1000 } })
    expect(quote.lines.find((l) => l.kind === "plan")?.monthlyPrice).toBe(1000)
  })
})

describe("cheapestAddonOfFamily", () => {
  it("picks the 1-day backup over the 7-day one", () => {
    const cheapest = cheapestAddonOfFamily(catalog, plan("vps-2027-model1"), "automatedBackup", "P1M")
    expect(cheapest?.planCode).toBe("option-auto-backup-2027-1-model1")
  })

  it("returns null for a family the plan does not offer", () => {
    const stripped = { ...plan("vps-2027-model1"), addonCodesByFamily: {} }
    expect(cheapestAddonOfFamily(catalog, stripped, "snapshot", "P1M")).toBeNull()
  })
})

describe("checkoutTotals", () => {
  const quote = buildQuote(catalog, {
    planCode: "vps-2027-model1",
    term: "P1M",
    datacenter: "GRA",
    operatingSystem: "Debian 13",
  })
  const spanishCompany = { country: "ES", kind: "company" as const, hasValidEuVatNumber: true }

  it("applies credit before VAT", () => {
    const totals = checkoutTotals(quote, 1000, spanishCompany)
    expect(totals.subtotal).toBe(898)
    expect(totals.creditApplied).toBe(898) // capped at the subtotal
    expect(totals.taxableBase).toBe(0)
    expect(totals.total).toBe(0)
  })

  it("never produces a negative charge", () => {
    const totals = checkoutTotals(quote, 999_999, spanishCompany)
    expect(totals.total).toBe(0)
    expect(totals.creditApplied).toBeLessThanOrEqual(totals.subtotal)
  })

  it("charges 21 % VAT to a Spanish customer", () => {
    const totals = checkoutTotals(quote, 0, spanishCompany)
    expect(totals.taxableBase).toBe(898)
    expect(totals.tax).toBe(189)
    expect(totals.total).toBe(1087)
  })

  it("rejects negative credit", () => {
    expect(() => checkoutTotals(quote, -1, spanishCompany)).toThrow()
  })
})

describe("formatCents", () => {
  it("formats in Spanish", () => {
    expect(formatCents(799)).toBe("7,99 €")
    // Spanish typography groups from five digits up, not four.
    expect(formatCents(123456, { withSymbol: false })).toBe("1234,56")
    expect(formatCents(1234567, { withSymbol: false })).toBe("12.345,67")
  })
})
