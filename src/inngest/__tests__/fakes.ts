import type { DunningStage, ProvisionStep } from "@ola/core"
import type { EmailMessage } from "@ola/email"
import type {
  Cart,
  CartConfigurationItem,
  CartItem,
  CheckoutPreview,
  GenericOptionDefinition,
  GenericProductDefinition,
  Image,
  IpAddress,
  Order,
  OvhOrderStatus,
  ServiceInfos,
  VpsSummary,
  VpsTask,
} from "@ola/ovh"
import type { WhmcsClientAccount, WhmcsInvoiceDetail, WhmcsService } from "@ola/whmcs"
import type { StepTools } from "../steps"
import type {
  AddonRecord,
  AlertInput,
  CatalogSnapshotRecord,
  CustomerRecord,
  InvoiceRecord,
  JobDb,
  JobDeps,
  OrderRecord,
  OvhJobs,
  PlanRecord,
  ServiceRecord,
  SshKeyRecord,
  WhmcsJobs,
} from "../ports"

/**
 * Test doubles for the whole jobs layer: an in-memory `JobDb`, and OVH / WHMCS stubs that
 * record every call so a test can assert that a paid action happened exactly once.
 *
 * `MockOvhJobs` / `MockWhmcsJobs` implement the same `OvhJobs` / `WhmcsJobs` picks of the
 * real ports, so they cannot drift from `packages/ovh` / `packages/whmcs`. They are
 * counting stubs on purpose: `MockOvhClient` from `@ola/ovh` is a full stateful simulator
 * with its own clock, which is the right tool for an end-to-end dev environment but
 * cannot answer "was `checkout` called exactly zero times?".
 */

/* -------------------------------------------------------------------------- */
/* step tools                                                                 */
/* -------------------------------------------------------------------------- */

export interface RecordingStepTools extends StepTools {
  readonly ran: readonly string[]
  readonly slept: readonly string[]
}

export function recordingStepTools(): RecordingStepTools {
  const ran: string[] = []
  const slept: string[] = []
  return {
    ran,
    slept,
    run<T>(id: string, fn: () => Promise<T>): Promise<T> {
      ran.push(id)
      return fn()
    },
    async sleep(id: string): Promise<void> {
      slept.push(id)
    },
  }
}

/* -------------------------------------------------------------------------- */
/* in-memory database                                                         */
/* -------------------------------------------------------------------------- */

export interface FakeDbState {
  orders: Map<string, OrderRecord>
  customers: Map<string, CustomerRecord>
  sshKeys: Map<string, SshKeyRecord[]>
  plans: PlanRecord[]
  addons: AddonRecord[]
  services: Map<string, ServiceRecord>
  invoices: Map<string, InvoiceRecord>
  snapshots: CatalogSnapshotRecord[]
  actions: { id: string; serviceId: string; type: string; ovhTaskId: number | null }[]
  /** Audit rows the jobs rely on as markers (see `countAuditActions`). */
  auditActions: {
    entity: string
    entityId: string | null
    action: string
    diff?: Record<string, unknown>
  }[]
  webhookEvents: Map<string, { eventType: string | null; processedAt: Date | null; error: string | null }>
}

export interface FakeDb {
  db: JobDb
  state: FakeDbState
}

let sequence = 0
function nextId(prefix: string): string {
  sequence += 1
  return `${prefix}_${sequence.toString().padStart(4, "0")}`
}

