/**
 * The fake data layer the admin tests run against. No Postgres, no OVH, no Inngest.
 *
 * `FakeAdminStore` keeps rows in arrays and records nothing it is not asked to; the ports
 * record every call so a test can assert that an audit row was written, which event was
 * emitted and that no money moved.
 */
import { parseCatalog, type ParsedCatalog } from "@ola/core"
import catalogFixture from "../../../../packages/core/test/fixtures/ovh-catalog-vps-es.json"
import type {
  AdminActor,
  AdminAlertsPort,
  AdminAuditEntry,
  AdminBillingPort,
  AdminCachePort,
  AdminCatalogPort,
  AdminDeps,
  AdminEventsPort,
  AdminSafetyPort,
  ImpersonationPort,
  ImpersonationState,
} from "../deps"
import type {
  ActionRow,
  AddonPatch,
  AddonRow,
  AdminStore,
  AuditFilter,
  AuditRow,
  CustomerDetail,
  CustomerFilter,
  CustomerPatch,
  CustomerRow,
  DashboardCounts,
  FlagRow,
  NewCredit,
  OrderDetail,
  OrderFilter,
  OrderRow,
  PaymentFilter,
  PaymentRow,
  PlanPatch,
  PlanRow,
  ServiceDetail,
  ServiceFilter,
  ServicePatch,
  ServiceRow,
  SnapshotRow,
} from "../store"

export const FIXED_NOW = new Date("2026-11-06T12:00:00.000Z")

export const TEST_ACTOR: AdminActor = {
  userId: "01JADMIN00000000000000000A",
  email: "ops@oladc.com",
  ip: "203.0.113.7",
  userAgent: "vitest",
}

// ─── row builders ────────────────────────────────────────────────────────────

/**
 * VPS-1 as the live ES catalog really prices it (verified 2026-11-05):
 * plan 449 cents/month, mandatory `automatedBackup` 35 cents, so the true cost is 484.
 */
export function planRow(overrides: Partial<PlanRow> = {}): PlanRow {
  return {
    id: "01JPLAN0000000000000000001",
    ovhPlanCode: "vps-2027-model1",
    slug: "s",
    name: "OLA VPS S",
    cost: { P1M: 449, P12M: 393 },
    storedTrueCost: { P1M: 484, P12M: 428 },
    manualPrice: {},
    marginBasisPoints: 7500,
    active: true,
    sort: 0,
    ...overrides,
  }
}

export function addonRow(overrides: Partial<AddonRow> = {}): AddonRow {
  return {
    id: "01JADDON000000000000000001",
    ovhPlanCode: "option-auto-backup-2027-1-model1",
    family: "automatedBackup",
    name: "Backup automático 1 día",
    cost: { P1M: 35, P12M: 35 },
    manualPrice: {},
    marginBasisPoints: 5000,
    mandatory: true,
    active: true,
    sort: 0,
    ...overrides,
  }
}

export function orderDetail(overrides: Partial<OrderDetail> = {}): OrderDetail {
  return {
    id: "01JORDER000000000000000001",
    customerId: "01JCUST0000000000000000001",
    customerEmail: "cliente@example.com",
    kind: "new",
    status: "failed",
    term: "P1M",
    total: 967,
    expectedCost: 484,
    completedSteps: [],
    ovhOrderId: null,
    paidAt: new Date("2026-11-06T08:00:00.000Z"),
    deliveredAt: null,
    createdAt: new Date("2026-11-06T07:55:00.000Z"),
    errorCode: "ovh_unavailable",
    serviceId: null,
    subtotal: 799,
    tax: 168,
    creditApplied: 0,
    items: { planCode: "vps-2027-model1", datacenter: "GRA" },
    stripePaymentIntentId: "pi_3Qtest",
    whmcsOrderId: 1234,
    whmcsInvoiceId: 5678,
    ovhCartId: null,
    idempotencyKey: "order-01JORDER000000000000000001",
    error: "OVH 503: service unavailable",
    updatedAt: new Date("2026-11-06T08:05:00.000Z"),
    ...overrides,
  }
}

export function serviceDetail(overrides: Partial<ServiceDetail> = {}): ServiceDetail {
  return {
    id: "01JSERVICE00000000000000001",
    customerId: "01JCUST0000000000000000001",
    customerEmail: "cliente@example.com",
    planId: "01JPLAN0000000000000000001",
    planName: "OLA VPS S",
    ovhPlanCode: "vps-2027-model1",
    displayName: "web-1",
    ovhServiceName: "vps-abc123.vps.ovh.net",
    datacenter: "GRA",
    os: "Debian 13",
    ipv4: "203.0.113.10",
    status: "active",
    term: "P1M",
    monthlyPrice: 799,
    nextDueAt: new Date("2026-12-01T00:00:00.000Z"),
    dunningStage: "scheduled",
    autoRenew: true,
    lastSyncedAt: new Date("2026-11-06T06:00:00.000Z"),
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    ipv6: "2001:db8::1",
    whmcsServiceId: 99,
    ovhExpiresAt: new Date("2026-12-01T00:00:00.000Z"),
    rescueMode: false,
    suspendedAt: null,
    terminatedAt: null,
    dunningCompleted: [],
    orderId: "01JORDER000000000000000001",
    ...overrides,
  }
}

