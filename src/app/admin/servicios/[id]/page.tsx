import Link from "next/link"
import { notFound } from "next/navigation"
import { allowedActions, canTransitionService, formatCents } from "@ola/core"
import { ActionForm, ConfirmAction } from "@/components/admin/action-form"
import {
  ACTION_STATUS_UI,
  AdminHeader,
  AdminSection,
  DunningBadge,
  Kv,
  KvRow,
  LoadFailure,
  Maybe,
  Mono,
  Muted,
  ProviderLink,
  ServiceStatus,
  TableEmpty,
  TableWrap,
  Td,
  Th,
  Timestamp,
  ovhVpsUrl,
} from "@/components/admin/ui"
import { Field, Input, Notice, Panel, StatusBadge, Textarea } from "@/components/app/ui"
import {
  changeServiceNextDueAt,
  changeServiceStatus,
  forceServiceSync,
  retryRenewalCharge,
} from "@/server/admin/actions"
import { requireAdminPage, serviceScreen } from "@/server/admin/queries"

/**
 * One service: everything the customer can do with it, plus the admin-only levers —
 * force a sync with OVH, suspend or reactivate, move the renewal date, mark it as abuse,
 * and the full history of `actions`.
 */

const CUSTOMER_ACTION_LABELS: Record<string, string> = {
  start: "Encender",
  stop: "Apagar",
  reboot: "Reiniciar",
  reinstall: "Reinstalar",
  rescue_on: "Activar rescate",
  rescue_off: "Salir de rescate",
  console: "Consola",
  snapshot_create: "Crear snapshot",
  snapshot_revert: "Restaurar snapshot",
  snapshot_delete: "Borrar snapshot",
  backup_restore: "Restaurar backup",
  rdns_set: "Cambiar rDNS",
  firewall_rule_add: "Añadir regla de firewall",
  firewall_rule_delete: "Borrar regla de firewall",
  upgrade: "Mejorar plan",
  addon_add: "Añadir opción",
}

function centsField(value: number): string {
  return `${Math.trunc(value / 100)},${String(Math.abs(value % 100)).padStart(2, "0")}`
}