export function createFakeDb(seed: Partial<FakeDbState> = {}): FakeDb {
  const state: FakeDbState = {
    orders: seed.orders ?? new Map(),
    customers: seed.customers ?? new Map(),
    sshKeys: seed.sshKeys ?? new Map(),
    plans: seed.plans ?? [],
    addons: seed.addons ?? [],
    services: seed.services ?? new Map(),
    invoices: seed.invoices ?? new Map(),
    snapshots: seed.snapshots ?? [],
    actions: seed.actions ?? [],
    auditActions: seed.auditActions ?? [],
    webhookEvents: seed.webhookEvents ?? new Map(),
  }

  const db: JobDb = {
    async getOrder(orderId) {
      const order = state.orders.get(orderId)
      return order ? { ...order } : null
    },
    async updateOrder(orderId, patch) {
      const order = state.orders.get(orderId)
      if (!order) return
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) continue
        Object.assign(order, { [key]: value })
      }
    },
    async markOrderStepComplete(orderId, step) {
      const order = state.orders.get(orderId)
      if (!order) return []
      if (order.completedSteps.includes(step)) return order.completedSteps
      order.completedSteps = [...order.completedSteps, step]
      return order.completedSteps
    },

    async getCustomer(customerId) {
      const customer = state.customers.get(customerId)
      return customer ? { ...customer } : null
    },
    async findCustomerByWhmcsClientId(whmcsClientId) {
      for (const customer of state.customers.values()) {
        if (customer.whmcsClientId === whmcsClientId) return { ...customer }
      }
      return null
    },
    async setCustomerWhmcsClientId(customerId, whmcsClientId) {
      const customer = state.customers.get(customerId)
      if (customer) customer.whmcsClientId = whmcsClientId
    },
    async updateCustomerProfile(customerId, patch) {
      const customer = state.customers.get(customerId)
      if (!customer) return
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) continue
        Object.assign(customer, { [key]: value })
      }
    },
    async listSshKeys(customerId) {
      return state.sshKeys.get(customerId) ?? []
    },

    async findPlanByOvhCode(ovhPlanCode) {
      return state.plans.find((plan) => plan.ovhPlanCode === ovhPlanCode) ?? null
    },
    async listPlans() {
      return state.plans
    },
    async updatePlanCosts(planId, costs) {
      const plan = state.plans.find((candidate) => candidate.id === planId)
      if (!plan) return
      plan.costMonth = costs.costMonth
      plan.cost12m = costs.cost12m
      plan.trueCostMonth = costs.trueCostMonth ?? plan.trueCostMonth
      plan.trueCost12m = costs.trueCost12m ?? plan.trueCost12m
    },
    async findAddonByOvhCode(ovhPlanCode) {
      return state.addons.find((addon) => addon.ovhPlanCode === ovhPlanCode) ?? null
    },
    async listAddons() {
      return state.addons
    },
    async updateAddonCosts(addonId, costs) {
      const addon = state.addons.find((candidate) => candidate.id === addonId)
      if (!addon) return
      addon.costMonth = costs.costMonth
      addon.cost12m = costs.cost12m
    },
    async latestCatalogSnapshot() {
      return state.snapshots.at(-1) ?? null
    },
    async insertCatalogSnapshot(input) {
      state.snapshots.push({
        id: nextId("snap"),
        fetchedAt: input.fetchedAt,
        raw: input.raw,
        diff: input.diff,
      })
    },

    async getService(serviceId) {
      const service = state.services.get(serviceId)
      return service ? { ...service } : null
    },
    async findServiceByOrderId(orderId) {
      for (const service of state.services.values()) {
        if (service.orderId === orderId) return { ...service }
      }
      return null
    },
    async findServiceByOvhName(ovhServiceName) {
      for (const service of state.services.values()) {
        if (service.ovhServiceName === ovhServiceName) return { ...service }
      }
      return null
    },
    async createService(input) {
      const service: ServiceRecord = {
        id: nextId("svc"),
        customerId: input.customerId,
        planId: input.planId,
        orderId: input.orderId,
        displayName: input.displayName,
        ovhServiceName: input.ovhServiceName,
        datacenter: input.datacenter,
        os: input.os,
        ipv4: input.ipv4,
        ipv6: input.ipv6,
        status: input.status,
        term: input.term,
        monthlyPrice: input.monthlyPrice,
        nextDueAt: null,
        autoRenew: true,
        dunningStage: "scheduled",
        dunningCompleted: [],
        whmcsServiceId: null,
        ovhExpiresAt: null,
        suspendedAt: null,
        terminatedAt: null,
        lastSyncedAt: null,
      }
      state.services.set(service.id, service)
      return { ...service }
    },
    async updateService(serviceId, patch) {
      const service = state.services.get(serviceId)
      if (!service) return
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) continue
        Object.assign(service, { [key]: value })
      }
    },
    async appendDunningStage(serviceId, stage) {
      const service = state.services.get(serviceId)
      if (!service) return []
      if (service.dunningCompleted.includes(stage)) return service.dunningCompleted
      service.dunningCompleted = [...service.dunningCompleted, stage]
      return service.dunningCompleted
    },
    async resetDunning(serviceId, stage) {
      const service = state.services.get(serviceId)
      if (!service) return
      service.dunningCompleted = []
      service.dunningStage = stage
    },
    async listServicesForDunning() {
      return [...state.services.values()]
        .filter((service) => service.nextDueAt !== null)
        .map((service) => ({ ...service }))
    },
    async listServicesForSync() {
      return [...state.services.values()]
        .filter((service) => service.status !== "terminated")
        .map((service) => ({ ...service }))
    },

    async upsertInvoice(input) {
      for (const invoice of state.invoices.values()) {
        if (invoice.whmcsInvoiceId === input.whmcsInvoiceId) {
          Object.assign(invoice, {
            serviceId: input.serviceId ?? invoice.serviceId,
            status: input.status ?? invoice.status,
            subtotal: input.subtotal ?? invoice.subtotal,
            total: input.total ?? invoice.total,
            dueAt: input.dueAt ?? invoice.dueAt,
            paidAt: input.paidAt ?? invoice.paidAt,
          })
          return { ...invoice }
        }
      }
      const invoice: InvoiceRecord = {
        id: nextId("inv"),
        customerId: input.customerId,
        serviceId: input.serviceId ?? null,
        orderId: input.orderId ?? null,
        whmcsInvoiceId: input.whmcsInvoiceId,
        number: input.number ?? null,
        status: input.status ?? "unpaid",
        subtotal: input.subtotal ?? 0,
        tax: input.tax ?? 0,
        credit: input.credit ?? 0,
        total: input.total ?? 0,
        dueAt: input.dueAt ?? null,
        paidAt: input.paidAt ?? null,
      }
      state.invoices.set(invoice.id, invoice)
      return { ...invoice }
    },
    async findInvoiceByWhmcsId(whmcsInvoiceId) {
      for (const invoice of state.invoices.values()) {
        if (invoice.whmcsInvoiceId === whmcsInvoiceId) return { ...invoice }
      }
      return null
    },
    async findInvoice(invoiceId) {
      const invoice = state.invoices.get(invoiceId)
      return invoice ? { ...invoice } : null
    },
    async findLatestUnpaidInvoiceForService(serviceId) {
      for (const invoice of state.invoices.values()) {
        if (invoice.serviceId === serviceId && invoice.status === "unpaid") return { ...invoice }
      }
      return null
    },
    async updateInvoice(invoiceId, patch) {
      const invoice = state.invoices.get(invoiceId)
      if (!invoice) return
      if (patch.status !== undefined) invoice.status = patch.status
      if (patch.paidAt !== undefined) invoice.paidAt = patch.paidAt
    },

    async recordAction(input) {
      const id = nextId("act")
      state.actions.push({
        id,
        serviceId: input.serviceId,
        type: input.type,
        ovhTaskId: input.ovhTaskId ?? null,
      })
      return id
    },

    async countAuditActions(entity, entityId, action) {
      return state.auditActions.filter(
        (row) => row.entity === entity && row.entityId === entityId && row.action === action,
      ).length
    },

    async latestAuditDiff(entity, entityId, action) {
      const rows = state.auditActions.filter(
        (row) => row.entity === entity && row.entityId === entityId && row.action === action,
      )
      return rows.at(-1)?.diff ?? null
    },

    async claimWebhookEvent(input) {
      const key = `${input.provider}:${input.eventId}`
      if (state.webhookEvents.has(key)) return "duplicate"
      state.webhookEvents.set(key, {
        eventType: input.eventType,
        processedAt: null,
        error: null,
      })
      return "claimed"
    },
    async markWebhookProcessed(provider, eventId, error) {
      const key = `${provider}:${eventId}`
      const row = state.webhookEvents.get(key)
      if (row) {
        row.processedAt = new Date()
        row.error = error ?? null
      }
    },
  }

  return { db, state }
}