export function customerDetail(overrides: Partial<CustomerDetail> = {}): CustomerDetail {
  return {
    id: "01JCUST0000000000000000001",
    userId: "01JUSER0000000000000000001",
    email: "cliente@example.com",
    kind: "company",
    legalName: "Example SL",
    country: "ES",
    status: "verified",
    taxIdValidated: true,
    emailVerifiedAt: new Date("2026-10-01T00:00:00.000Z"),
    phoneVerifiedAt: new Date("2026-10-01T00:00:00.000Z"),
    firstPaidAt: new Date("2026-10-02T00:00:00.000Z"),
    whmcsClientId: 42,
    stripeCustomerId: "cus_test",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    taxId: "ESB12345678",
    phone: "+34600000000",
    riskNotes: null,
    hasVerifiedCard: true,
    billingComplete: true,
    credits: [],
    services: [],
    invoices: [],
    ...overrides,
  }
}

export function paymentRow(overrides: Partial<PaymentRow> = {}): PaymentRow {
  return {
    id: "01JPAY00000000000000000001",
    customerId: "01JCUST0000000000000000001",
    customerEmail: "cliente@example.com",
    orderId: "01JORDER000000000000000001",
    invoiceId: null,
    serviceId: null,
    dunningStage: null,
    stripePaymentIntentId: "pi_3Qtest",
    amount: 967,
    status: "requires_payment_method",
    failureCode: "card_declined",
    failureMessage: "Your card was declined.",
    refundedAmount: 0,
    settledAt: null,
    createdAt: new Date("2026-11-06T08:00:00.000Z"),
    ...overrides,
  }
}

export function auditRow(overrides: Partial<AuditRow> = {}): AuditRow {
  return {
    id: "01JAUDIT000000000000000001",
    actorId: TEST_ACTOR.userId,
    actorType: "admin",
    entity: "plan",
    entityId: "01JPLAN0000000000000000001",
    action: "plan.price.changed",
    diff: { priceMonth: { from: null, to: 899 } },
    ip: TEST_ACTOR.ip,
    correlationId: "admin-plan-price-abc",
    createdAt: new Date("2026-11-06T09:00:00.000Z"),
    ...overrides,
  }
}

// ─── the fake store ──────────────────────────────────────────────────────────

export interface FakeStoreSeed {
  plans?: PlanRow[]
  addons?: AddonRow[]
  orders?: OrderDetail[]
  services?: ServiceDetail[]
  customers?: CustomerDetail[]
  payments?: PaymentRow[]
  flags?: FlagRow[]
  audit?: AuditRow[]
  snapshots?: SnapshotRow[]
  counts?: DashboardCounts
}

export class FakeAdminStore implements AdminStore {
  plans: PlanRow[]
  addons: AddonRow[]
  orders: OrderDetail[]
  services: ServiceDetail[]
  customers: CustomerDetail[]
  payments: PaymentRow[]
  flags: FlagRow[]
  audit: AuditRow[]
  snapshots: SnapshotRow[]
  credits: NewCredit[] = []
  /** Order ids with an `ovh.checkout.attempt` audit marker. */
  checkoutAttempts = new Set<string>()
  counts: DashboardCounts

  constructor(seed: FakeStoreSeed = {}) {
    this.plans = seed.plans ?? [planRow()]
    this.addons = seed.addons ?? [addonRow()]
    this.orders = seed.orders ?? []
    this.services = seed.services ?? []
    this.customers = seed.customers ?? []
    this.payments = seed.payments ?? []
    this.flags = seed.flags ?? []
    this.audit = seed.audit ?? []
    this.snapshots = seed.snapshots ?? []
    this.counts =
      seed.counts ?? {
        ordersInProgress: 0,
        ordersLate: 0,
        ordersFailed: 0,
        servicesSuspended: 0,
        servicesInReview: 0,
        paymentsFailedToday: 0,
        webhooksFailed: 0,
      }
  }

  async dashboardCounts(): Promise<DashboardCounts> {
    return this.counts
  }

  async listPlans(): Promise<readonly PlanRow[]> {
    return this.plans
  }

  async getPlan(id: string): Promise<PlanRow | null> {
    return this.plans.find((row) => row.id === id) ?? null
  }

