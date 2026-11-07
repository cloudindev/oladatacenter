import type { Metadata } from "next"
import Link from "next/link"
import { formatCents } from "@ola/core"

import { PageTitle, Panel } from "@/components/app/ui"
import { CreditPanel } from "@/components/billing/CreditPanel"
import { requireUser } from "@/server/auth/session"
import { creditSummary } from "@/server/billing"
import { pendingBalance } from "@/server/whmcs-products/model"
import { whmcsInvoicesFor } from "@/server/whmcs-products"
import { BillingIncomplete } from "../incomplete"

/**
 * Inicio → Mi saldo: what the customer owes today (unpaid invoices, shown negative) and
 * the credit they have in their favour.
 */

export const metadata: Metadata = {
  title: "Mi saldo · OLA",
}

export default async function CreditPage() {
  const session = await requireUser()
  if (!session.customer) return <BillingIncomplete title="Mi saldo" />

  const [credit, invoices] = await Promise.all([
    creditSummary(session.customer.id),
    whmcsInvoicesFor(session.customer.id),
  ])
  const pending = invoices.state === "ok" ? pendingBalance(invoices.items, new Date()) : null

  return (
    <>
      <PageTitle description="Lo que tienes pendiente de pago y el crédito a tu favor.">
        Mi saldo
      </PageTitle>
      <div className="grid gap-5 lg:grid-cols-2 max-w-4xl">
        <Panel>
          <p className="label-mono text-text-muted mb-3">Pendiente de pago</p>
          {pending === null ? (
            <p className="text-sm text-text-muted">
              {invoices.state === "unavailable"
                ? "No hemos podido consultar tus facturas ahora mismo."
                : "No tienes facturas pendientes."}
            </p>
          ) : (
            <>
              <p
                className={
                  pending.cents > 0
                    ? "text-4xl font-light tracking-tight text-[#8a2d26]"
                    : "text-4xl font-light tracking-tight text-text-base"
                }
              >
                {pending.cents > 0 ? `−${formatCents(pending.cents)}` : formatCents(0)}
              </p>
              <p className="mt-1 text-sm text-text-muted">
                {pending.count === 0
                  ? "Estás al día: no tienes facturas pendientes."
                  : `${pending.count} ${pending.count === 1 ? "factura pendiente" : "facturas pendientes"} hasta hoy.`}
              </p>
              {pending.count > 0 ? (
                <Link
                  href="/app/billing"
                  className="label-mono mt-4 inline-block text-text-base underline decoration-border-base underline-offset-4 hover:decoration-accent-ink"
                >
                  Ver y pagar facturas
                </Link>
              ) : null}
            </>
          )}
        </Panel>
        <Panel>
          <p className="label-mono text-text-muted mb-3">Crédito a tu favor</p>
          <CreditPanel summary={credit} />
        </Panel>
      </div>
    </>
  )
}