/* -------------------------------------------------------------------------- */
/* OVH mock                                                                   */
/* -------------------------------------------------------------------------- */

export interface MockOvhOptions {
  /** Cents, without tax, that the checkout preview reports. */
  previewCents?: number
  /** Statuses returned by `getOrderStatus`, consumed in order; the last one repeats. */
  orderStatuses?: readonly OvhOrderStatus[]
  /**
   * The full VPS list, fixed whatever happens. Leave unset to simulate a real account:
   * `existingVps` before the checkout, plus `deliveredVps` and `appearsAfterCheckout` once
   * the checkout has been posted.
   */
  vpsNames?: readonly string[]
  /** Servers the OVH account already holds (the operator's own). Default none. */
  existingVps?: readonly string[]
  /** The server the checkout delivers. Default `vps-ola1.ovh.net`. */
  deliveredVps?: string
  /** Other servers that show up after the checkout, e.g. one created by hand meanwhile. */
  appearsAfterCheckout?: readonly string[]
  /** Per-server model and zone, for servers that are not the default S in GRA. */
  vpsSpecs?: Readonly<
    Record<string, { vcore: number; memory: number; zone: string; model?: string }>
  >
  catalog?: unknown
  /** Orders OVH already holds, for the "checkout may have gone through" re-check. */
  existingOrders?: readonly Order[]
  serviceInfos?: Partial<ServiceInfos>
  vpsState?: VpsSummary["state"]
  currentImage?: Image
}

