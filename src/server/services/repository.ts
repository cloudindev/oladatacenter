import "server-only"
import { and, desc, eq } from "drizzle-orm"
import {
  actionStatusFromOvhTask,
  datacenterLabel,
  isOvhTaskTerminal,
  resolvePrice,
  type ActionStatus,
  type OvhTaskState,
  type ServiceAction,
  type ServiceStatus,
  type Term,
} from "@ola/core"
import { actions, addons, auditLog, db, plans, serviceAddons, services, sshKeys } from "@ola/db"
import type {
  ActionRecordView,
  AuditEntryView,
  PlanSpecsView,
  ServiceAddonView,
  ServiceListItem,
  ServiceRecord,
  SshKeyView,
} from "./types"

/**
 * Typed data access for the customer server area.
 *
 * Two invariants every function here upholds:
 *  1. A service is always looked up by id **and** customer id. `getServiceForCustomer`
 *     returns `null` for a service that belongs to somebody else, so the caller can
 *     answer 404 and never leak that the id exists.
 *  2. Nothing is ever deleted. An action or audit row is only ever appended or updated.
 */

const serviceColumns = {
  id: services.id,
  customerId: services.customerId,
  displayName: services.displayName,
  ovhServiceName: services.ovhServiceName,
  datacenter: services.datacenter,
  os: services.os,
  ipv4: services.ipv4,
  ipv6: services.ipv6,
  status: services.status,
  term: services.term,
  monthlyPrice: services.monthlyPrice,
  nextDueAt: services.nextDueAt,
  autoRenew: services.autoRenew,
  dunningStage: services.dunningStage,
  rescueMode: services.rescueMode,
  ovhExpiresAt: services.ovhExpiresAt,
  createdAt: services.createdAt,
  planId: services.planId,
  planName: plans.name,
  planSlug: plans.slug,
  ovhPlanCode: plans.ovhPlanCode,
  vcores: plans.vcores,
  ramGb: plans.ramGb,
  nvmeGb: plans.nvmeGb,
  bandwidthMbps: plans.bandwidthMbps,
}

/** Shape of one `serviceColumns` row. Declared explicitly so the mapper stays honest. */
interface ServiceRow {
  id: string
  customerId: string
  displayName: string | null
  ovhServiceName: string | null
  datacenter: string
  os: string
  ipv4: string | null
  ipv6: string | null
  status: ServiceStatus
  term: Term
  monthlyPrice: number
  nextDueAt: Date | null
  autoRenew: boolean
  dunningStage: string
  rescueMode: boolean
  ovhExpiresAt: Date | null
  createdAt: Date
  planId: string
  planName: string
  planSlug: string
  ovhPlanCode: string
  vcores: number
  ramGb: number
  nvmeGb: number
  bandwidthMbps: number
}

function toServiceRecord(row: ServiceRow): ServiceRecord {
  const name = row.displayName?.trim() ? row.displayName.trim() : row.planName
  return {
    id: row.id,
    customerId: row.customerId,
    name,
    planId: row.planId,
    planName: row.planName,
    planSlug: row.planSlug,
    ovhPlanCode: row.ovhPlanCode,
    ovhServiceName: row.ovhServiceName,
    specs: {
      vcores: row.vcores,
      ramGb: row.ramGb,
      nvmeGb: row.nvmeGb,
      bandwidthMbps: row.bandwidthMbps,
    },
    os: row.os,
    datacenterLabel: datacenterLabel(row.datacenter) ?? row.datacenter,
    ipv4: row.ipv4,
    ipv6: row.ipv6,
    status: row.status,
    term: row.term,
    monthlyPrice: row.monthlyPrice,
    nextDueAt: row.nextDueAt,
    autoRenew: row.autoRenew,
    dunningStage: row.dunningStage,
    rescueMode: row.rescueMode,
    ovhExpiresAt: row.ovhExpiresAt,
    createdAt: row.createdAt,
  }
}

/** Only the fields the browser is allowed to see. */
export function toListItem(record: ServiceRecord): ServiceListItem {
  return {
    id: record.id,
    name: record.name,
    planName: record.planName,
    planSlug: record.planSlug,
    specs: record.specs,
    os: record.os,
    datacenterLabel: record.datacenterLabel,
    ipv4: record.ipv4,
    ipv6: record.ipv6,
    status: record.status,
    term: record.term,
    monthlyPrice: record.monthlyPrice,
    nextDueAt: record.nextDueAt,
    autoRenew: record.autoRenew,
    dunningStage: record.dunningStage,
    rescueMode: record.rescueMode,
    createdAt: record.createdAt,
  }
}

// ─── reads ───────────────────────────────────────────────────────────────────

/** Every server of one customer, newest first. Cancelled ones are kept visible. */
export async function listServicesForCustomer(customerId: string): Promise<ServiceListItem[]> {
  const rows = await db()
    .select(serviceColumns)
    .from(services)
    .innerJoin(plans, eq(plans.id, services.planId))
    .where(eq(services.customerId, customerId))
    .orderBy(desc(services.createdAt))

  return rows.map((row) => toListItem(toServiceRecord(row)))
}

