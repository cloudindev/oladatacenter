import type { Metadata } from "next"
import { formatCents } from "@ola/core"
import { EmptyState, Notice, PageTitle, Panel, StatusBadge } from "@/components/app/ui"
import { ManagedByCloudinNote, WhmcsReadNotice } from "@/components/app/WhmcsProducts"
import { formatDate } from "@/components/servers/labels"
import { customerContext } from "@/server/services/customer"
import { whmcsDomainsFor, type WhmcsDomainView } from "@/server/whmcs-products"

/** Web Cloud → Dominios: the customer's domains as registered in WHMCS. */

export const metadata: Metadata = {
  title: "Dominios · Web Cloud · OLA",
}

function DomainRows({ items }: { items: readonly WhmcsDomainView[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-base text-left">
            {["Dominio", "Alta", "Caduca", "Renovación", "Importe", "Estado"].map((label) => (
              <th key={label} scope="col" className="label-mono text-text-muted font-normal px-5 py-3 whitespace-nowrap">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-border-base last:border-b-0">
              <td className="px-5 py-4 font-mono text-text-base">{item.domain}</td>
              <td className="px-5 py-4 text-text-muted whitespace-nowrap">{formatDate(item.registeredAt)}</td>
              <td className="px-5 py-4 text-text-muted whitespace-nowrap">{formatDate(item.expiresAt)}</td>
              <td className="px-5 py-4 whitespace-nowrap">
                {item.live ? (
                  item.autoRenew ? (
                    <span className="text-text-base">Automática</span>
                  ) : (
                    <StatusBadge tone="warn">No se renueva</StatusBadge>
                  )
                ) : (
                  <span className="text-text-muted">—</span>
                )}
              </td>
              <td className="px-5 py-4 text-text-base whitespace-nowrap">
                {item.amountCents > 0 ? `${formatCents(item.amountCents)} / ${item.periodLabel}` : "—"}
              </td>
              <td className="px-5 py-4">
                <StatusBadge tone={item.tone}>{item.statusLabel}</StatusBadge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default async function DomainsPage() {
  const context = await customerContext()
  if (!context.ok) {
    return (
      <>
        <PageTitle>Dominios</PageTitle>
        <Notice tone="warn" title="No hemos podido cargar tus dominios">
          {context.message}
        </Notice>
      </>
    )
  }

  const read = await whmcsDomainsFor(context.customerId)
  const empty = (
    <EmptyState>
      No tienes ningún dominio registrado con nosotros. Pronto podrás registrarlos desde aquí.
    </EmptyState>
  )
  const live = read.state === "ok" ? read.items.filter((item) => item.live) : []
  const past = read.state === "ok" ? read.items.filter((item) => !item.live) : []

  return (
    <>
      <PageTitle description="Tus dominios, cuándo caducan y si se renuevan solos.">
        Dominios
      </PageTitle>
      <WhmcsReadNotice read={read} what="tus dominios" />
      {read.state === "not_linked" || (read.state === "ok" && read.items.length === 0) ? empty : null}
      {read.state === "ok" && read.items.length > 0 ? (
        <div className="space-y-4">
          {live.length > 0 ? (
            <Panel className="p-0 overflow-hidden">
              <DomainRows items={live} />
            </Panel>
          ) : (
            <EmptyState>No tienes ningún dominio activo ahora mismo.</EmptyState>
          )}
          {past.length > 0 ? (
            <details>
              <summary className="label-mono cursor-pointer text-text-muted hover:text-text-base">
                Ver también los caducados o transferidos ({past.length})
              </summary>
              <Panel className="mt-3 p-0 overflow-hidden opacity-80">
                <DomainRows items={past} />
              </Panel>
            </details>
          ) : null}
          <ManagedByCloudinNote />
        </div>
      ) : null}
    </>
  )
}