function price(cents: number) {
  return {
    currencyCode: "EUR",
    value: cents / 100,
    text: `${(cents / 100).toFixed(2)} €`,
    priceInUcents: cents * 1_000_000,
  }
}

function preview(cents: number, orderId: number | null): CheckoutPreview {
  return {
    orderId,
    url: null,
    prices: {
      withoutTax: price(cents),
      withTax: price(Math.round(cents * 1.21)),
      tax: price(Math.round(cents * 0.21)),
      originalWithoutTax: null,
      reduction: null,
    },
    details: [
      {
        description: "VPS-1 2027",
        domain: "vps-new",
        quantity: 1,
        detailType: "CREATION",
        cartItemID: 1,
        unitPrice: price(cents),
        totalPrice: price(cents),
        originalTotalPrice: null,
        reductionTotalPrice: null,
      },
    ],
    contracts: [],
  }
}

function pricing(pricingMode: string, duration: string) {
  return {
    capacities: ["renew"],
    description: "",
    duration,
    interval: 1,
    pricingMode,
    pricingType: "rental",
    price: price(449),
    priceInUcents: 449_000_000,
    minimumQuantity: 1,
    maximumQuantity: 1,
    minimumRepeat: 1,
    maximumRepeat: null,
  }
}

const MOCK_MODEL = {
  name: "vps-2027-model1",
  offer: "classic",
  version: "2027v1",
  vcore: 2,
  memory: 4096,
  disk: 40,
  diskLocationType: "local",
  maximumAdditionnalIp: 16,
  datacenter: ["GRA"],
  availableOptions: [],
}

export class MockOvhJobs implements OvhJobs {
  readonly calls: string[] = []
  private statusIndex = 0
  private readonly options: MockOvhOptions

