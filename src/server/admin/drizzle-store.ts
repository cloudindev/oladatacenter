import "server-only"
import { and, desc, eq, gte, ilike, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm"
import {
  deliveryState,
  parseCatalog,
  type Cents,
  type CreditReason,
  type DunningStage,
  type OrderKind,
  type OrderStatus,
  type ProvisionStep,
  type ServiceStatus,
  type Term,
} from "@ola/core"
import {
  actions,
  addons,
  auditLog,
  credits,
  customers,
  db,
  featureFlags,
  invoices,
  orders,
  ovhCatalogSnapshots,
  paymentMethods,
  payments,
  plans,
  services,
  users,
  webhookEvents,
} from "@ola/db"
import { CHECKOUT_ATTEMPT_ACTION } from "@/inngest/jobs/provision"
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
  SnapshotCost,
  SnapshotRow,
} from "./store"

/**
 * The Drizzle implementation of `AdminStore`.
 *
 * Rules it upholds:
 *  - nothing is ever deleted; `orders`, `services`, `invoices` and `auditLog` only grow;
 *  - every list is bounded by a limit, because an admin list of 200 000 rows is a
 *    production incident, not a feature;
 *  - costs, OVH ids and WHMCS ids are selected on purpose. This is the internal panel.
 */

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 1000

function bounded(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_LIMIT
  return Math.min(Math.max(1, Math.trunc(limit)), MAX_LIMIT)
}

function byTerm(month: number, year: number): Record<Term, Cents> {
  return { P1M: month, P12M: year }
}

function manual(month: number | null, year: number | null): Partial<Record<Term, Cents>> {
  const result: Partial<Record<Term, Cents>> = {}
  if (month !== null) result.P1M = month
  if (year !== null) result.P12M = year
  return result
}

function startOfDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

function likePattern(query: string): string {
  return `%${query.trim().replace(/[%_]/g, (match) => `\\${match}`)}%`
}

/** `payments.status` is Stripe's own value; anything but a settled success is a failure. */
function isFailedPayment(status: string, failureCode: string | null): boolean {
  return status !== "succeeded" || failureCode !== null
}

export class DrizzleAdminStore implements AdminStore {
  // ─── dashboard ─────────────────────────────────────────────────────────────

  async dashboardCounts(now: Date): Promise<DashboardCounts> {
    const open = await db()
      .select({ status: orders.status, paidAt: orders.paidAt })
      .from(orders)
      .where(inArray(orders.status, ["pending_payment", "paid", "provisioning", "delayed"]))

    const ordersInProgress = open.filter((row) =>
      ["pending_payment", "paid", "provisioning"].includes(row.status),
    ).length
    const ordersLate = open.filter(
      (row) => row.paidAt !== null && deliveryState(row.paidAt, now) !== "on_time",
    ).length

    const [failed] = await db()
      .select({ value: sql<number>`count(*)::int` })
      .from(orders)
      .where(eq(orders.status, "failed"))

    const serviceCounts = await db()
      .select({ status: services.status, value: sql<number>`count(*)::int` })
      .from(services)
      .where(inArray(services.status, ["suspended", "review"]))
      .groupBy(services.status)

    const today = startOfDay(now)
    const todaysPayments = await db()
      .select({ status: payments.status, failureCode: payments.failureCode })
      .from(payments)
      .where(gte(payments.createdAt, today))

    const [webhooks] = await db()
      .select({ value: sql<number>`count(*)::int` })
      .from(webhookEvents)
      .where(or(isNull(webhookEvents.processedAt), isNotNull(webhookEvents.error)))

    return {
      ordersInProgress,
      ordersLate,
      ordersFailed: failed?.value ?? 0,
      servicesSuspended:
        serviceCounts.find((row) => row.status === "suspended")?.value ?? 0,
      servicesInReview: serviceCounts.find((row) => row.status === "review")?.value ?? 0,
      paymentsFailedToday: todaysPayments.filter((row) =>
        isFailedPayment(row.status, row.failureCode),
      ).length,
      webhooksFailed: webhooks?.value ?? 0,
    }
  }

  // ─── plans and addons ──────────────────────────────────────────────────────

