import { WhmcsApiError, writesDisabledError } from "./errors"
import { whmcsInvoiceStatusToDomain, type WhmcsInvoiceItem } from "./types"
import type {
  CreateClientInput,
  CreateInvoiceInput,
  CreateOrderInput,
  CreateSsoTokenOptions,
  ListInvoicesFilter,
  RecordPaymentInput,
  UpdateClientInput,
  UpdateServiceInput,
  WhmcsClient,
  WhmcsClientAccount,
  WhmcsInvoiceDetail,
  WhmcsInvoiceSummary,
  WhmcsService,
  WhmcsDomain,
  WhmcsSsoDestination,
} from "./client"

/**
 * In-memory WHMCS used by `USE_MOCK_PROVIDERS=true`, by the tests and by local development.
 *
 * It is deterministic on purpose: ids auto-increment from fixed bases and the clock is
 * injectable, so a test can assert exact values. It models the few WHMCS behaviours we rely
 * on — duplicate email refused, duplicate transaction id refused, an order carrying its own
 * invoice — and nothing else.
 */

const FIRST_CLIENT_ID = 1001
const FIRST_ORDER_ID = 2001
const FIRST_INVOICE_ID = 3001
const FIRST_SERVICE_ID = 4001

/** Used when an order does not carry a price override, so invoices are never zero by accident. */
export const MOCK_DEFAULT_PRICE_CENTS = 1000

const MOCK_EPOCH = new Date("2026-01-01T09:00:00.000Z")

export interface MockWhmcsClientOptions {
  /** Defaults to true: the mock never touches a real book of record. */
  writeEnabled?: boolean
  now?: () => Date
}

export interface MockOrder {
  orderId: number
  clientId: number
  pid: number
  billingCycle: string
  invoiceId: number
  serviceId: number
  status: "Pending" | "Active" | "Cancelled"
  configOptions: Readonly<Record<string, string | number>>
  customFields: Readonly<Record<string, string | number>>
}

export interface MockInvoice {
  invoiceId: number
  clientId: number
  status: string
  date: string
  dueDate: string
  datePaid: string | null
  subtotalCents: number
  taxCents: number
  creditCents: number
  totalCents: number
  paidCents: number
  paymentMethod: string
  notes: string | null
  items: WhmcsInvoiceItem[]
}

export class MockWhmcsClient implements WhmcsClient {
  private readonly writeEnabled: boolean
  private readonly now: () => Date

  private clients = new Map<number, WhmcsClientAccount>()
  private orders = new Map<number, MockOrder>()
  private invoices = new Map<number, MockInvoice>()
  private services = new Map<number, WhmcsService>()
  private transactionIds = new Set<string>()

  private nextClientId = FIRST_CLIENT_ID
  private nextOrderId = FIRST_ORDER_ID
  private nextInvoiceId = FIRST_INVOICE_ID
  private nextServiceId = FIRST_SERVICE_ID
  private nextItemId = 1
  private ssoTokenCount = 0

  private queuedFailures: unknown[] = []

  constructor(options: MockWhmcsClientOptions = {}) {
    this.writeEnabled = options.writeEnabled ?? true
    this.now = options.now ?? (() => MOCK_EPOCH)
  }

  // ── test helpers ──────────────────────────────────────────────────────────

  /** The next call — any method — rejects with `error`. Queue several to fail in sequence. */
  failNextCall(error: unknown): void {
    this.queuedFailures.push(error)
  }

  /** Back to a pristine WHMCS: no clients, no orders, ids from their original bases. */
  reset(): void {
    this.clients = new Map()
    this.orders = new Map()
    this.invoices = new Map()
    this.services = new Map()
    this.transactionIds = new Set()
    this.nextClientId = FIRST_CLIENT_ID
    this.nextOrderId = FIRST_ORDER_ID
    this.nextInvoiceId = FIRST_INVOICE_ID
    this.nextServiceId = FIRST_SERVICE_ID
    this.nextItemId = 1
    this.ssoTokenCount = 0
    this.queuedFailures = []
  }

