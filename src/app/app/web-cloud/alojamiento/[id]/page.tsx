import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { formatCents } from "@ola/core"
import { CardLink, DetailHeader, InfoCard, InfoRow, SoonAction } from "@/components/app/Detail"
import { ButtonLink, Notice, StatusBadge } from "@/components/app/ui"
import { formatDate } from "@/components/servers/labels"
import { customerContext } from "@/server/services/customer"
import { whmcsProductDetail } from "@/server/whmcs-products"

/**
 * Web Cloud → Alojamiento web → one plan: its state and renewal, the space and traffic it
 * uses, the connection details, and the one-click way into Plesk.
 */

export const metadata: Metadata = {
  title: "Alojamiento web · Web Cloud · OLA",
}

function megabytes(value: number | null): string {
  if (value === null) return "—"
  return value >= 1024 ? `${(value / 1024).toLocaleString("es-ES", { maximumFractionDigits: 1 })} GB` : `${value} MB`
}

function UsageBar({ label, used, limit }: { label: string; used: number | null; limit: number | null }) {
  const unlimited = limit === null || limit === 0
  const share = !unlimited && used !== null ? Math.min(100, Math.round((used / limit) * 100)) : 0
  return (
    <div>
      <div className="mb-1.5 flex justify-between gap-3 text-sm">
        <span className="label-mono text-text-muted">{label}</span>
        <span className="text-text-base">
          {megabytes(used)} {unlimited ? "· sin límite" : `de ${megabytes(limit)}`}
        </span>
      </div>
      {unlimited ? null : (
        <div className="h-2 overflow-hidden rounded-full bg-surface-beige">
          <div
            className={share >= 90 ? "h-full bg-[#c4513f]" : share >= 75 ? "h-full bg-[#e0a43a]" : "h-full bg-text-base/70"}
            style={{ width: `${share}%` }}
          />
        </div>
      )}
    </div>
  )
}

export default async function HostingDetailPage(props: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { id } = await props.params
  const serviceId = Number(id)
  if (!Number.isInteger(serviceId) || serviceId <= 0) notFound()
  const params = await props.searchParams

  const context = await customerContext()
  if (!context.ok) {
    return (
      <Notice tone="warn" title="No hemos podido cargar este alojamiento">
        {context.message}
      </Notice>
    )
  }

  const read = await whmcsProductDetail(context.customerId, serviceId)
  if (read === null) notFound()
  if (read.state !== "ok") {
    return (
      <Notice tone="warn" title="No hemos podido cargar este alojamiento">
        Nuestro sistema de facturación no responde ahora mismo. Vuelve a intentarlo en unos minutos.
      </Notice>
    )
  }
  const plan = read.items[0]
  if (!plan || plan.kind !== "web_hosting") notFound()
  const domain = plan.label

  return (
    <>
      <DetailHeader
        back={{ href: "/app/web-cloud/alojamiento", label: "Alojamiento web" }}
        title={domain ?? plan.name}
        status={{ label: plan.statusLabel, tone: plan.tone }}
        subtitle={`Plan ${plan.name}`}
        action={
          plan.live ? (
            <ButtonLink href={`/app/web-cloud/alojamiento/${plan.id}/plesk`} withArrow>
              Acceder a Plesk
            </ButtonLink>
          ) : null
        }
      />

      {params.error === "plesk" ? (
        <div className="mb-6">
          <Notice tone="warn" title="No hemos podido abrir Plesk">
            Vuelve a intentarlo en unos segundos. Si sigue fallando, escríbenos desde Soporte.
          </Notice>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <InfoCard title="Información general">
          <InfoRow label="Plan">{plan.name}</InfoRow>
          <InfoRow label="Dominio principal" mono>
            {domain ?? "—"}
          </InfoRow>
          <InfoRow label="Estado">
            <StatusBadge tone={plan.tone}>{plan.statusLabel}</StatusBadge>
          </InfoRow>
          <InfoRow label="Servidor">{plan.serverName ?? "—"}</InfoRow>
        </InfoCard>

        <InfoCard title="Acceso">
          <InfoRow label="Panel de control">
            Plesk, con acceso directo desde aquí sin volver a escribir tu contraseña.
          </InfoRow>
          <InfoRow label="Usuario (Plesk y FTP)" mono>
            {plan.username ?? "—"}
          </InfoRow>
          <InfoRow label="Servidores DNS" mono>
            {plan.nameservers && plan.nameservers.length > 0 ? (
              <ul className="space-y-0.5">
                {plan.nameservers.map((server) => (
                  <li key={server}>{server}</li>
                ))}
              </ul>
            ) : (
              "—"
            )}
          </InfoRow>
          {plan.live ? <CardLink href={`/app/web-cloud/alojamiento/${plan.id}/plesk`} external>Acceder a Plesk</CardLink> : null}
          <SoonAction>Cambiar la contraseña del panel</SoonAction>
        </InfoCard>

        <InfoCard title="Suscripción">
          <InfoRow label="Alta">{formatDate(plan.registeredAt)}</InfoRow>
          <InfoRow label="Próxima renovación">{plan.live ? formatDate(plan.nextDueAt) : "—"}</InfoRow>
          <InfoRow label="Importe">
            {plan.amountCents > 0 ? `${formatCents(plan.amountCents)}${plan.cycle.startsWith("/") ? plan.cycle : ` ${plan.cycle}`}` : "—"}
          </InfoRow>
          <div className="flex flex-wrap gap-4">
            <CardLink href="/app/billing">Ver facturas</CardLink>
            <SoonAction>Cancelar al final del periodo</SoonAction>
          </div>
        </InfoCard>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <InfoCard title="Uso del alojamiento">
          <UsageBar label="Espacio en disco" used={plan.usage.diskMb} limit={plan.usage.diskLimitMb} />
          <UsageBar label="Transferencia del mes" used={plan.usage.bandwidthMb} limit={plan.usage.bandwidthLimitMb} />
          <p className="text-xs text-text-muted">Datos de la última sincronización con el servidor.</p>
        </InfoCard>

        <InfoCard title="Correo">
          {domain ? (
            <>
              <InfoRow label="Webmail" mono>
                <a href={`https://webmail.${domain}`} target="_blank" rel="noreferrer" className="hover:text-accent-ink">
                  webmail.{domain}
                </a>
              </InfoRow>
              <InfoRow label="Servidor de entrada (IMAP)" mono>
                mail.{domain} · puerto 993 (SSL)
              </InfoRow>
              <InfoRow label="Servidor de salida (SMTP)" mono>
                mail.{domain} · puerto 465 (SSL)
              </InfoRow>
            </>
          ) : (
            <p className="text-sm text-text-muted">Este plan no tiene un dominio asociado.</p>
          )}
          <SoonAction>Gestionar buzones</SoonAction>
        </InfoCard>
      </div>
    </>
  )
}
