import Link from "next/link"
import { notFound } from "next/navigation"
import { PROVISION_STEPS, formatCents, marginOf } from "@ola/core"
import { ActionForm, ConfirmAction } from "@/components/admin/action-form"
import {
  AdminHeader,
  AdminSection,
  DeliveryBadge,
  Kv,
  KvRow,
  LoadFailure,
  Maybe,
  Mono,
  Muted,
  OrderStatus,
  ProviderLink,
  RawError,
  Timestamp,
  ovhOrderUrl,
  whmcsInvoiceUrl,
  whmcsOrderUrl,
} from "@/components/admin/ui"
import { Field, Input, Notice, Panel, StatusBadge, Textarea } from "@/components/app/ui"
import {
  assignOrderVps,
  cancelAndRefundOrder,
  retryOrderProvisioning,
} from "@/server/admin/actions"
import { formatMargin } from "@/server/admin/pricing"
import { orderScreen, requireAdminPage } from "@/server/admin/queries"

/**
 * One order, with everything needed to decide what to do about it: the step timeline, the
 * WHMCS and OVH ids, the frozen quote, the raw provider error and the Stripe
 * PaymentIntent.
 *
 * Two buttons, both guarded. "Reintentar" emits `ola/order.provision` and refuses when
 * `OVH_ORDERS_ENABLED` is false or when OVH already took the order. "Cancelar y
 * reembolsar" goes through `refundOrder` and names the exact amount and customer first.
 */

function centsField(value: number): string {
  return `${Math.trunc(value / 100)},${String(Math.abs(value % 100)).padStart(2, "0")}`
}