  constructor(options: MockOvhOptions = {}) {
    this.options = options
  }

  countOf(call: string): number {
    return this.calls.filter((entry) => entry === call).length
  }

  private record(call: string): void {
    this.calls.push(call)
  }

  async fetchPublicCatalog(): Promise<unknown> {
    this.record("fetchPublicCatalog")
    return this.options.catalog ?? { plans: [], addons: [] }
  }

  async createCart(): Promise<Cart> {
    this.record("createCart")
    return { cartId: "cart-1", description: "ola", items: [], readOnly: false, expire: null }
  }

  async assignCart(): Promise<void> {
    this.record("assignCart")
  }

  async listCartVpsOffers(): Promise<readonly GenericProductDefinition[]> {
    this.record("listCartVpsOffers")
    return [
      {
        planCode: "vps-2027-model1",
        productName: "VPS-1 2027",
        productType: "cloud_service",
        prices: [pricing("default", "P1M"), pricing("upfront12", "P1Y")],
      },
    ]
  }

  async listCartOptions(): Promise<readonly GenericOptionDefinition[]> {
    this.record("listCartOptions")
    const base = {
      productType: "cloud_service",
      exclusive: true,
      mandatory: true,
      prices: [pricing("default", "P1M"), pricing("upfront12", "P1Y")],
    }
    return [
      { ...base, planCode: "option-linux", productName: "Linux", family: "os" },
      {
        ...base,
        planCode: "option-auto-backup-2027-1-model1",
        productName: "Backup 1 día",
        family: "automatedBackup",
      },
    ]
  }

  async addVpsToCart(): Promise<CartItem> {
    this.record("addVpsToCart")
    return {
      cartId: "cart-1",
      itemId: 1,
      productId: "vps",
      offerId: null,
      duration: "P1M",
      parentItemId: null,
      configurations: [],
      options: [],
      prices: [],
      settings: {},
    }
  }

  async configureItem(): Promise<CartConfigurationItem> {
    this.record("configureItem")
    return { id: 1, label: "vps_datacenter", value: "GRA" }
  }

  async addOption(): Promise<CartItem> {
    this.record("addOption")
    return {
      cartId: "cart-1",
      itemId: 2,
      productId: "vps-option",
      offerId: null,
      duration: "P1M",
      parentItemId: 1,
      configurations: [],
      options: [],
      prices: [],
      settings: {},
    }
  }

  async getCheckoutPreview(): Promise<CheckoutPreview> {
    this.record("getCheckoutPreview")
    return preview(this.options.previewCents ?? 484, null)
  }

  async checkout(): Promise<CheckoutPreview> {
    this.record("checkout")
    return preview(this.options.previewCents ?? 484, 99_001)
  }

  async getOrderStatus(): Promise<OvhOrderStatus> {
    this.record("getOrderStatus")
    const statuses = this.options.orderStatuses ?? ["delivered"]
    const status = statuses[Math.min(this.statusIndex, statuses.length - 1)] ?? "delivered"
    this.statusIndex += 1
    return status
  }

  async getOrder(orderId: number): Promise<Order> {
    this.record("getOrder")
    const existing = this.options.existingOrders?.find((order) => order.orderId === orderId)
    return (
      existing ?? {
        orderId,
        date: new Date("2026-11-06T08:56:00.000Z"),
        expirationDate: null,
        retractionDate: null,
        pdfUrl: null,
        url: null,
        priceWithTax: price(586),
        priceWithoutTax: price(484),
        tax: price(102),
      }
    )
  }

  async listVps(): Promise<readonly string[]> {
    this.record("listVps")
    if (this.options.vpsNames) return this.options.vpsNames
    const before = this.options.existingVps ?? []
    if (!this.calls.includes("checkout")) return before
    return [
      ...before,
      this.options.deliveredVps ?? "vps-ola1.ovh.net",
      ...(this.options.appearsAfterCheckout ?? []),
    ]
  }