/**
 * One service, scoped to its owner. `null` means "not yours or not there" — the caller
 * answers 404 either way, so the two cases are indistinguishable from outside.
 */
export async function getServiceForCustomer(
  serviceId: string,
  customerId: string,
): Promise<ServiceRecord | null> {
  const rows = await db()
    .select(serviceColumns)
    .from(services)
    .innerJoin(plans, eq(plans.id, services.planId))
    .where(and(eq(services.id, serviceId), eq(services.customerId, customerId)))
    .limit(1)

  const row = rows[0]
  return row ? toServiceRecord(row) : null
}

export async function listServiceAddons(serviceId: string): Promise<ServiceAddonView[]> {
  const rows = await db()
    .select({
      id: serviceAddons.id,
      status: serviceAddons.status,
      monthlyPrice: serviceAddons.monthlyPrice,
      name: addons.name,
      family: addons.family,
    })
    .from(serviceAddons)
    .innerJoin(addons, eq(addons.id, serviceAddons.addonId))
    .where(eq(serviceAddons.serviceId, serviceId))

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    family: row.family,
    monthlyPrice: row.monthlyPrice,
    status: row.status,
  }))
}

export async function listSshKeysForCustomer(customerId: string): Promise<SshKeyView[]> {
  const rows = await db()
    .select({
      id: sshKeys.id,
      name: sshKeys.name,
      fingerprint: sshKeys.fingerprint,
      publicKey: sshKeys.publicKey,
    })
    .from(sshKeys)
    .where(eq(sshKeys.customerId, customerId))
    .orderBy(desc(sshKeys.createdAt))

  return rows
}

/**
 * Plans more expensive than the one this service is on, with **our** price.
 *
 * The cost never leaves this function: `resolvePrice` turns it into the sale price here
 * and only that number is returned. `ovhPlanCode` is returned because the OVH upgrade
 * list is matched on it, and it is never rendered.
 */
export interface UpgradeCandidate {
  id: string
  name: string
  slug: string
  /** Server-side only, for matching `listAvailableUpgrades`. */
  ovhPlanCode: string
  specs: PlanSpecsView
  monthlyPrice: number
}

export async function listPlansAbove(monthlyPrice: number): Promise<UpgradeCandidate[]> {
  const rows = await db()
    .select({
      id: plans.id,
      name: plans.name,
      slug: plans.slug,
      ovhPlanCode: plans.ovhPlanCode,
      vcores: plans.vcores,
      ramGb: plans.ramGb,
      nvmeGb: plans.nvmeGb,
      bandwidthMbps: plans.bandwidthMbps,
      costMonth: plans.costMonth,
      priceMonth: plans.priceMonth,
      margin: plans.margin,
      active: plans.active,
    })
    .from(plans)
    .orderBy(plans.sort)

  return rows
    .filter((row) => row.active)
    .map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      ovhPlanCode: row.ovhPlanCode,
      specs: {
        vcores: row.vcores,
        ramGb: row.ramGb,
        nvmeGb: row.nvmeGb,
        bandwidthMbps: row.bandwidthMbps,
      },
      monthlyPrice: resolvePrice(row.costMonth, row.margin / 10_000, row.priceMonth).price,
    }))
    .filter((candidate) => candidate.monthlyPrice > monthlyPrice)
}

export interface ContractableAddon {
  id: string
  name: string
  family: string
  monthlyPrice: number
}

/**
 * Optional add-ons this plan accepts and the service does not have yet. Mandatory
 * families are excluded: they are part of the plan and never offered again.
 */
export async function listContractableAddons(
  ovhPlanCode: string,
  serviceId: string,
): Promise<ContractableAddon[]> {
  const [rows, current] = await Promise.all([
    db()
      .select({
        id: addons.id,
        name: addons.name,
        family: addons.family,
        costMonth: addons.costMonth,
        priceMonth: addons.priceMonth,
        margin: addons.margin,
        appliesTo: addons.appliesTo,
        mandatory: addons.mandatory,
        active: addons.active,
      })
      .from(addons)
      .orderBy(addons.sort),
    db()
      .select({ addonId: serviceAddons.addonId, status: serviceAddons.status })
      .from(serviceAddons)
      .where(eq(serviceAddons.serviceId, serviceId)),
  ])

  const held = new Set(
    current.filter((row) => row.status !== "removed").map((row) => row.addonId),
  )

  return rows
    .filter(
      (row) =>
        row.active &&
        !row.mandatory &&
        !held.has(row.id) &&
        row.appliesTo.includes(ovhPlanCode),
    )
    .map((row) => ({
      id: row.id,
      name: row.name,
      family: row.family,
      monthlyPrice: resolvePrice(row.costMonth, row.margin / 10_000, row.priceMonth).price,
    }))
}

