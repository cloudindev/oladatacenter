import { AdminHeader, AdminSection, CountTile, LoadFailure } from "@/components/admin/ui"
import { Notice } from "@/components/app/ui"
import { dashboard, requireAdminPage } from "@/server/admin/queries"

/**
 * The dashboard: what needs attention right now, and nothing else.
 *
 * No totals, no growth, no revenue chart. Every tile is a count of things that are stuck,
 * failing or waiting for a human, and every tile links to the filtered list that shows
 * which ones.
 */
export default async function AdminDashboardPage() {
  await requireAdminPage()
  const counts = await dashboard()

  if (!counts.ok) {
    return (
      <>
        <AdminHeader title="Resumen" />
        <LoadFailure message={counts.message} detail={counts.detail} />
      </>
    )
  }

  const data = counts.data
  const quiet =
    data.ordersInProgress === 0 &&
    data.ordersLate === 0 &&
    data.ordersFailed === 0 &&
    data.servicesSuspended === 0 &&
    data.servicesInReview === 0 &&
    data.paymentsFailedToday === 0 &&
    data.webhooksFailed === 0

  return (
    <>
      <AdminHeader
        title="Resumen"
        hint="Sólo lo que requiere atención. Cada número lleva a su lista filtrada."
      />

      {quiet ? (
        <div className="mb-8">
          <Notice tone="ok" title="Nada pendiente">
            No hay pedidos atascados, servicios suspendidos ni cobros fallidos hoy.
          </Notice>
        </div>
      ) : null}

      <AdminSection title="Pedidos">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <CountTile
            label="En curso"
            value={data.ordersInProgress}
            href="/admin/pedidos?estado=en_curso"
            hint="Pendientes de pago, pagados o aprovisionando"
          />
          <CountTile
            label="Retrasados"
            value={data.ordersLate}
            href="/admin/pedidos?estado=retrasados"
            tone="warn"
            hint="Pagados y fuera del plazo de entrega"
          />
          <CountTile
            label="Fallidos"
            value={data.ordersFailed}
            href="/admin/pedidos?estado=failed"
            tone="danger"
            hint="Con error registrado, sin entregar"
          />
        </div>
      </AdminSection>

      <AdminSection title="Servicios">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <CountTile
            label="Suspendidos"
            value={data.servicesSuspended}
            href="/admin/servicios?estado=suspended"
            tone="danger"
            hint="Parados por impago"
          />
          <CountTile
            label="En revisión"
            value={data.servicesInReview}
            href="/admin/servicios?estado=review"
            tone="warn"
            hint="Marcados por abuso o fraude"
          />
        </div>
      </AdminSection>

      <AdminSection
        title="Dinero y webhooks"
        hint="Las alertas abiertas se derivan de estas señales hasta que el módulo de alertas las persista."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <CountTile
            label="Cobros fallidos hoy"
            value={data.paymentsFailedToday}
            href="/admin/pagos?resultado=failed&desde=hoy"
            tone="danger"
            hint="Con código de fallo de Stripe"
          />
          <CountTile
            label="Webhooks sin procesar"
            value={data.webhooksFailed}
            href="/admin/auditoria?entidad=webhook"
            tone="warn"
            hint="Recibidos y nunca procesados, o con error"
          />
        </div>
      </AdminSection>
    </>
  )
}
