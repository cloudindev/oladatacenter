/**
 * The catalog service: the single server-side source of truth for what we sell and
 * what it costs the customer.
 *
 * Contract (fixed in docs/architecture.md):
 *   loadCatalog()        -> the newest OVH catalog snapshot, parsed and cached
 *   listSellablePlans()  -> the public view model of the four OLA plans
 *   quoteFor(config)     -> one priced configuration, straight from `buildQuote`
 *
 * Rules honoured here:
 *  - No price is ever computed by hand: `buildQuote` / `priceFromCost` own the margin rule.
 *  - OVH is never called from a request. A background job writes `ovhCatalogSnapshots`;
 *    if there is no snapshot (fresh install, no database) we fall back to the committed
 *    fixture so the public page always renders.
 *  - Nothing in here may be imported by a Client Component: it reads the database and
 *    the server environment, and it handles OVH plan codes and our costs.
 */
import { cache } from "react"
import { desc } from "drizzle-orm"
import {
  DEFAULT_ADDON_MARGIN,
  DEFAULT_PLAN_MARGIN,
  TERMS,
  addonSlug,
  buildQuote,
  parseCatalog,
  priceFromCost,
  toPlanViewModel,
  toPublicQuote,
  toQuoteRequest,
  type AddonGroup,
  type Cents,
  type ParsedCatalog,
  type PricingOverrides,
  type PublicConfig,
  type PublicQuote,
  type Quote,
  type SellablePlan,
  type Term,
} from "@ola/core"
import { addons as addonsTable, db, ovhCatalogSnapshots, plans as plansTable } from "@ola/db"
import { env } from "@/lib/env"
import { logger } from "@/lib/logger"
// Committed fixture of the real ES catalog (verified 2026-11-05). Last-resort fallback only.
import fallbackCatalogRaw from "../../../packages/core/test/fixtures/ovh-catalog-vps-es.json"

const log = logger.child({ module: "catalog" })

/** Short module-scope TTL: the catalog changes once a day at most. */
const CATALOG_TTL_MS = 5 * 60_000

interface CatalogCacheEntry {
  catalog: ParsedCatalog
  expiresAt: number
}

let catalogCache: CatalogCacheEntry | null = null

/** Default margins come from the environment; without one, from the domain defaults. */
function defaultMargins(): { plan: number; addon: number } {
  try {
    const current = env()
    return { plan: current.PRICING_DEFAULT_MARGIN, addon: current.ADDON_DEFAULT_MARGIN }
  } catch {
    return { plan: DEFAULT_PLAN_MARGIN, addon: DEFAULT_ADDON_MARGIN }
  }
}

async function readNewestSnapshot(): Promise<ParsedCatalog | null> {
  const rows = await db()
    .select({ raw: ovhCatalogSnapshots.raw, fetchedAt: ovhCatalogSnapshots.fetchedAt })
    .from(ovhCatalogSnapshots)
    .orderBy(desc(ovhCatalogSnapshots.fetchedAt))
    .limit(1)

  const newest = rows[0]
  if (!newest) return null
  return parseCatalog(newest.raw, { fetchedAt: newest.fetchedAt })
}

/**
 * Newest parsed catalog. Cached per request by React `cache` and for a short TTL in
 * module scope, so one page render parses the 6 MB-worth of JSON once.
 */
export const loadCatalog = cache(async (): Promise<ParsedCatalog> => {
  const now = Date.now()
  if (catalogCache && catalogCache.expiresAt > now) return catalogCache.catalog

  let catalog: ParsedCatalog | null = null
  try {
    catalog = await readNewestSnapshot()
    if (!catalog) {
      log.warn(
        { event: "catalog.snapshot.missing" },
        "no OVH catalog snapshot in the database, using the committed fixture",
      )
    }
  } catch (error) {
    log.warn(
      {
        event: "catalog.snapshot.unreachable",
        error: error instanceof Error ? error.message : String(error),
      },
      "could not read the OVH catalog snapshot, using the committed fixture",
    )
  }

  if (!catalog) catalog = parseCatalog(fallbackCatalogRaw)

  catalogCache = { catalog, expiresAt: now + CATALOG_TTL_MS }
  return catalog
})

// ─── admin overrides ─────────────────────────────────────────────────────────

interface PlanOverride {
  active: boolean
  sort: number | null
  planMargin: number
  manualPlanPrice: Partial<Record<Term, Cents>>
}

interface CatalogOverrides {
  plans: ReadonlyMap<string, PlanOverride>
  addonMargin: number
  manualAddonPrice: Record<string, Partial<Record<Term, Cents>>>
  /** OVH codes of addons the admin has switched off. */
  inactiveAddons: ReadonlySet<string>
}

function basisPointsToRatio(basisPoints: number): number {
  return basisPoints / 10_000
}

/**
 * Admin overrides from the database.
 *
 * `PricingOverrides` carries one addon margin for the whole quote, so a per-addon margin
 * is expressed as an explicit price produced by the engine (`priceFromCost`) over the
 * catalog cost. A manual PVP in the row always wins over both.
 */