export default async function AdminPedidoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage()
  const { id } = await params
  const screen = await orderScreen(id)

  if (!screen.ok) {
    return (
      <>
        <AdminHeader title="Pedido" />
        <LoadFailure message={screen.message} detail={screen.detail} />
      </>
    )
  }
  if (!screen.data) notFound()

  const {
    detail,
    nextStep,
    delivery,
    ovhOrdersEnabledInEnv,
    usingMocks,
    checkoutAttempted,
    whmcsBaseUrl,
  } = screen.data
  const done = new Set<string>(detail.completedSteps)
  const margin = marginOf(detail.expectedCost, detail.subtotal)
  const alreadyAtOvh = detail.ovhOrderId !== null
  const doubleOrderRisk = alreadyAtOvh || checkoutAttempted
  const nextIndex = nextStep ? PROVISION_STEPS.indexOf(nextStep) : PROVISION_STEPS.length
  const mayPlaceOrder = nextIndex <= PROVISION_STEPS.indexOf("ovh_checkout")
  const blockedByKillSwitch = mayPlaceOrder && !usingMocks && !ovhOrdersEnabledInEnv
  const retryable = detail.status !== "delivered" && detail.status !== "cancelled"

  return (
    <>
      <AdminHeader
        title={`Pedido ${detail.id}`}
        hint={
          <>
            <Link
              href="/admin/pedidos"
              className="underline decoration-dotted underline-offset-4"
            >
              Volver a la cola
            </Link>{" "}
            · cliente{" "}
            <Link
              href={`/admin/clientes/${detail.customerId}`}
              className="underline decoration-dotted underline-offset-4"
            >
              {detail.customerEmail}
            </Link>
          </>
        }
        actions={
          <>
            <OrderStatus status={detail.status} />
            <DeliveryBadge state={delivery} />
          </>
        }
      />

      {detail.error ? (
        <div className="mb-6">
          <RawError label={detail.errorCode ? `error ${detail.errorCode}` : "error sin filtrar"}>
            {detail.error}
          </RawError>
        </div>
      ) : null}

      {delivery === "timed_out" ? (
        <div className="mb-6">
          <Notice tone="danger" title="Plazo de entrega agotado">
            Han pasado más de 24 h desde el pago sin entrega. O se recupera el pedido o se
            reembolsa; dejarlo así es el peor de los dos.
          </Notice>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <AdminSection title="Acciones">
          <div className="space-y-4">
            {!retryable ? (
              <Notice tone="neutral">
                El pedido está en «{detail.status}»: no hay nada que reintentar.
              </Notice>
            ) : (
              <>
                {detail.status === "failed" && detail.errorCode === "delivery_review" ? (
                  <Panel className="p-4">
                    <p className="mb-1 font-medium text-text-base">Asignar el VPS a mano</p>
                    <p className="mb-3 text-sm text-text-muted">
                      Varios servidores nuevos de la cuenta OVH encajan con este pedido (los tienes
                      en el error de arriba) y el sistema no adivina. Comprueba en OVH cuál se creó
                      con el pedido {detail.ovhOrderId ?? ""} y escribe su nombre. El
                      aprovisionamiento continúa con ese servidor.
                    </p>
                    <ActionForm
                      action={assignOrderVps}
                      fields={{ orderId: detail.id }}
                      submitLabel="Asignar y continuar"
                      variant="primary"
                    >
                      <Field label="Nombre del VPS en OVH" htmlFor="assign-vps">
                        <Input
                          id="assign-vps"
                          name="serviceName"
                          placeholder="vps-1a2b3c4d.vps.ovh.net"
                          autoComplete="off"
                          required
                        />
                      </Field>
                    </ActionForm>
                  </Panel>
                ) : null}
                {alreadyAtOvh ? (
                  <Notice tone="danger" title="OVH ya aceptó este pedido">
                    El pedido OVH <Mono>{detail.ovhOrderId}</Mono> existe. Un reintento a ciegas
                    puede crear un segundo servidor que pagamos nosotros. Comprueba el pedido en
                    OVH antes de marcar la casilla.
                  </Notice>
                ) : checkoutAttempted ? (
                  <Notice tone="danger" title="Ya se intentó el checkout en OVH">
                    Hay una marca <Mono>ovh.checkout.attempt</Mono> en la auditoría y no consta id
                    de pedido OVH: OVH puede haberlo aceptado sin que llegara la respuesta. Revisa
                    los pedidos recientes en OVH antes de marcar la casilla.
                  </Notice>
                ) : null}
                {blockedByKillSwitch ? (
                  <Notice tone="warn" title="OVH_ORDERS_ENABLED está en false">
                    El reintento llegaría hasta el checkout de OVH y se rechazaría. El panel se
                    negará a lanzarlo.
                  </Notice>
                ) : null}

                <ActionForm
                  action={retryOrderProvisioning}
                  fields={{ orderId: detail.id }}
                  submitLabel="Reintentar"
                  variant="primary"
                >
                  {doubleOrderRisk ? (
                    <label className="label-mono mb-3 flex max-w-sm items-start gap-2 text-text-base">
                      <input
                        type="checkbox"
                        name="acknowledgeDoubleOrder"
                        className="mt-0.5 h-4 w-4 accent-[#8a2d26]"
                      />
                      He comprobado {alreadyAtOvh ? `el pedido ${detail.ovhOrderId}` : "los pedidos recientes"}{" "}
                      en OVH y asumo el riesgo de duplicarlo
                    </label>
                  ) : null}
                </ActionForm>

                <ConfirmAction
                  action={cancelAndRefundOrder}
                  fields={{
                    orderId: detail.id,
                    confirmedTotal: centsField(detail.total),
                  }}
                  trigger="Cancelar y reembolsar"
                  title={`Reembolsar ${formatCents(detail.total)} a ${detail.customerEmail}`}
                  consequence={
                    `Se cancela el pedido y se devuelven ${formatCents(detail.total)} al medio de ` +
                    `pago de ${detail.customerEmail}. El dinero sale de verdad y no se puede deshacer ` +
                    "desde aquí."
                  }
                  confirmWord="REEMBOLSAR"
                >
                  <Field label="Motivo del reembolso" htmlFor="refund-reason">
                    <Textarea id="refund-reason" name="reason" rows={2} required />
                  </Field>
                </ConfirmAction>
              </>
            )}
          </div>
        </AdminSection>

        <AdminSection title="Aprovisionamiento" hint={`Paso siguiente: ${nextStep ?? "ninguno"}`}>
          <Panel className="p-4">
            <ol className="space-y-1.5">
              {PROVISION_STEPS.map((step) => {
                const complete = done.has(step)
                const current = step === nextStep
                return (
                  <li key={step} className="flex items-center justify-between gap-3">
                    <Mono
                      className={
                        complete
                          ? "text-text-base"
                          : current
                            ? "font-medium text-accent-ink"
                            : "text-text-muted"
                      }
                    >
                      {step}
                    </Mono>
                    {complete ? (
                      <StatusBadge tone="ok">Hecho</StatusBadge>
                    ) : current ? (
                      <StatusBadge tone="busy">Siguiente</StatusBadge>
                    ) : (
                      <Muted>pendiente</Muted>
                    )}
                  </li>
                )
              })}
            </ol>
          </Panel>
        </AdminSection>

        <AdminSection title="Dinero">
          <Panel className="p-4">
            <Kv>
              <KvRow label="Subtotal" mono>
                {formatCents(detail.subtotal)}
              </KvRow>
              <KvRow label="IVA" mono>
                {formatCents(detail.tax)}
              </KvRow>
              <KvRow label="Crédito aplicado" mono>
                {formatCents(detail.creditApplied)}
              </KvRow>
              <KvRow label="Total cobrado" mono>
                {formatCents(detail.total)}
              </KvRow>
              <KvRow label="Coste previsto OVH" mono>
                {formatCents(detail.expectedCost)}
              </KvRow>
              <KvRow label="Margen sobre coste previsto" mono>
                {formatMargin(margin)}
              </KvRow>
              <KvRow label="Término">{detail.term === "P1M" ? "Mensual" : "Anual"}</KvRow>
            </Kv>
          </Panel>
        </AdminSection>
      </div>

      <AdminSection title="Identificadores" hint="Enlaces de sólo lectura; el panel no actúa a través de ellos.">
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel className="p-4">
            <Kv>
              <KvRow label="Pedido" mono>
                {detail.id}
              </KvRow>
              <KvRow label="Clave de idempotencia" mono>
                {detail.idempotencyKey}
              </KvRow>
              <KvRow label="Servicio creado" mono>
                {detail.serviceId ? (
                  <Link
                    href={`/admin/servicios/${detail.serviceId}`}
                    className="text-accent-ink underline decoration-dotted underline-offset-4"
                  >
                    {detail.serviceId}
                  </Link>
                ) : (
                  <Muted>—</Muted>
                )}
              </KvRow>
              <KvRow label="Stripe PaymentIntent" mono>
                <Maybe value={detail.stripePaymentIntentId} />
              </KvRow>
              <KvRow label="Creado">
                <Timestamp value={detail.createdAt} />
              </KvRow>
              <KvRow label="Pagado">
                <Timestamp value={detail.paidAt} />
              </KvRow>
              <KvRow label="Entregado">
                <Timestamp value={detail.deliveredAt} />
              </KvRow>
              <KvRow label="Actualizado">
                <Timestamp value={detail.updatedAt} />
              </KvRow>
            </Kv>
          </Panel>

          <Panel className="p-4">
            <Kv>
              <KvRow label="OVH cart" mono>
                <Maybe value={detail.ovhCartId} />
              </KvRow>
              <KvRow label="OVH order" mono>
                {detail.ovhOrderId !== null ? (
                  <ProviderLink href={ovhOrderUrl(detail.ovhOrderId)}>
                    {detail.ovhOrderId}
                  </ProviderLink>
                ) : (
                  <Muted>—</Muted>
                )}
              </KvRow>
              <KvRow label="WHMCS order" mono>
                {detail.whmcsOrderId !== null ? (
                  whmcsBaseUrl ? (
                    <ProviderLink href={whmcsOrderUrl(whmcsBaseUrl, detail.whmcsOrderId)}>
                      {detail.whmcsOrderId}
                    </ProviderLink>
                  ) : (
                    detail.whmcsOrderId
                  )
                ) : (
                  <Muted>—</Muted>
                )}
              </KvRow>
              <KvRow label="WHMCS invoice" mono>
                {detail.whmcsInvoiceId !== null ? (
                  whmcsBaseUrl ? (
                    <ProviderLink href={whmcsInvoiceUrl(whmcsBaseUrl, detail.whmcsInvoiceId)}>
                      {detail.whmcsInvoiceId}
                    </ProviderLink>
                  ) : (
                    detail.whmcsInvoiceId
                  )
                ) : (
                  <Muted>—</Muted>
                )}
              </KvRow>
            </Kv>
            {!whmcsBaseUrl ? (
              <p className="mt-3 text-xs text-text-muted">
                WHMCS_API_URL no está configurada, así que no hay enlace al área de administración.
              </p>
            ) : null}
          </Panel>
        </div>
      </AdminSection>

      <AdminSection
        title="Presupuesto congelado"
        hint="orders.items, tal cual se guardó al pedir. Nunca se recalcula."
      >
        <Panel className="p-4">
          <pre className="overflow-x-auto font-mono text-xs leading-relaxed whitespace-pre-wrap text-text-base">
            {JSON.stringify(detail.items, null, 2)}
          </pre>
        </Panel>
      </AdminSection>

      <AdminSection title="Auditoría de este pedido">
        <Link
          href={`/admin/auditoria?entidad=order&id=${detail.id}`}
          className="label-mono text-accent-ink underline decoration-dotted underline-offset-4"
        >
          Ver todas las entradas de auditoría de este pedido
        </Link>
      </AdminSection>
    </>
  )
}
