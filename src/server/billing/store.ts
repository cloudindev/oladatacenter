import "server-only"
import { and, asc, count, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm"
import {
  credits,
  customers,
  db,
  invoices,
  orders,
  paymentMethods,
  payments,
  services,
  users,
  webhookEvents,
} from "@ola/db"
import type { Cents, CreditReason, OrderKind, OrderStatus, Term } from "@ola/core"

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
} from "./data"

/**
 * The Drizzle implementation of `BillingStore`.
 *
 * Isolated in its own module so the test suite can exercise every billing service without
 * importing the database driver at all.
 *
 * Note on atomicity: `consumeCredit` uses optimistic concurrency rather than a transaction,
 * so it holds no lock across the pooler — each row is updated conditionally on the
 * `consumed` value it was read with, and a lost race is retried. Two orders can never
 * spend the same cent.
 */

const CONSUME_RETRIES = 5

/** Statuses that still count as "the customer has a server". */
const LIVE_SERVICE_STATUSES = ["provisioning", "active", "stopped", "suspended", "review"] as const

function billingComplete(row: {
  addressLine1: string | null
  city: string | null
  postalCode: string | null
  country: string | null
}): boolean {
  return Boolean(row.addressLine1 && row.city && row.postalCode && row.country)
}

function missing(entity: string, id: string): Error {
  return new Error(`${entity} ${id} does not exist`)
}

export class DrizzleBillingStore implements BillingStore {
  // ─── customers ───────────────────────────────────────────────────────────
  async getCustomer(customerId: string): Promise<BillingCustomer | null> {
    const rows = await db()
      .select({
        id: customers.id,
        userId: customers.userId,
        email: users.email,
        emailVerifiedAt: users.emailVerifiedAt,
        kind: customers.kind,
        legalName: customers.legalName,
        country: customers.country,
        taxId: customers.taxId,
        taxIdValidated: customers.taxIdValidated,
        status: customers.status,
        phone: customers.phone,
        phoneVerifiedAt: customers.phoneVerifiedAt,
        whmcsClientId: customers.whmcsClientId,
        stripeCustomerId: customers.stripeCustomerId,
        firstPaidAt: customers.firstPaidAt,
        addressLine1: customers.addressLine1,
        city: customers.city,
        postalCode: customers.postalCode,
      })
      .from(customers)
      .innerJoin(users, eq(users.id, customers.userId))
      .where(eq(customers.id, customerId))
      .limit(1)

    const row = rows[0]
    if (!row) return null
    return {
      id: row.id,
      userId: row.userId,
      email: row.email,
      kind: row.kind,
      legalName: row.legalName,
      country: row.country,
      taxId: row.taxId,
      taxIdValidated: row.taxIdValidated,
      status: row.status,
      phone: row.phone,
      phoneVerifiedAt: row.phoneVerifiedAt,
      emailVerifiedAt: row.emailVerifiedAt,
      whmcsClientId: row.whmcsClientId,
      stripeCustomerId: row.stripeCustomerId,
      firstPaidAt: row.firstPaidAt,
      billingComplete: billingComplete({
        addressLine1: row.addressLine1,
        city: row.city,
        postalCode: row.postalCode,
        country: row.country,
      }),
    }
  }

