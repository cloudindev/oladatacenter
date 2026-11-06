/**
 * Minimal, self-contained reader for the OVH public VPS catalog.
 *
 * Deliberately does NOT import `@ola/core`'s `parseCatalog`: this is a contract
 * test. If the normalisation rules in `packages/core` ever drift from what OVH
 * actually publishes, a test built on `parseCatalog` would happily agree with
 * the bug. So the two price traps verified on 2026-11-05 are re-implemented
 * here, in ten lines, from the documentation in docs/ovh-api-verified.md:
 *
 *   1. prices are integers in units of 1e-8 EUR  ->  cents = price / 1e6
 *   2. `interval` is the number of months the price covers (Plesk publishes a
 *      yearly figure)                            ->  monthly = cents / interval
 */

import committedFixture from "../../packages/core/test/fixtures/ovh-catalog-vps-es.json"

/** The four plans the MVP sells. Must stay in step with `MVP_PLAN_CODES`. */
export const MVP_PLAN_CODES = [
  "vps-2027-model1",
  "vps-2027-model2",
  "vps-2027-model3",
  "vps-2027-model4",
] as const

/** The OVH pricing modes we quote: monthly and 12-month upfront. */
export const REQUIRED_PRICING_MODES = ["default", "upfront12"] as const

export const CATALOG_URL = "https://eu.api.ovh.com/1.0/order/catalog/public/vps?ovhSubsidiary=ES"

export const FIXTURE_PATH = "packages/core/test/fixtures/ovh-catalog-vps-es.json"

export interface OvhPricing {
  mode: string
  interval: number
  price: number
  capacities: string[]
  commitment?: number
}

export interface OvhAddonFamily {
  name: string
  mandatory?: boolean
  exclusive?: boolean
  addons: string[]
}

export interface OvhPlan {
  planCode: string
  invoiceName?: string
  pricings: OvhPricing[]
  addonFamilies?: OvhAddonFamily[]
}

export interface OvhCatalog {
  plans: OvhPlan[]
  addons: OvhPlan[]
}

/** The committed snapshot the live catalog is compared against. */
export const fixture = committedFixture as unknown as OvhCatalog

export function findPlan(catalog: OvhCatalog, planCode: string): OvhPlan | undefined {
  return catalog.plans.find((plan) => plan.planCode === planCode)
}

export function findAddon(catalog: OvhCatalog, planCode: string): OvhPlan | undefined {
  return catalog.addons.find((addon) => addon.planCode === planCode)
}

/** The recurring entry of a pricing mode: the one whose capacities include "renew". */
export function renewPricing(plan: OvhPlan, mode: string): OvhPricing | undefined {
  return plan.pricings.find((p) => p.mode === mode && p.capacities.includes("renew"))
}

/** Price of one month, in integer cents. Applies both normalisation rules. */
export function monthlyCents(pricing: OvhPricing): number {
  const cents = pricing.price / 1e6
  const months = pricing.interval > 0 ? pricing.interval : 1
  return Math.round(cents / months)
}

/** "7,99 €" — only used to make a failure message readable. */
export function formatCents(cents: number): string {
  return `${(cents / 100).toFixed(2).replace(".", ",")} €`
}

/**
 * The cheapest option of a mandatory family, which is what `buildQuote` charges
 * the customer for. `automatedBackup` is the one that costs real margin if it
 * moves: see docs/decisions.md, 2026-11-05.
 */
export function cheapestOfFamily(
  catalog: OvhCatalog,
  plan: OvhPlan,
  familyName: string,
  mode: string,
): { planCode: string; monthly: number } | null {
  const family = plan.addonFamilies?.find((f) => f.name === familyName)
  if (!family) return null

  let best: { planCode: string; monthly: number } | null = null
  for (const addonCode of family.addons) {
    const addon = findAddon(catalog, addonCode)
    if (!addon) continue
    const pricing = renewPricing(addon, mode)
    if (!pricing) continue
    const monthly = monthlyCents(pricing)
    if (!best || monthly < best.monthly) best = { planCode: addonCode, monthly }
  }
  return best
}

/** Families that must stay mandatory — pricing assumes all three are charged. */
export const MANDATORY_FAMILIES = ["os", "storage", "automatedBackup"] as const
