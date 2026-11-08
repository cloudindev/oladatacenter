import { notFound } from "next/navigation"
import { formatCents, SELLABLE_DATACENTERS } from "@ola/core"
import { CardLink, InfoCard, InfoRow, SoonAction } from "@/components/app/Detail"
import { Notice, Panel, SectionTitle, StatusBadge } from "@/components/app/ui"
import { CopyField } from "@/components/servers/CopyField"
import { DiskUsageBar } from "@/components/servers/DiskUsageBar"
import { PowerActions } from "@/components/servers/PowerActions"
import { RenameForm } from "@/components/servers/RenameForm"
import { StatusGateNotice } from "@/components/servers/StatusGateNotice"
import { formatDate, TERM_LABEL, vpsStateUi } from "@/components/servers/labels"
import { CountryFlag } from "@/components/vps/CountryFlag"
import { load } from "@/server/services/load"
import { actionGate, serviceForPage } from "@/server/services/page-data"
import { fetchDiskUsage, fetchLiveState } from "@/server/services/provider"

/**
 * Resumen, organised like the OVHcloud manager: general information, connection details,
 * configuration, backups and subscription, then disk usage and the server's name.
 *
 * Two live reads from the provider: power state and IPs, and disk usage. There are no CPU,
 * RAM or network graphs because the OVH API does not serve them for this range (§3 of
 * `docs/ovh-api-verified.md`); the page says so instead of drawing invented numbers.
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
  const base = `/app/servers/${service.id}`

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
  const site = SELLABLE_DATACENTERS.find((dc) => `${dc.city}, ${dc.country}` === service.datacenterLabel)
  const state = live.ok ? vpsStateUi(live.data.state) : null

  return (
    <div className="space-y-5">
      <StatusGateNotice status={service.status} />
      {!live.ok ? (
        <Notice tone="warn" title="No hemos podido leer el estado en el proveedor">
          {live.message} Lo que ves abajo es lo último que tenemos guardado.
        </Notice>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <InfoCard title="Información general">
          <InfoRow label="Estado">
            {state ? (
              <StatusBadge tone={state.tone} pulse={state.tone === "busy"}>
                {state.label}
              </StatusBadge>
            ) : (
              "—"
            )}
          </InfoRow>
          <InfoRow label="Arranque">
            {live.ok && live.data.rescueMode ? "Modo rescate" : "Disco local"}
          </InfoRow>
          <InfoRow label="Distribución">{service.os}</InfoRow>
          <CardLink href={`${base}/reinstalar`}>Reinstalar mi VPS</CardLink>
          <InfoRow label="Región">
            <span className="inline-flex items-center gap-2">
              {site ? <CountryFlag code={site.countryCode} /> : null}
              {service.datacenterLabel}
            </span>
          </InfoRow>
          <div className="border-t border-border-base pt-4">
            <p className="label-mono mb-2 text-text-muted">Acciones</p>
            <PowerActions
              serviceId={service.id}
              serverName={service.name}
              canStart={can("start")}
              canStop={can("stop")}
              canReboot={can("reboot")}
            />
          </div>
        </InfoCard>

        <InfoCard title="Detalles de conexión">
          <InfoRow label="IPv4">
            {ipv4.length > 0 ? (
              <span className="flex flex-col gap-1">
                {ipv4.map((address) => (
                  <CopyField key={address} value={address} label="la IPv4" />
                ))}
              </span>
            ) : (
              "Se asigna al crear el servidor"
            )}
          </InfoRow>
          <InfoRow label="IPv6">
            {ipv6.length > 0 ? (
              <span className="flex flex-col gap-1">
                {ipv6.map((address) => (
                  <CopyField key={address} value={address} label="la IPv6" />
                ))}
              </span>
            ) : (
              "—"
            )}
          </InfoRow>
          <InfoRow label="Acceso">SSH como root, con tu clave o la contraseña que te enviamos.</InfoRow>
          <div className="flex flex-col gap-2">
            <CardLink href={`${base}/consola`}>Abrir la consola KVM</CardLink>
            <CardLink href={`${base}/red`}>Gestionar IP, DNS inverso y firewall</CardLink>
          </div>
        </InfoCard>

        <InfoCard title="Mi configuración">
          <InfoRow label="Modelo">{service.planName}</InfoRow>
          <InfoRow label="Procesador">{service.specs.vcores} vCores</InfoRow>
          <InfoRow label="Memoria">{service.specs.ramGb} GB</InfoRow>
          <InfoRow label="Disco principal">{service.specs.nvmeGb} GB NVMe · local</InfoRow>
          <InfoRow label="Ancho de banda">{service.specs.bandwidthMbps} Mbps</InfoRow>
          <div className="flex flex-col gap-2">
            <CardLink href={`${base}/plan`}>Cambiar de gama</CardLink>
            <SoonAction>Añadir un disco</SoonAction>
          </div>
        </InfoCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <InfoCard title="Copia de seguridad">
          <InfoRow label="Instantánea">Una instantánea manual del disco, para volver atrás en segundos.</InfoRow>
          <CardLink href={`${base}/snapshots`}>Gestionar instantáneas</CardLink>
          <InfoRow label="Backup automático">Copia diaria con restauración desde el panel.</InfoRow>
          <CardLink href={`${base}/backups`}>Ver copias y restaurar</CardLink>
        </InfoCard>

        <InfoCard title="Suscripción">
          <InfoRow label="Creado el">{formatDate(service.createdAt)}</InfoRow>
          <InfoRow label="Compromiso">{TERM_LABEL[service.term] ?? service.term}</InfoRow>
          <InfoRow label="Próxima renovación">
            {service.nextDueAt ? formatDate(service.nextDueAt) : "—"} · {formatCents(service.monthlyPrice)}/mes
          </InfoRow>
          <InfoRow label="Renovación automática">{service.autoRenew ? "Activada" : "Cancelada"}</InfoRow>
          <CardLink href={`${base}/plan`}>Gestionar el plan</CardLink>
        </InfoCard>

        <InfoCard title="Uso del disco">
          {!disks.ok ? (
            <Notice tone="warn">{disks.message}</Notice>
          ) : disks.data.length === 0 ? (
            <p className="text-sm text-text-muted">El proveedor todavía no informa del uso de disco.</p>
          ) : (
            <div>
              {disks.data.map((disk, index) => (
                <DiskUsageBar key={disk.diskId} disk={disk} index={index} />
              ))}
            </div>
          )}
          <p className="text-xs leading-relaxed text-text-muted">
            El proveedor no ofrece gráficas de CPU, memoria ni red para esta gama; no mostramos
            números inventados. Si las necesitas, instala en el servidor el agente de
            monitorización que prefieras.
          </p>
        </InfoCard>
      </div>

      <Panel>
        <SectionTitle>Nombre</SectionTitle>
        <RenameForm serviceId={service.id} currentName={service.name} />
      </Panel>
    </div>
  )
}
