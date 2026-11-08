import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { formatCents } from "@ola/core"
import { CardLink, DetailHeader, InfoCard, InfoRow, SoonAction } from "@/components/app/Detail"
import { Notice, Panel, StatusBadge } from "@/components/app/ui"
import { formatDate } from "@/components/servers/labels"
import { customerContext } from "@/server/services/customer"
import { whmcsDomainDetail } from "@/server/whmcs-products"

/**
 * Web Cloud → Dominios → one domain, in the spirit of Dinahosting or DonDominio: its
 * dates and renewal, its nameservers and the records it publishes, the services tied to
 * it, and the registrar operations (shown as coming until a registrar is wired).
 */

export const metadata: Metadata = {
  title: "Dominio · Web Cloud · OLA",
}

const CLOUDIN_NS = /(^|\.)cloudinhosting\.com$/

export default async function DomainDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const domainId = Number(id)
  if (!Number.isInteger(domainId) || domainId <= 0) notFound()

  const context = await customerContext()
  if (!context.ok) {
    return (
      <Notice tone="warn" title="No hemos podido cargar este dominio">
        {context.message}
      </Notice>
    )
  }

  const read = await whmcsDomainDetail(context.customerId, domainId)
  if (read === null) notFound()
  if (read.state !== "ok") {
    return (
      <Notice tone="warn" title="No hemos podido cargar este dominio">
        Nuestro sistema de facturación no responde ahora mismo. Vuelve a intentarlo en unos minutos.
      </Notice>
    )
  }
  const domain = read.items[0]
  if (!domain) notFound()

  const nameservers = domain.nameservers ?? []
  const usesCloudinDns = nameservers.length > 0 && nameservers.every((server) => CLOUDIN_NS.test(server))
  const records = domain.records

  return (
    <>
      <DetailHeader
        back={{ href: "/app/web-cloud/dominios", label: "Dominios" }}
        title={domain.domain}
        status={{ label: domain.statusLabel, tone: domain.tone }}
        subtitle={
          domain.expiresAt
            ? `${domain.live ? "Caduca" : "Caducó"} el ${formatDate(domain.expiresAt)}`
            : undefined
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <InfoCard title="Información general">
          <InfoRow label="Estado">
            <StatusBadge tone={domain.tone}>{domain.statusLabel}</StatusBadge>
          </InfoRow>
          <InfoRow label="Alta">
            {formatDate(domain.registeredAt)}
            {domain.registrationType ? ` · ${domain.registrationType}` : ""}
          </InfoRow>
          <InfoRow label="Caducidad">{formatDate(domain.expiresAt)}</InfoRow>
          <InfoRow label="Renovación">
            {domain.autoRenew ? "Automática" : "Desactivada: el dominio no se renovará"}
            {domain.amountCents > 0 ? ` · ${formatCents(domain.amountCents)}/${domain.periodLabel}` : ""}
          </InfoRow>
        </InfoCard>

        <InfoCard title="Servidores DNS">
          {nameservers.length > 0 ? (
            <InfoRow label={usesCloudinDns ? "DNS de OLA" : "DNS externos"} mono>
              <ul className="space-y-0.5">
                {nameservers.map((server) => (
                  <li key={server}>{server}</li>
                ))}
              </ul>
            </InfoRow>
          ) : (
            <p className="text-sm text-text-muted">El dominio no publica servidores DNS ahora mismo.</p>
          )}
          <p className="text-xs leading-relaxed text-text-muted">
            {usesCloudinDns
              ? "Tu dominio usa nuestros servidores DNS: los registros se gestionan desde tu alojamiento."
              : "Tu dominio usa servidores DNS de otro proveedor: sus registros se gestionan allí."}
          </p>
          <SoonAction>Cambiar servidores DNS</SoonAction>
        </InfoCard>

        <InfoCard title="Seguridad y transferencia">
          <InfoRow label="Privacidad WHOIS">{domain.idProtection ? "Activada" : "No activada"}</InfoRow>
          <InfoRow label="Gestión DNS">{domain.dnsManagement ? "Incluida" : "No incluida"}</InfoRow>
          <InfoRow label="Redirección de correo">{domain.emailForwarding ? "Incluida" : "No incluida"}</InfoRow>
          <div className="space-y-2 pt-1">
            <SoonAction>Bloqueo de transferencia</SoonAction>
            <SoonAction>Código de transferencia (EPP)</SoonAction>
            <SoonAction>Datos del titular</SoonAction>
          </div>
        </InfoCard>
      </div>

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="label-mono text-text-muted">Zona DNS</p>
            <p className="mt-1 text-sm text-text-muted">
              Los registros que tu dominio publica ahora mismo en internet.
            </p>
          </div>
          <SoonAction>Editar la zona</SoonAction>
        </div>
        {records === null ? (
          <Notice tone="warn" title="No hemos podido leer la zona">
            El dominio no responde en el DNS público ahora mismo.
          </Notice>
        ) : records.length === 0 ? (
          <Panel>
            <p className="text-sm text-text-muted">El dominio no publica registros todavía.</p>
          </Panel>
        ) : (
          <Panel className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-base text-left">
                    {["Tipo", "Nombre", "Valor", "Prioridad"].map((label) => (
                      <th key={label} scope="col" className="label-mono px-5 py-3 font-normal text-text-muted">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((record, index) => (
                    <tr key={`${record.type}-${record.name}-${index}`} className="border-b border-border-base last:border-b-0 align-top">
                      <td className="px-5 py-3 font-mono text-text-base">{record.type}</td>
                      <td className="px-5 py-3 font-mono text-text-muted">{record.name}</td>
                      <td className="max-w-[28rem] break-all px-5 py-3 font-mono text-text-base">{record.value}</td>
                      <td className="px-5 py-3 text-text-muted">{record.priority ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </section>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <InfoCard title="Servicios de este dominio">
          {domain.hosting.length > 0 ? (
            domain.hosting.map((hosting) => (
              <div key={hosting.id} className="flex items-center justify-between gap-3">
                <InfoRow label="Alojamiento web">{hosting.name}</InfoRow>
                <CardLink href={`/app/web-cloud/alojamiento/${hosting.id}`}>Ver alojamiento</CardLink>
              </div>
            ))
          ) : (
            <p className="text-sm text-text-muted">No tienes un alojamiento web contratado para este dominio.</p>
          )}
        </InfoCard>

        <InfoCard title="Renovación y facturación">
          <InfoRow label="Próxima renovación">
            {formatDate(domain.nextDueAt ?? domain.expiresAt)}
            {domain.amountCents > 0 ? ` · ${formatCents(domain.amountCents)}` : ""}
          </InfoRow>
          <div className="flex flex-wrap gap-4">
            <SoonAction>Renovar ahora</SoonAction>
            <CardLink href="/app/billing">Ver facturas</CardLink>
          </div>
        </InfoCard>
      </div>
    </>
  )
}