  async getVps(serviceName: string): Promise<VpsSummary> {
    this.record("getVps")
    const spec = this.options.vpsSpecs?.[serviceName]
    const model = spec
      ? {
          ...MOCK_MODEL,
          name: spec.model ?? MOCK_MODEL.name,
          vcore: spec.vcore,
          memory: spec.memory,
        }
      : MOCK_MODEL
    return {
      name: serviceName,
      displayName: null,
      state: this.options.vpsState ?? "running",
      model,
      vcore: model.vcore,
      memoryLimit: model.memory,
      netbootMode: "local",
      zone: spec?.zone ?? "gra",
      zoneType: "region",
      offerType: "classic",
      cluster: null,
      slaMonitoring: false,
      lockStatus: null,
      monitoringIpBlocks: [],
    }
  }

  async getVpsIps(): Promise<readonly IpAddress[]> {
    this.record("getVpsIps")
    return [
      { address: "203.0.113.10", version: 4, isBlock: false },
      { address: "2001:db8::1", version: 6, isBlock: false },
    ]
  }

  async getServiceInfos(serviceName: string): Promise<ServiceInfos> {
    this.record("getServiceInfos")
    return {
      serviceId: 1,
      domain: serviceName,
      status: "ok",
      creation: new Date("2026-11-01T00:00:00.000Z"),
      expiration: new Date("2026-12-01T00:00:00.000Z"),
      engagedUpTo: null,
      renewalType: "automaticV2016",
      renew: {
        automatic: true,
        deleteAtExpiration: false,
        forced: false,
        manualPayment: false,
        period: 1,
      },
      canDeleteAtExpiration: true,
      possibleRenewPeriod: [1, 12],
      contactAdmin: null,
      contactBilling: null,
      contactTech: null,
      ...this.options.serviceInfos,
    }
  }

  async updateServiceInfos(): Promise<void> {
    this.record("updateServiceInfos")
  }

  async start(): Promise<VpsTask> {
    this.record("start")
    return { id: 1, state: "todo", type: "startVm", progress: 0, date: new Date() }
  }

  async stop(): Promise<VpsTask> {
    this.record("stop")
    return { id: 2, state: "todo", type: "stopVm", progress: 0, date: new Date() }
  }

  async getCurrentImage(): Promise<Image> {
    this.record("getCurrentImage")
    return this.options.currentImage ?? { id: "img-debian-12", name: "Debian 12" }
  }

  async rebuild(): Promise<VpsTask> {
    this.record("rebuild")
    return { id: 3, state: "todo", type: "reinstallVm", progress: 0, date: new Date() }
  }

  async getTask(): Promise<VpsTask> {
    this.record("getTask")
    return { id: 3, state: "done", type: "reinstallVm", progress: 100, date: new Date() }
  }
}

/* -------------------------------------------------------------------------- */
/* WHMCS stub                                                                 */
/* -------------------------------------------------------------------------- */

export interface MockWhmcsOptions {
  existingClientId?: number
  existingServices?: readonly WhmcsService[]
}

export class MockWhmcsJobs implements WhmcsJobs {
  readonly calls: string[] = []
  private readonly options: MockWhmcsOptions

  constructor(options: MockWhmcsOptions = {}) {
    this.options = options
  }

  countOf(call: string): number {
    return this.calls.filter((entry) => entry === call).length
  }

  private record(call: string): void {
    this.calls.push(call)
  }

  async findClientByEmail(email: string): Promise<WhmcsClientAccount | null> {
    this.record("findClientByEmail")
    if (!this.options.existingClientId) return null
    return {
      clientId: this.options.existingClientId,
      email,
      firstName: "Cliente",
      lastName: "SL",
      companyName: "Cliente SL",
      address1: "Calle Mayor 1",
      city: "Madrid",
      postcode: "28001",
      state: null,
      country: "ES",
      phoneNumber: null,
      taxId: null,
      currencyCode: "EUR",
      status: "Active",
    }
  }

