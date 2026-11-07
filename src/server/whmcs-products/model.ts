/**
 * How the customer area reads products and domains a customer already has in WHMCS
 * (contracted before OLA, or managed by Cloudin). Pure: classification by WHMCS product
 * id, Spanish labels, ordering. The ids are the operator's catalogue (2026-11-07).
 */
import type { StatusTone } from "@/components/app/ui"

export type WhmcsProductKind = "web_hosting" | "vps" | "plesk_licence" | "ip"

/** WHMCS product ids (`pid`) per kind. A product not listed here is not shown. */
export const WHMCS_PRODUCT_IDS: Readonly<Record<WhmcsProductKind, readonly number[]>> = {
  web_hosting: [1, 2, 3, 284, 4, 125, 8, 9, 10],
  vps: [85, 14, 15, 5, 41, 42, 63],
  plesk_licence: [88],
  ip: [64],
}

const KIND_BY_PID: ReadonlyMap<number, WhmcsProductKind> = new Map(
  (Object.entries(WHMCS_PRODUCT_IDS) as [WhmcsProductKind, readonly number[]][]).flatMap(
    ([kind, ids]) => ids.map((id) => [id, kind] as const),
  ),
)

export function kindOfProduct(pid: number): WhmcsProductKind | null {
  return KIND_BY_PID.get(pid) ?? null
}

interface StatusUi {
  label: string
  tone: StatusTone
  /** Still a live service: shown first, counted on the dashboard. */
  live: boolean
}

const PRODUCT_STATUS: Readonly<Record<string, StatusUi>> = {
  Active: { label: "Activo", tone: "ok", live: true },
  Pending: { label: "Pendiente", tone: "busy", live: true },
  Suspended: { label: "Suspendido", tone: "danger", live: true },
  Fraud: { label: "En revisión", tone: "warn", live: false },
  Terminated: { label: "Dado de baja", tone: "neutral", live: false },
  Cancelled: { label: "Cancelado", tone: "neutral", live: false },
  Completed: { label: "Finalizado", tone: "neutral", live: false },
}

const DOMAIN_STATUS: Readonly<Record<string, StatusUi>> = {
  Active: { label: "Activo", tone: "ok", live: true },
  Pending: { label: "Pendiente", tone: "busy", live: true },
  "Pending Registration": { label: "Registrándose", tone: "busy", live: true },
  "Pending Transfer": { label: "Transfiriéndose", tone: "busy", live: true },
  Grace: { label: "Caducado (en gracia)", tone: "warn", live: true },
  Redemption: { label: "En redención", tone: "danger", live: true },
  Expired: { label: "Caducado", tone: "danger", live: false },
  Cancelled: { label: "Cancelado", tone: "neutral", live: false },
  "Transferred Away": { label: "Transferido a otro proveedor", tone: "neutral", live: false },
  Fraud: { label: "En revisión", tone: "warn", live: false },
}

export function productStatusUi(status: string): StatusUi {
  return PRODUCT_STATUS[status] ?? { label: status, tone: "neutral", live: false }
}

export function domainStatusUi(status: string): StatusUi {
  return DOMAIN_STATUS[status] ?? { label: status, tone: "neutral", live: false }
}

const CYCLE_LABEL: Readonly<Record<string, string>> = {
  Monthly: "al mes",
  Quarterly: "al trimestre",
  "Semi-Annually": "al semestre",
  Annually: "al año",
  Biennially: "cada 2 años",
  Triennially: "cada 3 años",
  "One Time": "pago único",
  "Free Account": "gratuito",
  Free: "gratuito",
}

export function cycleLabel(cycle: string | null): string {
  return cycle ? (CYCLE_LABEL[cycle] ?? cycle.toLowerCase()) : ""
}

/** "2026-02-06" → Date at UTC midnight; null for missing or malformed. */
export function parseWhmcsDate(value: string | null): Date | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return Number.isNaN(date.getTime()) ? null : date
}

/** Live first, then by next due date (soonest first), then newest. */
export function byRelevance<T extends { live: boolean; nextDueAt: Date | null; registeredAt: Date | null }>(
  a: T,
  b: T,
): number {
  if (a.live !== b.live) return a.live ? -1 : 1
  const dueA = a.nextDueAt?.getTime() ?? Number.POSITIVE_INFINITY
  const dueB = b.nextDueAt?.getTime() ?? Number.POSITIVE_INFINITY
  if (dueA !== dueB) return dueA - dueB
  return (b.registeredAt?.getTime() ?? 0) - (a.registeredAt?.getTime() ?? 0)
}
