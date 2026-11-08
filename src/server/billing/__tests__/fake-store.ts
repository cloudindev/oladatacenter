/**
 * In-memory `BillingStore`.
 *
 * Mirrors the Drizzle implementation's observable behaviour, including the two things the
 * tests actually depend on: `recordWebhookEvent` is unique on (provider, eventId), and
 * `consumeCredit` can never hand out more than a customer has.
 */
import type { CreditReason } from "@ola/core"

import type {
  BillingCustomer,
  BillingService,
  BillingStore,
  CreditRecord,
  InvoicePatch,
  InvoiceRecord,
  NewCredit,
  NewInvoice,
  NewOrder,
  NewPayment,
  NewPaymentMethod,
  OrderPatch,
  OrderRecord,
  PaymentMethodRecord,
  PaymentPatch,
  PaymentRecord,
  WebhookRecordResult,
  WelcomeGrant,
} from "../data"

let sequence = 0
function nextId(prefix: string): string {
  sequence += 1
  return `${prefix}_${String(sequence).padStart(6, "0")}`
}

export interface FakeStoreSeed {
  customers?: BillingCustomer[]
  services?: BillingService[]
  paymentMethods?: PaymentMethodRecord[]
  credits?: CreditRecord[]
  invoices?: InvoiceRecord[]
  orders?: OrderRecord[]
  /** The clock the store reads; the harness pins it so expiry tests do not depend on today. */
  now?: () => Date
}

export class FakeBillingStore implements BillingStore {
  readonly customers = new Map<string, BillingCustomer>()
  readonly services = new Map<string, BillingService>()
  readonly paymentMethods: PaymentMethodRecord[] = []
  readonly credits: CreditRecord[] = []
  readonly orders = new Map<string, OrderRecord>()
  readonly payments: PaymentRecord[] = []
  readonly invoices: InvoiceRecord[] = []
  readonly webhooks: {
    provider: string
    eventId: string
    eventType: string
    processedAt: Date | null
    error: string | null
  }[] = []

  private readonly clock: () => Date

  constructor(seed: FakeStoreSeed = {}) {
    this.clock = seed.now ?? (() => new Date())
    for (const customer of seed.customers ?? []) this.customers.set(customer.id, customer)
    for (const service of seed.services ?? []) this.services.set(service.id, service)
    this.paymentMethods.push(...(seed.paymentMethods ?? []))
    this.credits.push(...(seed.credits ?? []))
    this.invoices.push(...(seed.invoices ?? []))
    for (const order of seed.orders ?? []) this.orders.set(order.id, order)
  }

  // ─── customers ───────────────────────────────────────────────────────────
  async getCustomer(customerId: string): Promise<BillingCustomer | null> {
    return this.customers.get(customerId) ?? null
  }

  async findCustomerByStripeId(stripeCustomerId: string): Promise<BillingCustomer | null> {
    for (const customer of this.customers.values()) {
      if (customer.stripeCustomerId === stripeCustomerId) return customer
    }
    return null
  }

  async setStripeCustomerId(customerId: string, stripeCustomerId: string): Promise<void> {
    const customer = this.customers.get(customerId)
    if (customer) this.customers.set(customerId, { ...customer, stripeCustomerId })
  }

  async setFirstPaidAt(customerId: string, at: Date): Promise<boolean> {
    const customer = this.customers.get(customerId)
    if (!customer || customer.firstPaidAt !== null) return false
    this.customers.set(customerId, { ...customer, firstPaidAt: at })
    return true
  }

  async flagCustomerForReview(customerId: string, note: string): Promise<void> {
    const customer = this.customers.get(customerId)
    if (customer) this.customers.set(customerId, { ...customer, status: "review" })
    this.reviewNotes.push({ customerId, note })
  }

  readonly reviewNotes: { customerId: string; note: string }[] = []

  // ─── services ────────────────────────────────────────────────────────────
  async countActiveServices(customerId: string): Promise<number> {
    const live = new Set(["provisioning", "active", "stopped", "suspended", "review"])
    return [...this.services.values()].filter(
      (service) => service.customerId === customerId && live.has(service.status),
    ).length
  }

  async getService(serviceId: string): Promise<BillingService | null> {
    return this.services.get(serviceId) ?? null
  }

  // ─── payment methods ─────────────────────────────────────────────────────
  async listPaymentMethods(customerId: string): Promise<PaymentMethodRecord[]> {
    return this.paymentMethods
      .filter((method) => method.customerId === customerId && method.detachedAt === null)
      .sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
  }