  async createClient(): Promise<{ clientId: number }> {
    this.record("createClient")
    return { clientId: 5001 }
  }

  async createOrder(): Promise<{ orderId: number; invoiceId: number }> {
    this.record("createOrder")
    return { orderId: 7001, invoiceId: 8001 }
  }

  async acceptOrder(): Promise<void> {
    this.record("acceptOrder")
  }

  async recordPayment(): Promise<void> {
    this.record("recordPayment")
  }

  async createInvoice(): Promise<{ invoiceId: number }> {
    this.record("createInvoice")
    return { invoiceId: 8002 }
  }

  async getInvoice(invoiceId: number): Promise<WhmcsInvoiceDetail> {
    this.record("getInvoice")
    return {
      invoiceId,
      invoiceNumber: `F-${invoiceId}`,
      clientId: this.options.existingClientId ?? 5001,
      status: "Unpaid",
      domainStatus: "unpaid",
      date: null,
      dueDate: null,
      datePaid: null,
      subtotalCents: 799,
      taxCents: 168,
      creditCents: 0,
      totalCents: 967,
      balanceCents: 967,
      currencyCode: "EUR",
      paymentMethod: "stripe",
      notes: null,
      items: [],
    }
  }

  async listInvoices(): Promise<[]> {
    this.record("listInvoices")
    return []
  }

  async updateService(): Promise<void> {
    this.record("updateService")
  }

  async listServices(): Promise<WhmcsService[]> {
    this.record("listServices")
    return [...(this.options.existingServices ?? [])]
  }
}

/* -------------------------------------------------------------------------- */
/* deps                                                                       */
/* -------------------------------------------------------------------------- */

export interface Recorded {
  emails: { template: EmailMessage["template"]; to: string; props: Record<string, unknown> }[]
  alerts: AlertInput[]
  audits: { entity: string; action: string; entityId?: string | null }[]
  events: { name: string; data: Record<string, unknown> }[]
  passwords: { serviceId: string; password: string }[]
}

export interface TestDeps {
  deps: JobDeps
  recorded: Recorded
  fake: FakeDb
  ovh: MockOvhJobs
  whmcs: MockWhmcsJobs
}

export function createTestDeps(options: {
  fake?: FakeDb
  ovh?: MockOvhJobs
  whmcs?: MockWhmcsJobs
  now?: Date
  ordersEnabled?: boolean
} = {}): TestDeps {
  const fake = options.fake ?? createFakeDb()
  const ovh = options.ovh ?? new MockOvhJobs()
  const whmcs = options.whmcs ?? new MockWhmcsJobs()
  const recorded: Recorded = { emails: [], alerts: [], audits: [], events: [], passwords: [] }

  const deps: JobDeps = {
    db: fake.db,
    ovh: () => ovh,
    whmcs: () => whmcs,
    email: {
      async send(input) {
        recorded.emails.push({
          template: input.message.template,
          to: input.to,
          props: { ...input.message.props },
        })
      },
    },
    audit: {
      async record(entry) {
        recorded.audits.push({
          entity: entry.entity,
          action: entry.action,
          entityId: entry.entityId ?? null,
        })
        // The real `recordAudit` writes a row, and `countAuditActions` reads it back: the
        // checkout marker only works if the fake does the same.
        fake.state.auditActions.push({
          entity: entry.entity,
          entityId: entry.entityId ?? null,
          action: entry.action,
          ...(entry.diff ? { diff: entry.diff } : {}),
        })
      },
    },
    alerts: {
      async raise(input) {
        recorded.alerts.push(input)
      },
    },
    events: {
      async send(name, data) {
        recorded.events.push({ name, data: data as unknown as Record<string, unknown> })
      },
    },
    log: () => ({
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    }),
    assertOvhOrdersEnabled: () => {
      if (options.ordersEnabled === false) throw new Error("OVH_ORDERS_ENABLED is false")
    },
    ovhSubsidiary: "ES",
    customerAreaUrl: "https://oladc.com/app",
    adminUrl: "https://oladc.com/admin",
    now: () => options.now ?? new Date("2026-11-06T09:00:00.000Z"),
    generatePassword: () => "test-password-0000",
    storeRootPasswordOnce: async (serviceId, password) => {
      recorded.passwords.push({ serviceId, password })
    },
  }

  return { deps, recorded, fake, ovh, whmcs }
}