  async findCustomerByStripeId(stripeCustomerId: string): Promise<BillingCustomer | null> {
    const rows = await db()
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.stripeCustomerId, stripeCustomerId))
      .limit(1)
    const row = rows[0]
    return row ? this.getCustomer(row.id) : null
  }

  async setStripeCustomerId(customerId: string, stripeCustomerId: string): Promise<void> {
    await db().update(customers).set({ stripeCustomerId }).where(eq(customers.id, customerId))
  }

  async setFirstPaidAt(customerId: string, at: Date): Promise<boolean> {
    const updated = await db()
      .update(customers)
      .set({ firstPaidAt: at })
      .where(and(eq(customers.id, customerId), isNull(customers.firstPaidAt)))
      .returning({ id: customers.id })
    return updated.length > 0
  }

  async flagCustomerForReview(customerId: string, note: string): Promise<void> {
    await db()
      .update(customers)
      .set({
        status: "review",
        riskNotes: sql`concat_ws(E'\n', ${customers.riskNotes}, ${note})`,
      })
      .where(eq(customers.id, customerId))
  }

  // ─── services ────────────────────────────────────────────────────────────
  async countActiveServices(customerId: string): Promise<number> {
    const rows = await db()
      .select({ value: count() })
      .from(services)
      .where(
        and(
          eq(services.customerId, customerId),
          inArray(services.status, [...LIVE_SERVICE_STATUSES]),
        ),
      )
    return rows[0]?.value ?? 0
  }

  async getService(serviceId: string): Promise<BillingService | null> {
    const rows = await db()
      .select({
        id: services.id,
        customerId: services.customerId,
        status: services.status,
        displayName: services.displayName,
        term: services.term,
        monthlyPrice: services.monthlyPrice,
        nextDueAt: services.nextDueAt,
        whmcsServiceId: services.whmcsServiceId,
      })
      .from(services)
      .where(eq(services.id, serviceId))
      .limit(1)
    return rows[0] ?? null
  }

  // ─── payment methods ─────────────────────────────────────────────────────
  async listPaymentMethods(customerId: string): Promise<PaymentMethodRecord[]> {
    return db()
      .select()
      .from(paymentMethods)
      .where(and(eq(paymentMethods.customerId, customerId), isNull(paymentMethods.detachedAt)))
      .orderBy(desc(paymentMethods.isDefault), desc(paymentMethods.createdAt))
  }

  async findPaymentMethodByStripeId(
    stripePaymentMethodId: string,
  ): Promise<PaymentMethodRecord | null> {
    const rows = await db()
      .select()
      .from(paymentMethods)
      .where(eq(paymentMethods.stripePaymentMethodId, stripePaymentMethodId))
      .limit(1)
    return rows[0] ?? null
  }

  async insertPaymentMethod(input: NewPaymentMethod): Promise<PaymentMethodRecord> {
    const inserted = await db().insert(paymentMethods).values(input).returning()
    const row = inserted[0]
    if (!row) throw new Error("failed to insert the payment method")
    if (input.isDefault) await this.setDefaultPaymentMethod(input.customerId, row.id)
    return row
  }

  async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    await db()
      .update(paymentMethods)
      .set({ isDefault: false })
      .where(and(eq(paymentMethods.customerId, customerId), ne(paymentMethods.id, paymentMethodId)))
    await db()
      .update(paymentMethods)
      .set({ isDefault: true })
      .where(and(eq(paymentMethods.id, paymentMethodId), eq(paymentMethods.customerId, customerId)))
  }

  async markPaymentMethodDetached(paymentMethodId: string, at: Date): Promise<void> {
    await db()
      .update(paymentMethods)
      .set({ detachedAt: at, isDefault: false })
      .where(eq(paymentMethods.id, paymentMethodId))
  }

  // ─── credit ──────────────────────────────────────────────────────────────
  async listCredits(customerId: string): Promise<CreditRecord[]> {
    const rows = await db()
      .select()
      .from(credits)
      .where(eq(credits.customerId, customerId))
      .orderBy(asc(credits.expiresAt), asc(credits.createdAt))
    return rows.map(toCreditRecord)
  }

  async insertCredit(input: NewCredit): Promise<CreditRecord> {
    const inserted = await db().insert(credits).values(input).returning()
    const row = inserted[0]
    if (!row) throw new Error("failed to insert the credit entry")
    return toCreditRecord(row)
  }

  async countCreditsByReason(customerId: string, reason: CreditReason): Promise<number> {
    const rows = await db()
      .select({ value: count() })
      .from(credits)
      .where(and(eq(credits.customerId, customerId), eq(credits.reason, reason)))
    return rows[0]?.value ?? 0
  }

  async listWelcomeGrants(since: Date): Promise<WelcomeGrant[]> {
    const rows = await db()
      .select({
        customerId: credits.customerId,
        grantedAt: credits.createdAt,
        signals: credits.signals,
      })
      .from(credits)
      .where(and(eq(credits.reason, "welcome"), sql`${credits.createdAt} >= ${since}`))
      .orderBy(desc(credits.createdAt))
    return rows.map((row) => ({
      customerId: row.customerId,
      grantedAt: row.grantedAt,
      signals: row.signals ?? null,
    }))
  }

  async consumeCredit(customerId: string, amount: Cents, orderId: string): Promise<Cents> {
    if (amount <= 0) return 0
    let remaining = amount
    let taken = 0

    for (let attempt = 0; attempt < CONSUME_RETRIES && remaining > 0; attempt += 1) {
      const now = new Date()
      const entries = (await this.listCredits(customerId)).filter(
        (entry) =>
          entry.amount - entry.consumed > 0 &&
          (entry.expiresAt === null || entry.expiresAt.getTime() > now.getTime()),
      )
      if (entries.length === 0) break

      for (const entry of entries) {
        if (remaining <= 0) break
        const usable = Math.min(remaining, entry.amount - entry.consumed)
        if (usable <= 0) continue
        // Conditional on the value we read: a concurrent order loses the race and retries.
        const updated = await db()
          .update(credits)
          .set({
            consumed: entry.consumed + usable,
            note: `${entry.note ? `${entry.note}; ` : ""}order:${orderId}`,
          })
          .where(and(eq(credits.id, entry.id), eq(credits.consumed, entry.consumed)))
          .returning({ id: credits.id })
        if (updated.length === 0) continue
        remaining -= usable
        taken += usable
      }
    }

    return taken
  }

  // ─── orders ──────────────────────────────────────────────────────────────
  async insertOrder(input: NewOrder): Promise<OrderRecord> {
    const inserted = await db()
      .insert(orders)
      .values({ ...input, completedSteps: input.completedSteps ?? [] })
      .returning()
    const row = inserted[0]
    if (!row) throw new Error("failed to insert the order")
    return toOrderRecord(row)
  }

  async getOrder(orderId: string): Promise<OrderRecord | null> {
    const rows = await db().select().from(orders).where(eq(orders.id, orderId)).limit(1)
    const row = rows[0]
    return row ? toOrderRecord(row) : null
  }

  async findOrderByIdempotencyKey(idempotencyKey: string): Promise<OrderRecord | null> {
    const rows = await db()
      .select()
      .from(orders)
      .where(eq(orders.idempotencyKey, idempotencyKey))
      .limit(1)
    const row = rows[0]
    return row ? toOrderRecord(row) : null
  }

  async findOrderByPaymentIntent(paymentIntentId: string): Promise<OrderRecord | null> {
    const rows = await db()
      .select()
      .from(orders)
      .where(eq(orders.stripePaymentIntentId, paymentIntentId))
      .limit(1)
    const row = rows[0]
    return row ? toOrderRecord(row) : null
  }

  async updateOrder(orderId: string, patch: OrderPatch): Promise<OrderRecord> {
    const updated = await db().update(orders).set(patch).where(eq(orders.id, orderId)).returning()
    const row = updated[0]
    if (!row) throw missing("order", orderId)
    return toOrderRecord(row)
  }

  async listOrders(customerId: string, limit = 20): Promise<OrderRecord[]> {
    const rows = await db()
      .select()
      .from(orders)
      .where(eq(orders.customerId, customerId))
      .orderBy(desc(orders.createdAt))
      .limit(limit)
    return rows.map(toOrderRecord)
  }

  // ─── payments ────────────────────────────────────────────────────────────
  async insertPayment(input: NewPayment): Promise<PaymentRecord> {
    const inserted = await db().insert(payments).values(input).returning()
    const row = inserted[0]
    if (!row) throw new Error("failed to insert the payment")
    return row
  }

  async findPaymentByPaymentIntent(paymentIntentId: string): Promise<PaymentRecord | null> {
    const rows = await db()
      .select()
      .from(payments)
      .where(eq(payments.stripePaymentIntentId, paymentIntentId))
      .limit(1)
    return rows[0] ?? null
  }

  async updatePayment(paymentId: string, patch: PaymentPatch): Promise<PaymentRecord> {
    const updated = await db()
      .update(payments)
      .set(patch)
      .where(eq(payments.id, paymentId))
      .returning()
    const row = updated[0]
    if (!row) throw missing("payment", paymentId)
    return row
  }

  async countSettledPayments(customerId: string): Promise<number> {
    const rows = await db()
      .select({ value: count() })
      .from(payments)
      .where(
        and(
          eq(payments.customerId, customerId),
          eq(payments.status, "succeeded"),
          sql`${payments.amount} > 0`,
        ),
      )
    return rows[0]?.value ?? 0
  }

  // ─── invoices ────────────────────────────────────────────────────────────
  async insertInvoice(input: NewInvoice): Promise<InvoiceRecord> {
    const inserted = await db().insert(invoices).values(input).returning()
    const row = inserted[0]
    if (!row) throw new Error("failed to insert the invoice")
    return row
  }

  async listInvoices(customerId: string): Promise<InvoiceRecord[]> {
    return db()
      .select()
      .from(invoices)
      .where(eq(invoices.customerId, customerId))
      .orderBy(desc(invoices.createdAt))
  }

  async findInvoiceByWhmcsId(whmcsInvoiceId: number): Promise<InvoiceRecord | null> {
    const rows = await db()
      .select()
      .from(invoices)
      .where(eq(invoices.whmcsInvoiceId, whmcsInvoiceId))
      .limit(1)
    return rows[0] ?? null
  }

  async findUnpaidInvoiceForService(serviceId: string): Promise<InvoiceRecord | null> {
    const rows = await db()
      .select()
      .from(invoices)
      .where(and(eq(invoices.serviceId, serviceId), eq(invoices.status, "unpaid")))
      .orderBy(asc(invoices.dueAt))
      .limit(1)
    return rows[0] ?? null
  }

  async updateInvoice(invoiceId: string, patch: InvoicePatch): Promise<InvoiceRecord> {
    const updated = await db()
      .update(invoices)
      .set(patch)
      .where(eq(invoices.id, invoiceId))
      .returning()
    const row = updated[0]
    if (!row) throw missing("invoice", invoiceId)
    return row
  }

  // ─── webhooks ────────────────────────────────────────────────────────────
  async recordWebhookEvent(input: {
    provider: "stripe" | "whmcs"
    eventId: string
    eventType: string
    payload: Record<string, unknown>
  }): Promise<WebhookRecordResult> {
    const inserted = await db()
      .insert(webhookEvents)
      .values(input)
      .onConflictDoNothing()
      .returning({ id: webhookEvents.id })
    const row = inserted[0]
    if (row) return { fresh: true, id: row.id }

    const existing = await db()
      .select({ id: webhookEvents.id })
      .from(webhookEvents)
      .where(
        and(eq(webhookEvents.provider, input.provider), eq(webhookEvents.eventId, input.eventId)),
      )
      .limit(1)
    return { fresh: false, id: existing[0]?.id ?? "" }
  }

  async markWebhookProcessed(provider: "stripe" | "whmcs", eventId: string): Promise<void> {
    await db()
      .update(webhookEvents)
      .set({ processedAt: new Date(), error: null })
      .where(and(eq(webhookEvents.provider, provider), eq(webhookEvents.eventId, eventId)))
  }

  async markWebhookFailed(
    provider: "stripe" | "whmcs",
    eventId: string,
    error: string,
  ): Promise<void> {
    await db()
      .update(webhookEvents)
      .set({ error })
      .where(and(eq(webhookEvents.provider, provider), eq(webhookEvents.eventId, eventId)))
  }
}