  /** Read-only view of the whole book, for assertions in tests. */
  snapshot(): {
    clients: WhmcsClientAccount[]
    orders: MockOrder[]
    invoices: MockInvoice[]
    services: WhmcsService[]
  } {
    return {
      clients: [...this.clients.values()],
      orders: [...this.orders.values()],
      invoices: [...this.invoices.values()],
      services: [...this.services.values()],
    }
  }

  // ── clients ───────────────────────────────────────────────────────────────

  async findClientByEmail(email: string): Promise<WhmcsClientAccount | null> {
    this.guard("GetClients")
    return this.lookupByEmail(email)
  }

  async createClient(input: CreateClientInput): Promise<{ clientId: number }> {
    this.guard("AddClient", { write: true })
    // Deliberately not `findClientByEmail`: an internal lookup must not consume a queued failure.
    if (this.lookupByEmail(input.email)) {
      throw new WhmcsApiError("A client already exists with that email address", {
        action: "AddClient",
        kind: "api_error",
        httpStatus: 200,
      })
    }
    const clientId = this.nextClientId++
    this.clients.set(clientId, {
      clientId,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      companyName: input.companyName ?? null,
      address1: input.address1,
      city: input.city,
      postcode: input.postcode,
      state: input.state ?? null,
      country: input.country,
      phoneNumber: input.phoneNumber ?? null,
      taxId: input.taxId ?? null,
      currencyCode: input.currencyCode ?? "EUR",
      status: "Active",
    })
    return { clientId }
  }

  async updateClient(clientId: number, input: UpdateClientInput): Promise<void> {
    this.guard("UpdateClient", { write: true })
    const client = this.clients.get(clientId)
    if (!client) throw notFound("UpdateClient", `Client ID ${clientId} not found`)
    this.clients.set(clientId, {
      ...client,
      email: input.email ?? client.email,
      firstName: input.firstName ?? client.firstName,
      lastName: input.lastName ?? client.lastName,
      companyName: input.companyName ?? client.companyName,
      address1: input.address1 ?? client.address1,
      city: input.city ?? client.city,
      postcode: input.postcode ?? client.postcode,
      state: input.state ?? client.state,
      country: input.country ?? client.country,
      phoneNumber: input.phoneNumber ?? client.phoneNumber,
      taxId: input.taxId ?? client.taxId,
      currencyCode: input.currencyCode ?? client.currencyCode,
      status: input.status ?? client.status,
    })
  }

  // ── orders ────────────────────────────────────────────────────────────────

  async createOrder(input: CreateOrderInput): Promise<{ orderId: number; invoiceId: number }> {
    this.guard("AddOrder", { write: true })
    if (!this.clients.has(input.clientId)) {
      throw notFound("AddOrder", `Client ID ${input.clientId} not found`)
    }
    const orderId = this.nextOrderId++
    const serviceId = this.nextServiceId++
    const amount = input.priceOverrideCents ?? MOCK_DEFAULT_PRICE_CENTS
    const invoice = this.newInvoice({
      clientId: input.clientId,
      paymentMethod: input.paymentmethod,
      lines: [{ description: `OLA VPS (pid ${input.pid})`, amount, taxed: true }],
      status: "Unpaid",
      relatedServiceId: serviceId,
    })

    this.orders.set(orderId, {
      orderId,
      clientId: input.clientId,
      pid: input.pid,
      billingCycle: input.billingcycle,
      invoiceId: invoice.invoiceId,
      serviceId,
      status: "Pending",
      configOptions: { ...(input.configoptions ?? {}) },
      customFields: { ...(input.customfields ?? {}) },
    })

    this.services.set(serviceId, {
      serviceId,
      clientId: input.clientId,
      orderId,
      pid: input.pid,
      groupName: "OLA VPS",
      ips: [],
      productName: `OLA VPS (pid ${input.pid})`,
      domain: input.domain ?? null,
      status: "Pending",
      registrationDate: formatDate(this.now()),
      nextDueDate: formatDate(this.addMonths(this.now(), input.billingcycle === "annually" ? 12 : 1)),
      billingCycle: input.billingcycle === "annually" ? "Annually" : "Monthly",
      recurringAmountCents: amount,
      paymentMethod: input.paymentmethod,
    })

    return { orderId, invoiceId: invoice.invoiceId }
  }

