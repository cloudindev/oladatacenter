import type { Metadata } from "next"
import Link from "next/link"
import { formatCents } from "@ola/core"
import { ButtonLink, EmptyState, Eyebrow, Notice, PageTitle, Panel, StatusBadge } from "@/components/app/ui"
import { formatDate } from "@/components/servers/labels"
import { customerContext } from "@/server/services/customer"
import { load } from "@/server/services/load"
import { listPleskLicencesForCustomer } from "@/server/services/repository"
import { whmcsProductsOfKind } from "@/server/whmcs-products"
import { ManagedByCloudinNote, WhmcsProductTable, WhmcsReadNotice } from "@/components/app/WhmcsProducts"

/**
 * Bare Metal Cloud → Licencias. Today only Plesk, which we sell as an option of a VPS:
 * each licence lives and renews with its server.
 */

export const metadata: Metadata = {
  title: "Licencias · Bare Metal Cloud · OLA",
}

const STATUS = {
  active: { label: "Activa", tone: "ok" },
  pending: { label: "Activándose", tone: "busy" },
  removed: { label: "Dada de baja", tone: "neutral" },
} as const

/** Domains each Plesk edition allows, as sold in the configurator. */
function domainsOf(edition: string): string {
  const name = edition.toLowerCase()
  if (name.includes("host")) return "Dominios ilimitados"
  if (name.includes("pro")) return "Hasta 30 dominios"
  if (name.includes("admin")) return "Hasta 10 dominios"
  return "—"
}

export default async function LicencesPage() {
  const context = await customerContext()
  if (!context.ok) {
    return (
      <>
        <PageTitle>Licencias</PageTitle>
        <Notice tone="warn" title="No hemos podido cargar tus licencias">
          {context.message}
        </Notice>
      </>
    )
  }

  const [licences, otherLicences] = await Promise.all([
    load("listPleskLicencesForCustomer", () => listPleskLicencesForCustomer(context.customerId)),
    whmcsProductsOfKind(context.customerId, "plesk_licence"),
  ])
  const hasOther = otherLicences.state === "ok" && otherLicences.items.length > 0

  return (
    <>
      <PageTitle description="Las licencias de Plesk van ligadas a un servidor VPS y se renuevan con él.">
        Licencias
      </PageTitle>

      {!licences.ok ? (
        <Notice tone="warn" title="No hemos podido cargar tus licencias">
          {licences.message} Vuelve a intentarlo en unos minutos.
        </Notice>
      ) : licences.data.length === 0 && hasOther ? null : licences.data.length === 0 ? (
        <EmptyState
          action={
            <ButtonLink href="/vps/configurar" withArrow>
              Contratar un VPS con Plesk
            </ButtonLink>
          }
        >
          No tienes ninguna licencia. Puedes añadir Plesk al contratar un VPS.
        </EmptyState>
      ) : (
        <Panel className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-base text-left">
                  {["Licencia", "Servidor", "Incluye", "Precio", "Alta", "Estado"].map((label) => (
                    <th key={label} scope="col" className="label-mono text-text-muted font-normal px-5 py-3">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {licences.data.map((licence) => {
                  const status = STATUS[licence.status]
                  return (
                    <tr key={licence.id} className="border-b border-border-base last:border-b-0">
                      <td className="px-5 py-4 text-text-base">{licence.edition}</td>
                      <td className="px-5 py-4">
                        <Link
                          href={`/app/servers/${licence.serviceId}`}
                          className="text-text-base hover:text-accent-ink underline-offset-4 hover:underline"
                        >
                          {licence.serviceName}
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-text-muted">{domainsOf(licence.edition)}</td>
                      <td className="px-5 py-4 text-text-base whitespace-nowrap">
                        {formatCents(licence.monthlyPrice)}/mes
                      </td>
                      <td className="px-5 py-4 text-text-muted whitespace-nowrap">
                        {formatDate(licence.createdAt)}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {otherLicences.state === "unavailable" || hasOther ? (
        <section className="mt-10">
          <Eyebrow>Otras licencias de tu cuenta</Eyebrow>
          <WhmcsReadNotice read={otherLicences} what="tus otras licencias" />
          {otherLicences.state === "ok" ? (
            <>
              <WhmcsProductTable items={otherLicences.items} />
              <ManagedByCloudinNote />
            </>
          ) : null}
        </section>
      ) : null}
    </>
  )
}
