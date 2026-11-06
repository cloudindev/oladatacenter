import { expect, request as apiRequest, test } from "@playwright/test"
import {
  CATALOG_URL,
  FIXTURE_PATH,
  MANDATORY_FAMILIES,
  MVP_PLAN_CODES,
  REQUIRED_PRICING_MODES,
  cheapestOfFamily,
  findPlan,
  fixture,
  formatCents,
  monthlyCents,
  renewPricing,
  type OvhCatalog,
} from "./fixtures/ovh-catalog"

/**
 * CONTRACT TEST — not a UI test. No browser, no app, no database, no credentials.
 *
 * It fetches the live public OVH catalog and compares it with the snapshot
 * committed at packages/core/test/fixtures/ovh-catalog-vps-es.json. Everything
 * downstream — the published price table, the margin rule, `buildQuote` — is
 * built on the numbers in that snapshot. When OVH moves a price or retires a
 * plan code we are selling at a margin we no longer have, or quoting a plan
 * that can no longer be ordered.
 *
 * Runs daily from .github/workflows/contract.yml. This test failing is not a
 * bug in our code: it is news. See docs/runbooks/ovh-caido.md for what to do.
 *
 * It is the only spec in this directory that runs today — it depends on nothing
 * the feature agents are still building.
 */

let cachedCatalog: Promise<OvhCatalog> | null = null

/**
 * One fetch per worker. The payload is ~6 MB, so it is memoised rather than
 * re-downloaded per assertion.
 */
async function liveCatalog(): Promise<OvhCatalog> {
  if (!cachedCatalog) {
    cachedCatalog = (async () => {
      const context = await apiRequest.newContext()
      try {
        const response = await context.get(CATALOG_URL, { timeout: 120_000 })
        expect(
          response.ok(),
          `GET ${CATALOG_URL} returned ${response.status()} ${response.statusText()}. ` +
            `If OVH is down this is not a price drift — check https://status.ovhcloud.com ` +
            `and docs/runbooks/ovh-caido.md.`,
        ).toBeTruthy()
        return (await response.json()) as OvhCatalog
      } finally {
        await context.dispose()
      }
    })()
  }
  return cachedCatalog
}

