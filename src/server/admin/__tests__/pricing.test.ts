import { describe, expect, it } from "vitest"
import { MANDATORY_FAMILIES, cheapestAddonOfFamily, formatCents, marginOf } from "@ola/core"
import { planBaselines } from "../baseline"
import { marginView, marginViewByTerm, previewPriceChange } from "../pricing"
import { marginFloorFrom, parseMarginFloor } from "../settings"
import { addonRow, planRow, testCatalog } from "./fakes"

/**
 * The bug this file exists to prevent: computing the margin over the bare plan cost.
 *
 * `docs/decisions.md` (2026-11-05): `automatedBackup` is mandatory and priced, so VPS-1
 * costs 4,84 € a month, not 4,49 €. At a PVP of 7,99 € the real margin is 65 %, not the
 * 78 % the bare cost suggests. The admin panel must show 65 %.
 */
describe("margin is computed from the TRUE cost", () => {
  /** VPS-1 exactly as the live ES catalog prices it: 4,49 € plan + 0,35 € backup. */
  const vps1 = {
    bareCost: 449,
    mandatory: { cost: 35, price: 99 },
    margin: 0.75,
    manualPrice: 799,
    floor: 0.3,
  }

  it("divides by plan + mandatory addons, not by the bare plan cost", () => {
    const view = marginView(vps1)

    expect(view.bareCost).toBe(449)
    expect(view.trueCost).toBe(484)
    expect(view.trueMargin).toBe(marginOf(484, 799))
  })

  it("reproduces the 65 % in docs/decisions.md and not the 78 %", () => {
    const view = marginView(vps1)

    expect(formatCents(view.trueCost)).toBe("4,84 €")
    expect(view.trueMargin).toBeCloseTo(0.6508, 4)
    expect(view.bareMargin).toBeCloseTo(0.7795, 4)
  })

  it("reports a materially lower margin than the bare-cost calculation", () => {
    const view = marginView(vps1)

    expect(view.trueMargin).not.toBeNull()
    expect(view.bareMargin).not.toBeNull()
    expect(view.trueMargin as number).toBeLessThan(view.bareMargin as number)
  })

  it("keeps the cart total and its margin separate from the headline margin", () => {
    const view = marginView(vps1)

    expect(view.linePrice).toBe(799)
    // `buildQuote` bills the 0,35 € backup at 0,99 €, so the baseline cart is 8,98 €.
    expect(view.totalPrice).toBe(898)
    expect(view.totalMargin).toBe(marginOf(484, 898))
    expect(view.totalMargin as number).toBeGreaterThan(view.trueMargin as number)
  })

  it("derives the floor warning from the conservative margin", () => {
    // 6,29 € is 30 % over the true cost of 4,84 € but 40 % over the bare 4,49 €: the
    // warning has to fire on the true-cost figure.
    const view = marginView({ ...vps1, manualPrice: 629, floor: 0.32 })

    expect(view.trueMargin as number).toBeLessThan(0.32)
    expect(view.bareMargin as number).toBeGreaterThan(0.32)
    expect(view.belowFloor).toBe(true)
  })

  it("takes the mandatory options from the pricing engine, not from a hard-coded list", () => {
    const catalog = testCatalog()
    const baselines = planBaselines(catalog, [planRow()], [addonRow()])
    const baseline = baselines.get("vps-2027-model1")

    expect(baseline).toBeDefined()
    expect(baseline?.error).toBeNull()
    expect(baseline?.bareCost.P1M).toBe(449)
    // `automatedBackup` is the only mandatory family with a non-zero cost.
    const backup = cheapestAddonOfFamily(
      catalog,
      catalog.plans.find((plan) => plan.planCode === "vps-2027-model1")!,
      "automatedBackup",
      "P1M",
    )
    expect(MANDATORY_FAMILIES).toContain("automatedBackup")
    expect(baseline?.mandatory.P1M.cost).toBe(backup?.monthlyCost.P1M)
    expect(baseline?.mandatory.P1M.cost).toBeGreaterThan(0)
  })

  it("never claims a margin when the true cost is zero", () => {
    const view = marginView({
      bareCost: 0,
      mandatory: { cost: 0, price: 0 },
      margin: 0.75,
      manualPrice: 0,
      floor: 0.3,
    })

    expect(view.trueMargin).toBeNull()
    expect(view.belowFloor).toBe(false)
  })
})

describe("the margin floor warns", () => {
  const base = {
    bareCost: { P1M: 449, P12M: 393 } as Record<"P1M" | "P12M", number>,
    mandatory: {
      P1M: { cost: 35, price: 53 },
      P12M: { cost: 35, price: 53 },
    },
    margin: 0.75,
    manualPrice: {},
    floor: 0.3,
  }

  it("flags a price change that drops the real margin below the floor", () => {
    const preview = previewPriceChange(base, { manualPrice: { P1M: 520 } })
    const monthly = preview.terms.find((row) => row.term === "P1M")

    expect(monthly?.before.belowFloor).toBe(false)
    expect(monthly?.after.belowFloor).toBe(true)
    expect(preview.warnsBelowFloor).toBe(true)
    expect(preview.belowFloorTerms).toEqual(["P1M"])
  })

  it("does not flag a change that stays above the floor", () => {
    const preview = previewPriceChange(base, { manualPrice: { P1M: 899 } })

    expect(preview.warnsBelowFloor).toBe(false)
    expect(preview.belowFloorTerms).toEqual([])
  })

  it("flags a margin cut that breaches the floor on both terms", () => {
    const preview = previewPriceChange(base, { margin: 0.05 })

    expect(preview.warnsBelowFloor).toBe(true)
    expect(preview.belowFloorTerms).toEqual(["P1M", "P12M"])
  })

  it("clearing a manual PVP falls back to the margin rule", () => {
    const withManual = { ...base, manualPrice: { P1M: 520 } }
    expect(marginViewByTerm(withManual).P1M.source).toBe("manual")

    const preview = previewPriceChange(withManual, { manualPrice: { P1M: null } })
    const monthly = preview.terms.find((row) => row.term === "P1M")

    expect(monthly?.before.source).toBe("manual")
    expect(monthly?.after.source).toBe("rule")
    expect(monthly?.after.linePrice).toBe(monthly?.after.rulePrice)
    expect(monthly?.after.belowFloor).toBe(false)
  })
})

describe("the floor is stored in featureFlags", () => {
  it("reads basis points out of the description", () => {
    expect(parseMarginFloor("3000")).toBe(3000)
    expect(parseMarginFloor(" 4500 ")).toBe(4500)
  })

  it("falls back to the default rather than accepting a floor of nothing", () => {
    expect(parseMarginFloor(null)).toBeNull()
    expect(parseMarginFloor("")).toBeNull()
    expect(parseMarginFloor("treinta por ciento")).toBeNull()
    expect(parseMarginFloor("999999")).toBeNull()

    const floor = marginFloorFrom(null)
    expect(floor.basisPoints).toBe(3000)
    expect(floor.configured).toBe(false)
  })

  it("keeps the stored value when there is one", () => {
    const floor = marginFloorFrom({
      key: "margin_floor",
      enabled: true,
      description: "4000",
      updatedAt: null,
    })

    expect(floor.basisPoints).toBe(4000)
    expect(floor.ratio).toBe(0.4)
    expect(floor.configured).toBe(true)
    expect(floor.enforced).toBe(true)
  })
})
