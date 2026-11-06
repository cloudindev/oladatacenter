import { z } from "zod"
import {
  MANDATORY_FAMILIES,
  MVP_PLAN_CODES,
  cheapestAddonOfFamily,
  marginOf,
  parseCatalog,
  priceFromCost,
  sumCents,
  type AddonFamily,
  type Cents,
  type ParsedCatalog,
  type PlanCost,
  type Term,
} from "@ola/core"
import type { StepTools } from "../steps"
import type { JobDeps } from "../ports"

/**
 * Daily catalog reconciliation.
 *
 * The public catalog is ~6.3 MB. Only the trimmed projection below is stored, which is
 * what `ovhCatalogSnapshots.raw` documents ("Trimmed catalog: only our plans and their
 * addons"). The snapshot exists to diff costs between days, not to archive OVH.
 */

/**
 * Minimum acceptable margin on the TRUE cost (plan + mandatory addons).
 * `CATALOG_MARGIN_FLOOR` is declared in `src/lib/env.ts`; it is read straight from
 * `process.env` here so this job stays testable without the full validated environment,
 * which requires a database URL and secrets that a unit test has no business holding.
 */
export const DEFAULT_MARGIN_FLOOR = 0.35

function marginFloor(): number {
  const raw = process.env.CATALOG_MARGIN_FLOOR
  if (!raw) return DEFAULT_MARGIN_FLOOR
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 && parsed < 1 ? parsed : DEFAULT_MARGIN_FLOOR
}

const snapshotPlanSchema = z.object({
  planCode: z.string(),
  invoiceName: z.string().default(""),
  costMonth: z.number().int(),
  cost12m: z.number().int(),
  trueCostMonth: z.number().int().default(0),
  trueCost12m: z.number().int().default(0),
  datacenters: z.array(z.string()).default([]),
  operatingSystems: z.array(z.string()).default([]),
})

const snapshotAddonSchema = z.object({
  planCode: z.string(),
  invoiceName: z.string().default(""),
  family: z.string(),
  costMonth: z.number().int(),
  cost12m: z.number().int(),
})

export const catalogSnapshotSchema = z.object({
  fetchedAt: z.string(),
  plans: z.array(snapshotPlanSchema).default([]),
  addons: z.array(snapshotAddonSchema).default([]),
})

export type CatalogSnapshotPayload = z.infer<typeof catalogSnapshotSchema>

export interface CostChange {
  kind: "plan" | "addon"
  code: string
  term: Term
  from: Cents
  to: Cents
}

export interface CatalogSyncResult {
  status: "ok" | "failed"
  plans: number
  addons: number
  changes: readonly CostChange[]
  missingPlanCodes: readonly string[]
  marginWarnings: readonly { planCode: string; margin: number | null; floor: number }[]
  detail?: string
}

/** Cost of the mandatory families OVH forces onto every cart, for one plan and term. */
function mandatoryCost(catalog: ParsedCatalog, plan: PlanCost, term: Term): Cents {
  const costs = MANDATORY_FAMILIES.map((family: AddonFamily) => {
    const addon = cheapestAddonOfFamily(catalog, plan, family, term)
    return addon ? addon.monthlyCost[term] : 0
  })
  return sumCents(costs)
}

export function trimCatalog(catalog: ParsedCatalog): CatalogSnapshotPayload {
  return {
    fetchedAt: catalog.fetchedAt.toISOString(),
    plans: catalog.plans.map((plan) => ({
      planCode: plan.planCode,
      invoiceName: plan.invoiceName,
      costMonth: plan.monthlyCost.P1M,
      cost12m: plan.monthlyCost.P12M,
      trueCostMonth: plan.monthlyCost.P1M + mandatoryCost(catalog, plan, "P1M"),
      trueCost12m: plan.monthlyCost.P12M + mandatoryCost(catalog, plan, "P12M"),
      datacenters: [...plan.datacenters],
      operatingSystems: [...plan.operatingSystems],
    })),
    addons: catalog.addons.map((addon) => ({
      planCode: addon.planCode,
      invoiceName: addon.invoiceName,
      family: addon.family,
      costMonth: addon.monthlyCost.P1M,
      cost12m: addon.monthlyCost.P12M,
    })),
  }
}

export function diffCatalog(
  previous: CatalogSnapshotPayload | null,
  current: CatalogSnapshotPayload,
): readonly CostChange[] {
  if (!previous) return []
  const changes: CostChange[] = []

  const previousPlans = new Map(previous.plans.map((plan) => [plan.planCode, plan]))
  for (const plan of current.plans) {
    const before = previousPlans.get(plan.planCode)
    if (!before) continue
    if (before.costMonth !== plan.costMonth) {
      changes.push({
        kind: "plan",
        code: plan.planCode,
        term: "P1M",
        from: before.costMonth,
        to: plan.costMonth,
      })
    }
    if (before.cost12m !== plan.cost12m) {
      changes.push({
        kind: "plan",
        code: plan.planCode,
        term: "P12M",
        from: before.cost12m,
        to: plan.cost12m,
      })
    }
  }

  const previousAddons = new Map(previous.addons.map((addon) => [addon.planCode, addon]))
  for (const addon of current.addons) {
    const before = previousAddons.get(addon.planCode)
    if (!before) continue
    if (before.costMonth !== addon.costMonth) {
      changes.push({
        kind: "addon",
        code: addon.planCode,
        term: "P1M",
        from: before.costMonth,
        to: addon.costMonth,
      })
    }
    if (before.cost12m !== addon.cost12m) {
      changes.push({
        kind: "addon",
        code: addon.planCode,
        term: "P12M",
        from: before.cost12m,
        to: addon.cost12m,
      })
    }
  }

  return changes
}