/* -------------------------------------------------------------------------- */
/* builders                                                                   */
/* -------------------------------------------------------------------------- */

export function makeCustomer(overrides: Partial<CustomerRecord> = {}): CustomerRecord {
  return {
    id: "cus_1",
    userId: "usr_1",
    email: "cliente@example.com",
    kind: "company",
    legalName: "Cliente SL",
    taxId: "ESB12345678",
    taxIdValidated: true,
    addressLine1: "Calle Mayor 1",
    addressLine2: null,
    city: "Madrid",
    postalCode: "28001",
    country: "ES",
    phone: "+34600000000",
    whmcsClientId: null,
    stripeCustomerId: "cus_stripe",
    status: "verified",
    ...overrides,
  }
}

export function makePlan(overrides: Partial<PlanRecord> = {}): PlanRecord {
  return {
    id: "pln_1",
    ovhPlanCode: "vps-2027-model1",
    slug: "s",
    name: "OLA VPS S",
    costMonth: 449,
    cost12m: 381,
    trueCostMonth: 484,
    trueCost12m: 416,
    priceMonth: 799,
    price12m: 699,
    margin: 7500,
    active: true,
    ...overrides,
  }
}

export function makeOrder(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    id: "ord_1",
    customerId: "cus_1",
    kind: "new",
    status: "paid",
    serviceId: null,
    items: {
      planCode: "vps-2027-model1",
      datacenter: "GRA",
      operatingSystem: "Debian 12",
      addonCodes: ["option-linux", "option-auto-backup-2027-1-model1"],
      displayName: "web-1",
      monthlyPrice: 799,
      whmcs: { productId: 12, configOptions: { "31": "101" }, customFields: {} },
    },
    term: "P1M",
    subtotal: 799,
    tax: 168,
    creditApplied: 0,
    total: 967,
    expectedCost: 484,
    stripePaymentIntentId: "pi_123",
    whmcsOrderId: null,
    whmcsInvoiceId: null,
    ovhCartId: null,
    ovhOrderId: null,
    completedSteps: [],
    error: null,
    errorCode: null,
    paidAt: new Date("2026-11-06T08:55:00.000Z"),
    deliveredAt: null,
    ...overrides,
  }
}

export function makeService(overrides: Partial<ServiceRecord> = {}): ServiceRecord {
  return {
    id: "svc_1",
    customerId: "cus_1",
    planId: "pln_1",
    orderId: "ord_1",
    displayName: "web-1",
    ovhServiceName: "vps-ola1.ovh.net",
    datacenter: "GRA",
    os: "Debian 12",
    ipv4: "203.0.113.10",
    ipv6: "2001:db8::1",
    status: "active",
    term: "P1M",
    monthlyPrice: 799,
    nextDueAt: new Date("2026-12-01T00:00:00.000Z"),
    autoRenew: true,
    dunningStage: "scheduled",
    dunningCompleted: [],
    whmcsServiceId: 9001,
    ovhExpiresAt: new Date("2026-12-01T00:00:00.000Z"),
    suspendedAt: null,
    terminatedAt: null,
    lastSyncedAt: null,
    ...overrides,
  }
}

export const ALL_WHMCS_STEPS: readonly ProvisionStep[] = [
  "whmcs_client",
  "whmcs_order",
  "whmcs_invoice",
  "whmcs_payment",
]

export const DUNNING_STAGE_LIST: readonly DunningStage[] = ["invoiced", "charging"]
