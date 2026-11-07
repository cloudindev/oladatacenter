import type { Metadata } from "next"

import { PageTitle, Panel } from "@/components/app/ui"
import { InvoiceTable } from "@/components/billing/InvoiceTable"
import { requireUser } from "@/server/auth/session"
import { listBillingInvoices } from "@/server/billing"
import { BillingIncomplete } from "./incomplete"

/**
 * Inicio → Mis facturas. Read on the server and handed over already formatted, so no
 * money arithmetic happens in the browser and no provider identifier is rendered.
 */

export const metadata: Metadata = {
  title: "Mis facturas · OLA",
  description: "Tus facturas y su estado de pago.",
}

export default async function InvoicesPage() {
  const session = await requireUser()
  if (!session.customer) return <BillingIncomplete title="Mis facturas" />

  const invoices = await listBillingInvoices(session.customer.id)

  return (
    <>
      <PageTitle description="Todas tus facturas, con su estado de pago. Se emiten a nombre de tus datos de facturación.">
        Mis facturas
      </PageTitle>
      <Panel>
        <InvoiceTable invoices={invoices.invoices} clientAreaUrl={invoices.clientAreaUrl} />
      </Panel>
    </>
  )
}
