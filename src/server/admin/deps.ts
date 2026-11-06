/**
 * Everything the admin panel needs from the rest of the platform, as ports.
 *
 * The Server Actions below never import the database, `next/headers`, `next/cache`,
 * Inngest or the billing layer directly. They ask for an `AdminDeps`, which is wired for
 * real in `live.ts` and replaced by fakes in `__tests__`. Two things fall out of that:
 *
 *  - every action is unit-testable with no Postgres, no OVH key and no Inngest key;
 *  - `live.ts` is the single place that has to change when a parallel module lands.
 *
 * This file must not statically import anything that pulls in `server-only`, `@ola/db`
 * or `next/*`: `live.ts` is loaded lazily, on the first real call.
 */
import type { Cents, ParsedCatalog } from "@ola/core"
import type { AdminStore } from "./store"

// ─── who is acting ───────────────────────────────────────────────────────────

/**
 * The signed-in admin. Produced by `requireAdmin()`, which is FIXED in
 * docs/architecture.md and requires role `admin` AND a TOTP-verified session.
 */
export interface AdminActor {
  userId: string
  email: string
  ip: string | null
  userAgent: string | null
}

// ─── audit ───────────────────────────────────────────────────────────────────

export interface AdminAuditEntry {
  entity: string
  entityId?: string | null
  action: string
  /** The row as it was, and the fields written. `live.ts` turns these into `diffOf(...)`. */
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  /** Facts that are not a field change: amounts, reasons, acknowledgements, event names. */
  context?: Record<string, unknown>
  correlationId?: string | null
}

/** Writes one `auditLog` row with `actorType: "admin"`. Never silently skipped. */
export type AdminAuditPort = (actor: AdminActor, entry: AdminAuditEntry) => Promise<void>

// ─── jobs ────────────────────────────────────────────────────────────────────

/**
 * The only three Inngest events the admin panel may emit, one method each so the payload
 * is checked at compile time and a test can assert exactly which one was sent.
 */
export interface AdminEventsPort {
  /** `ola/order.provision` with `resume: true`: pick the order up from `completedSteps`. */
  retryProvision(input: { orderId: string; correlationId: string }): Promise<void>
  /** `ola/catalog.sync` with `reason: "manual"`. */
  syncCatalog(input: { correlationId: string }): Promise<void>
  /** `ola/service.sync` for one service. */
  syncService(input: { serviceId: string; correlationId: string }): Promise<void>
}

// ─── the kill switches ───────────────────────────────────────────────────────

export interface AdminSafetyPort {
  /** `OVH_ORDERS_ENABLED` as the environment really has it. */
  ovhOrdersEnabledInEnv(): boolean
  /** True when both adapters are mocked, in which case nothing real can be spent. */
  usingMocks(): boolean
  /**
   * `assertOvhOrdersEnabled()` from `src/server/providers.ts`. Throws when a real order
   * would leave the building with the kill switch off.
   */
  assertOvhOrdersEnabled(): void
}

// ─── money-moving operations owned by the billing layer ──────────────────────

export interface AdminBillingPort {
  /** `refundOrder(orderId, reason)`. */
  refundOrder(orderId: string, reason: string): Promise<{ refunded: Cents }>
  /**
   * `chargeRenewal(serviceId)` flattened with billing's `toAdminChargeResult`. A decline is
   * NOT an exception: `declined` carries Stripe's code so the operator sees why.
   */
  chargeRenewal(
    serviceId: string,
  ): Promise<{ charged: Cents; paymentIntentId: string | null; declined: string | null }>
}

export interface AdminAlertsPort {
  /** `raiseAlert(...)` from `src/server/jobs/alerts.ts`. */
  raiseAlert(input: {
    severity: "info" | "warning" | "critical"
    title: string
    entity: string
    entityId?: string | null
    detail?: string
    correlationId?: string
  }): Promise<void>
}

// ─── catalog ─────────────────────────────────────────────────────────────────

export interface AdminCatalogPort {
  /** `loadCatalog()` from `src/server/catalog/service.ts`. */
  load(): Promise<ParsedCatalog>
  /**
   * The pricing defaults the environment configures. `marginFloorBasisPoints` comes from
   * `CATALOG_MARGIN_FLOOR`, which the catalog sync job already alerts on, so the panel and
   * the job warn at the same threshold unless an operator overrides it in `featureFlags`.
   */
  defaults(): { plan: number; addon: number; marginFloorBasisPoints: number }
}

// ─── impersonation ───────────────────────────────────────────────────────────

export interface ImpersonationState {
  customerId: string
  customerEmail: string
  adminUserId: string
  startedAt: Date
}

export interface ImpersonationPort {
  read(): Promise<ImpersonationState | null>
  start(state: ImpersonationState): Promise<void>
  stop(): Promise<void>
}

// ─── read-only deep links into the providers ─────────────────────────────────

export interface AdminLinksPort {
  /**
   * Origin of the WHMCS install, so the panel can link to an order, an invoice or a
   * client. `null` when WHMCS is not configured, and the links are then simply not shown.
   * The admin never acts on WHMCS through a link — the operator authenticates there.
   */
  whmcsBaseUrl(): string | null
}

// ─── cache ───────────────────────────────────────────────────────────────────

export interface AdminCachePort {
  /** `revalidatePath` for the admin routes a mutation just invalidated. */
  revalidate(path: string): void
}

// ─── the container ───────────────────────────────────────────────────────────

export interface AdminDeps {
  store: AdminStore
  /** `requireAdmin()` plus the request metadata the audit row records. */
  actor(): Promise<AdminActor>
  audit: AdminAuditPort
  events: AdminEventsPort
  safety: AdminSafetyPort
  billing: AdminBillingPort
  alerts: AdminAlertsPort
  catalog: AdminCatalogPort
  links: AdminLinksPort
  impersonation: ImpersonationPort
  cache: AdminCachePort
  now(): Date
}

let override: AdminDeps | null = null
let live: AdminDeps | null = null

/**
 * The container. In production it is built once by `live.ts`; in tests `setAdminDeps`
 * installs a fake before the first call, so the live wiring is never even imported.
 */
export async function adminDeps(): Promise<AdminDeps> {
  if (override) return override
  if (live) return live
  const wiring = await import("./live")
  live = wiring.liveAdminDeps()
  return live
}

/** Test seam. Pass `null` to restore the live wiring. */
export function setAdminDeps(deps: AdminDeps | null): void {
  override = deps
}
