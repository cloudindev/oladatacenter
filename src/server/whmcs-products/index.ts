import "server-only"
import { cache } from "react"
import { eq, isNotNull, and } from "drizzle-orm"
import { customers, db, services } from "@ola/db"
import type { StatusTone } from "@/components/app/ui"
import { whmcsReader } from "@/server/providers"
import { nameserversOf } from "./nameservers"
import {
  byRelevance,
  cycleLabel,
  perYearsLabel,
  stillVisible,
  withGracePeriod,
  domainStatusUi,
  cycleMonths,
  invoiceStatusUi,
  kindOfProduct,
  overdueLine,
  pendingBalance,
  type OverdueLine,
  parseWhmcsDate,
  productStatusUi,
  type WhmcsProductKind,
} from "./model"

/**
 * A customer's existing WHMCS products and domains, for the customer area. Read-only and
 * reduced to what the screen shows: WHMCS also returns service passwords, usernames and
 * registrar data, none of which leaves this module.
 */

export interface WhmcsProductView {
  id: number
  kind: WhmcsProductKind
  name: string
  /** The domain or label WHMCS shows for the service. */
  label: string | null
  ips: readonly string[]
  status: string
  statusLabel: string
  tone: StatusTone
  live: boolean
  registeredAt: Date | null
  nextDueAt: Date | null
  amountCents: number
  cycle: string
}

export interface WhmcsDomainView {
  id: number
  domain: string
  statusLabel: string
  tone: StatusTone
  live: boolean
  registeredAt: Date | null
  expiresAt: Date | null
  nextDueAt: Date | null
  amountCents: number
  /** "año", "2 años"… for "15,43 €/año". */
  periodLabel: string
  autoRenew: boolean
  /** Nameservers as published in public DNS; null when the lookup failed. */
  nameservers: readonly string[] | null
}

export type WhmcsRead<T> =
  | { state: "ok"; items: readonly T[] }
  /** The customer has no WHMCS account linked: nothing to show, not an error. */
  | { state: "not_linked" }
  | { state: "unavailable"; reason: "permission" | "error" }

async function linkedClient(customerId: string): Promise<number | null> {
  const rows = await db()
    .select({ whmcsClientId: customers.whmcsClientId })
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1)
  return rows[0]?.whmcsClientId ?? null
}

/** WHMCS service ids that OLA already shows as its own servers. */
async function olaManagedServiceIds(customerId: string): Promise<Set<number>> {
  const rows = await db()
    .select({ id: services.whmcsServiceId })
    .from(services)
    .where(and(eq(services.customerId, customerId), isNotNull(services.whmcsServiceId)))
  return new Set(rows.map((row) => row.id).filter((id): id is number => id !== null))
}

function failure(error: unknown): { state: "unavailable"; reason: "permission" | "error" } {
  const message = error instanceof Error ? error.message : String(error)
  console.warn("[whmcs-products] read failed", { error: message })
  return { state: "unavailable", reason: /permission|not allowed/i.test(message) ? "permission" : "error" }
}

/**
 * Every classified product of the customer, live first. Cached per request, so the
 * dashboard and the pages that read several kinds hit WHMCS once.
 */
/** Raw WHMCS rows, cached per request so every card and page asks WHMCS once. */
const rawServices = cache((clientId: number) => whmcsReader().listServices(clientId))
const rawDomains = cache((clientId: number) => whmcsReader().listDomains(clientId))

export const whmcsProductsFor = cache(
  async (customerId: string): Promise<WhmcsRead<WhmcsProductView>> => {
    const clientId = await linkedClient(customerId)
    if (clientId === null) return { state: "not_linked" }
    try {
      const [rows, olaIds] = await Promise.all([
        rawServices(clientId),
        olaManagedServiceIds(customerId),
      ])
      const now = new Date()
      const items: WhmcsProductView[] = []
      for (const row of rows) {
        const kind = kindOfProduct(row.pid)
        if (kind === null || olaIds.has(row.serviceId)) continue
        const registeredAt = parseWhmcsDate(row.registrationDate)
        const nextDueAt = parseWhmcsDate(row.nextDueDate)
        const ui = withGracePeriod(productStatusUi(row.status), row.status, nextDueAt, now)
        if (!stillVisible({ live: ui.live, end: nextDueAt ?? registeredAt }, now)) continue
        items.push({
          id: row.serviceId,
          kind,
          name: row.productName ?? "Servicio",
          label: row.domain,
          ips: row.ips,
          status: row.status,
          statusLabel: ui.label,
          tone: ui.tone,
          live: ui.live,
          registeredAt,
          nextDueAt,
          amountCents: row.recurringAmountCents,
          cycle: cycleLabel(row.billingCycle),
        })
      }
      return { state: "ok", items: items.sort(byRelevance) }
    } catch (error) {
      return failure(error)
    }
  },
)

