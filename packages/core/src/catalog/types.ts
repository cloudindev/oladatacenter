import { z } from "zod"
import type { Cents } from "../money"

/** Billing term offered to the customer. OVH pricing mode is derived from it. */
export const TERMS = ["P1M", "P12M"] as const
export type Term = (typeof TERMS)[number]
export const termSchema = z.enum(TERMS)

/** OVH `pricings[].mode` matching each term. Verified against the ES catalog 2026-11-05. */
export const OVH_PRICING_MODE: Record<Term, string> = {
  P1M: "default",
  P12M: "upfront12",
}

/** Months covered by one billing cycle of the term. */
export const TERM_MONTHS: Record<Term, number> = {
  P1M: 1,
  P12M: 12,
}

/** Addon families we handle. `cpanel` is deliberately out of MVP scope. */
export const ADDON_FAMILIES = [
  "os",
  "storage",
  "automatedBackup",
  "snapshot",
  "additionalDisk",
  "plesk",
] as const
export type AddonFamily = (typeof ADDON_FAMILIES)[number]
export const addonFamilySchema = z.enum(ADDON_FAMILIES)

/** Families OVH requires on every cart. Verified: mandatory=true in the catalog. */
export const MANDATORY_FAMILIES: readonly AddonFamily[] = ["os", "storage", "automatedBackup"]

/** Cost of one catalog entry, normalised to cents per month for every term. */
export type CostByTerm = Record<Term, Cents>

export interface PlanCost {
  planCode: string
  /** OVH's own commercial name, e.g. "VPS-1 2027". Never shown to a customer. */
  invoiceName: string
  /** Plan price only, per month, by term. */
  monthlyCost: CostByTerm
  datacenters: readonly string[]
  operatingSystems: readonly string[]
  addonCodesByFamily: Readonly<Partial<Record<AddonFamily, readonly string[]>>>
}

export interface AddonCost {
  planCode: string
  invoiceName: string
  family: AddonFamily
  monthlyCost: CostByTerm
}

export interface ParsedCatalog {
  fetchedAt: Date
  plans: readonly PlanCost[]
  addons: readonly AddonCost[]
}

/** Our commercial identity for a plan. OVH names never reach the customer. */
export interface PlanBranding {
  slug: string
  name: string
  vcores: number
  ramGb: number
  nvmeGb: number
  bandwidthMbps: number
}

/** Fixed mapping from the OVH 2027 range to the OLA commercial range. */
export const PLAN_BRANDING: Readonly<Record<string, PlanBranding>> = {
  "vps-2027-model1": {
    slug: "s",
    name: "OLA VPS S",
    vcores: 2,
    ramGb: 4,
    nvmeGb: 40,
    bandwidthMbps: 500,
  },
  "vps-2027-model2": {
    slug: "m",
    name: "OLA VPS M",
    vcores: 4,
    ramGb: 8,
    nvmeGb: 75,
    bandwidthMbps: 1000,
  },
  "vps-2027-model3": {
    slug: "l",
    name: "OLA VPS L",
    vcores: 6,
    ramGb: 12,
    nvmeGb: 100,
    bandwidthMbps: 2000,
  },
  "vps-2027-model4": {
    slug: "xl",
    name: "OLA VPS XL",
    vcores: 8,
    ramGb: 24,
    nvmeGb: 200,
    bandwidthMbps: 3000,
  },
}

export const MVP_PLAN_CODES = Object.keys(PLAN_BRANDING)

/**
 * Datacenters we sell, in the order the configurator shows them: Europe first, then the
 * rest of the world. Cities as OVH names them (the DE site is Limburg, the UK one Erith,
 * in the London area).
 */
export const SELLABLE_DATACENTERS = [
  { code: "GRA", city: "Gravelines", country: "Francia", region: "europe" },
  { code: "SBG", city: "Estrasburgo", country: "Francia", region: "europe" },
  { code: "EU-WEST-RBX", city: "Roubaix", country: "Francia", region: "europe" },
  { code: "DE", city: "Limburgo", country: "Alemania", region: "europe" },
  { code: "UK", city: "Londres", country: "Reino Unido", region: "europe" },
  { code: "WAW", city: "Varsovia", country: "Polonia", region: "europe" },
  { code: "EU-SOUTH-MIL", city: "Milán", country: "Italia", region: "europe" },
  { code: "BHS", city: "Beauharnois", country: "Canadá", region: "world" },
  { code: "SGP", city: "Singapur", country: "Singapur", region: "world" },
  { code: "SYD", city: "Sídney", country: "Australia", region: "world" },
  { code: "YNM", city: "Bombay", country: "India", region: "world" },
] as const

export type DatacenterRegion = (typeof SELLABLE_DATACENTERS)[number]["region"]

export const SELLABLE_DATACENTER_CODES = SELLABLE_DATACENTERS.map((dc) => dc.code)
