import "server-only"
import { and, count, desc, eq, inArray, isNotNull, ne } from "drizzle-orm"
import {
  actions,
  addons,
  auditLog,
  customers,
  db,
  invoices,
  orders,
  ovhCatalogSnapshots,
  plans,
  services,
  sshKeys,
  users,
  webhookEvents,
} from "@ola/db"
import {
  DUNNING_STAGES,
  PROVISION_STEPS,
  type DunningStage,
  type ProvisionStep,
} from "@ola/core"
import type {
  ActionInput,
  AddonRecord,
  CatalogSnapshotRecord,
  CostPatch,
  CreateServiceInput,
  CustomerProfilePatch,
  CustomerRecord,
  InvoiceRecord,
  JobDb,
  OrderPatch,
  OrderRecord,
  PlanRecord,
  ServicePatch,
  ServiceRecord,
  SshKeyRecord,
  UpsertInvoiceInput,
} from "../ports"

/**
 * The Drizzle implementation of `JobDb`.
 *
 * It is deliberately the only file in the jobs layer that knows about tables: the jobs
 * themselves are tested against an in-memory fake of this interface.
 *
 * `markOrderStepComplete` and `appendDunningStage` read-modify-write a jsonb array. That
 * is safe because both are only ever reached from a function with `concurrency.limit = 1`
 * keyed on the order / service id, so there is never a second writer.
 */

const PROVISION_STEP_SET = new Set<string>(PROVISION_STEPS)
const DUNNING_STAGE_SET = new Set<string>(DUNNING_STAGES)

function toProvisionSteps(raw: readonly string[] | null): readonly ProvisionStep[] {
  return (raw ?? []).filter((step): step is ProvisionStep => PROVISION_STEP_SET.has(step))
}

function toDunningStages(raw: readonly string[] | null): readonly DunningStage[] {
  return (raw ?? []).filter((stage): stage is DunningStage => DUNNING_STAGE_SET.has(stage))
}

function hasKeys(patch: object): boolean {
  return Object.values(patch).some((value) => value !== undefined)
}

type OrderRow = typeof orders.$inferSelect
type ServiceRow = typeof services.$inferSelect
type InvoiceRow = typeof invoices.$inferSelect
type PlanRow = typeof plans.$inferSelect
type AddonRow = typeof addons.$inferSelect

function mapOrder(row: OrderRow): OrderRecord {
  return {
    id: row.id,
    customerId: row.customerId,
    kind: row.kind,
    status: row.status,
    serviceId: row.serviceId,
    items: row.items,
    term: row.term,
    subtotal: row.subtotal,
    tax: row.tax,
    creditApplied: row.creditApplied,
    total: row.total,
    expectedCost: row.expectedCost,
    stripePaymentIntentId: row.stripePaymentIntentId,
    whmcsOrderId: row.whmcsOrderId,
    whmcsInvoiceId: row.whmcsInvoiceId,
    ovhCartId: row.ovhCartId,
    ovhOrderId: row.ovhOrderId,
    completedSteps: toProvisionSteps(row.completedSteps),
    error: row.error,
    errorCode: row.errorCode,
    paidAt: row.paidAt,
    deliveredAt: row.deliveredAt,
  }
}

function mapService(row: ServiceRow): ServiceRecord {
  return {
    id: row.id,
    customerId: row.customerId,
    planId: row.planId,
    orderId: row.orderId,
    displayName: row.displayName,
    ovhServiceName: row.ovhServiceName,
    datacenter: row.datacenter,
    os: row.os,
    ipv4: row.ipv4,
    ipv6: row.ipv6,
    status: row.status,
    term: row.term,
    monthlyPrice: row.monthlyPrice,
    nextDueAt: row.nextDueAt,
    autoRenew: row.autoRenew,
    dunningStage: row.dunningStage,
    dunningCompleted: toDunningStages(row.dunningCompleted),
    whmcsServiceId: row.whmcsServiceId,
    ovhExpiresAt: row.ovhExpiresAt,
    suspendedAt: row.suspendedAt,
    terminatedAt: row.terminatedAt,
    lastSyncedAt: row.lastSyncedAt,
  }
}

