/**
 * The baseline cost and price of every plan, taken from the pricing engine.
 *
 * The admin margin view needs four numbers per plan and term: the bare plan cost, the
 * plan line PVP, and the cost and PVP of the mandatory options OVH forces onto every
 * cart. Rather than add them up by hand — which is how `automatedBackup` got forgotten in
 * the first place — this asks `buildQuote` for the advertised baseline configuration and
 * reads the lines it produced. If the engine ever resolves a different mandatory option,
 * the admin panel follows automatically.
 *
 * Pure: a `ParsedCatalog` and the stored rows in, numbers out. No io.
 */
import {
  DEFAULT_ADDON_MARGIN,
  DEFAULT_PLAN_MARGIN,
  TERMS,
  baselineRequest,
  buildQuote,
  type Cents,
  type ParsedCatalog,
  type PlanCost,
  type PricingOverrides,
  type Term,
} from "@ola/core"
import { basisPointsToRatio, type MandatoryTotals } from "./pricing"
import type { AddonRow, PlanRow } from "./store"

export interface PlanBaseline {
  planCode: string
  /** Bare plan cost per month, by term. */
  bareCost: Record<Term, Cents>
  /** Cost and PVP of the mandatory options, summed, by term. */
  mandatory: Record<Term, MandatoryTotals>
  /** `null` when the engine refused the plan (no sellable OS, missing mandatory family). */
  error: string | null
}

const ZERO: MandatoryTotals = { cost: 0, price: 0 }

/**
 * `PricingOverrides` as the stored rows define them: one margin per plan, one shared
 * addon margin, and the manual PVPs. This is the same shape `src/server/catalog/service.ts`
 * feeds the public pages, so the admin screen prices what the customer is really charged.
 */
export function overridesFor(
  plan: PlanRow | undefined,
  addonRows: readonly AddonRow[],
  defaults: { plan: number; addon: number } = {
    plan: DEFAULT_PLAN_MARGIN,
    addon: DEFAULT_ADDON_MARGIN,
  },
): PricingOverrides {
  const manualAddonPrice: Record<string, Partial<Record<Term, Cents>>> = {}
  for (const row of addonRows) {
    const price: Partial<Record<Term, Cents>> = {}
    for (const term of TERMS) {
      const manual = row.manualPrice[term]
      if (manual !== undefined) price[term] = manual
    }
    if (Object.keys(price).length > 0) manualAddonPrice[row.ovhPlanCode] = price
  }

  const manualPlanPrice: Partial<Record<Term, Cents>> = {}
  for (const term of TERMS) {
    const manual = plan?.manualPrice[term]
    if (manual !== undefined) manualPlanPrice[term] = manual
  }

  return {
    planMargin: plan ? basisPointsToRatio(plan.marginBasisPoints) : defaults.plan,
    addonMargin: defaults.addon,
    ...(Object.keys(manualPlanPrice).length > 0 ? { manualPlanPrice } : {}),
    ...(Object.keys(manualAddonPrice).length > 0 ? { manualAddonPrice } : {}),
  }
}

function baselineForPlan(
  catalog: ParsedCatalog,
  plan: PlanCost,
  overrides: PricingOverrides,
): PlanBaseline {
  const bareCost = {} as Record<Term, Cents>
  const mandatory = {} as Record<Term, MandatoryTotals>

  for (const term of TERMS) {
    try {
      const quote = buildQuote(catalog, baselineRequest(plan, term), overrides)
      const planLine = quote.lines.find((line) => line.kind === "plan")
      bareCost[term] = planLine?.monthlyCost ?? plan.monthlyCost[term]
      mandatory[term] = quote.lines
        .filter((line) => line.kind === "addon" && line.mandatory)
        .reduce<MandatoryTotals>(
          (total, line) => ({
            cost: total.cost + line.monthlyCost,
            price: total.price + line.monthlyPrice,
          }),
          ZERO,
        )
    } catch (error) {
      return {
        planCode: plan.planCode,
        bareCost: { P1M: plan.monthlyCost.P1M, P12M: plan.monthlyCost.P12M },
        mandatory: { P1M: ZERO, P12M: ZERO },
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  return { planCode: plan.planCode, bareCost, mandatory, error: null }
}

/** One baseline per plan in the catalog, keyed by OVH plan code. */
export function planBaselines(
  catalog: ParsedCatalog,
  planRows: readonly PlanRow[],
  addonRows: readonly AddonRow[],
  defaults?: { plan: number; addon: number },
): ReadonlyMap<string, PlanBaseline> {
  const byCode = new Map(planRows.map((row) => [row.ovhPlanCode, row]))
  const result = new Map<string, PlanBaseline>()
  for (const plan of catalog.plans) {
    const overrides = overridesFor(byCode.get(plan.planCode), addonRows, defaults)
    result.set(plan.planCode, baselineForPlan(catalog, plan, overrides))
  }
  return result
}

/** Fallback baseline for a plan the catalog no longer carries: cost only, no mandatory. */
export function baselineFromRow(row: PlanRow): PlanBaseline {
  const stored = {
    P1M: Math.max(0, row.storedTrueCost.P1M - row.cost.P1M),
    P12M: Math.max(0, row.storedTrueCost.P12M - row.cost.P12M),
  }
  return {
    planCode: row.ovhPlanCode,
    bareCost: row.cost,
    // No catalog entry means no PVP for the mandatory options either; the cost half is
    // recovered from `plans.true_cost_*` so the margin is still not overstated.
    mandatory: {
      P1M: { cost: stored.P1M, price: 0 },
      P12M: { cost: stored.P12M, price: 0 },
    },
    error: "el plan ya no aparece en el catálogo de OVH",
  }
}