  async acceptOrder(orderId: number): Promise<void> {
    this.guard("AcceptOrder", { write: true })
    const order = this.orders.get(orderId)
    if (!order) throw notFound("AcceptOrder", `Order ID ${orderId} not found`)
    if (order.status === "Active") {
      throw new WhmcsApiError("Order has already been accepted", {
        action: "AcceptOrder",
        kind: "api_error",
        httpStatus: 200,
      })
    }
    order.status = "Active"
    const service = this.services.get(order.serviceId)
    if (service) service.status = "Active"
  }

  // ── invoices and payments ─────────────────────────────────────────────────

  async recordPayment(input: RecordPaymentInput): Promise<void> {
    this.guard("AddInvoicePayment", { write: true })
    const invoice = this.invoices.get(input.invoiceId)
    if (!invoice) throw notFound("AddInvoicePayment", `Invoice ID ${input.invoiceId} not found`)
    if (this.transactionIds.has(input.transactionId)) {
      // WHMCS refuses a duplicate transaction id; that refusal is our idempotency guarantee.
      throw new WhmcsApiError("A transaction with that ID already exists", {
        action: "AddInvoicePayment",
        kind: "api_error",
        httpStatus: 200,
      })
    }
    this.transactionIds.add(input.transactionId)
    invoice.paidCents += input.amount
    if (invoice.paidCents >= invoice.totalCents) {
      invoice.status = "Paid"
      invoice.datePaid = formatDateTime(input.date)
    }
  }

  async createInvoice(input: CreateInvoiceInput): Promise<{ invoiceId: number }> {
    this.guard("CreateInvoice", { write: true })
    if (!this.clients.has(input.clientId)) {
      throw notFound("CreateInvoice", `Client ID ${input.clientId} not found`)
    }
    const invoice = this.newInvoice({
      clientId: input.clientId,
      paymentMethod: input.paymentMethod,
      lines: input.lines,
      status: input.status ?? "Unpaid",
      taxRate: input.taxRate,
      notes: input.notes,
    })
    return { invoiceId: invoice.invoiceId }
  }

  async getInvoice(invoiceId: number): Promise<WhmcsInvoiceDetail> {
    this.guard("GetInvoice")
    const invoice = this.invoices.get(invoiceId)
    if (!invoice) throw notFound("GetInvoice", `Invoice ID ${invoiceId} not found`)
    return { ...toSummary(invoice), notes: invoice.notes, items: invoice.items.map((i) => ({ ...i })) }
  }

  async listInvoices(filter: ListInvoicesFilter): Promise<WhmcsInvoiceSummary[]> {
    this.guard("GetInvoices")
    return [...this.invoices.values()]
      .filter((invoice) => invoice.clientId === filter.clientId)
      .filter((invoice) => filter.status === undefined || invoice.status === filter.status)
      .sort((a, b) => b.invoiceId - a.invoiceId)
      .map(toSummary)
  }

  // ── services ──────────────────────────────────────────────────────────────

  async updateService(input: UpdateServiceInput): Promise<void> {
    this.guard("UpdateClientProduct", { write: true })
    const service = this.services.get(input.serviceId)
    if (!service) throw notFound("UpdateClientProduct", `Service ID ${input.serviceId} not found`)
    if (input.status !== undefined) service.status = input.status
    if (input.nextDueDate !== undefined) service.nextDueDate = formatDate(input.nextDueDate)
  }

  /** Test seam: domains per client. Empty unless a test adds some. */
  private domains = new Map<number, WhmcsDomain[]>()

  setDomains(clientId: number, domains: WhmcsDomain[]): void {
    this.domains.set(clientId, domains.map((domain) => ({ ...domain })))
  }

  async listDomains(clientId: number): Promise<WhmcsDomain[]> {
    this.guard("GetClientsDomains")
    return (this.domains.get(clientId) ?? []).map((domain) => ({ ...domain }))
  }

  async listServices(clientId: number): Promise<WhmcsService[]> {
    this.guard("GetClientsProducts")
    return [...this.services.values()]
      .filter((service) => service.clientId === clientId)
      .sort((a, b) => a.serviceId - b.serviceId)
      .map((service) => ({ ...service }))
  }