test.describe("OVH public VPS catalog (ES)", () => {
  test("the committed fixture is internally consistent", async () => {
    // Guards against a careless fixture refresh. No network.
    expect(fixture.plans.length, `${FIXTURE_PATH} should hold exactly the four MVP plans`).toBe(
      MVP_PLAN_CODES.length,
    )
    for (const planCode of MVP_PLAN_CODES) {
      const plan = findPlan(fixture, planCode)
      expect(plan, `${planCode} is missing from ${FIXTURE_PATH}`).toBeDefined()
      for (const mode of REQUIRED_PRICING_MODES) {
        expect(
          renewPricing(plan!, mode),
          `${planCode} has no "${mode}" renew price in ${FIXTURE_PATH}`,
        ).toBeDefined()
      }
    }
  })

  test("the four MVP plan codes still exist", async () => {
    const live = await liveCatalog()
    const livePlanCodes = new Set(live.plans.map((plan) => plan.planCode))

    for (const planCode of MVP_PLAN_CODES) {
      expect
        .soft(
          livePlanCodes.has(planCode),
          `Plan code "${planCode}" no longer exists in the live OVH ES catalog. ` +
            `It cannot be ordered any more: the configurator must stop offering it. ` +
            `Look for the replacement code in the live catalog and update ` +
            `MVP_PLAN_CODES, the fixture and the plans table.`,
        )
        .toBe(true)
    }
  })

  test("each MVP plan still publishes a default and an upfront12 renew price", async () => {
    const live = await liveCatalog()

    for (const planCode of MVP_PLAN_CODES) {
      const plan = findPlan(live, planCode)
      if (!plan) continue // already reported by the test above

      for (const mode of REQUIRED_PRICING_MODES) {
        const pricing = renewPricing(plan, mode)
        expect
          .soft(
            pricing,
            `${planCode} no longer publishes a "${mode}" price with the "renew" capacity. ` +
              `OVH_PRICING_MODE maps Term P1M -> default and P12M -> upfront12; ` +
              `without this entry that term cannot be quoted.`,
          )
          .toBeDefined()
      }
    }
  })

  test("plan costs still match the committed fixture", async () => {
    const live = await liveCatalog()

    for (const planCode of MVP_PLAN_CODES) {
      const livePlan = findPlan(live, planCode)
      const fixturePlan = findPlan(fixture, planCode)
      if (!livePlan || !fixturePlan) continue

      for (const mode of REQUIRED_PRICING_MODES) {
        const livePricing = renewPricing(livePlan, mode)
        const fixturePricing = renewPricing(fixturePlan, mode)
        if (!livePricing || !fixturePricing) continue

        const liveMonthly = monthlyCents(livePricing)
        const fixtureMonthly = monthlyCents(fixturePricing)

        expect
          .soft(
            liveMonthly,
            `PRICE DRIFT — ${planCode} (${fixturePlan.invoiceName ?? "?"}), mode "${mode}": ` +
              `the committed fixture says ${formatCents(fixtureMonthly)}/month, ` +
              `OVH now charges ${formatCents(liveMonthly)}/month ` +
              `(${liveMonthly > fixtureMonthly ? "+" : ""}${formatCents(liveMonthly - fixtureMonthly)}). ` +
              `Our published PVP is derived from the old cost, so the margin on this plan ` +
              `is now wrong. Re-run the catalog sync, refresh ${FIXTURE_PATH}, and check ` +
              `the price table before deploying.`,
          )
          .toBe(fixtureMonthly)
      }
    }
  })

  test("the mandatory addon families are still mandatory", async () => {
    const live = await liveCatalog()

    for (const planCode of MVP_PLAN_CODES) {
      const plan = findPlan(live, planCode)
      if (!plan) continue

      for (const familyName of MANDATORY_FAMILIES) {
        const family = plan.addonFamilies?.find((f) => f.name === familyName)
        expect
          .soft(
            family,
            `${planCode} no longer has an addon family called "${familyName}". ` +
              `buildQuote resolves it as a mandatory family; a missing family means ` +
              `either a cheaper quote than OVH will accept, or a failed cart configuration.`,
          )
          .toBeDefined()
        if (!family) continue
        expect
          .soft(
            family.mandatory,
            `${planCode}: the "${familyName}" family is no longer mandatory. ` +
              `If it became optional we may be charging the customer for something ` +
              `we no longer have to buy — check the margin rule.`,
          )
          .toBe(true)
      }
    }
  })

  test("the cheapest automated backup still costs what the fixture says", async () => {
    // This is the number that corrected the margin on 2026-11-05: the brief said
    // the 1-day backup was included; it is a mandatory PRICED family.
    const live = await liveCatalog()

    for (const planCode of MVP_PLAN_CODES) {
      const livePlan = findPlan(live, planCode)
      const fixturePlan = findPlan(fixture, planCode)
      if (!livePlan || !fixturePlan) continue

      const liveBackup = cheapestOfFamily(live, livePlan, "automatedBackup", "default")
      const fixtureBackup = cheapestOfFamily(fixture, fixturePlan, "automatedBackup", "default")
      if (!fixtureBackup) continue

      expect
        .soft(
          liveBackup,
          `${planCode}: no priceable option left in the mandatory "automatedBackup" family.`,
        )
        .not.toBeNull()
      if (!liveBackup) continue

      expect
        .soft(
          liveBackup.monthly,
          `COST DRIFT — ${planCode} mandatory automated backup ` +
            `(${fixtureBackup.planCode} -> ${liveBackup.planCode}): ` +
            `the fixture says ${formatCents(fixtureBackup.monthly)}/month, ` +
            `OVH now charges ${formatCents(liveBackup.monthly)}/month. ` +
            `This is added to every VPS of this model, so it moves the true cost ` +
            `and the real margin. Refresh ${FIXTURE_PATH} and re-check the margin view.`,
        )
        .toBe(fixtureBackup.monthly)
    }
  })
})
