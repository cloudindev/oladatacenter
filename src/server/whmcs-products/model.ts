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

export interface StatusUi {
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

/** Suffix after the amount: "/mes" joins it ("72,00 €/mes"), words get a space. */
const CYCLE_LABEL: Readonly<Record<string, string>> = {
  Monthly: "/mes",
  Quarterly: "/trimestre",
  "Semi-Annually": "/semestre",
  Annually: "/año",
  Biennially: "/2 años",
  Triennially: "/3 años",
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

/**
 * An active service or domain whose due date has already passed is still running but
 * unpaid: WHMCS keeps it "Active" while it waits for the invoice. Shown as a grace period.
 */
export function withGracePeriod(
  ui: StatusUi,
  status: string,
  dueAt: Date | null,
  now: Date,
): StatusUi {
  if (status !== "Active" || dueAt === null) return ui
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return dueAt.getTime() < today ? { label: "Periodo de gracia", tone: "warn", live: true } : ui
}

/** "15,43 €/año", "30,00 €/2 años". */
export function perYearsLabel(years: number | null): string {
  const count = years ?? 1
  return count === 1 ? "año" : `${count} años`
}

/** How long an inactive service or domain stays visible after it ended. */
export const INACTIVE_VISIBLE_DAYS = 31

/**
 * Inactive items are shown for a month after they ended, then dropped. `end` is the last
 * due date (or expiry for a domain); without one, the registration date stands in.
 */
export function stillVisible(
  item: { live: boolean; end: Date | null },
  now: Date,
): boolean {
  if (item.live) return true
  if (item.end === null) return false
  return now.getTime() - item.end.getTime() <= INACTIVE_VISIBLE_DAYS * 24 * 60 * 60 * 1000
}

/**
 * Each renewal WHMCS has not invoiced, dated on its renewal day, tax included: what the
 * billing widget adds so its totals match "Mi saldo".
 */
export function uninvoicedRenewals(
  lines: readonly OverdueLine[],
  taxRate: number,
): { dueAt: Date; totalCents: number }[] {
  const out: { dueAt: Date; totalCents: number }[] = []
  for (const line of lines) {
    for (let k = 1; k <= line.uninvoicedPeriods; k += 1) {
      out.push({
        dueAt: addMonthsUtc(line.since, line.months * k),
        totalCents: Math.round(line.amountCents * (1 + taxRate)),
      })
    }
  }
  return out
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

// ─── invoices ────────────────────────────────────────────────────────────────

export interface InvoiceStatusUi {
  label: string
  tone: StatusTone
  /** Still owed: counts towards the pending balance. */
  owed: boolean
}

/** Spanish label for a WHMCS invoice status; an unpaid one past its due date is "Vencida". */
export function invoiceStatusUi(status: string, dueAt: Date | null, now: Date): InvoiceStatusUi {
  switch (status) {
    case "Paid":
      return { label: "Pagada", tone: "ok", owed: false }
    case "Unpaid": {
      const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
      const overdue = dueAt !== null && dueAt.getTime() < today
      return overdue
        ? { label: "Vencida", tone: "danger", owed: true }
        : { label: "Pendiente", tone: "warn", owed: true }
    }
    case "Collections":
      return { label: "En reclamación", tone: "danger", owed: true }
    case "Payment Pending":
      return { label: "Pago en curso", tone: "busy", owed: false }
    case "Refunded":
      return { label: "Reembolsada", tone: "neutral", owed: false }
    case "Cancelled":
      return { label: "Anulada", tone: "neutral", owed: false }
    default:
      return { label: status, tone: "neutral", owed: false }
  }
}

/**
 * What the customer owes today: the outstanding balance of every owed invoice issued up
 * to now. A future-dated invoice (issued ahead of a renewal) does not count yet.
 */
export function pendingBalance(
  invoices: readonly { owed: boolean; issuedAt: Date | null; balanceCents: number }[],
  now: Date,
): { cents: number; count: number } {
  let cents = 0
  let count = 0
  for (const invoice of invoices) {
    if (!invoice.owed) continue
    if (invoice.issuedAt !== null && invoice.issuedAt.getTime() > now.getTime()) continue
    cents += invoice.balanceCents
    count += 1
  }
  return { cents, count }
}

// ─── what the customer owes to be up to date ─────────────────────────────────

const CYCLE_MONTHS: Readonly<Record<string, number>> = {
  Monthly: 1,
  Quarterly: 3,
  "Semi-Annually": 6,
  Annually: 12,
  Biennially: 24,
  Triennially: 36,
}

/** Months per billing cycle; null for one-off or free products, which never recur. */
export function cycleMonths(cycle: string | null): number | null {
  return cycle ? (CYCLE_MONTHS[cycle] ?? null) : null
}

/** Adds whole months in UTC, clamping to the month's last day (31 Jan + 1 → 28/29 Feb). */
export function addMonthsUtc(date: Date, months: number): Date {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + months
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay)))
}

/** How many renewal dates, starting at `dueAt`, have arrived by `now` (0 if not due yet). */
export function cyclesDue(dueAt: Date, months: number, now: Date): number {
  let count = 0
  for (let at = dueAt; at.getTime() <= now.getTime() && count < 240; count += 1) {
    at = addMonthsUtc(dueAt, months * (count + 1))
  }
  return count
}

export interface OverdueLine {
  name: string
  /** First unpaid renewal date. */
  since: Date
  /** Renewal dates reached by today. */
  periods: number
  /** Periods WHMCS has not invoiced yet: all but the first, which is on the unpaid invoice. */
  uninvoicedPeriods: number
  /** Price per period, before tax, in cents. */
  amountCents: number
  /** Months per period, to date each uninvoiced renewal. */
  months: number
}

/**
 * One line per recurring service or domain whose renewal date has passed. WHMCS invoices
 * only the first missed period and generates nothing more while it stays unpaid, so the
 * rest is counted here.
 */
export function overdueLine(input: {
  name: string
  dueAt: Date | null
  months: number | null
  amountCents: number
  now: Date
}): OverdueLine | null {
  if (input.dueAt === null || input.months === null || input.amountCents <= 0) return null
  const periods = cyclesDue(input.dueAt, input.months, input.now)
  if (periods === 0) return null
  return {
    name: input.name,
    since: input.dueAt,
    periods,
    uninvoicedPeriods: periods - 1,
    amountCents: input.amountCents,
    months: input.months,
  }
}