function mapInvoice(row: InvoiceRow): InvoiceRecord {
  return {
    id: row.id,
    customerId: row.customerId,
    serviceId: row.serviceId,
    orderId: row.orderId,
    whmcsInvoiceId: row.whmcsInvoiceId,
    number: row.number,
    status: row.status,
    subtotal: row.subtotal,
    tax: row.tax,
    credit: row.credit,
    total: row.total,
    dueAt: row.dueAt,
    paidAt: row.paidAt,
  }
}

function mapPlan(row: PlanRow): PlanRecord {
  return {
    id: row.id,
    ovhPlanCode: row.ovhPlanCode,
    slug: row.slug,
    name: row.name,
    costMonth: row.costMonth,
    cost12m: row.cost12m,
    trueCostMonth: row.trueCostMonth,
    trueCost12m: row.trueCost12m,
    priceMonth: row.priceMonth,
    price12m: row.price12m,
    margin: row.margin,
    active: row.active,
  }
}

function mapAddon(row: AddonRow): AddonRecord {
  return {
    id: row.id,
    ovhPlanCode: row.ovhPlanCode,
    family: row.family,
    name: row.name,
    costMonth: row.costMonth,
    cost12m: row.cost12m,
    priceMonth: row.priceMonth,
    price12m: row.price12m,
    margin: row.margin,
    active: row.active,
  }
}

