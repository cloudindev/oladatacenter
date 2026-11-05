import { sumCents, type Cents } from "../money.js"
import { cheapestAddonOfFamily } from "../catalog/parse.js"
import {
  MANDATORY_FAMILIES,
  TERM_MONTHS,
  type AddonCost,
  type AddonFamily,
  type ParsedCatalog,
  type PlanCost,
  type Term,
} from "../catalog/types.js"
import { DEFAULT_ADDON_MARGIN, DEFAULT_PLAN_MARGIN, resolvePrice } from "./margin.js"
import { applyVat, type TaxedAmount, type VatContext } from "./vat.js"

export class QuoteError extends Error {}

/** Per-plan and per-addon overrides the admin can set. */
export interface PricingOverrides {
  planMargin?: number
  addonMargin?: number
  manualPlanPrice?: Partial<Record<Term, Cents>>
  manualAddonPrice?: Record<string, Partial<Record<Term, Cents>>>
}

export interface QuoteRequest {
  planCode: string
  term: Term
  datacenter: string
  operatingSystem: string
  /** Optional addon plan codes (snapshot, additionalDisk, plesk, 7-day backup…). */
  addonCodes?: readonly string[]
}

export interface QuoteLine {
  kind: "plan" | "addon"
  code: string
  label: string
  family?: AddonFamily
  /** What OVH charges us, per month. */
  monthlyCost: Cents
  /** What the customer pays, per month. */
  monthlyPrice: Cents
  /** Monthly price times the months in one billing cycle. */
  cyclePrice: Cents
  /** True for lines OVH forces onto every cart. */
  mandatory: boolean
}

export interface Quote {
  planCode: string
  term: Term
  months: number
  lines: readonly QuoteLine[]
  /** Customer-facing totals, net of VAT. */
  monthlyPrice: Cents
  cycleNet: Cents
  /** Our cost for one cycle — never shown to a customer. */
  cycleCost: Cents
  /** Cost including the mandatory addons OVH forces (the real floor). */
  monthlyTrueCost: Cents
}

function label(name: string, fallback: string): string {
  return name.trim() === "" ? fallback : name
}

/**
 * Build the full price breakdown for one configuration.
 *
 * Mandatory families (os, storage, automatedBackup) are resolved automatically to their
 * cheapest option unless the caller picked a different addon of that family. This matters:
 * `automatedBackup` is mandatory and priced, so a plan can never be sold at its bare cost.
 */
export function buildQuote(
  catalog: ParsedCatalog,
  request: QuoteRequest,
  overrides: PricingOverrides = {},
): Quote {
  const plan = catalog.plans.find((candidate) => candidate.planCode === request.planCode)
  if (!plan) throw new QuoteError(`unknown plan: ${request.planCode}`)
  if (!plan.datacenters.includes(request.datacenter)) {
    throw new QuoteError(`datacenter ${request.datacenter} not available for ${plan.planCode}`)
  }
  if (!plan.operatingSystems.includes(request.operatingSystem)) {
    throw new QuoteError(`OS ${request.operatingSystem} not available for ${plan.planCode}`)
  }

  const term = request.term
  const months = TERM_MONTHS[term]
  const planMargin = overrides.planMargin ?? DEFAULT_PLAN_MARGIN
  const addonMargin = overrides.addonMargin ?? DEFAULT_ADDON_MARGIN

  const selected = resolveSelectedAddons(catalog, plan, request, term)

  const planCost = plan.monthlyCost[term]
  const planPrice = resolvePrice(planCost, planMargin, overrides.manualPlanPrice?.[term]).price

  const lines: QuoteLine[] = [
    {
      kind: "plan",
      code: plan.planCode,
      label: label(plan.invoiceName, plan.planCode),
      monthlyCost: planCost,
      monthlyPrice: planPrice,
      cyclePrice: planPrice * months,
      mandatory: true,
    },
  ]

  for (const addon of selected) {
    const cost = addon.monthlyCost[term]
    const manual = overrides.manualAddonPrice?.[addon.planCode]?.[term]
    // Free mandatory options (Linux, local storage) must stay free, never marked up to ,99.
    const price = cost === 0 ? 0 : resolvePrice(cost, addonMargin, manual).price
    lines.push({
      kind: "addon",
      code: addon.planCode,
      label: label(addon.invoiceName, addon.planCode),
      family: addon.family,
      monthlyCost: cost,
      monthlyPrice: price,
      cyclePrice: price * months,
      mandatory: MANDATORY_FAMILIES.includes(addon.family),
    })
  }

  const monthlyPrice = sumCents(lines.map((line) => line.monthlyPrice))
  const monthlyTrueCost = sumCents(lines.map((line) => line.monthlyCost))

  return {
    planCode: plan.planCode,
    term,
    months,
    lines,
    monthlyPrice,
    cycleNet: monthlyPrice * months,
    cycleCost: monthlyTrueCost * months,
    monthlyTrueCost,
  }
}

function resolveSelectedAddons(
  catalog: ParsedCatalog,
  plan: PlanCost,
  request: QuoteRequest,
  term: Term,
): AddonCost[] {
  const byCode = new Map(catalog.addons.map((addon) => [addon.planCode, addon]))
  const requested = request.addonCodes ?? []
  const selected: AddonCost[] = []
  const familiesTaken = new Set<AddonFamily>()

  for (const code of requested) {
    const addon = byCode.get(code)
    if (!addon) throw new QuoteError(`unknown addon: ${code}`)
    const availableForPlan = Object.values(plan.addonCodesByFamily).some((codes) =>
      codes.includes(code),
    )
    if (!availableForPlan) {
      throw new QuoteError(`addon ${code} is not available for plan ${plan.planCode}`)
    }
    // Every family in the catalog is exclusive: one addon per family, no exceptions.
    if (familiesTaken.has(addon.family)) {
      throw new QuoteError(`two addons selected for exclusive family ${addon.family}`)
    }
    familiesTaken.add(addon.family)
    selected.push(addon)
  }

  for (const family of MANDATORY_FAMILIES) {
    if (familiesTaken.has(family)) continue
    const cheapest = cheapestAddonOfFamily(catalog, plan, family, term)
    if (!cheapest) {
      throw new QuoteError(`plan ${plan.planCode} has no option for mandatory family ${family}`)
    }
    familiesTaken.add(family)
    selected.push(cheapest)
  }

  return selected
}

export interface CheckoutTotals {
  /** Net price of the cycle before any discount. */
  subtotal: Cents
  /** Promotional credit applied to this order. */
  creditApplied: Cents
  /** Net after credit — the taxable base. */
  taxableBase: Cents
  tax: Cents
  /** What Stripe actually charges. */
  total: Cents
  vat: TaxedAmount
}

/**
 * Credit is a discount on the net amount, applied BEFORE VAT, and never below zero.
 * It is not a payment: it must never produce a negative charge or a standalone invoice.
 */
export function checkoutTotals(
  quote: Quote,
  availableCredit: Cents,
  vatContext: VatContext,
): CheckoutTotals {
  if (availableCredit < 0) throw new QuoteError("available credit cannot be negative")
  const subtotal = quote.cycleNet
  const creditApplied = Math.min(availableCredit, subtotal)
  const taxableBase = subtotal - creditApplied
  const vat = applyVat(taxableBase, vatContext)
  return {
    subtotal,
    creditApplied,
    taxableBase,
    tax: vat.tax,
    total: vat.gross,
    vat,
  }
}
