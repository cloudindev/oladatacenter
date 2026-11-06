import { notFound } from "next/navigation"
import { DataRow, Notice, Panel, SectionTitle, StatusBadge } from "@/components/app/ui"
import { BackupRestorePanel } from "@/components/servers/BackupRestorePanel"
import { StatusGateNotice } from "@/components/servers/StatusGateNotice"
import { load } from "@/server/services/load"
import { actionGate, serviceForPage } from "@/server/services/page-data"
import { fetchBackup } from "@/server/services/provider"

/**
 * Automated backup.
 *
 * Every plan carries it: it is a mandatory, priced option in the OVH catalogue, so a
 * server without it does not exist. The restore points come from the provider.
 */
export default async function BackupsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const page = await serviceForPage(id)
  if (page.state === "missing") notFound()
  if (page.state === "unavailable") return null

  const { service } = page
  const can = actionGate(service)
  const backup = await load("fetchBackup", () => fetchBackup(service.ovhServiceName))

  return (
    <div className="space-y-8">
      <StatusGateNotice status={service.status} />

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <SectionTitle>Backup automático</SectionTitle>
          {backup.ok ? (
            <StatusBadge tone={backup.data.enabled ? "ok" : "warn"}>
              {backup.data.enabled ? "Activo" : "No activo"}
            </StatusBadge>
          ) : null}
        </div>

        {!backup.ok ? (
          <Notice tone="warn" title="No hemos podido consultar las copias">
            {backup.message}
          </Notice>
        ) : (
          <>
            <dl className="mb-6">
              <DataRow label="Copias guardadas">
                {backup.data.rotation !== null
                  ? `${backup.data.rotation} ${backup.data.rotation === 1 ? "día" : "días"}`
                  : "—"}
              </DataRow>
              <DataRow label="Hora de la copia" mono>
                {backup.data.schedule ?? "La decide el proveedor"}
              </DataRow>
            </dl>

            <p className="mb-6 text-sm text-text-muted leading-relaxed max-w-2xl">
              La copia se hace sola una vez al día sin apagar el servidor. Restaurar
              devuelve el disco completo al estado de la fecha que elijas, así que lo que
              hayas hecho después se pierde. Si solo necesitas un archivo concreto, suele
              ser mejor restaurar sobre un servidor de pruebas.
            </p>

            <BackupRestorePanel
              serviceId={service.id}
              serverName={service.name}
              restorePoints={backup.data.restorePoints}
              canRestore={can("backup_restore")}
            />
          </>
        )}
      </Panel>
    </div>
  )
}
