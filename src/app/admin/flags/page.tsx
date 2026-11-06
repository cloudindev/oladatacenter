import { ConfirmAction } from "@/components/admin/action-form"
import { AdminHeader, LoadFailure, Mono, TableWrap, Td, Th, Timestamp } from "@/components/admin/ui"
import { Notice, StatusBadge } from "@/components/app/ui"
import { setFeatureFlag } from "@/server/admin/actions"
import { flagsScreen, requireAdminPage } from "@/server/admin/queries"

/**
 * Operational switches backed by `featureFlags`.
 *
 * `ovh_orders` is special: it mirrors the `OVH_ORDERS_ENABLED` kill switch, and the
 * environment variable is what `assertOvhOrdersEnabled()` actually reads. The table says
 * which of the two is holding the brake so nobody flips the row on and assumes orders
 * are flowing.
 */

const BLOCKED_BY_LABEL: Record<string, string> = {
  ninguno: "nada, está activa",
  entorno: "la variable de entorno",
  "base de datos": "este flag",
  ambos: "el entorno y este flag",
}

export default async function AdminFlagsPage() {
  await requireAdminPage()
  const screen = await flagsScreen()

  if (!screen.ok) {
    return (
      <>
        <AdminHeader title="Flags" />
        <LoadFailure message={screen.message} detail={screen.detail} />
      </>
    )
  }

  const { flags, ovhOrdersEnabledInEnv, usingMocks } = screen.data

  return (
    <>
      <AdminHeader title="Flags" hint="Cambiar un flag pide confirmación y queda en la auditoría." />

      <div className="mb-6">
        <Notice
          tone={ovhOrdersEnabledInEnv ? "warn" : "neutral"}
          title={`OVH_ORDERS_ENABLED = ${ovhOrdersEnabledInEnv ? "true" : "false"}`}
        >
          Es la variable que manda para los pedidos reales: assertOvhOrdersEnabled() sólo lee el
          entorno. El flag <Mono>ovh_orders</Mono> puede frenar pedidos, pero nunca activarlos si la
          variable está en false.
          {usingMocks ? " Ahora mismo los proveedores están simulados: no sale ningún pedido real." : ""}
        </Notice>
      </div>

      <TableWrap>
        <thead>
          <tr>
            <Th>Flag</Th>
            <Th align="center">Guardado</Th>
            <Th align="center">Entorno</Th>
            <Th align="center">En vigor</Th>
            <Th>Lo frena</Th>
            <Th>Actualizado</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {flags.map((flag) => {
            const next = !flag.storedEnabled
            return (
              <tr key={flag.key}>
                <Td>
                  <p className="font-medium">{flag.label}</p>
                  <Mono className="text-text-muted">{flag.key}</Mono>
                </Td>
                <Td align="center">
                  <StatusBadge tone={flag.storedEnabled ? "ok" : "neutral"}>
                    {flag.storedEnabled ? "Activo" : "Apagado"}
                  </StatusBadge>
                  {flag.row === null ? <p className="label-mono mt-1 text-text-muted">sin fila</p> : null}
                </Td>
                <Td align="center">
                  {flag.envEnabled === null ? (
                    <span className="text-text-muted">—</span>
                  ) : (
                    <StatusBadge tone={flag.envEnabled ? "ok" : "danger"}>
                      {flag.envEnabled ? "true" : "false"}
                    </StatusBadge>
                  )}
                </Td>
                <Td align="center">
                  <StatusBadge tone={flag.effective ? "ok" : "warn"}>
                    {flag.effective ? "Sí" : "No"}
                  </StatusBadge>
                </Td>
                <Td>{BLOCKED_BY_LABEL[flag.blockedBy] ?? flag.blockedBy}</Td>
                <Td><Timestamp value={flag.row?.updatedAt ?? null} /></Td>
                <Td>
                  <ConfirmAction
                    action={setFeatureFlag}
                    fields={{ key: flag.key, confirmedKey: flag.key, enabled: next ? "on" : "" }}
                    trigger={next ? "Activar" : "Desactivar"}
                    variant={next ? "secondary" : "danger"}
                    title={`${next ? "Activar" : "Desactivar"} ${flag.label}`}
                    consequence={
                      next
                        ? flag.envBacked && !ovhOrdersEnabledInEnv
                          ? "El flag quedará activo, pero los pedidos siguen frenados por OVH_ORDERS_ENABLED=false."
                          : "La función vuelve a estar disponible en cuanto se guarde."
                        : `Efecto inmediato: ${flag.consequence}.`
                    }
                    confirmWord={flag.key.toUpperCase()}
                  />
                </Td>
              </tr>
            )
          })}
        </tbody>
      </TableWrap>
    </>
  )
}
