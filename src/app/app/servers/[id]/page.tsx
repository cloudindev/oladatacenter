import { notFound } from "next/navigation"
import { formatCents } from "@ola/core"
import { DataRow, Notice, Panel, SectionTitle, StatusBadge } from "@/components/app/ui"
import { CopyField } from "@/components/servers/CopyField"
import { DiskUsageBar } from "@/components/servers/DiskUsageBar"
import { PowerActions } from "@/components/servers/PowerActions"
import { RenameForm } from "@/components/servers/RenameForm"
import { StatusGateNotice } from "@/components/servers/StatusGateNotice"
import { formatDate, TERM_LABEL, vpsStateUi } from "@/components/servers/labels"
import { load } from "@/server/services/load"
import { actionGate, serviceForPage } from "@/server/services/page-data"
import { fetchDiskUsage, fetchLiveState } from "@/server/services/provider"

/**
 * Resumen.
 *
 * Two reads from the provider: the real power state and the real disk usage. There are
 * no CPU, RAM or network graphs because the OVH API does not serve them — see §3 of
 * `docs/ovh-api-verified.md`. The page says so in one line instead of drawing something
 * that would be made up.
 */
export default async function ServerOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const page = await serviceForPage(id)
  if (page.state === "missing") notFound()
  if (page.state === "unavailable") return null

  const { service } = page
  const can = actionGate(service)

  const [live, disks] = await Promise.all([
    load("fetchLiveState", () => fetchLiveState(service.ovhServiceName)),
    load("fetchDiskUsage", () => fetchDiskUsage(service.ovhServiceName)),
  ])

  const ipv4 = live.ok
    ? live.data.ips.filter((ip) => ip.version === 4).map((ip) => ip.address)
    : service.ipv4
      ? [service.ipv4]
      : []
  const ipv6 = live.ok
    ? live.data.ips.filter((ip) => ip.version === 6).map((ip) => ip.address)
    : service.ipv6
      ? [service.ipv6]
      : []

  return (
    <div className="space-y-8">
      <StatusGateNotice status={service.status} />

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <SectionTitle>Estado</SectionTitle>
          {live.ok ? (
            <StatusBadge
              tone={vpsStateUi(live.data.state).tone}
              pulse={vpsStateUi(live.data.state).tone === "busy"}
            >
              {vpsStateUi(live.data.state).label}
            </StatusBadge>
          ) : null}
        </div>

        {!live.ok ? (
          <div className="mb-5">
            <Notice tone="warn" title="No hemos podido leer el estado en el proveedor">
              {live.message} Lo que ves abajo es lo último que tenemos guardado.
            </Notice>
          </div>
        ) : null}

        <PowerActions
          serviceId={service.id}
          serverName={service.name}
          canStart={can("start")}
          canStop={can("stop")}
          canReboot={can("reboot")}
        />
      </Panel>

      <Panel>
        <SectionTitle>Datos del servidor</SectionTitle>
        <dl>
          <DataRow label="Plan">{service.planName}</DataRow>
          <DataRow label="Recursos">
            {service.specs.vcores} vCore · {service.specs.ramGb} GB RAM ·{" "}
            {service.specs.nvmeGb} GB NVMe · {service.specs.bandwidthMbps} Mbps
          </DataRow>
          <DataRow label="Sistema">{service.os}</DataRow>
          <DataRow label="Ubicación">{service.datacenterLabel}</DataRow>
          <DataRow label="IPv4">
            {ipv4.length > 0 ? (
              <span className="flex flex-col items-end gap-1">
                {ipv4.map((address) => (
                  <CopyField key={address} value={address} label="la IPv4" />
                ))}
              </span>
            ) : (
              "—"
            )}
          </DataRow>
          <DataRow label="IPv6">
            {ipv6.length > 0 ? (
              <span className="flex flex-col items-end gap-1">
                {ipv6.map((address) => (
                  <CopyField key={address} value={address} label="la IPv6" />
                ))}
              </span>
            ) : (
              "—"
            )}
          </DataRow>
          <DataRow label="Creado el">{formatDate(service.createdAt)}</DataRow>
          <DataRow label="Renovación">
            {TERM_LABEL[service.term] ?? service.term} · {formatCents(service.monthlyPrice)} al
            mes · {service.nextDueAt ? formatDate(service.nextDueAt) : "—"}
          </DataRow>
        </dl>
      </Panel>

      <Panel>
        <SectionTitle>Uso del disco</SectionTitle>
        {!disks.ok ? (
          <Notice tone="warn">{disks.message}</Notice>
        ) : disks.data.length === 0 ? (
          <p className="text-sm text-text-muted">
            El proveedor todavía no informa del uso de disco de este servidor.
          </p>
        ) : (
          <div>
            {disks.data.map((disk, index) => (
              <DiskUsageBar key={disk.diskId} disk={disk} index={index} />
            ))}
          </div>
        )}
        <p className="mt-5 text-sm text-text-muted leading-relaxed">
          El uso de disco es la única medida que nos da el proveedor. No publicamos
          gráficas de CPU, memoria ni red porque su API no las ofrece, y preferimos no
          mostrar números inventados. Si necesitas esas métricas, instala en el servidor
          el agente de monitorización que prefieras.
        </p>
      </Panel>

      <Panel>
        <SectionTitle>Nombre</SectionTitle>
        <RenameForm serviceId={service.id} currentName={service.name} />
      </Panel>
    </div>
  )
}
