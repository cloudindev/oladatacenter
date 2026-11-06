import Link from "next/link"
import { ORDER_STATUSES, PROVISION_STEPS, formatCents } from "@ola/core"
import { FilterBar, FilterDate, FilterSelect, FilterText } from "@/components/admin/filters"
import {
  AdminHeader,
  DeliveryBadge,
  LoadFailure,
  Mono,
  Muted,
  OrderStatus,
  TableEmpty,
  TableWrap,
  Td,
  Th,
  Timestamp,
} from "@/components/admin/ui"
import { ORDER_STATUS_UI } from "@/components/app/ui"
import {
  hasAnyFilter,
  one,
  orderFilterFrom,
  wantsLateOnly,
  type RawSearchParams,
} from "@/server/admin/filters"
import { ordersScreen, requireAdminPage } from "@/server/admin/queries"

/**
 * The order queue.
 *
 * The step column is derived from `orders.completedSteps` through `nextProvisionStep`, so
 * it is the step the job would actually run next, not a guess. The delivery column is
 * `deliveryState(paidAt, now)`: an order that is "provisioning" and three hours old is a
 * problem, and the list has to say so without the operator doing arithmetic.
 */

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "en_curso", label: "En curso" },
  { value: "retrasados", label: "Retrasados" },
  { value: "atencion", label: "Retrasados o fallidos" },
  ...ORDER_STATUSES.map((status) => ({
    value: status,
    label: ORDER_STATUS_UI[status]?.label ?? status,
  })),
]

export default async function AdminPedidosPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  await requireAdminPage()
  const params = await searchParams
  const now = new Date()
  const screen = await ordersScreen(orderFilterFrom(params, now))

  if (!screen.ok) {
    return (
      <>
        <AdminHeader title="Pedidos" />
        <LoadFailure message={screen.message} detail={screen.detail} />
      </>
    )
  }

  const rows = wantsLateOnly(params)
    ? screen.data.filter((view) => view.delivery !== null && view.delivery !== "on_time")
    : screen.data

  return (
    <>
      <AdminHeader
        title="Pedidos"
        hint="El paso siguiente sale de orders.completedSteps. La entrega se mide contra el SLA de 2 h y el límite de 24 h."
      />

      <FilterBar
        action="/admin/pedidos"
        reset={hasAnyFilter(params, ["estado", "q", "desde", "hasta"])}
      >
        <FilterSelect
          name="estado"
          label="Estado"
          value={one(params, "estado")}
          options={STATUS_OPTIONS}
        />
        <FilterText
          name="q"
          label="Cliente o identificador"
          value={one(params, "q")}
          placeholder="correo, id, pi_…"
        />
        <FilterDate name="desde" label="Desde" value={one(params, "desde")} />
        <FilterDate name="hasta" label="Hasta" value={one(params, "hasta")} />
      </FilterBar>

      <p className="mb-3 text-xs text-text-muted">
        {rows.length} pedidos · límite de 100 por consulta
      </p>

      <TableWrap>
        <thead>
          <tr>
            <Th>Pedido</Th>
            <Th>Cliente</Th>
            <Th align="center">Estado</Th>
            <Th>Paso siguiente</Th>
            <Th align="center">Entrega</Th>
            <Th align="right">Total</Th>
            <Th align="right">Coste previsto</Th>
            <Th>Pagado</Th>
            <Th>OVH</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <TableEmpty colSpan={9}>Ningún pedido coincide con el filtro.</TableEmpty>
          ) : null}
          {rows.map(({ row, nextStep, complete, delivery }) => (
            <tr key={row.id}>
              <Td>
                <Link
                  href={`/admin/pedidos/${row.id}`}
                  className="font-mono text-xs text-accent-ink underline decoration-dotted underline-offset-4 hover:no-underline"
                >
                  {row.id}
                </Link>
                <p className="label-mono text-text-muted">
                  {row.kind} · <Timestamp value={row.createdAt} />
                </p>
              </Td>
              <Td>{row.customerEmail}</Td>
              <Td align="center">
                <OrderStatus status={row.status} />
                {row.errorCode ? (
                  <p className="label-mono mt-1 text-[#8a2d26]">{row.errorCode}</p>
                ) : null}
              </Td>
              <Td>
                {complete ? (
                  <Muted>completo</Muted>
                ) : (
                  <>
                    <Mono>{nextStep ?? "—"}</Mono>
                    <p className="label-mono text-text-muted">
                      {row.completedSteps.length}/{PROVISION_STEPS.length} pasos
                    </p>
                  </>
                )}
              </Td>
              <Td align="center">
                <DeliveryBadge state={delivery} />
              </Td>
              <Td align="right" mono>
                {formatCents(row.total)}
              </Td>
              <Td align="right" mono>
                {formatCents(row.expectedCost)}
              </Td>
              <Td>
                <Timestamp value={row.paidAt} />
              </Td>
              <Td mono>
                {row.ovhOrderId !== null ? row.ovhOrderId : <Muted>—</Muted>}
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  )
}
