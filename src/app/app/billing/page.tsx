import type { Metadata } from "next"
import Link from "next/link"
import { formatCents } from "@ola/core"

import { Notice, PageTitle, Panel } from "@/components/app/ui"
import { InvoiceTable } from "@/components/billing/InvoiceTable"
import { WhmcsInvoiceTable } from "@/components/billing/WhmcsInvoiceTable"
import { WhmcsReadNotice } from "@/components/app/WhmcsProducts"
import { requireUser } from "@/server/auth/session"
import { listBillingInvoices } from "@/server/billing"
import { pendingBalance } from "@/server/whmcs-products/model"
import { whmcsInvoicesFor } from "@/server/whmcs-products"
import { BillingIncomplete } from "./incomplete"

/**
 * Inicio → Mis facturas. For a customer linked to WHMCS, every invoice WHMCS holds for
 * them (WHMCS is the book of record); otherwise the invoices issued by OLA itself.
 */

export const metadata: Metadata = {
  title: "Mis facturas · OLA",
  description: "Tus facturas y su estado de pago.",
}

const PAGE_SIZE = 25

function Pager({ page, pages }: { page: number; pages: number }) {
  if (pages <= 1) return null
  const link = (target: number, label: string, disabled: boolean) =>
    disabled ? (
      <span className="label-mono text-text-muted/50">{label}</span>
    ) : (
      <Link
        href={target === 1 ? "/app/billing" : `/app/billing?pagina=${target}`}
        className="label-mono text-text-base underline decoration-border-base underline-offset-4 hover:decoration-accent-ink"
      >
        {label}
      </Link>
    )
  return (
    <nav aria-label="Páginas de facturas" className="mt-4 flex items-center justify-between gap-4">
      {link(page - 1, "← Más recientes", page <= 1)}
      <span className="text-sm text-text-muted">
        Página {page} de {pages}
      </span>
      {link(page + 1, "Más antiguas →", page >= pages)}
    </nav>
  )
}

export default async function InvoicesPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const session = await requireUser()
  if (!session.customer) return <BillingIncomplete title="Mis facturas" />

  const params = await props.searchParams
  const linkFailed = params.error === "factura"
  const whmcs = await whmcsInvoicesFor(session.customer.id)

  const title = (
    <PageTitle description="Todas tus facturas, con su estado de pago y su PDF.">Mis facturas</PageTitle>
  )
  const linkNotice = linkFailed ? (
    <div className="mb-6">
      <Notice tone="warn" title="No hemos podido abrir esa factura">
        Vuelve a intentarlo en unos segundos. Si sigue fallando, escríbenos desde Soporte.
      </Notice>
    </div>
  ) : null

  if (whmcs.state === "not_linked") {
    const local = await listBillingInvoices(session.customer.id)
    return (
      <>
        {title}
        {linkNotice}
        <Panel>
          <InvoiceTable invoices={local.invoices} clientAreaUrl={local.clientAreaUrl} />
        </Panel>
      </>
    )
  }

  const pending = whmcs.state === "ok" ? pendingBalance(whmcs.items, new Date()) : null
  const all = whmcs.state === "ok" ? whmcs.items : []
  const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE))
  const asked = Number(params.pagina)
  const page = Number.isInteger(asked) && asked >= 1 ? Math.min(asked, pages) : 1
  const shown = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <>
      {title}
      {linkNotice}
      <WhmcsReadNotice read={whmcs} what="tus facturas" />
      {pending && pending.count > 0 ? (
        <div className="mb-6">
          <Notice tone="danger" title={`Tienes ${formatCents(pending.cents)} pendientes de pago`}>
            {pending.count === 1 ? "Hay una factura" : `Hay ${pending.count} facturas`} sin pagar. Ábrela
            con «Ver y pagar» para pagarla en línea.
          </Notice>
        </div>
      ) : null}
      {whmcs.state === "ok" ? (
        <>
          <Panel className="p-0 overflow-hidden">
            <WhmcsInvoiceTable invoices={shown} />
          </Panel>
          <Pager page={page} pages={pages} />
        </>
      ) : null}
    </>
  )
}