export default async function AdminServicioPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage()
  const { id } = await params
  const screen = await serviceScreen(id)

  if (!screen.ok) {
    return (
      <>
        <AdminHeader title="Servicio" />
        <LoadFailure message={screen.message} detail={screen.detail} />
      </>
    )
  }
  if (!screen.data) notFound()

  const { detail, actions, pendingDunning, dunningCalendar } = screen.data
  const customerActions = allowedActions(detail.status)
  const who = `${detail.displayName ?? detail.id} de ${detail.customerEmail}`
  const baseFields = { serviceId: detail.id, confirmedCustomerId: detail.customerId }

  return (
    <>
      <AdminHeader
        title={detail.displayName ?? `Servicio ${detail.id}`}
        hint={
          <>
            <Link href="/admin/servicios" className="underline decoration-dotted underline-offset-4">
              Volver a servicios
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
            <ServiceStatus status={detail.status} />
            <DunningBadge stage={detail.dunningStage} />
          </>
        }
      />

      {pendingDunning ? (
        <div className="mb-6">
          <Notice tone="warn" title="Paso de cobro pendiente">
            Debería haberse ejecutado «{pendingDunning.stage}» el{" "}
            {pendingDunning.at.toISOString().slice(0, 10)} y no consta como hecho.
          </Notice>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <AdminSection title="Datos">
          <Panel className="p-4">
            <Kv>
              <KvRow label="Id" mono>{detail.id}</KvRow>
              <KvRow label="Servicio OVH" mono>
                {detail.ovhServiceName ? (
                  <ProviderLink href={ovhVpsUrl(detail.ovhServiceName)}>
                    {detail.ovhServiceName}
                  </ProviderLink>
                ) : (
                  <Muted>—</Muted>
                )}
              </KvRow>
              <KvRow label="Plan">
                {detail.planName} <Mono className="text-text-muted">{detail.ovhPlanCode}</Mono>
              </KvRow>
              <KvRow label="Datacenter" mono>{detail.datacenter}</KvRow>
              <KvRow label="Sistema">{detail.os}</KvRow>
              <KvRow label="IPv4" mono><Maybe value={detail.ipv4} /></KvRow>
              <KvRow label="IPv6" mono><Maybe value={detail.ipv6} /></KvRow>
              <KvRow label="Rescate">{detail.rescueMode ? "Sí" : "No"}</KvRow>
              <KvRow label="Servicio WHMCS" mono><Maybe value={detail.whmcsServiceId} /></KvRow>
              <KvRow label="Pedido" mono>
                {detail.orderId ? (
                  <Link href={`/admin/pedidos/${detail.orderId}`} className="text-accent-ink underline decoration-dotted underline-offset-4">
                    {detail.orderId}
                  </Link>
                ) : (
                  <Muted>—</Muted>
                )}
              </KvRow>
              <KvRow label="Última sincronización"><Timestamp value={detail.lastSyncedAt} /></KvRow>
            </Kv>
          </Panel>
        </AdminSection>

        <AdminSection title="Facturación">
          <Panel className="p-4">
            <Kv>
              <KvRow label="Cuota" mono>{formatCents(detail.monthlyPrice)} / mes</KvRow>
              <KvRow label="Término">{detail.term === "P1M" ? "Mensual" : "Anual"}</KvRow>
              <KvRow label="Renovación automática">{detail.autoRenew ? "Sí" : "No"}</KvRow>
              <KvRow label="Próxima renovación"><Timestamp value={detail.nextDueAt} time={false} /></KvRow>
              <KvRow label="Caduca en OVH"><Timestamp value={detail.ovhExpiresAt} time={false} /></KvRow>
              <KvRow label="Suspendido"><Timestamp value={detail.suspendedAt} /></KvRow>
            </Kv>
            {dunningCalendar.length > 0 ? (
              <ol className="mt-4 space-y-1 border-t border-border-base pt-3">
                {dunningCalendar.map((step) => (
                  <li key={step.stage} className="flex justify-between gap-2 text-xs">
                    <Mono className={detail.dunningCompleted.includes(step.stage) ? "" : "text-text-muted"}>
                      {step.stage}
                    </Mono>
                    <span className="font-mono">{step.at.toISOString().slice(0, 10)}</span>
                  </li>
                ))}
              </ol>
            ) : null}
          </Panel>
        </AdminSection>

        <AdminSection title="Lo que puede hacer el cliente" hint="Según el estado actual.">
          <Panel className="p-4">
            {customerActions.length === 0 ? (
              <p className="text-sm text-text-muted">
                Nada: en este estado el panel del cliente es de sólo lectura.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {customerActions.map((action) => (
                  <li key={action}>
                    <StatusBadge tone="neutral">{CUSTOMER_ACTION_LABELS[action] ?? action}</StatusBadge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </AdminSection>
      </div>

      <AdminSection title="Acciones internas">
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel className="space-y-4 p-4">
            <ActionForm
              action={forceServiceSync}
              fields={{ serviceId: detail.id }}
              submitLabel="Forzar sincronización con OVH"
            />

            <ActionForm
              action={changeServiceNextDueAt}
              fields={baseFields}
              submitLabel="Cambiar renovación"
            >
              <label className="block">
                <span className="label-mono mb-1.5 block text-text-muted">Próxima renovación</span>
                <Input
                  type="date"
                  name="nextDueAt"
                  defaultValue={detail.nextDueAt ? detail.nextDueAt.toISOString().slice(0, 10) : ""}
                />
              </label>
            </ActionForm>

            {detail.status !== "terminated" ? (
              <ConfirmAction
                action={retryRenewalCharge}
                fields={{ serviceId: detail.id, confirmedAmount: centsField(detail.monthlyPrice) }}
                trigger="Reintentar cobro"
                variant="secondary"
                title={`Cobrar ${formatCents(detail.monthlyPrice)} a ${detail.customerEmail}`}
                consequence="Se hace un cargo fuera de sesión a la tarjeta guardada del cliente por la cuota de este servicio."
                confirmWord="COBRAR"
              />
            ) : null}
          </Panel>

          <Panel className="space-y-4 p-4">
            {canTransitionService(detail.status, "suspended") ? (
              <ConfirmAction
                action={changeServiceStatus}
                fields={{ ...baseFields, status: "suspended" }}
                trigger="Suspender"
                title={`Suspender ${who}`}
                consequence="El servidor se detiene y el cliente pierde el acceso a las acciones hasta que se reactive."
                confirmWord="SUSPENDER"
              >
                <Field label="Motivo" htmlFor="suspend-reason">
                  <Input id="suspend-reason" name="reason" />
                </Field>
              </ConfirmAction>
            ) : null}

            {canTransitionService(detail.status, "active") && detail.status !== "stopped" ? (
              <ConfirmAction
                action={changeServiceStatus}
                fields={{ ...baseFields, status: "active" }}
                trigger="Reactivar"
                variant="secondary"
                title={`Reactivar ${who}`}
                consequence="El servicio vuelve a estado activo y el cliente recupera sus acciones."
                confirmWord="REACTIVAR"
              >
                <Field label="Motivo" htmlFor="reactivate-reason">
                  <Input id="reactivate-reason" name="reason" />
                </Field>
              </ConfirmAction>
            ) : null}

            {canTransitionService(detail.status, "review") ? (
              <ConfirmAction
                action={changeServiceStatus}
                fields={{ ...baseFields, status: "review" }}
                trigger="Marcar como abuso"
                title={`Poner en revisión ${who}`}
                consequence="El servidor queda en revisión por abuso: se detiene y sólo un administrador puede reactivarlo o cancelarlo."
                confirmWord="ABUSO"
              >
                <Field label="Motivo (obligatorio)" htmlFor="abuse-reason">
                  <Textarea id="abuse-reason" name="reason" rows={2} required />
                </Field>
              </ConfirmAction>
            ) : null}
          </Panel>
        </div>
      </AdminSection>

      <AdminSection title="Historial de acciones" hint={`${actions.length} entradas, la más reciente primero`}>
        <TableWrap>
          <thead>
            <tr>
              <Th>Fecha</Th>
              <Th>Acción</Th>
              <Th align="center">Estado</Th>
              <Th>Tarea OVH</Th>
              <Th>Terminada</Th>
              <Th>Error</Th>
            </tr>
          </thead>
          <tbody>
            {actions.length === 0 ? <TableEmpty colSpan={6}>Sin acciones registradas.</TableEmpty> : null}
            {actions.map((action) => {
              const ui = ACTION_STATUS_UI[action.status] ?? { label: action.status, tone: "neutral" as const }
              return (
                <tr key={action.id}>
                  <Td><Timestamp value={action.createdAt} /></Td>
                  <Td mono>{action.type}</Td>
                  <Td align="center"><StatusBadge tone={ui.tone}>{ui.label}</StatusBadge></Td>
                  <Td mono><Maybe value={action.ovhTaskId} /></Td>
                  <Td><Timestamp value={action.finishedAt} /></Td>
                  <Td>
                    {action.error ? (
                      <span className="font-mono text-xs text-[#8a2d26]">{action.error}</span>
                    ) : (
                      <Muted>—</Muted>
                    )}
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </TableWrap>
      </AdminSection>
    </>
  )
}
