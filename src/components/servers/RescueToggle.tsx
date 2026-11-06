"use client"

import { disableRescueMode, enableRescueMode } from "@/server/services/actions"
import { ActionButton } from "./ActionButton"

/**
 * Rescue mode: the server boots a maintenance system instead of its own disk, so the
 * disk can be mounted and repaired. Leaving it is another reboot.
 */
export function RescueToggle({
  serviceId,
  serverName,
  rescueMode,
  canEnable,
  canDisable,
}: {
  serviceId: string
  serverName: string
  rescueMode: boolean
  canEnable: boolean
  canDisable: boolean
}) {
  if (rescueMode) {
    return (
      <ActionButton
        serviceId={serviceId}
        label="Salir del modo rescate"
        variant="primary"
        withArrow
        disabled={!canDisable}
        disabledReason={
          canDisable ? undefined : "Disponible cuando el servidor vuelva a estar activo."
        }
        run={() => disableRescueMode(serviceId)}
        confirm={{
          title: "Salir del modo rescate",
          consequence: (
            <>
              {serverName} se reinicia y vuelve a arrancar desde su propio disco. Si
              tenías algo montado desde el sistema de rescate, desmóntalo antes.
            </>
          ),
          confirmLabel: "Reiniciar en modo normal",
        }}
      />
    )
  }

  return (
    <ActionButton
      serviceId={serviceId}
      label="Activar el modo rescate"
      variant="secondary"
      disabled={!canEnable}
      disabledReason={canEnable ? undefined : "Disponible cuando el servidor está activo."}
      run={() => enableRescueMode(serviceId)}
      confirm={{
        title: "Activar el modo rescate",
        consequence: (
          <>
            {serverName} se reinicia y arranca un sistema de mantenimiento en memoria en
            lugar de su sistema operativo. Durante ese tiempo tus servicios están caídos.
            El disco no se borra: lo podrás montar para recuperar o arreglar archivos.
          </>
        ),
        confirmLabel: "Reiniciar en modo rescate",
      }}
    />
  )
}
