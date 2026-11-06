import "server-only"
import {
  MVP_PLAN_CODES,
  availableCredit,
  checkTrialLimits,
  deliveryState,
  dunningSchedule,
  expiringSoon,
  isProvisionComplete,
  nextProvisionStep,
  pendingStep,
  type Cents,
  type DunningStep,
  type ProvisionStep,
  type TrialCheck,
} from "@ola/core"
import { requireAdmin, type SessionContext } from "@/server/auth/session"
import { baselineFromRow, planBaselines, type PlanBaseline } from "./baseline"
import { diffSnapshots, type CatalogDiff } from "./catalog-diff"
import { adminDeps, type ImpersonationState } from "./deps"
import { load, type Loaded } from "./load"
import { basisPointsToRatio, marginViewByTerm, type MarginByTerm } from "./pricing"
import { flagViews, readMarginFloor, type FlagView, type MarginFloor } from "./settings"
import type {
  ActionRow,
  AddonRow,
  AdminStore,
  AuditFilter,
  AuditRow,
  CustomerCreditRow,
  CustomerDetail,
  CustomerFilter,
  CustomerRow,
  DashboardCounts,
  OrderDetail,
  OrderFilter,
  OrderRow,
  PaymentFilter,
  PaymentRow,
  PlanRow,
  ServiceDetail,
  ServiceFilter,
  ServiceRow,
} from "./store"

/**
 * Every read the admin pages perform.
 *
 * These are reads, so they do not write audit rows; the guard is `requireAdminPage()`,
 * which every page in `src/app/admin/**` calls as its first statement. Each read is
 * wrapped in `load()`, so a missing or unreachable database renders a notice with the
 * raw error instead of a blank error page.
 */

export interface AdminPageSession {
  session: SessionContext
  impersonation: ImpersonationState | null
}

/**
 * The guard. `requireAdmin()` is FIXED in docs/architecture.md: role `admin` plus a
 * TOTP-verified session, redirecting to /login otherwise. There is no admin route
 * without this call.
 */
export async function requireAdminPage(): Promise<AdminPageSession> {
  const session = await requireAdmin()
  let impersonation: ImpersonationState | null = null
  try {
    const deps = await adminDeps()
    impersonation = await deps.impersonation.read()
  } catch {
    // A missing AUTH_SECRET must not take the whole panel down; without the marker the
    // banner simply does not show.
    impersonation = null
  }
  return { session, impersonation }
}

async function store(): Promise<AdminStore> {
  return (await adminDeps()).store
}

// ─── dashboard ───────────────────────────────────────────────────────────────

export async function dashboard(): Promise<Loaded<DashboardCounts>> {
  return load("dashboard", async () => {
    const deps = await adminDeps()
    return deps.store.dashboardCounts(deps.now())
  })
}

// ─── pricing ─────────────────────────────────────────────────────────────────

export interface PlanPricingView {
  row: PlanRow
  baseline: PlanBaseline
  margin: MarginByTerm
}

export interface AddonPricingView {
  row: AddonRow
  margin: MarginByTerm
}

export interface PricingScreen {
  plans: readonly PlanPricingView[]
  addons: readonly AddonPricingView[]
  floor: MarginFloor
  /** Set when the catalog could not be read: the true costs then come from `plans`. */
  catalogError: string | null
}

const NO_MANDATORY = { P1M: { cost: 0, price: 0 }, P12M: { cost: 0, price: 0 } }

export async function pricingScreen(): Promise<Loaded<PricingScreen>> {
  return load("pricing", async () => {
    const deps = await adminDeps()
    const [planRows, addonRows, floor] = await Promise.all([
      deps.store.listPlans(),
      deps.store.listAddons(),
      readMarginFloor(deps.store, deps.catalog.defaults().marginFloorBasisPoints),
    ])

    let baselines: ReadonlyMap<string, PlanBaseline> = new Map()
    let catalogError: string | null = null
    try {
      const catalog = await deps.catalog.load()
      baselines = planBaselines(catalog, planRows, addonRows, deps.catalog.defaults())
    } catch (error) {
      catalogError = error instanceof Error ? error.message : String(error)
    }

    const plans = planRows.map((row) => {
      const baseline = baselines.get(row.ovhPlanCode) ?? baselineFromRow(row)
      return {
        row,
        baseline,
        margin: marginViewByTerm({
          bareCost: baseline.bareCost,
          mandatory: baseline.mandatory,
          margin: basisPointsToRatio(row.marginBasisPoints),
          manualPrice: row.manualPrice,
          floor: floor.ratio,
        }),
      }
    })

    const addons = addonRows.map((row) => ({
      row,
      margin: marginViewByTerm({
        bareCost: row.cost,
        mandatory: NO_MANDATORY,
        margin: basisPointsToRatio(row.marginBasisPoints),
        manualPrice: row.manualPrice,
        floor: floor.ratio,
      }),
    }))

    return { plans, addons, floor, catalogError }
  })
}