// ─── actions ─────────────────────────────────────────────────────────────────

/**
 * Appends one row to `actions` before OVH is called, so a request that dies halfway
 * still leaves a trace the customer and the admin can see.
 */
export async function recordAction(input: {
  serviceId: string
  userId: string | null
  type: ServiceAction
  payload?: Record<string, unknown>
}): Promise<string> {
  const inserted = await db()
    .insert(actions)
    .values({
      serviceId: input.serviceId,
      userId: input.userId,
      type: input.type,
      status: "queued",
      payload: input.payload ?? null,
      startedAt: new Date(),
    })
    .returning({ id: actions.id })

  const id = inserted[0]?.id
  if (!id) throw new Error("could not record the action")
  return id
}

/** Stores the OVH task id the moment the call returns, so polling can start. */
export async function attachOvhTask(actionId: string, ovhTaskId: number): Promise<void> {
  await db()
    .update(actions)
    .set({ ovhTaskId, status: "running" })
    .where(eq(actions.id, actionId))
}

/**
 * Maps a real OVH task state onto the action row. The UI never invents progress:
 * it shows what this function last wrote.
 */
export async function updateActionFromTask(
  actionId: string,
  task: { id: number; state: OvhTaskState },
): Promise<{ status: ActionStatus; terminal: boolean }> {
  const status = actionStatusFromOvhTask(task.state)
  const terminal = isOvhTaskTerminal(task.state)

  await db()
    .update(actions)
    .set({
      ovhTaskId: task.id,
      status,
      error: status === "error" ? `La tarea del proveedor terminó en estado ${task.state}` : null,
      finishedAt: terminal ? new Date() : null,
    })
    .where(eq(actions.id, actionId))

  return { status, terminal }
}

/** An action with no OVH task (rename, rDNS, auto-renew) finishes immediately. */
export async function completeAction(
  actionId: string,
  result?: Record<string, unknown>,
): Promise<void> {
  await db()
    .update(actions)
    .set({ status: "done", result: result ?? null, finishedAt: new Date() })
    .where(eq(actions.id, actionId))
}

export async function failAction(actionId: string, message: string): Promise<void> {
  await db()
    .update(actions)
    .set({ status: "error", error: message, finishedAt: new Date() })
    .where(eq(actions.id, actionId))
}

export async function listRecentActions(
  serviceId: string,
  limit = 20,
): Promise<ActionRecordView[]> {
  const rows = await db()
    .select({
      id: actions.id,
      type: actions.type,
      status: actions.status,
      error: actions.error,
      createdAt: actions.createdAt,
      finishedAt: actions.finishedAt,
    })
    .from(actions)
    .where(eq(actions.serviceId, serviceId))
    .orderBy(desc(actions.createdAt))
    .limit(limit)

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    status: row.status,
    error: row.error,
    createdAt: row.createdAt,
    finishedAt: row.finishedAt,
    terminal: row.status === "done" || row.status === "error",
  }))
}

/** One action, scoped to its service. Used by the polling route handler. */
export async function getActionForService(
  actionId: string,
  serviceId: string,
): Promise<{ view: ActionRecordView; ovhTaskId: number | null } | null> {
  const rows = await db()
    .select({
      id: actions.id,
      type: actions.type,
      status: actions.status,
      error: actions.error,
      createdAt: actions.createdAt,
      finishedAt: actions.finishedAt,
      ovhTaskId: actions.ovhTaskId,
    })
    .from(actions)
    .where(and(eq(actions.id, actionId), eq(actions.serviceId, serviceId)))
    .limit(1)

  const row = rows[0]
  if (!row) return null
  return {
    ovhTaskId: row.ovhTaskId,
    view: {
      id: row.id,
      type: row.type,
      status: row.status,
      error: row.error,
      createdAt: row.createdAt,
      finishedAt: row.finishedAt,
      terminal: row.status === "done" || row.status === "error",
    },
  }
}

export async function listAuditForService(
  serviceId: string,
  limit = 30,
): Promise<AuditEntryView[]> {
  const rows = await db()
    .select({
      id: auditLog.id,
      action: auditLog.action,
      actorType: auditLog.actorType,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .where(and(eq(auditLog.entity, "service"), eq(auditLog.entityId, serviceId)))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit)

  return rows
}

// ─── writes on our own record ────────────────────────────────────────────────

/** The display name is ours only: it is never pushed to OVH. */
export async function renameService(serviceId: string, displayName: string): Promise<void> {
  await db().update(services).set({ displayName }).where(eq(services.id, serviceId))
}

export async function setServiceAutoRenew(serviceId: string, autoRenew: boolean): Promise<void> {
  await db().update(services).set({ autoRenew }).where(eq(services.id, serviceId))
}

export async function setServiceRescueMode(serviceId: string, rescueMode: boolean): Promise<void> {
  await db().update(services).set({ rescueMode }).where(eq(services.id, serviceId))
}
