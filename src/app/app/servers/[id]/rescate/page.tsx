import { notFound } from "next/navigation"
import { Notice, Panel, SectionTitle, StatusBadge } from "@/components/app/ui"
import { RescueToggle } from "@/components/servers/RescueToggle"
import { StatusGateNotice } from "@/components/servers/StatusGateNotice"
import { load } from "@/server/services/load"
import { actionGate, serviceForPage } from "@/server/services/page-data"
import { fetchLiveState } from "@/server/services/provider"

/**
 * Rescue mode.
 *
 * The live `netbootMode` is the truth here, not our own column: somebody may have
 * changed it from the provider's panel.
 */
export default async function RescuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const page = await serviceForPage(id)
  if (page.state === "missing") notFound()
  if (page.state === "unavailable") return null

  const { service } = page
  const can = actionGate(service)
  const live = await load("fetchLiveState", () => fetchLiveState(service.ovhServiceName))
  const rescueMode = live.ok ? live.data.rescueMode : service.rescueMode

  return (
    <div className="space-y-8">
      <StatusGateNotice status={service.status} />

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <SectionTitle>Modo rescate</SectionTitle>
          <StatusBadge tone={rescueMode ? "warn" : "neutral"}>
            {rescueMode ? "Activado" : "Desactivado"}
          </StatusBadge>
        </div>

        {!live.ok ? (
          <div className="mb-5">
            <Notice tone="warn">
              {live.message} Mostramos el último estado que tenemos guardado.
            </Notice>
          </div>
        ) : null}

        <div className="space-y-4 text-sm text-text-muted leading-relaxed max-w-2xl mb-6">
          <p>
            En modo rescate el servidor no arranca su propio sistema: arranca un sistema
            de mantenimiento que vive en memoria. Tu disco sigue intacto y lo puedes
            montar desde ahí para recuperar archivos, arreglar una configuración que ha
            dejado el servidor sin arrancar o cambiar una contraseña.
          </p>
          <p>
            <strong className="text-text-base">Qué cambia mientras está activo:</strong> tus
            servicios están caídos —no hay web, ni correo, ni bases de datos— y las
            credenciales de acceso son las del sistema de rescate, que el proveedor envía
            por correo al activarlo.
          </p>
          <p>
            Tanto entrar como salir implican un reinicio. Al salir, el servidor vuelve a
            arrancar normalmente desde su disco.
          </p>
        </div>

        <RescueToggle
          serviceId={service.id}
          serverName={service.name}
          rescueMode={rescueMode}
          canEnable={can("rescue_on")}
          canDisable={can("rescue_off")}
        />
      </Panel>
    </div>
  )
}