async function readOverrides(catalog: ParsedCatalog): Promise<CatalogOverrides> {
  const margins = defaultMargins()
  const planRows = await db()
    .select({
      ovhPlanCode: plansTable.ovhPlanCode,
      active: plansTable.active,
      sort: plansTable.sort,
      margin: plansTable.margin,
      priceMonth: plansTable.priceMonth,
      price12m: plansTable.price12m,
    })
    .from(plansTable)

  const addonRows = await db()
    .select({
      ovhPlanCode: addonsTable.ovhPlanCode,
      active: addonsTable.active,
      margin: addonsTable.margin,
      priceMonth: addonsTable.priceMonth,
      price12m: addonsTable.price12m,
    })
    .from(addonsTable)

  const plans = new Map<string, PlanOverride>()
  for (const row of planRows) {
    const manualPlanPrice: Partial<Record<Term, Cents>> = {}
    if (row.priceMonth !== null) manualPlanPrice.P1M = row.priceMonth
    if (row.price12m !== null) manualPlanPrice.P12M = row.price12m
    plans.set(row.ovhPlanCode, {
      active: row.active,
      sort: row.sort,
      planMargin: basisPointsToRatio(row.margin),
      manualPlanPrice,
    })
  }

  const costByCode = new Map(catalog.addons.map((addon) => [addon.planCode, addon.monthlyCost]))
  const manualAddonPrice: Record<string, Partial<Record<Term, Cents>>> = {}
  const inactiveAddons = new Set<string>()

  for (const row of addonRows) {
    if (!row.active) inactiveAddons.add(row.ovhPlanCode)
    const rowMargin = basisPointsToRatio(row.margin)
    const cost = costByCode.get(row.ovhPlanCode)
    const price: Partial<Record<Term, Cents>> = {}

    for (const term of TERMS) {
      const manual = term === "P1M" ? row.priceMonth : row.price12m
      if (manual !== null) {
        price[term] = manual
        continue
      }
      // A per-addon margin the admin changed: price it with the engine, not by hand.
      if (cost && cost[term] > 0 && rowMargin !== margins.addon) {
        price[term] = priceFromCost(cost[term], rowMargin)
      }
    }
    if (Object.keys(price).length > 0) manualAddonPrice[row.ovhPlanCode] = price
  }

  return { plans, addonMargin: margins.addon, manualAddonPrice, inactiveAddons }
}

const loadOverrides = cache(async (catalog: ParsedCatalog): Promise<CatalogOverrides> => {
  const margins = defaultMargins()
  try {
    return await readOverrides(catalog)
  } catch (error) {
    log.warn(
      {
        event: "catalog.overrides.unreachable",
        error: error instanceof Error ? error.message : String(error),
      },
      "could not read plan and addon overrides, pricing with the default margins",
    )
    return {
      plans: new Map<string, PlanOverride>(),
      addonMargin: margins.addon,
      manualAddonPrice: {},
      inactiveAddons: new Set<string>(),
    }
  }
})

function pricingFor(planCode: string, overrides: CatalogOverrides): PricingOverrides {
  const plan = overrides.plans.get(planCode)
  const margins = defaultMargins()
  return {
    planMargin: plan?.planMargin ?? margins.plan,
    addonMargin: overrides.addonMargin,
    ...(plan && Object.keys(plan.manualPlanPrice).length > 0
      ? { manualPlanPrice: plan.manualPlanPrice }
      : {}),
    ...(Object.keys(overrides.manualAddonPrice).length > 0
      ? { manualAddonPrice: overrides.manualAddonPrice }
      : {}),
  }
}

/** Public slugs of the addons the admin switched off, so the view model can drop them. */
function inactiveSlugs(catalog: ParsedCatalog, overrides: CatalogOverrides): ReadonlySet<string> {
  const slugs = new Set<string>()
  for (const addon of catalog.addons) {
    if (!overrides.inactiveAddons.has(addon.planCode)) continue
    const slug = addonSlug(addon)
    if (slug !== null) slugs.add(slug)
  }
  return slugs
}

function withoutInactiveAddons(
  groups: readonly AddonGroup[],
  hidden: ReadonlySet<string>,
): readonly AddonGroup[] {
  if (hidden.size === 0) return groups
  return groups
    .map((group) => ({
      ...group,
      options: group.options.filter((option) => !hidden.has(option.slug) || option.included),
    }))
    .filter((group) => group.options.length > 0)
}

// ─── the public contract ─────────────────────────────────────────────────────

/**
 * The four OLA plans as the public pages render them: specs, both terms priced through
 * `buildQuote`, the annual saving, the sellable datacenters, the images and the addons
 * grouped by family. Inactive plans and addons are left out.
 */
export const listSellablePlans = cache(async (): Promise<SellablePlan[]> => {
  const catalog = await loadCatalog()
  const overrides = await loadOverrides(catalog)
  const hidden = inactiveSlugs(catalog, overrides)

  const plans: SellablePlan[] = []
  for (const plan of catalog.plans) {
    const override = overrides.plans.get(plan.planCode)
    if (override && !override.active) continue
    const view = toPlanViewModel(plan, catalog, pricingFor(plan.planCode, overrides))
    plans.push({
      ...view,
      addons: withoutInactiveAddons(view.addons, hidden),
      sort: override?.sort ?? view.sort,
    })
  }

  return plans.sort((a, b) => a.sort - b.sort || a.slug.localeCompare(b.slug))
})

/**
 * Price one configuration. Thin wrapper over `buildQuote`: the catalog and the admin
 * overrides are the only things added.
 *
 * The returned `Quote` carries our cost and OVH's own plan name, so it stays on the
 * server. `publicQuoteFor` is what a Server Action may send to the browser.
 */
export async function quoteFor(config: PublicConfig): Promise<Quote> {
  const catalog = await loadCatalog()
  const overrides = await loadOverrides(catalog)
  const request = toQuoteRequest(catalog, config)
  return buildQuote(catalog, request, pricingFor(request.planCode, overrides))
}

/** The same quote, stripped of everything a customer must never see. */
export async function publicQuoteFor(config: PublicConfig): Promise<PublicQuote> {
  const catalog = await loadCatalog()
  const quote = await quoteFor(config)
  return toPublicQuote(quote, catalog, config)
}

/** Test seam: drops the module-scope catalog cache. */
export function resetCatalogCache(): void {
  catalogCache = null
}
