import { formatCents } from "@ola/core"
import { EmptyState, StatusBadge } from "@/components/app/ui"
import { formatDate } from "@/components/servers/labels"
import type { WhmcsInvoiceView } from "@/server/whmcs-products"

/**
 * The customer's invoices as WHMCS issued them. Each PDF opens WHMCS's own document
 * through `/app/billing/factura/[id]`, which signs the customer in for that one invoice.
 */
export function WhmcsInvoiceTable({ invoices }: { invoices: readonly WhmcsInvoiceView[] }) {
  if (invoices.length === 0) {
    return <EmptyState>Todavía no tienes facturas.</EmptyState>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-base text-left">
            {["Número", "Fecha", "Vencimiento", "Importe", "Pendiente", "Estado", ""].map((label, index) => (
              <th
                key={label || index}
                scope="col"
                className="label-mono text-text-muted font-normal px-5 py-3 whitespace-nowrap"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr key={invoice.id} className="border-b border-border-base last:border-b-0">
              <td className="px-5 py-3.5 font-mono text-text-base whitespace-nowrap">{invoice.reference}</td>
              <td className="px-5 py-3.5 text-text-muted whitespace-nowrap">{formatDate(invoice.issuedAt)}</td>
              <td className="px-5 py-3.5 text-text-muted whitespace-nowrap">{formatDate(invoice.dueAt)}</td>
              <td className="px-5 py-3.5 text-text-base whitespace-nowrap">{formatCents(invoice.totalCents)}</td>
              <td className="px-5 py-3.5 whitespace-nowrap">
                {invoice.owed ? (
                  <span className="text-[#8a2d26]">{formatCents(invoice.balanceCents)}</span>
                ) : (
                  <span className="text-text-muted">—</span>
                )}
              </td>
              <td className="px-5 py-3.5">
                <StatusBadge tone={invoice.tone}>{invoice.statusLabel}</StatusBadge>
              </td>
              <td className="px-5 py-3.5 text-right whitespace-nowrap">
                <a
                  href={`/app/billing/factura/${invoice.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="label-mono text-text-base underline decoration-border-base underline-offset-4 hover:decoration-accent-ink"
                >
                  {invoice.owed ? "Ver y pagar" : "Ver PDF"}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
