"use client"

import { rebootServer, startServer, stopServer } from "@/server/services/actions"
import { ActionButton } from "./ActionButton"

/**
 * Encender, apagar, reiniciar. Which buttons exist at all is decided on the server by
 * `allowedActions`, so a suspended server renders none of them.
 */
export function PowerActions({
  serviceId,
  serverName,
  canStart,
  canStop,
  canReboot,
}: {
  serviceId: string
  serverName: string
  canStart: boolean
  canStop: boolean
  canReboot: boolean
}) {
  if (!canStart && !canStop && !canReboot) return null

  return (
    <div className="flex flex-wrap gap-3">
      {canStart ? (
        <ActionButton
          serviceId={serviceId}
          label="Encender"
          variant="primary"
          withArrow
          run={() => startServer(serviceId)}
        />
      ) : null}

      {canReboot ? (
        <ActionButton
          serviceId={serviceId}
          label="Reiniciar"
          run={() => rebootServer(serviceId)}
          confirm={{
            title: "Reiniciar el servidor",
            consequence: (
              <>
                El servidor se apaga y vuelve a arrancar. Durante un par de minutos{" "}
                {serverName} deja de responder y se cortan las conexiones abiertas. Los
                datos del disco no se tocan.
              </>
            ),
            confirmLabel: "Reiniciar ahora",
          }}
        />
      ) : null}

      {canStop ? (
        <ActionButton
          serviceId={serviceId}
          label="Apagar"
          variant="danger"
          run={() => stopServer(serviceId)}
          confirm={{
            title: "Apagar el servidor",
            consequence: (
              <>
                {serverName} se apaga y todo lo que tenga publicado deja de estar
                accesible hasta que lo vuelvas a encender. Los datos del disco se
                conservan y el servicio se sigue facturando.
              </>
            ),
            confirmLabel: "Apagar el servidor",
            danger: true,
          }}
        />
      ) : null}
    </div>
  )
}