// ─── catalog ─────────────────────────────────────────────────────────────────

export async function catalogScreen(): Promise<Loaded<CatalogDiff>> {
  return load("catalog", async () => {
    const snapshots = await (await store()).listSnapshots(2)
    return diffSnapshots(snapshots)
  })
}

// ─── orders ──────────────────────────────────────────────────────────────────

export interface OrderListView {
  row: OrderRow
  /** The step the provisioning job would run next, from `orders.completedSteps`. */
  nextStep: ProvisionStep | null
  complete: boolean
  /** `null` until the order is paid. */
  delivery: "on_time" | "late" | "timed_out" | null
}

function toOrderView(row: OrderRow, now: Date): OrderListView {
  return {
    row,
    nextStep: nextProvisionStep(row.completedSteps),
    complete: isProvisionComplete(row.completedSteps),
    delivery:
      row.paidAt && !row.deliveredAt ? deliveryState(row.paidAt, now) : null,
  }
}

export async function ordersScreen(
  filter: OrderFilter,
): Promise<Loaded<readonly OrderListView[]>> {
  return load("orders", async () => {
    const deps = await adminDeps()
    const rows = await deps.store.listOrders(filter)
    const now = deps.now()
    return rows.map((row) => toOrderView(row, now))
  })
}

export interface OrderScreen {
  detail: OrderDetail
  nextStep: ProvisionStep | null
  delivery: "on_time" | "late" | "timed_out" | null
  /** Both kill switches, so the retry button can explain itself before being pressed. */
  ovhOrdersEnabledInEnv: boolean
  usingMocks: boolean
  /** The jobs layer's `ovh.checkout.attempt` marker exists for this order. */
  checkoutAttempted: boolean
  whmcsBaseUrl: string | null
}

export async function orderScreen(id: string): Promise<Loaded<OrderScreen | null>> {
  return load("order", async () => {
    const deps = await adminDeps()
    const detail = await deps.store.getOrder(id)
    if (!detail) return null
    const now = deps.now()
    return {
      detail,
      nextStep: nextProvisionStep(detail.completedSteps),
      delivery: detail.paidAt && !detail.deliveredAt ? deliveryState(detail.paidAt, now) : null,
      ovhOrdersEnabledInEnv: deps.safety.ovhOrdersEnabledInEnv(),
      usingMocks: deps.safety.usingMocks(),
      checkoutAttempted: await deps.store.hasCheckoutAttempt(id),
      whmcsBaseUrl: deps.links.whmcsBaseUrl(),
    }
  })
}

// ─── services ────────────────────────────────────────────────────────────────

export interface ServicesScreen {
  rows: readonly ServiceRow[]
  datacenters: readonly string[]
  plans: readonly PlanRow[]
}

export async function servicesScreen(filter: ServiceFilter): Promise<Loaded<ServicesScreen>> {
  return load("services", async () => {
    const current = await store()
    const [rows, datacenters, plans] = await Promise.all([
      current.listServices(filter),
      current.listServiceDatacenters(),
      current.listPlans(),
    ])
    return { rows, datacenters, plans }
  })
}

export interface ServiceScreen {
  detail: ServiceDetail
  actions: readonly ActionRow[]
  /** The dunning step that should have fired and has not, from `pendingStep`. */
  pendingDunning: DunningStep | null
  /** The full renewal calendar for the current cycle, for the detail timeline. */
  dunningCalendar: readonly DunningStep[]
  whmcsBaseUrl: string | null
}