  async updatePlan(id: string, patch: PlanPatch): Promise<void> {
    const row = this.plans.find((candidate) => candidate.id === id)
    if (!row) return
    if (patch.priceMonth !== undefined) {
      if (patch.priceMonth === null) delete row.manualPrice.P1M
      else row.manualPrice.P1M = patch.priceMonth
    }
    if (patch.price12m !== undefined) {
      if (patch.price12m === null) delete row.manualPrice.P12M
      else row.manualPrice.P12M = patch.price12m
    }
    if (patch.marginBasisPoints !== undefined) row.marginBasisPoints = patch.marginBasisPoints
    if (patch.active !== undefined) row.active = patch.active
    if (patch.sort !== undefined) row.sort = patch.sort
  }

  async listAddons(): Promise<readonly AddonRow[]> {
    return this.addons
  }

  async getAddon(id: string): Promise<AddonRow | null> {
    return this.addons.find((row) => row.id === id) ?? null
  }

  async updateAddon(id: string, patch: AddonPatch): Promise<void> {
    const row = this.addons.find((candidate) => candidate.id === id)
    if (!row) return
    if (patch.priceMonth !== undefined) {
      if (patch.priceMonth === null) delete row.manualPrice.P1M
      else row.manualPrice.P1M = patch.priceMonth
    }
    if (patch.price12m !== undefined) {
      if (patch.price12m === null) delete row.manualPrice.P12M
      else row.manualPrice.P12M = patch.price12m
    }
    if (patch.marginBasisPoints !== undefined) row.marginBasisPoints = patch.marginBasisPoints
    if (patch.active !== undefined) row.active = patch.active
    if (patch.sort !== undefined) row.sort = patch.sort
  }

  async listSnapshots(limit: number): Promise<readonly SnapshotRow[]> {
    return this.snapshots.slice(0, limit)
  }

  async listOrders(_filter: OrderFilter): Promise<readonly OrderRow[]> {
    return this.orders
  }

  async getOrder(id: string): Promise<OrderDetail | null> {
    return this.orders.find((row) => row.id === id) ?? null
  }

  async listServices(_filter: ServiceFilter): Promise<readonly ServiceRow[]> {
    return this.services
  }

  async getService(id: string): Promise<ServiceDetail | null> {
    return this.services.find((row) => row.id === id) ?? null
  }

  async updateService(id: string, patch: ServicePatch): Promise<void> {
    const row = this.services.find((candidate) => candidate.id === id)
    if (!row) return
    if (patch.status !== undefined) row.status = patch.status
    if (patch.nextDueAt !== undefined) row.nextDueAt = patch.nextDueAt
    if (patch.autoRenew !== undefined) row.autoRenew = patch.autoRenew
    if (patch.suspendedAt !== undefined) row.suspendedAt = patch.suspendedAt
  }

  async listServiceActions(): Promise<readonly ActionRow[]> {
    return []
  }

  async listServiceDatacenters(): Promise<readonly string[]> {
    return [...new Set(this.services.map((row) => row.datacenter))]
  }

  async listCustomers(_filter: CustomerFilter): Promise<readonly CustomerRow[]> {
    return this.customers
  }

  async getCustomer(id: string): Promise<CustomerDetail | null> {
    return this.customers.find((row) => row.id === id) ?? null
  }

  async updateCustomer(id: string, patch: CustomerPatch): Promise<void> {
    const row = this.customers.find((candidate) => candidate.id === id)
    if (!row) return
    if (patch.status !== undefined) row.status = patch.status
    if (patch.riskNotes !== undefined) row.riskNotes = patch.riskNotes
  }

  async insertCredit(credit: NewCredit): Promise<{ id: string }> {
    this.credits.push(credit)
    return { id: `01JCREDIT${String(this.credits.length).padStart(17, "0")}` }
  }

  async listPayments(_filter: PaymentFilter): Promise<readonly PaymentRow[]> {
    return this.payments
  }

  async getPayment(id: string): Promise<PaymentRow | null> {
    return this.payments.find((row) => row.id === id) ?? null
  }

  async listFlags(): Promise<readonly FlagRow[]> {
    return this.flags
  }

  async getFlag(key: string): Promise<FlagRow | null> {
    return this.flags.find((row) => row.key === key) ?? null
  }

  async setFlag(key: string, enabled: boolean, description: string | null): Promise<void> {
    const existing = this.flags.find((row) => row.key === key)
    if (existing) {
      existing.enabled = enabled
      existing.description = description
      existing.updatedAt = FIXED_NOW
      return
    }
    this.flags.push({ key, enabled, description, updatedAt: FIXED_NOW })
  }

  async searchAudit(_filter: AuditFilter): Promise<readonly AuditRow[]> {
    return this.audit
  }

  async hasCheckoutAttempt(orderId: string): Promise<boolean> {
    return this.checkoutAttempts.has(orderId)
  }
}

// ─── recording ports ─────────────────────────────────────────────────────────

