import { z } from "zod"
import { catalogPriceToCents, type Cents } from "../money.js"
import {
  ADDON_FAMILIES,
  MVP_PLAN_CODES,
  OVH_PRICING_MODE,
  TERMS,
  type AddonCost,
  type AddonFamily,
  type CostByTerm,
  type ParsedCatalog,
  type PlanCost,
  type Term,
} from "./types.js"

/**
 * Minimal shape of the OVH public catalog. Verified against
 * GET /order/catalog/public/vps?ovhSubsidiary=ES on 2026-11-05.
 * Unknown fields are ignored on purpose: OVH adds fields often.
 */
const pricingSchema = z.object({
  mode: z.string(),
  /** Number of MONTHS the price covers. 0 for one-off fees. */
  interval: z.number(),
  price: z.number(),
  capacities: z.array(z.string()).default([]),
  commitment: z.number().optional(),
})

const configurationSchema = z.object({
  name: z.string(),
  values: z.array(z.string()).default([]),
})

const addonFamilySchema = z.object({
  name: z.string(),
  mandatory: z.boolean().optional(),
  exclusive: z.boolean().optional(),
  addons: z.array(z.string()).default([]),
})

const planSchema = z.object({
  planCode: z.string(),
  invoiceName: z.string().default(""),
  pricings: z.array(pricingSchema).default([]),
  configurations: z.array(configurationSchema).default([]),
  addonFamilies: z.array(addonFamilySchema).default([]),
})

const addonSchema = z.object({
  planCode: z.string(),
  invoiceName: z.string().default(""),
  pricings: z.array(pricingSchema).default([]),
})

export const ovhCatalogSchema = z.object({
  plans: z.array(planSchema).default([]),
  addons: z.array(addonSchema).default([]),
})

export type OvhCatalogRaw = z.infer<typeof ovhCatalogSchema>
type OvhPricing = z.infer<typeof pricingSchema>

export class CatalogError extends Error {}

/**
 * Pick the recurring ("renew") price for a pricing mode and normalise it to cents/month.
 *
 * Two verified traps handled here:
 *  - prices are in 1e-8 EUR, not cents;
 *  - `interval` is the number of months the price covers, and it is NOT always 1.
 *    Plans publish upfront12 with interval=1 (price is already monthly) while Plesk
 *    publishes upfront12 with interval=12 (price covers the full year).
 */
export function monthlyCostForMode(pricings: readonly OvhPricing[], mode: string): Cents | null {
  const renewals = pricings.filter(
    (pricing) => pricing.mode === mode && pricing.capacities.includes("renew"),
  )
  if (renewals.length === 0) return null

  // If OVH ever publishes several, the one covering the shortest interval wins.
  const pricing = renewals.reduce((best, candidate) =>
    candidate.interval < best.interval ? candidate : best,
  )
  const months = pricing.interval > 0 ? pricing.interval : 1
  return Math.round(catalogPriceToCents(pricing.price) / months)
}

function costByTerm(pricings: readonly OvhPricing[]): CostByTerm | null {
  const result = {} as CostByTerm
  for (const term of TERMS) {
    const monthly = monthlyCostForMode(pricings, OVH_PRICING_MODE[term])
    if (monthly === null) return null
    result[term] = monthly
  }
  return result
}

function isKnownFamily(name: string): name is AddonFamily {
  return (ADDON_FAMILIES as readonly string[]).includes(name)
}

export interface ParseOptions {
  /** Restrict to these plan codes. Defaults to the MVP range. */
  planCodes?: readonly string[]
  fetchedAt?: Date
}

export function parseCatalog(raw: unknown, options: ParseOptions = {}): ParsedCatalog {
  const catalog = ovhCatalogSchema.parse(raw)
  const planCodes = options.planCodes ?? MVP_PLAN_CODES
  const wanted = new Set(planCodes)

  const addonsByCode = new Map(catalog.addons.map((addon) => [addon.planCode, addon]))
  const plans: PlanCost[] = []
  const addonCosts = new Map<string, AddonCost>()

  for (const plan of catalog.plans) {
    if (!wanted.has(plan.planCode)) continue

    const monthlyCost = costByTerm(plan.pricings)
    if (!monthlyCost) {
      throw new CatalogError(
        `plan ${plan.planCode} has no renewable price for every term (${TERMS.join(", ")})`,
      )
    }

    const configurations = new Map(plan.configurations.map((cfg) => [cfg.name, cfg.values]))
    const addonCodesByFamily: Partial<Record<AddonFamily, readonly string[]>> = {}

    for (const family of plan.addonFamilies) {
      if (!isKnownFamily(family.name)) continue
      addonCodesByFamily[family.name] = family.addons

      for (const code of family.addons) {
        if (addonCosts.has(code)) continue
        const addon = addonsByCode.get(code)
        if (!addon) continue
        const addonMonthly = costByTerm(addon.pricings)
        if (!addonMonthly) continue
        addonCosts.set(code, {
          planCode: code,
          invoiceName: addon.invoiceName,
          family: family.name,
          monthlyCost: addonMonthly,
        })
      }
    }

    plans.push({
      planCode: plan.planCode,
      invoiceName: plan.invoiceName,
      monthlyCost,
      datacenters: configurations.get("vps_datacenter") ?? [],
      operatingSystems: configurations.get("vps_os") ?? [],
      addonCodesByFamily,
    })
  }

  const missing = planCodes.filter((code) => !plans.some((plan) => plan.planCode === code))
  if (missing.length > 0) {
    throw new CatalogError(`catalog is missing expected plan codes: ${missing.join(", ")}`)
  }

  return {
    fetchedAt: options.fetchedAt ?? new Date(),
    plans,
    addons: [...addonCosts.values()],
  }
}

/**
 * Cheapest addon of a mandatory family — what a bare order really costs.
 * Verified 2026-11-05: `automatedBackup` is mandatory AND priced (0.35 EUR/month on model1),
 * so the floor cost of a VPS is above its plan price.
 */
export function cheapestAddonOfFamily(
  catalog: ParsedCatalog,
  plan: PlanCost,
  family: AddonFamily,
  term: Term,
): AddonCost | null {
  const codes = plan.addonCodesByFamily[family] ?? []
  const candidates = catalog.addons.filter((addon) => codes.includes(addon.planCode))
  if (candidates.length === 0) return null
  return candidates.reduce((best, candidate) =>
    candidate.monthlyCost[term] < best.monthlyCost[term] ? candidate : best,
  )
}