export async function serviceScreen(id: string): Promise<Loaded<ServiceScreen | null>> {
  return load("service", async () => {
    const deps = await adminDeps()
    const detail = await deps.store.getService(id)
    if (!detail) return null
    const actions = await deps.store.listServiceActions(id, 100)
    return {
      detail,
      actions,
      pendingDunning: detail.nextDueAt
        ? pendingStep(detail.nextDueAt, deps.now(), detail.dunningCompleted)
        : null,
      dunningCalendar: detail.nextDueAt ? dunningSchedule(detail.nextDueAt) : [],
      whmcsBaseUrl: deps.links.whmcsBaseUrl(),
    }
  })
}

// ─── customers ───────────────────────────────────────────────────────────────

export async function customersScreen(
  filter: CustomerFilter,
): Promise<Loaded<readonly CustomerRow[]>> {
  return load("customers", async () => (await store()).listCustomers(filter))
}

export interface CustomerScreen {
  detail: CustomerDetail
  /** Credit still usable today, and the grants about to expire. */
  availableCredit: Cents
  expiring: readonly CustomerCreditRow[]
  /** Trial limits status: `null` once the customer has paid real money. */
  trial: TrialCheck | null
  whmcsBaseUrl: string | null
}

export async function customerScreen(id: string): Promise<Loaded<CustomerScreen | null>> {
  return load("customer", async () => {
    const deps = await adminDeps()
    const detail = await deps.store.getCustomer(id)
    if (!detail) return null

    const now = deps.now()
    const entries = detail.credits.map((credit) => ({
      amount: credit.amount,
      reason: credit.reason,
      expiresAt: credit.expiresAt,
      consumed: credit.consumed,
    }))

    return {
      detail,
      availableCredit: availableCredit(entries, now),
      // Same rule as `expiringSoon`, applied per row so each grant keeps its id.
      expiring: detail.credits.filter((credit) => expiringSoon([credit], now).length > 0),
      trial:
        detail.firstPaidAt === null
          ? checkTrialLimits({
              hasPaidRealMoney: false,
              currentServiceCount: detail.services.length,
              planCode: detail.services[0]?.ovhPlanCode ?? MVP_PLAN_CODES[0],
              addonFamilies: [],
            })
          : null,
      whmcsBaseUrl: deps.links.whmcsBaseUrl(),
    }
  })
}

// ─── payments ────────────────────────────────────────────────────────────────

export interface PaymentsScreen {
  rows: readonly PaymentRow[]
  /** The monthly fee of the services behind these payments, for the retry confirmation. */
  serviceFees: ReadonlyMap<string, Cents>
}

export async function paymentsScreen(filter: PaymentFilter): Promise<Loaded<PaymentsScreen>> {
  return load("payments", async () => {
    const current = await store()
    const rows = await current.listPayments(filter)
    const serviceIds = new Set(
      rows.map((row) => row.serviceId).filter((id): id is string => id !== null),
    )
    const serviceFees = new Map<string, Cents>()
    for (const id of serviceIds) {
      const service = await current.getService(id)
      if (service) serviceFees.set(id, service.monthlyPrice)
    }
    return { rows, serviceFees }
  })
}

// ─── flags ───────────────────────────────────────────────────────────────────

export interface FlagsScreen {
  flags: readonly FlagView[]
  ovhOrdersEnabledInEnv: boolean
  usingMocks: boolean
}

export async function flagsScreen(): Promise<Loaded<FlagsScreen>> {
  return load("flags", async () => {
    const deps = await adminDeps()
    const rows = await deps.store.listFlags()
    const envEnabled = deps.safety.ovhOrdersEnabledInEnv()
    return {
      flags: flagViews(rows, envEnabled),
      ovhOrdersEnabledInEnv: envEnabled,
      usingMocks: deps.safety.usingMocks(),
    }
  })
}

// ─── audit ───────────────────────────────────────────────────────────────────

export async function auditScreen(filter: AuditFilter): Promise<Loaded<readonly AuditRow[]>> {
  return load("audit", async () => (await store()).searchAudit(filter))
}

/** Same query, bigger ceiling, for the CSV route handler. */
export async function auditRowsForExport(filter: AuditFilter): Promise<readonly AuditRow[]> {
  return (await store()).searchAudit({ ...filter, limit: filter.limit ?? 1000 })
}
