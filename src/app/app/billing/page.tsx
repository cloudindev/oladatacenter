import type { Metadata } from "next"
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
        <Panel className="p-0 overflow-hidden">
          <WhmcsInvoiceTable invoices={whmcs.items} />
        </Panel>
      ) : null}
    </>
  )
}