  async listPlans(): Promise<readonly PlanRow[]> {
    const rows = await db().select().from(plans).orderBy(plans.sort, plans.name)
    return rows.map(toPlanRow)
  }

  async getPlan(id: string): Promise<PlanRow | null> {
    const rows = await db().select().from(plans).where(eq(plans.id, id)).limit(1)
    return rows[0] ? toPlanRow(rows[0]) : null
  }

  async updatePlan(id: string, patch: PlanPatch): Promise<void> {
    await db()
      .update(plans)
      .set({
        ...(patch.priceMonth !== undefined ? { priceMonth: patch.priceMonth } : {}),
        ...(patch.price12m !== undefined ? { price12m: patch.price12m } : {}),
        ...(patch.marginBasisPoints !== undefined ? { margin: patch.marginBasisPoints } : {}),
        ...(patch.active !== undefined ? { active: patch.active } : {}),
        ...(patch.sort !== undefined ? { sort: patch.sort } : {}),
      })
      .where(eq(plans.id, id))
  }

  async listAddons(): Promise<readonly AddonRow[]> {
    const rows = await db().select().from(addons).orderBy(addons.family, addons.sort, addons.name)
    return rows.map(toAddonRow)
  }

  async getAddon(id: string): Promise<AddonRow | null> {
    const rows = await db().select().from(addons).where(eq(addons.id, id)).limit(1)
    return rows[0] ? toAddonRow(rows[0]) : null
  }

  async updateAddon(id: string, patch: AddonPatch): Promise<void> {
    await db()
      .update(addons)
      .set({
        ...(patch.priceMonth !== undefined ? { priceMonth: patch.priceMonth } : {}),
        ...(patch.price12m !== undefined ? { price12m: patch.price12m } : {}),
        ...(patch.marginBasisPoints !== undefined ? { margin: patch.marginBasisPoints } : {}),
        ...(patch.active !== undefined ? { active: patch.active } : {}),
        ...(patch.sort !== undefined ? { sort: patch.sort } : {}),
      })
      .where(eq(addons.id, id))
  }

  // ─── catalog snapshots ─────────────────────────────────────────────────────

  async listSnapshots(limit: number): Promise<readonly SnapshotRow[]> {
    const rows = await db()
      .select({
        id: ovhCatalogSnapshots.id,
        fetchedAt: ovhCatalogSnapshots.fetchedAt,
        raw: ovhCatalogSnapshots.raw,
      })
      .from(ovhCatalogSnapshots)
      .orderBy(desc(ovhCatalogSnapshots.fetchedAt))
      .limit(bounded(limit))

    return rows.map((row) => ({
      id: row.id,
      fetchedAt: row.fetchedAt,
      costs: snapshotCosts(row.raw, row.fetchedAt),
    }))
  }

  // ─── orders ────────────────────────────────────────────────────────────────