export async function runCatalogSync(
  deps: JobDeps,
  step: StepTools,
  correlationId: string,
): Promise<CatalogSyncResult> {
  const log = deps.log(correlationId, { job: "catalog-sync" })
  const floor = marginFloor()

  let current: CatalogSnapshotPayload
  try {
    current = await step.run("fetch-and-trim", async () => {
      const raw = await deps.ovh().fetchPublicCatalog(deps.ovhSubsidiary)
      // `parseCatalog` restricts itself to MVP_PLAN_CODES and throws when one is missing.
      const parsed = parseCatalog(raw, { fetchedAt: deps.now() })
      return trimCatalog(parsed)
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    // A plan code that vanished from the catalog stops every sale of that plan: loudest alert.
    await deps.alerts.raise({
      severity: "critical",
      title: "El catálogo de OVH no se puede sincronizar",
      entity: "catalog",
      entityId: null,
      detail,
      correlationId,
    })
    log.error({ error: detail }, "catalog sync failed")
    return {
      status: "failed",
      plans: 0,
      addons: 0,
      changes: [],
      missingPlanCodes: MVP_PLAN_CODES,
      marginWarnings: [],
      detail,
    }
  }

  const presentCodes = new Set(current.plans.map((plan) => plan.planCode))
  const missingPlanCodes = MVP_PLAN_CODES.filter((code) => !presentCodes.has(code))
  if (missingPlanCodes.length > 0) {
    await deps.alerts.raise({
      severity: "critical",
      title: "Faltan planes del MVP en el catálogo de OVH",
      entity: "catalog",
      entityId: null,
      detail: `missing plan codes: ${missingPlanCodes.join(", ")}`,
      correlationId,
    })
  }

  const previousRow = await deps.db.latestCatalogSnapshot()
  const previous = previousRow ? catalogSnapshotSchema.safeParse(previousRow.raw) : null
  const changes = diffCatalog(previous?.success ? previous.data : null, current)

  // Costs first: `plans`/`addons` are what the configurator and the margin view read.
  const marginWarnings: { planCode: string; margin: number | null; floor: number }[] = []
  await step.run("update-costs", async () => {
    for (const plan of current.plans) {
      const row = await deps.db.findPlanByOvhCode(plan.planCode)
      if (!row) continue
      await deps.db.updatePlanCosts(row.id, {
        costMonth: plan.costMonth,
        cost12m: plan.cost12m,
        trueCostMonth: plan.trueCostMonth,
        trueCost12m: plan.trueCost12m,
      })
      const price = row.priceMonth ?? priceFromCost(plan.costMonth, row.margin / 10_000)
      const realised = marginOf(plan.trueCostMonth, price)
      if (realised === null || realised < floor) {
        marginWarnings.push({ planCode: plan.planCode, margin: realised, floor })
      }
    }
    for (const addon of current.addons) {
      const row = await deps.db.findAddonByOvhCode(addon.planCode)
      if (!row) continue
      await deps.db.updateAddonCosts(row.id, {
        costMonth: addon.costMonth,
        cost12m: addon.cost12m,
      })
    }
    return null
  })

  const diffPayload: Record<string, unknown> = {
    changes,
    missingPlanCodes,
    marginWarnings,
  }
  await step.run("store-snapshot", async () => {
    await deps.db.insertCatalogSnapshot({
      fetchedAt: deps.now(),
      raw: current,
      diff: diffPayload,
    })
    return null
  })

  const increases = changes.filter((change) => change.to > change.from)
  if (increases.length > 0) {
    await deps.alerts.raise({
      severity: "warning",
      title: "Han subido costes en el catálogo de OVH",
      entity: "catalog",
      entityId: null,
      detail: increases
        .map((change) => `${change.kind} ${change.code} ${change.term}: ${change.from} -> ${change.to}`)
        .join("; "),
      correlationId,
    })
  }
  if (marginWarnings.length > 0) {
    await deps.alerts.raise({
      severity: "critical",
      title: "Margen por debajo del mínimo tras sincronizar el catálogo",
      entity: "catalog",
      entityId: null,
      detail: marginWarnings
        .map((warning) => `${warning.planCode}: ${warning.margin ?? "n/a"} < ${warning.floor}`)
        .join("; "),
      correlationId,
    })
  }

  await deps.audit.record({
    entity: "catalog",
    action: "catalog.synced",
    diff: { plans: current.plans.length, addons: current.addons.length, changes: changes.length },
    correlationId,
  })
  log.info(
    { plans: current.plans.length, addons: current.addons.length, changes: changes.length },
    "catalog synced",
  )

  return {
    status: "ok",
    plans: current.plans.length,
    addons: current.addons.length,
    changes,
    missingPlanCodes,
    marginWarnings,
  }
}
