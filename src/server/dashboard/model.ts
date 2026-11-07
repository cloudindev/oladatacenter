/**
 * Pure rules behind the customer dashboard: how each service's payment state is told,
 * and the invoice totals per period. No I/O, so they are unit-tested.
 */
import type { StatusTone } from "@/components/app/ui"

export interface RenewalInput {
  status: string
  autoRenew: boolean
  dunningStage: string
  nextDueAt: Date | null
}

export interface RenewalState {
  label: string
  tone: StatusTone
  /** The date the line under the badge refers to, if any. */
  date: Date | null
  /** "desde el", "el" … prefix for that date. */
  datePrefix: string
}

const OVERDUE_STAGES = new Set(["charging", "retry_1", "retry_2"])

/** What the "Estado de pago de tus servicios" card says for one service. */
export function renewalState(service: RenewalInput): RenewalState {
  const due = service.nextDueAt
  switch (service.status) {
    case "terminated":
      return { label: "Dado de baja", tone: "neutral", date: null, datePrefix: "" }
    case "terminating":
      return { label: "Baja programada", tone: "warn", date: due, datePrefix: "el" }
    case "suspended":
      return { label: "Suspendido por impago", tone: "danger", date: due, datePrefix: "vencía el" }
    case "provisioning":
      return { label: "Creándose", tone: "busy", date: null, datePrefix: "" }
    case "review":
      return { label: "En revisión", tone: "warn", date: null, datePrefix: "" }
  }
  if (OVERDUE_STAGES.has(service.dunningStage)) {
    return { label: "Pago pendiente", tone: "danger", date: due, datePrefix: "vencía el" }
  }
  if (!service.autoRenew) {
    return { label: "Renovación cancelada", tone: "warn", date: due, datePrefix: "se da de baja el" }
  }
  return { label: "Renovación automática", tone: "ok", date: due, datePrefix: "" }
}

export const INVOICE_PERIODS = [
  { key: "mes", label: "Este mes" },
  { key: "mes-pasado", label: "El mes pasado" },
  { key: "12-meses", label: "Últimos 12 meses" },
] as const

export type InvoicePeriod = (typeof INVOICE_PERIODS)[number]["key"]

export function parsePeriod(value: string | undefined): InvoicePeriod {
  return INVOICE_PERIODS.some((period) => period.key === value)
    ? (value as InvoicePeriod)
    : "mes-pasado"
}

/** [from, to) in UTC for a period, relative to `now`. */
export function periodRange(period: InvoicePeriod, now: Date): { from: Date; to: Date } {
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()
  if (period === "mes") {
    return { from: new Date(Date.UTC(year, month, 1)), to: new Date(Date.UTC(year, month + 1, 1)) }
  }
  if (period === "mes-pasado") {
    return { from: new Date(Date.UTC(year, month - 1, 1)), to: new Date(Date.UTC(year, month, 1)) }
  }
  return { from: new Date(Date.UTC(year, month - 11, 1)), to: new Date(Date.UTC(year, month + 1, 1)) }
}

export interface InvoiceLike {
  issuedAt: Date
  status: "unpaid" | "paid" | "cancelled" | "refunded"
  total: number
}

export interface InvoiceTotals {
  /** Sum of the invoices issued in the period, cancelled ones excluded. */
  total: number
  count: number
  /** Part of the total still unpaid. */
  unpaid: number
}

export function invoiceTotals(
  invoices: readonly InvoiceLike[],
  period: InvoicePeriod,
  now: Date,
): InvoiceTotals {
  const { from, to } = periodRange(period, now)
  let total = 0
  let count = 0
  let unpaid = 0
  for (const invoice of invoices) {
    if (invoice.status === "cancelled") continue
    const at = invoice.issuedAt.getTime()
    if (at < from.getTime() || at >= to.getTime()) continue
    total += invoice.total
    count += 1
    if (invoice.status === "unpaid") unpaid += invoice.total
  }
  return { total, count, unpaid }
}

/** True when the card expires before the end of the month `days` from now. */
export function cardExpiresSoon(
  card: { expMonth: number | null; expYear: number | null },
  now: Date,
  days = 45,
): boolean {
  if (card.expMonth === null || card.expYear === null) return false
  // A card is valid through the last day of its expiry month.
  const expiry = new Date(Date.UTC(card.expYear, card.expMonth, 1))
  return expiry.getTime() - now.getTime() <= days * 24 * 60 * 60 * 1000
}