// ─── row mappers ─────────────────────────────────────────────────────────────

interface CreditRow {
  id: string
  customerId: string
  amount: number
  consumed: number
  reason: CreditReason
  note: string | null
  expiresAt: Date | null
  signals: Record<string, string | null> | null
  createdAt: Date
}

function toCreditRecord(row: CreditRow): CreditRecord {
  return {
    id: row.id,
    customerId: row.customerId,
    amount: row.amount,
    consumed: row.consumed,
    reason: row.reason,
    note: row.note,
    expiresAt: row.expiresAt,
    signals: row.signals,
    createdAt: row.createdAt,
  }
}

interface OrderRow {
  id: string
  customerId: string
  kind: OrderKind
  status: OrderStatus
  serviceId: string | null
  items: Record<string, unknown>
  term: Term
  subtotal: number
  tax: number
  creditApplied: number
  total: number
  expectedCost: number
  stripePaymentIntentId: string | null
  whmcsOrderId: number | null
  whmcsInvoiceId: number | null
  completedSteps: string[]
  idempotencyKey: string
  error: string | null
  errorCode: string | null
  paidAt: Date | null
  deliveredAt: Date | null
  createdAt: Date
  updatedAt: Date
}

function toOrderRecord(row: OrderRow): OrderRecord {
  return { ...row }
}

let cached: BillingStore | null = null

/** Lazily created singleton. Never called from a test. */
export function billingStore(): BillingStore {
  if (!cached) cached = new DrizzleBillingStore()
  return cached
}

/** Test and dev seam. */
export function setBillingStore(store: BillingStore | null): void {
  cached = store
}