/** Only the products of one kind, keeping the same states. */
export async function whmcsProductsOfKind(
  customerId: string,
  kind: WhmcsProductKind,
): Promise<WhmcsRead<WhmcsProductView>> {
  const all = await whmcsProductsFor(customerId)
  return all.state === "ok" ? { state: "ok", items: all.items.filter((item) => item.kind === kind) } : all
}

export const whmcsDomainsFor = cache(
  async (customerId: string): Promise<WhmcsRead<WhmcsDomainView>> => {
    const clientId = await linkedClient(customerId)
    if (clientId === null) return { state: "not_linked" }
    try {
      const rows = await rawDomains(clientId)
      const now = new Date()
      const items = rows.map((row): WhmcsDomainView => {
        // Most domains in WHMCS have no expiry date (no registrar module): the next due
        // date is when they have to be renewed, so it stands in.
        const expiresAt = parseWhmcsDate(row.expiryDate) ?? parseWhmcsDate(row.nextDueDate)
        const ui = withGracePeriod(domainStatusUi(row.status), row.status, expiresAt, now)
        return {
          id: row.domainId,
          domain: row.domain,
          statusLabel: ui.label,
          tone: ui.tone,
          live: ui.live,
          registeredAt: parseWhmcsDate(row.registrationDate),
          expiresAt,
          nextDueAt: parseWhmcsDate(row.nextDueDate),
          amountCents: row.recurringAmountCents,
          periodLabel: perYearsLabel(row.registrationPeriod),
          autoRenew: !row.doNotRenew,
          nameservers: null,
        }
      })
      const visible = items.filter((item) =>
        stillVisible({ live: item.live, end: item.expiresAt ?? item.nextDueAt ?? item.registeredAt }, now),
      )
      // Nameservers only for the live ones: the inactive ones may not resolve at all.
      await Promise.all(
        visible.map(async (item) => {
          if (item.live) item.nameservers = await nameserversOf(item.domain)
        }),
      )
      return { state: "ok", items: visible.sort(byRelevance) }
    } catch (error) {
      return failure(error)
    }
  },
)

// ─── invoices ────────────────────────────────────────────────────────────────

export interface WhmcsInvoiceView {
  /** WHMCS invoice id: what the PDF link needs. */
  id: number
  reference: string
  issuedAt: Date | null
  dueAt: Date | null
  paidAt: Date | null
  statusLabel: string
  tone: StatusTone
  owed: boolean
  totalCents: number
  /** Still to pay; equals the total unless part of it was paid. */
  balanceCents: number
  subtotalCents: number
  taxCents: number
}

const INVOICE_PAGES = 5
const INVOICE_PAGE_SIZE = 100

/** Every invoice of the customer in WHMCS, newest first (drafts left out). */
export const whmcsInvoicesFor = cache(
  async (customerId: string): Promise<WhmcsRead<WhmcsInvoiceView>> => {
    const clientId = await linkedClient(customerId)
    if (clientId === null) return { state: "not_linked" }
    try {
      const now = new Date()
      const rows = []
      for (let page = 0; page < INVOICE_PAGES; page += 1) {
        const batch = await whmcsReader().listInvoices({
          clientId,
          limit: INVOICE_PAGE_SIZE,
          offset: page * INVOICE_PAGE_SIZE,
        })
        rows.push(...batch)
        if (batch.length < INVOICE_PAGE_SIZE) break
      }
      const items = rows
        .filter((row) => row.status !== "Draft")
        .map((row): WhmcsInvoiceView => {
          const dueAt = parseWhmcsDate(row.dueDate)
          const ui = invoiceStatusUi(row.status, dueAt, now)
          return {
            id: row.invoiceId,
            reference: row.invoiceNumber ?? String(row.invoiceId),
            issuedAt: parseWhmcsDate(row.date),
            dueAt,
            paidAt: parseWhmcsDate(row.datePaid),
            statusLabel: ui.label,
            tone: ui.tone,
            owed: ui.owed,
            totalCents: row.totalCents,
            subtotalCents: row.subtotalCents,
            taxCents: row.taxCents,
            balanceCents: row.balanceCents > 0 ? row.balanceCents : ui.owed ? row.totalCents : 0,
          }
        })
        .sort((a, b) => (b.issuedAt?.getTime() ?? 0) - (a.issuedAt?.getTime() ?? 0))
      return { state: "ok", items }
    } catch (error) {
      return failure(error)
    }
  },
)