export interface RecordedAudit {
  actor: AdminActor
  entry: AdminAuditEntry
}

export interface RecordedEvent {
  name: "ola/order.provision" | "ola/catalog.sync" | "ola/service.sync"
  data: Record<string, unknown>
}

export interface FakeDeps extends AdminDeps {
  readonly recordedAudit: RecordedAudit[]
  readonly recordedEvents: RecordedEvent[]
  readonly recordedAlerts: { severity: string; title: string; entity: string }[]
  readonly recordedRefunds: { orderId: string; reason: string }[]
  readonly recordedCharges: string[]
  readonly revalidated: string[]
  impersonated: ImpersonationState | null
}

export interface FakeDepsOptions {
  store?: AdminStore
  ovhOrdersEnabledInEnv?: boolean
  usingMocks?: boolean
  /** Make `refundOrder` / `chargeRenewal` throw, as the live wiring currently does. */
  billingUnavailable?: boolean
  /** Make `chargeRenewal` come back declined with this Stripe code. */
  declineWith?: string
  catalog?: ParsedCatalog
  now?: Date
}

let parsedFixture: ParsedCatalog | null = null

/** The committed fixture of the real ES catalog, parsed once per test run. */
export function testCatalog(): ParsedCatalog {
  if (!parsedFixture) parsedFixture = parseCatalog(catalogFixture)
  return parsedFixture
}

export function fakeDeps(options: FakeDepsOptions = {}): FakeDeps {
  const recordedAudit: RecordedAudit[] = []
  const recordedEvents: RecordedEvent[] = []
  const recordedAlerts: { severity: string; title: string; entity: string }[] = []
  const recordedRefunds: { orderId: string; reason: string }[] = []
  const recordedCharges: string[] = []
  const revalidated: string[] = []

  const events: AdminEventsPort = {
    async retryProvision(input) {
      recordedEvents.push({ name: "ola/order.provision", data: { ...input, resume: true } })
    },
    async syncCatalog(input) {
      recordedEvents.push({ name: "ola/catalog.sync", data: { ...input } })
    },
    async syncService(input) {
      recordedEvents.push({ name: "ola/service.sync", data: { ...input } })
    },
  }

  const safety: AdminSafetyPort = {
    ovhOrdersEnabledInEnv: () => options.ovhOrdersEnabledInEnv ?? true,
    usingMocks: () => options.usingMocks ?? false,
    assertOvhOrdersEnabled() {
      if (options.usingMocks) return
      if (!(options.ovhOrdersEnabledInEnv ?? true)) {
        throw new Error("OVH_ORDERS_ENABLED is false; refusing to place a real order")
      }
    },
  }

  const billing: AdminBillingPort = {
    async refundOrder(orderId, reason) {
      if (options.billingUnavailable) throw new Error("billing not wired")
      recordedRefunds.push({ orderId, reason })
      return { refunded: 967 }
    },
    async chargeRenewal(serviceId) {
      if (options.billingUnavailable) throw new Error("billing not wired")
      recordedCharges.push(serviceId)
      if (options.declineWith) {
        return { charged: 0, paymentIntentId: null, declined: options.declineWith }
      }
      return { charged: 799, paymentIntentId: "pi_3Qretry", declined: null }
    },
  }

  const alerts: AdminAlertsPort = {
    async raiseAlert(input) {
      recordedAlerts.push({
        severity: input.severity,
        title: input.title,
        entity: input.entity,
      })
    },
  }

  const catalog: AdminCatalogPort = {
    async load() {
      return options.catalog ?? testCatalog()
    },
    defaults: () => ({ plan: 0.75, addon: 0.5, marginFloorBasisPoints: 3000 }),
  }

  const cache: AdminCachePort = {
    revalidate(path) {
      revalidated.push(path)
    },
  }

  const deps: FakeDeps = {
    store: options.store ?? new FakeAdminStore(),
    actor: async () => TEST_ACTOR,
    audit: async (actor, entry) => {
      recordedAudit.push({ actor, entry })
    },
    events,
    safety,
    billing,
    alerts,
    catalog,
    links: { whmcsBaseUrl: () => "https://whmcs.example.com" },
    impersonation: {} as ImpersonationPort,
    cache,
    now: () => options.now ?? FIXED_NOW,
    recordedAudit,
    recordedEvents,
    recordedAlerts,
    recordedRefunds,
    recordedCharges,
    revalidated,
    impersonated: null,
  }

  deps.impersonation = {
    async read() {
      return deps.impersonated
    },
    async start(state) {
      deps.impersonated = state
    },
    async stop() {
      deps.impersonated = null
    },
  }

  return deps
}

/** A `FormData` from a plain object, which is how the tests call the Server Actions. */
export function formOf(fields: Record<string, string>): FormData {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.set(key, value)
  return form
}
