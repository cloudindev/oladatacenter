import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { formatCents } from "@ola/core"
import { CardLink, DetailHeader, InfoCard, InfoRow, SoonAction } from "@/components/app/Detail"
import { Notice, StatusBadge } from "@/components/app/ui"
import { CopyField } from "@/components/servers/CopyField"
import { formatDate } from "@/components/servers/labels"
import { customerContext } from "@/server/services/customer"
import { whmcsProductDetail } from "@/server/whmcs-products"

/**
 * A VPS the customer contracted before OLA (it lives in WHMCS). Same layout as the OLA
 * server page, read-only: power, console, reinstall and the rest arrive once the service
 * is linked to its OVH server (docs/prompts/fase-6-detalle-de-servicios.md §3.4).
 */

export const metadata: Metadata = {
  title: "VPS · Bare Metal Cloud · OLA",
}

export default async function AccountVpsPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const serviceId = Number(id)
  if (!Number.isInteger(serviceId) || serviceId <= 0) notFound()

  const context = await customerContext()
  if (!context.ok) {
    return (
      <Notice tone="warn" title="No hemos podido cargar este servidor">
        {context.message}
      </Notice>
    )
  }

  const read = await whmcsProductDetail(context.customerId, serviceId)
  if (read === null) notFound()
  if (read.state !== "ok") {
    return (
      <Notice tone="warn" title="No hemos podido cargar este servidor">
        Nuestro sistema de facturación no responde ahora mismo. Vuelve a intentarlo en unos minutos.
      </Notice>
    )
  }
  const vps = read.items[0]
  if (!vps || vps.kind !== "vps") notFound()

  const [ipv4, ...others] = vps.ips
  const pending = ["Consola KVM", "Reiniciar y apagar", "Reinstalar", "Modo rescate", "Instantáneas", "Backup automático"]

  return (
    <>
      <DetailHeader
        back={{ href: "/app/bare-metal/vps", label: "Servidores VPS" }}
        title={vps.label ?? vps.name}
        status={{ label: vps.statusLabel, tone: vps.tone }}
        subtitle={vps.label ? vps.name : undefined}
      />

      <div className="mb-6">
        <Notice tone="neutral" title="Gestión avanzada en preparación">
          Estamos conectando este servidor con el panel. Mientras tanto ves sus datos y su
          facturación; para cualquier acción sobre el servidor, escríbenos desde Soporte.
        </Notice>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <InfoCard title="Información general">
          <InfoRow label="Estado">
            <StatusBadge tone={vps.tone}>{vps.statusLabel}</StatusBadge>
          </InfoRow>
          <InfoRow label="Producto">{vps.name}</InfoRow>
          <InfoRow label="Nombre">{vps.label ?? "—"}</InfoRow>
          <div className="space-y-2 border-t border-border-base pt-4">
            {pending.map((action) => (
              <div key={action}>
                <SoonAction>{action}</SoonAction>
              </div>
            ))}
          </div>
        </InfoCard>

        <InfoCard title="Detalles de conexión">
          <InfoRow label="IPv4">
            {ipv4 ? <CopyField value={ipv4} label="la IPv4" /> : "Consúltala en el correo de alta"}
          </InfoRow>
          {others.length > 0 ? (
            <InfoRow label="IP adicionales">
              <span className="flex flex-col gap-1">
                {others.map((ip) => (
                  <CopyField key={ip} value={ip} label="la IP" />
                ))}
              </span>
            </InfoRow>
          ) : null}
          <InfoRow label="Usuario">{vps.username ?? "root"}</InfoRow>
          <SoonAction>Gestionar IP y DNS inverso</SoonAction>
        </InfoCard>

        <InfoCard title="Suscripción">
          <InfoRow label="Alta">{formatDate(vps.registeredAt)}</InfoRow>
          <InfoRow label="Próximo vencimiento">{vps.live ? formatDate(vps.nextDueAt) : "—"}</InfoRow>
          <InfoRow label="Importe">
            {vps.amountCents > 0 ? `${formatCents(vps.amountCents)}${vps.cycle.startsWith("/") ? vps.cycle : ` ${vps.cycle}`}` : "—"}
          </InfoRow>
          <div className="flex flex-wrap gap-4">
            <CardLink href="/app/billing">Ver facturas</CardLink>
            <CardLink href="/app/billing/saldo">Mi saldo</CardLink>
          </div>
        </InfoCard>
      </div>
    </>
  )
}