/** Whether a WHMCS invoice belongs to this customer, for the PDF link. */
export async function customerWhmcsClientId(customerId: string): Promise<number | null> {
  return linkedClient(customerId)
}

// ─── balance ─────────────────────────────────────────────────────────────────

export interface WhmcsBalance {
  /** Unpaid invoices issued up to today, tax included. */
  invoicesCents: number
  invoicesCount: number
  /** Overdue periods WHMCS has not invoiced, tax included (estimated with WHMCS's rate). */
  uninvoicedCents: number
  /** Everything owed to be up to date today. */
  totalCents: number
  /** Services and domains behind, for the breakdown. */
  lines: readonly OverdueLine[]
  /** Tax rate WHMCS applies to this customer, read from their latest invoice. */
  taxRate: number
}

const RECURRING_STATUSES = new Set(["Active", "Suspended"])
const RENEWING_DOMAIN_STATUSES = new Set(["Active", "Grace"])

/** The tax rate WHMCS applied on the customer's latest invoice with a taxable base. */
function taxRateOf(invoices: readonly WhmcsInvoiceView[]): number {
  const latest = invoices.find((invoice) => invoice.subtotalCents > 0)
  return latest ? latest.taxCents / latest.subtotalCents : 0
}

/**
 * What the customer owes to be up to date: the unpaid invoices plus every renewal period
 * that has passed since, which WHMCS does not invoice while the first one stays unpaid.
 */
export const whmcsBalanceFor = cache(
  async (customerId: string): Promise<WhmcsRead<WhmcsBalance>> => {
    const clientId = await linkedClient(customerId)
    if (clientId === null) return { state: "not_linked" }
    const invoices = await whmcsInvoicesFor(customerId)
    if (invoices.state !== "ok") return invoices
    try {
      const now = new Date()
      const [services, olaIds] = await Promise.all([rawServices(clientId), olaManagedServiceIds(customerId)])
      // Domains need their own permission: without it, they simply do not add up.
      const domains = await rawDomains(clientId).catch(() => [])

      const lines: OverdueLine[] = []
      for (const service of services) {
        if (!RECURRING_STATUSES.has(service.status) || olaIds.has(service.serviceId)) continue
        const line = overdueLine({
          name: [service.productName, service.domain].filter(Boolean).join(" · ") || "Servicio",
          dueAt: parseWhmcsDate(service.nextDueDate),
          months: cycleMonths(service.billingCycle),
          amountCents: service.recurringAmountCents,
          now,
        })
        if (line) lines.push(line)
      }
      for (const domain of domains) {
        if (!RENEWING_DOMAIN_STATUSES.has(domain.status) || domain.doNotRenew) continue
        const line = overdueLine({
          name: `Dominio ${domain.domain}`,
          dueAt: parseWhmcsDate(domain.nextDueDate),
          months: (domain.registrationPeriod ?? 1) * 12,
          amountCents: domain.recurringAmountCents,
          now,
        })
        if (line) lines.push(line)
      }

      const taxRate = taxRateOf(invoices.items)
      const pending = pendingBalance(invoices.items, now)
      const uninvoicedCents = lines.reduce(
        (sum, line) => sum + Math.round(line.uninvoicedPeriods * line.amountCents * (1 + taxRate)),
        0,
      )
      lines.sort((a, b) => a.since.getTime() - b.since.getTime())
      return {
        state: "ok",
        items: [
          {
            invoicesCents: pending.cents,
            invoicesCount: pending.count,
            uninvoicedCents,
            totalCents: pending.cents + uninvoicedCents,
            lines,
            taxRate,
          },
        ],
      }
    } catch (error) {
      return failure(error)
    }
  },
)