  async listOrders(filter: OrderFilter): Promise<readonly OrderRow[]> {
    const conditions = [
      ...(filter.status && filter.status.length > 0
        ? [inArray(orders.status, [...filter.status])]
        : []),
      ...(filter.from ? [gte(orders.createdAt, filter.from)] : []),
      ...(filter.to ? [lte(orders.createdAt, filter.to)] : []),
    ]

    if (filter.query?.trim()) {
      const pattern = likePattern(filter.query)
      const match = or(
        ilike(users.email, pattern),
        ilike(orders.id, pattern),
        ilike(orders.stripePaymentIntentId, pattern),
        ilike(orders.ovhCartId, pattern),
      )
      if (match) conditions.push(match)
    }

    const rows = await db()
      .select(orderListColumns)
      .from(orders)
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .innerJoin(users, eq(users.id, customers.userId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(orders.createdAt))
      .limit(bounded(filter.limit))

    return rows.map(toOrderRow)
  }

  async getOrder(id: string): Promise<OrderDetail | null> {
    const rows = await db()
      .select({
        ...orderListColumns,
        serviceId: orders.serviceId,
        subtotal: orders.subtotal,
        tax: orders.tax,
        creditApplied: orders.creditApplied,
        items: orders.items,
        stripePaymentIntentId: orders.stripePaymentIntentId,
        whmcsOrderId: orders.whmcsOrderId,
        whmcsInvoiceId: orders.whmcsInvoiceId,
        ovhCartId: orders.ovhCartId,
        idempotencyKey: orders.idempotencyKey,
        error: orders.error,
        updatedAt: orders.updatedAt,
      })
      .from(orders)
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .innerJoin(users, eq(users.id, customers.userId))
      .where(eq(orders.id, id))
      .limit(1)

    const row = rows[0]
    if (!row) return null
    return {
      ...toOrderRow(row),
      serviceId: row.serviceId,
      subtotal: row.subtotal,
      tax: row.tax,
      creditApplied: row.creditApplied,
      items: row.items,
      stripePaymentIntentId: row.stripePaymentIntentId,
      whmcsOrderId: row.whmcsOrderId,
      whmcsInvoiceId: row.whmcsInvoiceId,
      ovhCartId: row.ovhCartId,
      idempotencyKey: row.idempotencyKey,
      error: row.error,
      updatedAt: row.updatedAt,
    }
  }

  // ─── services ──────────────────────────────────────────────────────────────

  async listServices(filter: ServiceFilter): Promise<readonly ServiceRow[]> {
    const conditions = [
      ...(filter.status && filter.status.length > 0
        ? [inArray(services.status, [...filter.status])]
        : []),
      ...(filter.datacenter ? [eq(services.datacenter, filter.datacenter)] : []),
      ...(filter.planId ? [eq(services.planId, filter.planId)] : []),
    ]

    if (filter.query?.trim()) {
      const pattern = likePattern(filter.query)
      const match = or(
        ilike(users.email, pattern),
        ilike(services.id, pattern),
        ilike(services.ovhServiceName, pattern),
        ilike(services.ipv4, pattern),
        ilike(services.displayName, pattern),
      )
      if (match) conditions.push(match)
    }

    const rows = await db()
      .select(serviceListColumns)
      .from(services)
      .innerJoin(customers, eq(customers.id, services.customerId))
      .innerJoin(users, eq(users.id, customers.userId))
      .innerJoin(plans, eq(plans.id, services.planId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(services.createdAt))
      .limit(bounded(filter.limit))

    return rows.map(toServiceRow)
  }

  async getService(id: string): Promise<ServiceDetail | null> {
    const rows = await db()
      .select({
        ...serviceListColumns,
        ipv6: services.ipv6,
        whmcsServiceId: services.whmcsServiceId,
        ovhExpiresAt: services.ovhExpiresAt,
        rescueMode: services.rescueMode,
        suspendedAt: services.suspendedAt,
        terminatedAt: services.terminatedAt,
        dunningCompleted: services.dunningCompleted,
        orderId: services.orderId,
      })
      .from(services)
      .innerJoin(customers, eq(customers.id, services.customerId))
      .innerJoin(users, eq(users.id, customers.userId))
      .innerJoin(plans, eq(plans.id, services.planId))
      .where(eq(services.id, id))
      .limit(1)

    const row = rows[0]
    if (!row) return null
    return {
      ...toServiceRow(row),
      ipv6: row.ipv6,
      whmcsServiceId: row.whmcsServiceId,
      ovhExpiresAt: row.ovhExpiresAt,
      rescueMode: row.rescueMode,
      suspendedAt: row.suspendedAt,
      terminatedAt: row.terminatedAt,
      dunningCompleted: (row.dunningCompleted ?? []) as DunningStage[],
      orderId: row.orderId,
    }
  }

  async updateService(id: string, patch: ServicePatch): Promise<void> {
    await db()
      .update(services)
      .set({
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.nextDueAt !== undefined ? { nextDueAt: patch.nextDueAt } : {}),
        ...(patch.autoRenew !== undefined ? { autoRenew: patch.autoRenew } : {}),
        ...(patch.suspendedAt !== undefined ? { suspendedAt: patch.suspendedAt } : {}),
      })
      .where(eq(services.id, id))
  }

  async listServiceActions(serviceId: string, limit: number): Promise<readonly ActionRow[]> {
    const rows = await db()
      .select({
        id: actions.id,
        serviceId: actions.serviceId,
        type: actions.type,
        status: actions.status,
        ovhTaskId: actions.ovhTaskId,
        error: actions.error,
        createdAt: actions.createdAt,
        finishedAt: actions.finishedAt,
      })
      .from(actions)
      .where(eq(actions.serviceId, serviceId))
      .orderBy(desc(actions.createdAt))
      .limit(bounded(limit))
    return rows
  }

  async listServiceDatacenters(): Promise<readonly string[]> {
    const rows = await db()
      .selectDistinct({ datacenter: services.datacenter })
      .from(services)
      .orderBy(services.datacenter)
    return rows.map((row) => row.datacenter)
  }

  // ─── customers ─────────────────────────────────────────────────────────────

  async listCustomers(filter: CustomerFilter): Promise<readonly CustomerRow[]> {
    const conditions = []
    if (filter.status && filter.status.length > 0) {
      conditions.push(
        inArray(customers.status, filter.status as ("unverified" | "verified" | "review" | "blocked")[]),
      )
    }
    if (filter.query?.trim()) {
      const pattern = likePattern(filter.query)
      const match = or(
        ilike(users.email, pattern),
        ilike(customers.id, pattern),
        ilike(customers.legalName, pattern),
        ilike(customers.taxId, pattern),
      )
      if (match) conditions.push(match)
    }

    const rows = await db()
      .select(customerListColumns)
      .from(customers)
      .innerJoin(users, eq(users.id, customers.userId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(customers.createdAt))
      .limit(bounded(filter.limit))

    return rows.map(toCustomerRow)
  }

  async getCustomer(id: string): Promise<CustomerDetail | null> {
    const rows = await db()
      .select({
        ...customerListColumns,
        taxId: customers.taxId,
        phone: customers.phone,
        riskNotes: customers.riskNotes,
        addressLine1: customers.addressLine1,
        city: customers.city,
        postalCode: customers.postalCode,
      })
      .from(customers)
      .innerJoin(users, eq(users.id, customers.userId))
      .where(eq(customers.id, id))
      .limit(1)

    const row = rows[0]
    if (!row) return null

    const [creditRows, cardRows, invoiceRows, serviceRows] = await Promise.all([
      db()
        .select({
          id: credits.id,
          amount: credits.amount,
          consumed: credits.consumed,
          reason: credits.reason,
          note: credits.note,
          expiresAt: credits.expiresAt,
          signals: credits.signals,
          createdAt: credits.createdAt,
        })
        .from(credits)
        .where(eq(credits.customerId, id))
        .orderBy(desc(credits.createdAt)),
      db()
        .select({ verifiedAt: paymentMethods.verifiedAt })
        .from(paymentMethods)
        .where(and(eq(paymentMethods.customerId, id), isNull(paymentMethods.detachedAt))),
      db()
        .select({
          id: invoices.id,
          whmcsInvoiceId: invoices.whmcsInvoiceId,
          number: invoices.number,
          status: invoices.status,
          total: invoices.total,
          dueAt: invoices.dueAt,
          paidAt: invoices.paidAt,
        })
        .from(invoices)
        .where(eq(invoices.customerId, id))
        .orderBy(desc(invoices.createdAt))
        .limit(50),
      this.listServices({ query: undefined, limit: 50 }).then((all) =>
        all.filter((service) => service.customerId === id),
      ),
    ])

    return {
      ...toCustomerRow(row),
      taxId: row.taxId,
      phone: row.phone,
      riskNotes: row.riskNotes,
      hasVerifiedCard: cardRows.some((card) => card.verifiedAt !== null),
      billingComplete: Boolean(
        row.addressLine1 && row.city && row.postalCode && row.country && row.legalName,
      ),
      credits: creditRows.map((credit) => ({
        ...credit,
        reason: credit.reason as CreditReason,
      })),
      services: serviceRows,
      invoices: invoiceRows,
    }
  }

  async updateCustomer(id: string, patch: CustomerPatch): Promise<void> {
    await db()
      .update(customers)
      .set({
        ...(patch.status !== undefined
          ? { status: patch.status as "unverified" | "verified" | "review" | "blocked" }
          : {}),
        ...(patch.riskNotes !== undefined ? { riskNotes: patch.riskNotes } : {}),
      })
      .where(eq(customers.id, id))
  }

  async insertCredit(credit: NewCredit): Promise<{ id: string }> {
    const inserted = await db()
      .insert(credits)
      .values({
        customerId: credit.customerId,
        amount: credit.amount,
        reason: credit.reason,
        note: credit.note,
        expiresAt: credit.expiresAt,
      })
      .returning({ id: credits.id })
    return { id: inserted[0]?.id ?? "" }
  }

  // ─── payments ──────────────────────────────────────────────────────────────

  async listPayments(filter: PaymentFilter): Promise<readonly PaymentRow[]> {
    const conditions = [
      ...(filter.from ? [gte(payments.createdAt, filter.from)] : []),
      ...(filter.to ? [lte(payments.createdAt, filter.to)] : []),
    ]

    if (filter.outcome === "succeeded") conditions.push(eq(payments.status, "succeeded"))
    if (filter.outcome === "failed") conditions.push(isNotNull(payments.failureCode))
    if (filter.outcome === "refunded") conditions.push(sql`${payments.refundedAmount} > 0`)
    if (filter.outcome === "disputed") conditions.push(eq(payments.status, "disputed"))

    if (filter.query?.trim()) {
      const pattern = likePattern(filter.query)
      const match = or(
        ilike(users.email, pattern),
        ilike(payments.stripePaymentIntentId, pattern),
        ilike(payments.id, pattern),
      )
      if (match) conditions.push(match)
    }

    const rows = await db()
      .select({
        id: payments.id,
        customerId: payments.customerId,
        customerEmail: users.email,
        orderId: payments.orderId,
        invoiceId: payments.invoiceId,
        stripePaymentIntentId: payments.stripePaymentIntentId,
        amount: payments.amount,
        status: payments.status,
        failureCode: payments.failureCode,
        failureMessage: payments.failureMessage,
        refundedAmount: payments.refundedAmount,
        settledAt: payments.settledAt,
        createdAt: payments.createdAt,
        invoiceServiceId: invoices.serviceId,
        orderServiceId: orders.serviceId,
      })
      .from(payments)
      .innerJoin(customers, eq(customers.id, payments.customerId))
      .innerJoin(users, eq(users.id, customers.userId))
      .leftJoin(invoices, eq(invoices.id, payments.invoiceId))
      .leftJoin(orders, eq(orders.id, payments.orderId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(payments.createdAt))
      .limit(bounded(filter.limit))

    const serviceIds = [
      ...new Set(
        rows
          .map((row) => row.invoiceServiceId ?? row.orderServiceId)
          .filter((value): value is string => value !== null),
      ),
    ]
    const stages = new Map<string, DunningStage>()
    if (serviceIds.length > 0) {
      const stageRows = await db()
        .select({ id: services.id, dunningStage: services.dunningStage })
        .from(services)
        .where(inArray(services.id, serviceIds))
      for (const row of stageRows) stages.set(row.id, row.dunningStage)
    }

    return rows.map((row) => {
      const serviceId = row.invoiceServiceId ?? row.orderServiceId
      return {
        id: row.id,
        customerId: row.customerId,
        customerEmail: row.customerEmail,
        orderId: row.orderId,
        invoiceId: row.invoiceId,
        serviceId,
        dunningStage: serviceId ? stages.get(serviceId) ?? null : null,
        stripePaymentIntentId: row.stripePaymentIntentId,
        amount: row.amount,
        status: row.status,
        failureCode: row.failureCode,
        failureMessage: row.failureMessage,
        refundedAmount: row.refundedAmount,
        settledAt: row.settledAt,
        createdAt: row.createdAt,
      }
    })
  }

  async getPayment(id: string): Promise<PaymentRow | null> {
    const rows = await this.listPayments({ query: id, limit: 1 })
    return rows.find((row) => row.id === id) ?? null
  }

  // ─── flags ─────────────────────────────────────────────────────────────────

  async listFlags(): Promise<readonly FlagRow[]> {
    const rows = await db()
      .select({
        key: featureFlags.key,
        enabled: featureFlags.enabled,
        description: featureFlags.description,
        updatedAt: featureFlags.updatedAt,
      })
      .from(featureFlags)
      .orderBy(featureFlags.key)
    return rows
  }

  async getFlag(key: string): Promise<FlagRow | null> {
    const rows = await db()
      .select({
        key: featureFlags.key,
        enabled: featureFlags.enabled,
        description: featureFlags.description,
        updatedAt: featureFlags.updatedAt,
      })
      .from(featureFlags)
      .where(eq(featureFlags.key, key))
      .limit(1)
    return rows[0] ?? null
  }

  async setFlag(key: string, enabled: boolean, description: string | null): Promise<void> {
    await db()
      .insert(featureFlags)
      .values({ key, enabled, description })
      .onConflictDoUpdate({
        target: featureFlags.key,
        set: { enabled, description, updatedAt: new Date() },
      })
  }

  // ─── audit ─────────────────────────────────────────────────────────────────

  async searchAudit(filter: AuditFilter): Promise<readonly AuditRow[]> {
    const conditions = [
      ...(filter.entity ? [eq(auditLog.entity, filter.entity)] : []),
      ...(filter.entityId ? [eq(auditLog.entityId, filter.entityId)] : []),
      ...(filter.actorId ? [eq(auditLog.actorId, filter.actorId)] : []),
      ...(filter.from ? [gte(auditLog.createdAt, filter.from)] : []),
      ...(filter.to ? [lte(auditLog.createdAt, filter.to)] : []),
    ]

    const rows = await db()
      .select({
        id: auditLog.id,
        actorId: auditLog.actorId,
        actorType: auditLog.actorType,
        entity: auditLog.entity,
        entityId: auditLog.entityId,
        action: auditLog.action,
        diff: auditLog.diff,
        ip: auditLog.ip,
        correlationId: auditLog.correlationId,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLog.createdAt))
      .limit(bounded(filter.limit))

    return rows
  }

  async hasCheckoutAttempt(orderId: string): Promise<boolean> {
    const rows = await db()
      .select({ id: auditLog.id })
      .from(auditLog)
      .where(
        and(
          eq(auditLog.entity, "order"),
          eq(auditLog.entityId, orderId),
          eq(auditLog.action, CHECKOUT_ATTEMPT_ACTION),
        ),
      )
      .limit(1)
    return rows.length > 0
  }
}

// ─── column sets and mappers ─────────────────────────────────────────────────

const orderListColumns = {
  id: orders.id,
  customerId: orders.customerId,
  customerEmail: users.email,
  kind: orders.kind,
  status: orders.status,
  term: orders.term,
  total: orders.total,
  expectedCost: orders.expectedCost,
  completedSteps: orders.completedSteps,
  ovhOrderId: orders.ovhOrderId,
  paidAt: orders.paidAt,
  deliveredAt: orders.deliveredAt,
  createdAt: orders.createdAt,
  errorCode: orders.errorCode,
}

interface OrderListRow {
  id: string
  customerId: string
  customerEmail: string
  kind: OrderKind
  status: OrderStatus
  term: Term
  total: number
  expectedCost: number
  completedSteps: string[]
  ovhOrderId: number | null
  paidAt: Date | null
  deliveredAt: Date | null
  createdAt: Date
  errorCode: string | null
}

function toOrderRow(row: OrderListRow): OrderRow {
  return {
    ...row,
    completedSteps: (row.completedSteps ?? []) as ProvisionStep[],
  }
}

const serviceListColumns = {
  id: services.id,
  customerId: services.customerId,
  customerEmail: users.email,
  planId: services.planId,
  planName: plans.name,
  ovhPlanCode: plans.ovhPlanCode,
  displayName: services.displayName,
  ovhServiceName: services.ovhServiceName,
  datacenter: services.datacenter,
  os: services.os,
  ipv4: services.ipv4,
  status: services.status,
  term: services.term,
  monthlyPrice: services.monthlyPrice,
  nextDueAt: services.nextDueAt,
  dunningStage: services.dunningStage,
  autoRenew: services.autoRenew,
  lastSyncedAt: services.lastSyncedAt,
  createdAt: services.createdAt,
}

interface ServiceListRow {
  id: string
  customerId: string
  customerEmail: string
  planId: string
  planName: string
  ovhPlanCode: string
  displayName: string | null
  ovhServiceName: string | null
  datacenter: string
  os: string
  ipv4: string | null
  status: ServiceStatus
  term: Term
  monthlyPrice: number
  nextDueAt: Date | null
  dunningStage: DunningStage
  autoRenew: boolean
  lastSyncedAt: Date | null
  createdAt: Date
}

function toServiceRow(row: ServiceListRow): ServiceRow {
  return { ...row }
}

const customerListColumns = {
  id: customers.id,
  userId: customers.userId,
  email: users.email,
  kind: customers.kind,
  legalName: customers.legalName,
  country: customers.country,
  status: customers.status,
  taxIdValidated: customers.taxIdValidated,
  emailVerifiedAt: users.emailVerifiedAt,
  phoneVerifiedAt: customers.phoneVerifiedAt,
  firstPaidAt: customers.firstPaidAt,
  whmcsClientId: customers.whmcsClientId,
  stripeCustomerId: customers.stripeCustomerId,
  createdAt: customers.createdAt,
}

interface CustomerListRow {
  id: string
  userId: string
  email: string
  kind: "company" | "individual"
  legalName: string | null
  country: string | null
  status: string
  taxIdValidated: boolean
  emailVerifiedAt: Date | null
  phoneVerifiedAt: Date | null
  firstPaidAt: Date | null
  whmcsClientId: number | null
  stripeCustomerId: string | null
  createdAt: Date
}

function toCustomerRow(row: CustomerListRow): CustomerRow {
  return { ...row }
}

interface PlanTableRow {
  id: string
  ovhPlanCode: string
  slug: string
  name: string
  costMonth: number
  cost12m: number
  trueCostMonth: number
  trueCost12m: number
  priceMonth: number | null
  price12m: number | null
  margin: number
  active: boolean
  sort: number
}

function toPlanRow(row: PlanTableRow): PlanRow {
  return {
    id: row.id,
    ovhPlanCode: row.ovhPlanCode,
    slug: row.slug,
    name: row.name,
    cost: byTerm(row.costMonth, row.cost12m),
    storedTrueCost: byTerm(row.trueCostMonth, row.trueCost12m),
    manualPrice: manual(row.priceMonth, row.price12m),
    marginBasisPoints: row.margin,
    active: row.active,
    sort: row.sort,
  }
}

interface AddonTableRow {
  id: string
  ovhPlanCode: string
  family: string
  name: string
  costMonth: number
  cost12m: number
  priceMonth: number | null
  price12m: number | null
  margin: number
  mandatory: boolean
  active: boolean
  sort: number
}

function toAddonRow(row: AddonTableRow): AddonRow {
  return {
    id: row.id,
    ovhPlanCode: row.ovhPlanCode,
    family: row.family,
    name: row.name,
    cost: byTerm(row.costMonth, row.cost12m),
    manualPrice: manual(row.priceMonth, row.price12m),
    marginBasisPoints: row.margin,
    mandatory: row.mandatory,
    active: row.active,
    sort: row.sort,
  }
}

/**
 * Costs of one snapshot, keyed by OVH plan code, via `parseCatalog`. A snapshot we can no
 * longer parse yields an empty map rather than breaking the whole catalog screen.
 */
function snapshotCosts(raw: unknown, fetchedAt: Date): ReadonlyMap<string, SnapshotCost> {
  const costs = new Map<string, SnapshotCost>()
  try {
    const parsed = parseCatalog(raw, { fetchedAt })
    for (const plan of parsed.plans) {
      costs.set(plan.planCode, {
        code: plan.planCode,
        name: plan.invoiceName,
        kind: "plan",
        cost: plan.monthlyCost,
      })
    }
    for (const addon of parsed.addons) {
      costs.set(addon.planCode, {
        code: addon.planCode,
        name: addon.invoiceName,
        kind: "addon",
        cost: addon.monthlyCost,
      })
    }
  } catch {
    return costs
  }
  return costs
}
