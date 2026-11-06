import Link from "next/link"
import { formatCents } from "@ola/core"
import { ConfirmAction } from "@/components/admin/action-form"
import { FilterBar, FilterDate, FilterSelect, FilterText } from "@/components/admin/filters"
import {
  AdminHeader,
  DunningBadge,
  LoadFailure,
  Maybe,
  Mono,
  Muted,
  TableEmpty,
  TableWrap,
  Td,
  Th,
  Timestamp,
} from "@/components/admin/ui"
import { Field, Notice, StatusBadge, Textarea } from "@/components/app/ui"
import { refundPayment, retryRenewalCharge } from "@/server/admin/actions"
import { hasAnyFilter, one, paymentFilterFrom, type RawSearchParams } from "@/server/admin/filters"
import { paymentsScreen, requireAdminPage } from "@/server/admin/queries"

/**
 * Payments: every charge, failures with Stripe's own failure code, the dunning stage of
 * the service behind each one, manual retry through `chargeRenewal`, refunds through
 * `refundOrder`, and disputes flagged for review.
 */

function centsField(value: number): string {
  return `${Math.trunc(value / 100)},${String(Math.abs(value % 100)).padStart(2, "0")}`
}

function outcomeBadge(status: string, failureCode: string | null, refunded: number, amount: number) {
  if (status === "disputed") return <StatusBadge tone="danger">Disputa</StatusBadge>
  if (refunded >= amount && amount > 0) return <StatusBadge tone="neutral">Reembolsado</StatusBadge>
  if (refunded > 0) return <StatusBadge tone="warn">Reembolso parcial</StatusBadge>
  if (status === "succeeded" && failureCode === null) return <StatusBadge tone="ok">Cobrado</StatusBadge>
  return <StatusBadge tone="danger">Fallido</StatusBadge>
}

export default async function AdminPagosPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  await requireAdminPage()
  const params = await searchParams
  const screen = await paymentsScreen(paymentFilterFrom(params, new Date()))

  if (!screen.ok) {
    return (
      <>
        <AdminHeader title="Pagos" />
        <LoadFailure message={screen.message} detail={screen.detail} />
      </>
    )
  }

  const { rows, serviceFees } = screen.data
  const disputes = rows.filter((row) => row.status === "disputed")

  return (
    <>
      <AdminHeader title="Pagos" hint="Los códigos de fallo son los de Stripe, sin traducir." />

      {disputes.length > 0 ? (
        <div className="mb-6">
          <Notice tone="danger" title={`${disputes.length} disputas pendientes de revisar`}>
            Un contracargo pone al cliente en revisión. Comprueba el uso del servidor y la
            documentación antes de responder en Stripe.
          </Notice>
        </div>
      ) : null}

      <FilterBar action="/admin/pagos" reset={hasAnyFilter(params, ["resultado", "q", "desde", "hasta"])}>
        <FilterSelect
          name="resultado"
          label="Resultado"
          value={one(params, "resultado")}
          options={[
            { value: "", label: "Todos" },
            { value: "succeeded", label: "Cobrados" },
            { value: "failed", label: "Fallidos" },
            { value: "refunded", label: "Reembolsados" },
            { value: "disputed", label: "Disputas" },
          ]}
        />
        <FilterText name="q" label="Buscar" value={one(params, "q")} placeholder="correo, pi_…" />
        <FilterDate name="desde" label="Desde" value={one(params, "desde") === "hoy" ? new Date().toISOString().slice(0, 10) : one(params, "desde")} />
        <FilterDate name="hasta" label="Hasta" value={one(params, "hasta")} />
      </FilterBar>

      <p className="mb-3 text-xs text-text-muted">{rows.length} cobros · límite de 100</p>

      <TableWrap>
        <thead>
          <tr>
            <Th>Fecha</Th>
            <Th>Cliente</Th>
            <Th align="right">Importe</Th>
            <Th align="center">Resultado</Th>
            <Th>Fallo Stripe</Th>
            <Th align="center">Fase de cobro</Th>
            <Th>Referencias</Th>
            <Th>Acciones</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? <TableEmpty colSpan={8}>Ningún cobro coincide con el filtro.</TableEmpty> : null}
          {rows.map((row) => {
            const failed = row.status !== "succeeded" || row.failureCode !== null
            const fee = row.serviceId ? serviceFees.get(row.serviceId) : undefined
            const refundable = row.status === "succeeded" && row.refundedAmount < row.amount && row.orderId
            return (
              <tr key={row.id}>
                <Td><Timestamp value={row.createdAt} /></Td>
                <Td>
                  <Link href={`/admin/clientes/${row.customerId}`} className="hover:underline">
                    {row.customerEmail}
                  </Link>
                </Td>
                <Td align="right" mono>
                  {formatCents(row.amount)}
                  {row.refundedAmount > 0 ? (
                    <p className="label-mono text-text-muted">−{formatCents(row.refundedAmount)}</p>
                  ) : null}
                </Td>
                <Td align="center">{outcomeBadge(row.status, row.failureCode, row.refundedAmount, row.amount)}</Td>
                <Td>
                  {row.failureCode ? (
                    <>
                      <Mono className="text-[#8a2d26]">{row.failureCode}</Mono>
                      {row.failureMessage ? (
                        <p className="text-xs text-text-muted">{row.failureMessage}</p>
                      ) : null}
                    </>
                  ) : (
                    <Muted>—</Muted>
                  )}
                </Td>
                <Td align="center"><DunningBadge stage={row.dunningStage} /></Td>
                <Td>
                  <p><Mono><Maybe value={row.stripePaymentIntentId} /></Mono></p>
                  {row.orderId ? (
                    <Link href={`/admin/pedidos/${row.orderId}`} className="label-mono text-accent-ink hover:underline">
                      pedido
                    </Link>
                  ) : null}{" "}
                  {row.serviceId ? (
                    <Link href={`/admin/servicios/${row.serviceId}`} className="label-mono text-accent-ink hover:underline">
                      servicio
                    </Link>
                  ) : null}
                </Td>
                <Td>
                  <div className="space-y-2">
                    {failed && row.serviceId && fee !== undefined ? (
                      <ConfirmAction
                        action={retryRenewalCharge}
                        fields={{ serviceId: row.serviceId, confirmedAmount: centsField(fee) }}
                        trigger="Reintentar cobro"
                        variant="secondary"
                        title={`Cobrar ${formatCents(fee)} a ${row.customerEmail}`}
                        consequence="Cargo fuera de sesión a la tarjeta guardada por la cuota del servicio."
                        confirmWord="COBRAR"
                      />
                    ) : null}
                    {refundable ? (
                      <ConfirmAction
                        action={refundPayment}
                        fields={{ paymentId: row.id, confirmedAmount: centsField(row.amount) }}
                        trigger="Reembolsar"
                        title={`Reembolsar ${formatCents(row.amount)} a ${row.customerEmail}`}
                        consequence="Se cancela el pedido asociado y el dinero vuelve a su medio de pago. No se puede deshacer desde aquí."
                        confirmWord="REEMBOLSAR"
                      >
                        <Field label="Motivo" htmlFor={`refund-${row.id}`}>
                          <Textarea id={`refund-${row.id}`} name="reason" rows={2} required />
                        </Field>
                      </ConfirmAction>
                    ) : null}
                  </div>
                </Td>
              </tr>
            )
          })}
        </tbody>
      </TableWrap>
    </>
  )
}
