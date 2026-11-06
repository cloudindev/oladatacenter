/**
 * Seeds the catalog tables from the committed OVH fixture so a fresh database can serve
 * the public pages without waiting for the first catalog sync.
 *
 * Run with:  npm run db:seed
 * Safe to re-run: every row is upserted on its OVH plan code.
 */
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import {
  MANDATORY_FAMILIES,
  PLAN_BRANDING,
  cheapestAddonOfFamily,
  parseCatalog,
  type AddonFamily,
} from "@ola/core"
import { createDatabase } from "./index"
import { addons, ovhCatalogSnapshots, plans } from "./schema"

const here = dirname(fileURLToPath(import.meta.url))
const FIXTURE = resolve(here, "../../core/test/fixtures/ovh-catalog-vps-es.json")

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to seed")
  }

  const raw: unknown = JSON.parse(readFileSync(FIXTURE, "utf8"))
  const catalog = parseCatalog(raw)
  const db = createDatabase(connectionString)

  await db.insert(ovhCatalogSnapshots).values({ raw: raw as Record<string, unknown> })

  let sort = 0
  for (const plan of catalog.plans) {
    const branding = PLAN_BRANDING[plan.planCode]
    if (!branding) continue

    // The real floor: plan cost plus every mandatory family OVH forces onto the cart.
    const mandatoryMonthly = MANDATORY_FAMILIES.reduce((total, family: AddonFamily) => {
      const cheapest = cheapestAddonOfFamily(catalog, plan, family, "P1M")
      return total + (cheapest?.monthlyCost.P1M ?? 0)
    }, 0)
    const mandatoryAnnual = MANDATORY_FAMILIES.reduce((total, family: AddonFamily) => {
      const cheapest = cheapestAddonOfFamily(catalog, plan, family, "P12M")
      return total + (cheapest?.monthlyCost.P12M ?? 0)
    }, 0)

    await db
      .insert(plans)
      .values({
        ovhPlanCode: plan.planCode,
        slug: branding.slug,
        name: branding.name,
        vcores: branding.vcores,
        ramGb: branding.ramGb,
        nvmeGb: branding.nvmeGb,
        bandwidthMbps: branding.bandwidthMbps,
        costMonth: plan.monthlyCost.P1M,
        cost12m: plan.monthlyCost.P12M,
        trueCostMonth: plan.monthlyCost.P1M + mandatoryMonthly,
        trueCost12m: plan.monthlyCost.P12M + mandatoryAnnual,
        sort: sort++,
      })
      .onConflictDoUpdate({
        target: plans.ovhPlanCode,
        set: {
          costMonth: plan.monthlyCost.P1M,
          cost12m: plan.monthlyCost.P12M,
          trueCostMonth: plan.monthlyCost.P1M + mandatoryMonthly,
          trueCost12m: plan.monthlyCost.P12M + mandatoryAnnual,
          updatedAt: new Date(),
        },
      })
  }

  for (const addon of catalog.addons) {
    const appliesTo = catalog.plans
      .filter((plan) =>
        Object.values(plan.addonCodesByFamily).some((codes) => codes.includes(addon.planCode)),
      )
      .map((plan) => plan.planCode)

    await db
      .insert(addons)
      .values({
        ovhPlanCode: addon.planCode,
        family: addon.family,
        name: addon.invoiceName || addon.planCode,
        costMonth: addon.monthlyCost.P1M,
        cost12m: addon.monthlyCost.P12M,
        appliesTo,
        mandatory: MANDATORY_FAMILIES.includes(addon.family),
      })
      .onConflictDoUpdate({
        target: addons.ovhPlanCode,
        set: {
          costMonth: addon.monthlyCost.P1M,
          cost12m: addon.monthlyCost.P12M,
          appliesTo,
          updatedAt: new Date(),
        },
      })
  }

  console.log(`seeded ${catalog.plans.length} plans and ${catalog.addons.length} addons`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