  async findPaymentMethodByStripeId(id: string): Promise<PaymentMethodRecord | null> {
    return this.paymentMethods.find((method) => method.stripePaymentMethodId === id) ?? null
  }

  async insertPaymentMethod(input: NewPaymentMethod): Promise<PaymentMethodRecord> {
    const record: PaymentMethodRecord = {
      id: nextId("pm"),
      createdAt: new Date(),
      detachedAt: null,
      ...input,
    }
    this.paymentMethods.push(record)
    if (record.isDefault) await this.setDefaultPaymentMethod(record.customerId, record.id)
    return record
  }

  async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    for (let index = 0; index < this.paymentMethods.length; index += 1) {
      const method = this.paymentMethods[index]
      if (!method || method.customerId !== customerId) continue
      this.paymentMethods[index] = { ...method, isDefault: method.id === paymentMethodId }
    }
  }

  async markPaymentMethodDetached(paymentMethodId: string, at: Date): Promise<void> {
    const index = this.paymentMethods.findIndex((method) => method.id === paymentMethodId)
    const method = this.paymentMethods[index]
    if (method) {
      this.paymentMethods[index] = { ...method, detachedAt: at, isDefault: false }
    }
  }

  // ─── credit ──────────────────────────────────────────────────────────────
  async listCredits(customerId: string): Promise<CreditRecord[]> {
    return this.credits
      .filter((credit) => credit.customerId === customerId)
      .sort((a, b) => (a.expiresAt?.getTime() ?? Infinity) - (b.expiresAt?.getTime() ?? Infinity))
  }

  async insertCredit(input: NewCredit): Promise<CreditRecord> {
    const record: CreditRecord = {
      id: nextId("cr"),
      consumed: 0,
      createdAt: new Date(),
      ...input,
    }
    this.credits.push(record)
    return record
  }

  async countCreditsByReason(customerId: string, reason: CreditReason): Promise<number> {
    return this.credits.filter(
      (credit) => credit.customerId === customerId && credit.reason === reason,
    ).length
  }

  async listWelcomeGrants(since: Date): Promise<WelcomeGrant[]> {
    return this.credits
      .filter(
        (credit) => credit.reason === "welcome" && credit.createdAt.getTime() >= since.getTime(),
      )
      .map((credit) => ({
        customerId: credit.customerId,
        grantedAt: credit.createdAt,
        signals: credit.signals,
      }))
  }

  async consumeCredit(customerId: string, amount: number, orderId: string): Promise<number> {
    if (amount <= 0) return 0
    let remaining = amount
    let taken = 0
    const now = this.clock()

    for (const credit of await this.listCredits(customerId)) {
      if (remaining <= 0) break
      if (credit.expiresAt && credit.expiresAt.getTime() <= now.getTime()) continue
      const usable = Math.min(remaining, credit.amount - credit.consumed)
      if (usable <= 0) continue
      const index = this.credits.findIndex((entry) => entry.id === credit.id)
      const entry = this.credits[index]
      if (!entry) continue
      this.credits[index] = {
        ...entry,
        consumed: entry.consumed + usable,
        note: `${entry.note ? `${entry.note}; ` : ""}order:${orderId}`,
      }
      remaining -= usable
      taken += usable
    }
    return taken
  }

  // ─── orders ──────────────────────────────────────────────────────────────
  async insertOrder(input: NewOrder): Promise<OrderRecord> {
    if ([...this.orders.values()].some((o) => o.idempotencyKey === input.idempotencyKey)) {
      throw new Error(`duplicate idempotency key ${input.idempotencyKey}`)
    }
    const now = new Date()
    const record: OrderRecord = {
      id: nextId("ord"),
      stripePaymentIntentId: null,
      whmcsOrderId: null,
      whmcsInvoiceId: null,
      error: null,
      errorCode: null,
      paidAt: null,
      deliveredAt: null,
      createdAt: now,
      updatedAt: now,
      completedSteps: input.completedSteps ?? [],
      ...input,
    }
    this.orders.set(record.id, record)
    return record
  }

  async getOrder(orderId: string): Promise<OrderRecord | null> {
    return this.orders.get(orderId) ?? null
  }

  async findOrderByIdempotencyKey(key: string): Promise<OrderRecord | null> {
    return [...this.orders.values()].find((order) => order.idempotencyKey === key) ?? null
  }

  async findOrderByPaymentIntent(paymentIntentId: string): Promise<OrderRecord | null> {
    return (
      [...this.orders.values()].find(
        (order) => order.stripePaymentIntentId === paymentIntentId,
      ) ?? null
    )
  }

  async updateOrder(orderId: string, patch: OrderPatch): Promise<OrderRecord> {
    const order = this.orders.get(orderId)
    if (!order) throw new Error(`order ${orderId} does not exist`)
    const updated: OrderRecord = { ...order, ...patch, updatedAt: new Date() }
    this.orders.set(orderId, updated)
    return updated
  }

  async listOrders(customerId: string, limit = 20): Promise<OrderRecord[]> {
    return [...this.orders.values()]
      .filter((order) => order.customerId === customerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
  }

  // ─── payments ────────────────────────────────────────────────────────────
  async insertPayment(input: NewPayment): Promise<PaymentRecord> {
    const record: PaymentRecord = {
      id: nextId("pay"),
      refundedAmount: 0,
      createdAt: new Date(),
      ...input,
    }
    this.payments.push(record)
    return record
  }

  async findPaymentByPaymentIntent(paymentIntentId: string): Promise<PaymentRecord | null> {
    return (
      this.payments.find((payment) => payment.stripePaymentIntentId === paymentIntentId) ?? null
    )
  }

  async updatePayment(paymentId: string, patch: PaymentPatch): Promise<PaymentRecord> {
    const index = this.payments.findIndex((payment) => payment.id === paymentId)
    const payment = this.payments[index]
    if (!payment) throw new Error(`payment ${paymentId} does not exist`)
    const updated: PaymentRecord = { ...payment, ...patch }
    this.payments[index] = updated
    return updated
  }

  async countSettledPayments(customerId: string): Promise<number> {
    return this.payments.filter(
      (payment) =>
        payment.customerId === customerId && payment.status === "succeeded" && payment.amount > 0,
    ).length
  }

  // ─── invoices ────────────────────────────────────────────────────────────
  async insertInvoice(input: NewInvoice): Promise<InvoiceRecord> {
    const record: InvoiceRecord = { id: nextId("inv"), createdAt: new Date(), ...input }
    this.invoices.push(record)
    return record
  }

  async listInvoices(customerId: string): Promise<InvoiceRecord[]> {
    return this.invoices
      .filter((invoice) => invoice.customerId === customerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  async findInvoiceByWhmcsId(whmcsInvoiceId: number): Promise<InvoiceRecord | null> {
    return this.invoices.find((invoice) => invoice.whmcsInvoiceId === whmcsInvoiceId) ?? null
  }

  async findUnpaidInvoiceForService(serviceId: string): Promise<InvoiceRecord | null> {
    return (
      this.invoices.find(
        (invoice) => invoice.serviceId === serviceId && invoice.status === "unpaid",
      ) ?? null
    )
  }

  async updateInvoice(invoiceId: string, patch: InvoicePatch): Promise<InvoiceRecord> {
    const index = this.invoices.findIndex((invoice) => invoice.id === invoiceId)
    const invoice = this.invoices[index]
    if (!invoice) throw new Error(`invoice ${invoiceId} does not exist`)
    const updated: InvoiceRecord = { ...invoice, ...patch }
    this.invoices[index] = updated
    return updated
  }

  // ─── webhooks ────────────────────────────────────────────────────────────
  async recordWebhookEvent(input: {
    provider: "stripe" | "whmcs"
    eventId: string
    eventType: string
    payload: Record<string, unknown>
  }): Promise<WebhookRecordResult> {
    const existing = this.webhooks.find(
      (row) => row.provider === input.provider && row.eventId === input.eventId,
    )
    if (existing) return { fresh: false, id: existing.eventId }
    this.webhooks.push({
      provider: input.provider,
      eventId: input.eventId,
      eventType: input.eventType,
      processedAt: null,
      error: null,
    })
    return { fresh: true, id: input.eventId }
  }

  async markWebhookProcessed(provider: "stripe" | "whmcs", eventId: string): Promise<void> {
    const row = this.webhooks.find((item) => item.provider === provider && item.eventId === eventId)
    if (row) {
      row.processedAt = new Date()
      row.error = null
    }
  }

  async markWebhookFailed(
    provider: "stripe" | "whmcs",
    eventId: string,
    error: string,
  ): Promise<void> {
    const row = this.webhooks.find((item) => item.provider === provider && item.eventId === eventId)
    if (row) row.error = error
  }
}
