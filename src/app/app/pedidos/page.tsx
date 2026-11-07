import type { Metadata } from "next"
import Link from "next/link"
import { formatCents } from "@ola/core"
import {
  ButtonLink,
  EmptyState,
  Notice,
  ORDER_STATUS_UI,
  PageTitle,
  Panel,
  StatusBadge,
} from "@/components/app/ui"
import { formatDate, TERM_LABEL } from "@/components/servers/labels"
import { customerContext } from "@/server/services/customer"
import { load } from "@/server/services/load"
import { listOrdersForCustomer } from "@/server/orders/repository"

/** Inicio → Mis pedidos: every order, newest first, each linked to its live progress. */

export const metadata: Metadata = {
  title: "Mis pedidos · OLA",
}

const KIND_LABEL = { new: "Alta", upgrade: "Cambio de plan", addon: "Complemento" } as const

export default async function OrdersPage() {
  const context = await customerContext()
  if (!context.ok) {
    return (
      <>
        <PageTitle>Mis pedidos</PageTitle>
        <Notice tone="warn" title="No hemos podido cargar tus pedidos">
          {context.message}
        </Notice>
      </>
    )
  }

  const orders = await load("listOrdersForCustomer", () => listOrdersForCustomer(context.customerId))

  return (
    <>
      <PageTitle description="Todo lo que has contratado, con su estado de pago y de entrega.">
        Mis pedidos
      </PageTitle>

      {!orders.ok ? (
        <Notice tone="warn" title="No hemos podido cargar tus pedidos">
          {orders.message} Vuelve a intentarlo en unos minutos.
        </Notice>
      ) : orders.data.length === 0 ? (
        <EmptyState
          action={
            <ButtonLink href="/vps/configurar" withArrow>
              Crear servidor
            </ButtonLink>
          }
        >
          Todavía no has hecho ningún pedido.
        </EmptyState>
      ) : (
        <Panel className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-base text-left">
                  {["Pedido", "Fecha", "Concepto", "Importe", "Estado"].map((label) => (
                    <th key={label} scope="col" className="label-mono text-text-muted font-normal px-5 py-3">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.data.map((order) => {
                  const status = ORDER_STATUS_UI[order.status] ?? { label: order.status, tone: "neutral" as const }
                  return (
                    <tr key={order.id} className="border-b border-border-base last:border-b-0">
                      <td className="px-5 py-4">
                        <Link
                          href={`/app/servers/new/${order.id}`}
                          className="font-mono text-text-base hover:text-accent-ink underline-offset-4 hover:underline"
                        >
                          N.º {order.reference}
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-text-muted whitespace-nowrap">{formatDate(order.createdAt)}</td>
                      <td className="px-5 py-4 text-text-base">
                        {KIND_LABEL[order.kind]}
                        {order.planName ? ` · ${order.planName}` : ""}
                        <span className="text-text-muted"> · {TERM_LABEL[order.term] ?? order.term}</span>
                      </td>
                      <td className="px-5 py-4 text-text-base whitespace-nowrap">{formatCents(order.total)}</td>
                      <td className="px-5 py-4">
                        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  )
}
