import type { Metadata } from "next"
import Link from "next/link"
import { formatCents } from "@ola/core"

import { Notice, PageTitle, Panel } from "@/components/app/ui"
import { CreditPanel } from "@/components/billing/CreditPanel"
import { formatDate } from "@/components/servers/labels"
import { requireUser } from "@/server/auth/session"
import { creditSummary } from "@/server/billing"
import { whmcsBalanceFor } from "@/server/whmcs-products"
import { BillingIncomplete } from "../incomplete"

/**
 * Inicio → Mi saldo: everything the customer owes to be up to date today, shown negative,
 * with its breakdown, and the credit in their favour.
 */

export const metadata: Metadata = {
  title: "Mi saldo · OLA",
}

function periodsLabel(count: number): string {
  return count === 1 ? "1 periodo" : `${count} periodos`
}

export default async function CreditPage() {
  const session = await requireUser()
  if (!session.customer) return <BillingIncomplete title="Mi saldo" />

  const [credit, balanceRead] = await Promise.all([
    creditSummary(session.customer.id),
    whmcsBalanceFor(session.customer.id),
  ])
  const balance = balanceRead.state === "ok" ? balanceRead.items[0] : undefined
  const owes = balance !== undefined && balance.totalCents > 0
  const behind = balance ? balance.lines : []

  return (
    <>
      <PageTitle description="Lo que debes para estar al día hoy y el crédito a tu favor.">
        Mi saldo
      </PageTitle>

      {balanceRead.state === "unavailable" ? (
        <div className="mb-6">
          <Notice tone="warn" title="No hemos podido calcular tu saldo">
            Nuestro sistema de facturación no responde ahora mismo. Vuelve a intentarlo en unos minutos.
          </Notice>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <p className="label-mono text-text-muted mb-3">Para estar al día hoy</p>
          <p
            className={
              owes
                ? "text-5xl font-light tracking-tight text-[#8a2d26]"
                : "text-5xl font-light tracking-tight text-text-base"
            }
          >
            {owes ? `−${formatCents(balance.totalCents)}` : formatCents(0)}
          </p>
          {balance === undefined ? (
            <p className="mt-2 text-sm text-text-muted">No tienes nada pendiente.</p>
          ) : owes ? (
            <>
              <dl className="mt-5 space-y-2 text-sm">
                <div className="flex justify-between gap-4 border-b border-border-base pb-2">
                  <dt className="text-text-muted">
                    Facturas pendientes ({balance.invoicesCount})
                  </dt>
                  <dd className="text-text-base">{formatCents(balance.invoicesCents)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-text-muted">Periodos vencidos sin facturar todavía</dt>
                  <dd className="text-text-base">{formatCents(balance.uninvoicedCents)}</dd>
                </div>
              </dl>
              <p className="mt-4 text-xs text-text-muted leading-relaxed">
                Solo se emite factura del primer periodo impagado de cada servicio; los siguientes
                se facturarán al ponerte al día. Importes con impuestos
                {balance.taxRate > 0 ? ` (${Math.round(balance.taxRate * 100)} %)` : ""}.
              </p>
              <Link
                href="/app/billing"
                className="label-mono mt-4 inline-block text-text-base underline decoration-border-base underline-offset-4 hover:decoration-accent-ink"
              >
                Ver y pagar facturas
              </Link>
            </>
          ) : (
            <p className="mt-2 text-sm text-text-muted">Estás al día: no debes nada.</p>
          )}
        </Panel>

        <Panel>
          <p className="label-mono text-text-muted mb-3">Crédito a tu favor</p>
          <CreditPanel summary={credit} />
        </Panel>
      </div>

      {behind.length > 0 ? (
        <section className="mt-8">
          <p className="label-mono text-text-muted mb-3">Servicios con renovaciones pendientes</p>
          <Panel className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-base text-left">
                    {["Servicio", "Pendiente desde", "Periodos", "Precio por periodo", "Total"].map((label) => (
                      <th key={label} scope="col" className="label-mono text-text-muted font-normal px-5 py-3 whitespace-nowrap">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {behind.map((line) => (
                    <tr key={`${line.name}-${line.since.toISOString()}`} className="border-b border-border-base last:border-b-0">
                      <td className="px-5 py-3.5 text-text-base">{line.name}</td>
                      <td className="px-5 py-3.5 text-text-muted whitespace-nowrap">{formatDate(line.since)}</td>
                      <td className="px-5 py-3.5 text-text-muted whitespace-nowrap">{periodsLabel(line.periods)}</td>
                      <td className="px-5 py-3.5 text-text-muted whitespace-nowrap">{formatCents(line.amountCents)}</td>
                      <td className="px-5 py-3.5 text-[#8a2d26] whitespace-nowrap">
                        {formatCents(Math.round(line.periods * line.amountCents * (1 + (balance?.taxRate ?? 0))))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </section>
      ) : null}
    </>
  )
}
