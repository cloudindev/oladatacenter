import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ButtonLink, DataRow, Eyebrow, PageTitle, Panel } from "@/components/app/ui"
import { OrderProgress } from "@/components/billing/OrderProgress"
import { requireUser } from "@/server/auth/session"
import { orderProgress } from "@/server/billing/progress"

/**
 * Live order progress after a successful payment.
 *
 * Reads the real provisioning state from `orders.completedSteps` and renders it in plain
 * Spanish. The `delayed` and `failed` states are shown honestly: there is no point in
 * spinning for twenty-four hours while a provider is stuck.
 */

export const metadata: Metadata = {
  title: "Tu pedido · OLA VPS Cloud",
  description: "Seguimiento en vivo de la creación de tu servidor.",
}

export default async function OrderProgressPage(props: {
  params: Promise<{ orderId: string }>
}) {
  const session = await requireUser()
  const { orderId } = await props.params

  if (!session.customer) notFound()

  const progress = await orderProgress(session.customer.id, orderId)
  if (!progress) notFound()

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle
        description="Te avisamos por correo en cuanto el servidor esté listo. Puedes cerrar esta página."
        action={
          <ButtonLink href="/app" variant="secondary">
            Mis servidores
          </ButtonLink>
        }
      >
        Tu pedido
      </PageTitle>

      <Panel className="mb-6">
        <OrderProgress initial={progress} />
      </Panel>

      <Panel>
        <Eyebrow>Resumen</Eyebrow>
        <dl>
          <DataRow label="Plan">{progress.planName}</DataRow>
          <DataRow label="Importe cobrado">{progress.totalLabel}</DataRow>
          <DataRow label="Referencia" mono>
            {progress.reference}
          </DataRow>
          {progress.paidAt ? (
            <DataRow label="Pagado">
              {progress.paidAt.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })}
            </DataRow>
          ) : null}
        </dl>
        <p className="mt-4 text-[13px] text-text-muted">
          La factura aparece en{" "}
          <a href="/app/billing" className="underline decoration-border-base">
            facturación
          </a>{" "}
          en cuanto se emite.
        </p>
      </Panel>
    </div>
  )
}