  // ── single sign-on ────────────────────────────────────────────────────────

  async createSsoToken(
    clientId: number,
    destination: WhmcsSsoDestination,
    options: CreateSsoTokenOptions = {},
  ): Promise<{ redirectUrl: string }> {
    this.guard("CreateSsoToken", { write: true })
    if (!this.clients.has(clientId)) {
      throw notFound("CreateSsoToken", `Client ID ${clientId} not found`)
    }
    this.ssoTokenCount += 1
    const token = `mock-sso-${clientId}-${this.ssoTokenCount}`
    const path = options.redirectPath ?? destination
    return {
      redirectUrl: `https://whmcs.test/dologin.php?token=${token}&destination=${encodeURIComponent(path)}`,
    }
  }

  // ── plumbing ──────────────────────────────────────────────────────────────

  private lookupByEmail(email: string): WhmcsClientAccount | null {
    const wanted = email.trim().toLowerCase()
    for (const client of this.clients.values()) {
      if (client.email.trim().toLowerCase() === wanted) return { ...client }
    }
    return null
  }

  private guard(action: string, options: { write?: boolean } = {}): void {
    const failure = this.queuedFailures.shift()
    if (failure !== undefined) throw failure
    if (options.write && !this.writeEnabled) throw writesDisabledError(action)
  }

  private newInvoice(input: {
    clientId: number
    paymentMethod: string
    lines: readonly { description: string; amount: number; taxed?: boolean }[]
    status: string
    taxRate?: number
    notes?: string
    relatedServiceId?: number
  }): MockInvoice {
    const invoiceId = this.nextInvoiceId++
    const items: WhmcsInvoiceItem[] = input.lines.map((line) => ({
      id: this.nextItemId++,
      type: input.relatedServiceId === undefined ? null : "Hosting",
      relid: input.relatedServiceId ?? null,
      description: line.description,
      amount: line.amount,
      taxed: line.taxed ?? false,
    }))
    const subtotalCents = items.reduce((sum, item) => sum + item.amount, 0)
    const taxableCents = items.reduce((sum, item) => sum + (item.taxed ? item.amount : 0), 0)
    const taxCents = Math.round((taxableCents * (input.taxRate ?? 0)) / 100)
    const now = this.now()
    const invoice: MockInvoice = {
      invoiceId,
      clientId: input.clientId,
      status: input.status,
      date: formatDate(now),
      dueDate: formatDate(now),
      datePaid: null,
      subtotalCents,
      taxCents,
      creditCents: 0,
      totalCents: subtotalCents + taxCents,
      paidCents: 0,
      paymentMethod: input.paymentMethod,
      notes: input.notes ?? null,
      items,
    }
    if (input.status === "Paid") {
      invoice.paidCents = invoice.totalCents
      invoice.datePaid = formatDateTime(now)
    }
    this.invoices.set(invoiceId, invoice)
    return invoice
  }

  private addMonths(date: Date, months: number): Date {
    const next = new Date(date.getTime())
    next.setUTCMonth(next.getUTCMonth() + months)
    return next
  }
}

function toSummary(invoice: MockInvoice): WhmcsInvoiceSummary {
  return {
    invoiceId: invoice.invoiceId,
    invoiceNumber: String(invoice.invoiceId),
    clientId: invoice.clientId,
    status: invoice.status,
    domainStatus: whmcsInvoiceStatusToDomain(invoice.status),
    date: invoice.date,
    dueDate: invoice.dueDate,
    datePaid: invoice.datePaid,
    subtotalCents: invoice.subtotalCents,
    taxCents: invoice.taxCents,
    creditCents: invoice.creditCents,
    totalCents: invoice.totalCents,
    balanceCents: Math.max(invoice.totalCents - invoice.paidCents, 0),
    currencyCode: "EUR",
    paymentMethod: invoice.paymentMethod,
  }
}

function notFound(action: string, message: string): WhmcsApiError {
  return new WhmcsApiError(message, { action, kind: "api_error", httpStatus: 200 })
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function formatDateTime(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ")
}
