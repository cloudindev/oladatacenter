/**
 * Query string → store filter.
 *
 * The filter state lives in the URL, in Spanish, so a filtered list is a link an operator
 * can paste into an incident thread. The dashboard tiles link to the named presets
 * (`en_curso`, `retrasados`) rather than to a list of raw statuses.
 */
import {
  ORDER_STATUSES,
  SERVICE_STATUSES,
  type OrderStatus,
  type ServiceStatus,
} from "@ola/core"
import type { AuditFilter, CustomerFilter, OrderFilter, PaymentFilter, ServiceFilter } from "./store"

export type RawSearchParams = Record<string, string | string[] | undefined>

export function one(params: RawSearchParams, key: string): string {
  const value = params[key]
  const first = Array.isArray(value) ? value[0] : value
  return typeof first === "string" ? first.trim() : ""
}

/** `"hoy"` resolves against `now` so the dashboard link keeps working tomorrow. */
function day(raw: string, now: Date): Date | undefined {
  if (raw === "") return undefined
  if (raw === "hoy") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  }
  const parsed = new Date(`${raw}T00:00:00Z`)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

function endOfDay(raw: string, now: Date): Date | undefined {
  const start = day(raw, now)
  if (!start) return undefined
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1)
}

// ─── orders ──────────────────────────────────────────────────────────────────

/** Named presets the dashboard links to, plus any single `OrderStatus`. */
export const ORDER_PRESETS = {
  en_curso: ["pending_payment", "paid", "provisioning"] as const,
  retrasados: ["delayed", "paid", "provisioning"] as const,
  atencion: ["delayed", "failed"] as const,
}

export type OrderPreset = keyof typeof ORDER_PRESETS

export function orderFilterFrom(params: RawSearchParams, now: Date): OrderFilter {
  const estado = one(params, "estado")
  const preset = estado in ORDER_PRESETS ? ORDER_PRESETS[estado as OrderPreset] : null
  const single = (ORDER_STATUSES as readonly string[]).includes(estado)
    ? [estado as OrderStatus]
    : null

  const filter: OrderFilter = { limit: 100 }
  const status = preset ?? single
  if (status) filter.status = [...status]
  const query = one(params, "q")
  if (query) filter.query = query
  const from = day(one(params, "desde"), now)
  if (from) filter.from = from
  const to = endOfDay(one(params, "hasta"), now)
  if (to) filter.to = to
  return filter
}

/** `retrasados` also needs the SLA check, which only `deliveryState` can decide. */
export function wantsLateOnly(params: RawSearchParams): boolean {
  return one(params, "estado") === "retrasados"
}

// ─── services ────────────────────────────────────────────────────────────────

export function serviceFilterFrom(params: RawSearchParams): ServiceFilter {
  const filter: ServiceFilter = { limit: 100 }
  const estado = one(params, "estado")
  if ((SERVICE_STATUSES as readonly string[]).includes(estado)) {
    filter.status = [estado as ServiceStatus]
  }
  const datacenter = one(params, "dc")
  if (datacenter) filter.datacenter = datacenter
  const planId = one(params, "plan")
  if (planId) filter.planId = planId
  const query = one(params, "q")
  if (query) filter.query = query
  return filter
}

// ─── customers ───────────────────────────────────────────────────────────────

export const CUSTOMER_STATUSES = ["unverified", "verified", "review", "blocked"] as const

export function customerFilterFrom(params: RawSearchParams): CustomerFilter {
  const filter: CustomerFilter = { limit: 100 }
  const estado = one(params, "estado")
  if ((CUSTOMER_STATUSES as readonly string[]).includes(estado)) filter.status = [estado]
  const query = one(params, "q")
  if (query) filter.query = query
  return filter
}

// ─── payments ────────────────────────────────────────────────────────────────

export const PAYMENT_OUTCOMES = ["all", "succeeded", "failed", "refunded", "disputed"] as const

export function paymentFilterFrom(params: RawSearchParams, now: Date): PaymentFilter {
  const filter: PaymentFilter = { limit: 100 }
  const outcome = one(params, "resultado")
  if ((PAYMENT_OUTCOMES as readonly string[]).includes(outcome)) {
    filter.outcome = outcome as PaymentFilter["outcome"]
  }
  const query = one(params, "q")
  if (query) filter.query = query
  const from = day(one(params, "desde"), now)
  if (from) filter.from = from
  const to = endOfDay(one(params, "hasta"), now)
  if (to) filter.to = to
  return filter
}

// ─── audit ───────────────────────────────────────────────────────────────────

export function auditFilterFrom(params: RawSearchParams, now: Date): AuditFilter {
  const filter: AuditFilter = { limit: 200 }
  const entity = one(params, "entidad")
  if (entity) filter.entity = entity
  const entityId = one(params, "id")
  if (entityId) filter.entityId = entityId
  const actorId = one(params, "actor")
  if (actorId) filter.actorId = actorId
  const from = day(one(params, "desde"), now)
  if (from) filter.from = from
  const to = endOfDay(one(params, "hasta"), now)
  if (to) filter.to = to
  return filter
}

/** True when the operator applied anything, so the list can offer "quitar filtros". */
export function hasAnyFilter(params: RawSearchParams, keys: readonly string[]): boolean {
  return keys.some((key) => one(params, key) !== "")
}
