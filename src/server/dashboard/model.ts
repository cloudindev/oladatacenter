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
  /** A renewal owed but not invoiced yet: counts as pending, not as an invoice. */
  estimated?: boolean
}

export interface InvoiceTotals {
  /** Sum of the invoices issued in the period, cancelled ones excluded. */
  total: number
  /** Real invoices only. */
  count: number
  /** Part of the total still unpaid, renewals not yet invoiced included. */
  unpaid: number
  /** Renewals owed but not invoiced yet, in cents. */
  estimated: number
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
  let estimated = 0
  for (const invoice of invoices) {
    if (invoice.status === "cancelled") continue
    const at = invoice.issuedAt.getTime()
    if (at < from.getTime() || at >= to.getTime()) continue
    total += invoice.total
    if (invoice.estimated) estimated += invoice.total
    else count += 1
    if (invoice.status === "unpaid") unpaid += invoice.total
  }
  return { total, count, unpaid, estimated }
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

/** Invoiced per calendar month (UTC), oldest first, for the last `months` months. */
export function monthlyTotals(
  invoices: readonly InvoiceLike[],
  months: number,
  now: Date,
): { key: string; label: string; total: number; unpaid: number }[] {
  const names = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
  const buckets = Array.from({ length: months }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1 - index), 1))
    return {
      key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
      label: names[date.getUTCMonth()] ?? "",
      total: 0,
      unpaid: 0,
    }
  })
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]))
  for (const invoice of invoices) {
    if (invoice.status === "cancelled") continue
    const key = `${invoice.issuedAt.getUTCFullYear()}-${String(invoice.issuedAt.getUTCMonth() + 1).padStart(2, "0")}`
    const bucket = byKey.get(key)
    if (!bucket) continue
    bucket.total += invoice.total
    if (invoice.status === "unpaid") bucket.unpaid += invoice.total
  }
  return buckets
}
