import { formatCents, type Cents } from "@ola/core"

import { resolveDeps } from "./deps"
import type { BillingDepsOverride } from "./ports"

/**
 * Invoices as the billing page shows them.
 *
 * The PDF itself lives in WHMCS, which is the book of record. We never proxy it: the
 * customer follows a short-lived SSO link into the WHMCS client area, so the document they
 * download is the real accounting one and no copy of it exists here.
 */

export interface BillingInvoiceView {
  id: string
  /** The invoice number WHMCS assigned, or its id while the number is not set yet. */
  reference: string
  issuedAt: Date
  dueAt: Date | null
  paidAt: Date | null
  status: "unpaid" | "paid" | "cancelled" | "refunded"
  /** Spanish label for the status. */
  statusLabel: string
  subtotal: Cents
  tax: Cents
  credit: Cents
  total: Cents
  /** Pre-formatted so the page never does money arithmetic. */
  totalLabel: string
}

const STATUS_LABELS: Readonly<Record<BillingInvoiceView["status"], string>> = {
  unpaid: "Pendiente",
  paid: "Pagada",
  cancelled: "Anulada",
  refunded: "Reembolsada",
}

export interface BillingInvoicesResult {
  invoices: readonly BillingInvoiceView[]
  /** SSO link into the WHMCS client area, or `null` when we could not mint one. */
  clientAreaUrl: string | null
}

export async function listBillingInvoices(
  customerId: string,
  override: BillingDepsOverride = {},
): Promise<BillingInvoicesResult> {
  const deps = await resolveDeps(override)
  const invoices = await listInvoiceViews(customerId, override)

  const customer = await deps.store.getCustomer(customerId)
  const clientAreaUrl =
    customer?.whmcsClientId != null
      ? await deps.ledger.invoiceAreaUrl(customer.whmcsClientId)
      : null

  return { invoices, clientAreaUrl }
}

/**
 * The invoices alone, from our own copy: no call to WHMCS. For the dashboard, which must
 * answer fast and keep working when WHMCS does not.
 */
export async function listInvoiceViews(
  customerId: string,
  override: BillingDepsOverride = {},
): Promise<readonly BillingInvoiceView[]> {
  const deps = await resolveDeps(override)
  const rows = await deps.store.listInvoices(customerId)
  return rows.map((row) => ({
    id: row.id,
    reference: row.number ?? String(row.whmcsInvoiceId),
    issuedAt: row.createdAt,
    dueAt: row.dueAt,
    paidAt: row.paidAt,
    status: row.status,
    statusLabel: STATUS_LABELS[row.status],
    subtotal: row.subtotal,
    tax: row.tax,
    credit: row.credit,
    total: row.total,
    totalLabel: formatCents(row.total),
  }))
}