export function createJobDb(): JobDb {
  return {
    /* ---- orders ---- */
    async getOrder(orderId) {
      const rows = await db().select().from(orders).where(eq(orders.id, orderId)).limit(1)
      const row = rows[0]
      return row ? mapOrder(row) : null
    },

    async updateOrder(orderId, patch: OrderPatch) {
      if (!hasKeys(patch)) return
      await db().update(orders).set(patch).where(eq(orders.id, orderId))
    },

    async markOrderStepComplete(orderId, step) {
      const rows = await db()
        .select({ completedSteps: orders.completedSteps })
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1)
      const current = toProvisionSteps(rows[0]?.completedSteps ?? [])
      if (current.includes(step)) return current
      const next = [...current, step]
      await db()
        .update(orders)
        .set({ completedSteps: [...next] })
        .where(eq(orders.id, orderId))
      return next
    },

    /* ---- customers ---- */
    async getCustomer(customerId) {
      const rows = await db()
        .select({ customer: customers, email: users.email })
        .from(customers)
        .innerJoin(users, eq(users.id, customers.userId))
        .where(eq(customers.id, customerId))
        .limit(1)
      const row = rows[0]
      return row ? mapCustomer(row.customer, row.email) : null
    },

    async findCustomerByWhmcsClientId(whmcsClientId) {
      const rows = await db()
        .select({ customer: customers, email: users.email })
        .from(customers)
        .innerJoin(users, eq(users.id, customers.userId))
        .where(eq(customers.whmcsClientId, whmcsClientId))
        .limit(1)
      const row = rows[0]
      return row ? mapCustomer(row.customer, row.email) : null
    },

    async setCustomerWhmcsClientId(customerId, whmcsClientId) {
      await db().update(customers).set({ whmcsClientId }).where(eq(customers.id, customerId))
    },

    async updateCustomerProfile(customerId, patch: CustomerProfilePatch) {
      if (!hasKeys(patch)) return
      await db().update(customers).set(patch).where(eq(customers.id, customerId))
    },

    async listSshKeys(customerId) {
      const rows = await db()
        .select()
        .from(sshKeys)
        .where(eq(sshKeys.customerId, customerId))
        .orderBy(desc(sshKeys.createdAt))
      return rows.map(
        (row): SshKeyRecord => ({
          id: row.id,
          name: row.name,
          publicKey: row.publicKey,
          fingerprint: row.fingerprint,
        }),
      )
    },

    /* ---- catalog ---- */
    async findPlanByOvhCode(ovhPlanCode) {
      const rows = await db()
        .select()
        .from(plans)
        .where(eq(plans.ovhPlanCode, ovhPlanCode))
        .limit(1)
      const row = rows[0]
      return row ? mapPlan(row) : null
    },

    async listPlans() {
      const rows = await db().select().from(plans)
      return rows.map(mapPlan)
    },

    async updatePlanCosts(planId, costs: CostPatch) {
      await db()
        .update(plans)
        .set({
          costMonth: costs.costMonth,
          cost12m: costs.cost12m,
          trueCostMonth: costs.trueCostMonth,
          trueCost12m: costs.trueCost12m,
        })
        .where(eq(plans.id, planId))
    },

    async findAddonByOvhCode(ovhPlanCode) {
      const rows = await db()
        .select()
        .from(addons)
        .where(eq(addons.ovhPlanCode, ovhPlanCode))
        .limit(1)
      const row = rows[0]
      return row ? mapAddon(row) : null
    },

    async listAddons() {
      const rows = await db().select().from(addons)
      return rows.map(mapAddon)
    },

    async updateAddonCosts(addonId, costs: CostPatch) {
      await db()
        .update(addons)
        .set({ costMonth: costs.costMonth, cost12m: costs.cost12m })
        .where(eq(addons.id, addonId))
    },

    async latestCatalogSnapshot() {
      const rows = await db()
        .select()
        .from(ovhCatalogSnapshots)
        .orderBy(desc(ovhCatalogSnapshots.fetchedAt))
        .limit(1)
      const row = rows[0]
      if (!row) return null
      const record: CatalogSnapshotRecord = {
        id: row.id,
        fetchedAt: row.fetchedAt,
        raw: row.raw,
        diff: row.diff ?? null,
      }
      return record
    },

    async insertCatalogSnapshot(input) {
      await db()
        .insert(ovhCatalogSnapshots)
        .values({ fetchedAt: input.fetchedAt, raw: input.raw, diff: input.diff })
    },

    /* ---- services ---- */
    async getService(serviceId) {
      const rows = await db().select().from(services).where(eq(services.id, serviceId)).limit(1)
      const row = rows[0]
      return row ? mapService(row) : null
    },

    async findServiceByOrderId(orderId) {
      const rows = await db()
        .select()
        .from(services)
        .where(eq(services.orderId, orderId))
        .orderBy(desc(services.createdAt))
        .limit(1)
      const row = rows[0]
      return row ? mapService(row) : null
    },

    async findServiceByOvhName(ovhServiceName) {
      const rows = await db()
        .select()
        .from(services)
        .where(eq(services.ovhServiceName, ovhServiceName))
        .limit(1)
      const row = rows[0]
      return row ? mapService(row) : null
    },

    async createService(input: CreateServiceInput) {
      const inserted = await db()
        .insert(services)
        .values({
          customerId: input.customerId,
          planId: input.planId,
          orderId: input.orderId,
          displayName: input.displayName,
          ovhServiceName: input.ovhServiceName,
          datacenter: input.datacenter,
          os: input.os,
          ipv4: input.ipv4,
          ipv6: input.ipv6,
          term: input.term,
          monthlyPrice: input.monthlyPrice,
          status: input.status,
        })
        .returning()
      const row = inserted[0]
      if (!row) throw new Error("failed to insert service row")
      return mapService(row)
    },

    async updateService(serviceId, patch: ServicePatch) {
      if (!hasKeys(patch)) return
      await db().update(services).set(patch).where(eq(services.id, serviceId))
    },

    async appendDunningStage(serviceId, stage) {
      const rows = await db()
        .select({ dunningCompleted: services.dunningCompleted })
        .from(services)
        .where(eq(services.id, serviceId))
        .limit(1)
      const current = toDunningStages(rows[0]?.dunningCompleted ?? [])
      if (current.includes(stage)) return current
      const next = [...current, stage]
      await db()
        .update(services)
        .set({ dunningCompleted: [...next] })
        .where(eq(services.id, serviceId))
      return next
    },

    async resetDunning(serviceId, stage) {
      await db()
        .update(services)
        .set({ dunningCompleted: [], dunningStage: stage })
        .where(eq(services.id, serviceId))
    },

    async listServicesForDunning() {
      const rows = await db()
        .select()
        .from(services)
        .where(
          and(
            isNotNull(services.nextDueAt),
            inArray(services.status, ["active", "stopped", "suspended"]),
          ),
        )
      return rows.map(mapService)
    },

    async listServicesForSync() {
      const rows = await db().select().from(services).where(ne(services.status, "terminated"))
      return rows.map(mapService)
    },

    /* ---- invoices ---- */
    async upsertInvoice(input: UpsertInvoiceInput) {
      const inserted = await db()
        .insert(invoices)
        .values({
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
        })
        .onConflictDoUpdate({
          target: invoices.whmcsInvoiceId,
          set: {
            serviceId: input.serviceId ?? null,
            status: input.status ?? "unpaid",
            subtotal: input.subtotal ?? 0,
            tax: input.tax ?? 0,
            credit: input.credit ?? 0,
            total: input.total ?? 0,
            dueAt: input.dueAt ?? null,
            paidAt: input.paidAt ?? null,
          },
        })
        .returning()
      const row = inserted[0]
      if (!row) throw new Error("failed to upsert invoice row")
      return mapInvoice(row)
    },

    async findInvoiceByWhmcsId(whmcsInvoiceId) {
      const rows = await db()
        .select()
        .from(invoices)
        .where(eq(invoices.whmcsInvoiceId, whmcsInvoiceId))
        .limit(1)
      const row = rows[0]
      return row ? mapInvoice(row) : null
    },

    async findInvoice(invoiceId) {
      const rows = await db().select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1)
      const row = rows[0]
      return row ? mapInvoice(row) : null
    },

    async findLatestUnpaidInvoiceForService(serviceId) {
      const rows = await db()
        .select()
        .from(invoices)
        .where(and(eq(invoices.serviceId, serviceId), eq(invoices.status, "unpaid")))
        .orderBy(desc(invoices.createdAt))
        .limit(1)
      const row = rows[0]
      return row ? mapInvoice(row) : null
    },

    async updateInvoice(invoiceId, patch) {
      if (!hasKeys(patch)) return
      await db().update(invoices).set(patch).where(eq(invoices.id, invoiceId))
    },

    /* ---- operations ---- */
    async recordAction(input: ActionInput) {
      const inserted = await db()
        .insert(actions)
        .values({
          serviceId: input.serviceId,
          type: input.type,
          status: input.status ?? "queued",
          ovhTaskId: input.ovhTaskId ?? null,
          payload: input.payload ?? null,
          result: input.result ?? null,
          error: input.error ?? null,
          startedAt: new Date(),
        })
        .returning({ id: actions.id })
      const row = inserted[0]
      if (!row) throw new Error("failed to insert action row")
      return row.id
    },

    async countAuditActions(entity, entityId, action) {
      const rows = await db()
        .select({ count: count() })
        .from(auditLog)
        .where(
          and(
            eq(auditLog.entity, entity),
            eq(auditLog.entityId, entityId),
            eq(auditLog.action, action),
          ),
        )
      return rows[0]?.count ?? 0
    },

    /* ---- webhooks ---- */
    async claimWebhookEvent(input) {
      const inserted = await db()
        .insert(webhookEvents)
        .values({
          provider: input.provider,
          eventId: input.eventId,
          eventType: input.eventType,
          payload: input.payload,
        })
        .onConflictDoNothing({ target: [webhookEvents.provider, webhookEvents.eventId] })
        .returning({ id: webhookEvents.id })
      return inserted.length > 0 ? "claimed" : "duplicate"
    },

    async markWebhookProcessed(provider, eventId, error) {
      await db()
        .update(webhookEvents)
        .set({ processedAt: new Date(), error: error ?? null })
        .where(and(eq(webhookEvents.provider, provider), eq(webhookEvents.eventId, eventId)))
    },
  }
}

function mapCustomer(row: typeof customers.$inferSelect, email: string): CustomerRecord {
  return {
    id: row.id,
    userId: row.userId,
    email,
    kind: row.kind,
    legalName: row.legalName,
    taxId: row.taxId,
    taxIdValidated: row.taxIdValidated,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    city: row.city,
    postalCode: row.postalCode,
    country: row.country,
    phone: row.phone,
    whmcsClientId: row.whmcsClientId,
    stripeCustomerId: row.stripeCustomerId,
    status: row.status,
  }
}
