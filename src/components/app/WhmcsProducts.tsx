import { formatCents } from "@ola/core"
import { EmptyState, Notice, Panel, StatusBadge } from "@/components/app/ui"
import { formatDate } from "@/components/servers/labels"
import type { WhmcsProductView, WhmcsRead } from "@/server/whmcs-products"

/**
 * Read-only views of what a customer already has in WHMCS: what it is, its state and when
 * it renews. No action buttons yet.
 */

/** The notice for a read that did not return items. Null when it did. */
export function WhmcsReadNotice<T>({
  read,
  what,
}: {
  read: WhmcsRead<T>
  what: string
}) {
  if (read.state !== "unavailable") return null
  return (
    <Notice tone="warn" title={`No hemos podido cargar ${what}`}>
      {read.reason === "permission"
        ? "Falta un permiso en la conexión con nuestro sistema de facturación. Ya lo sabemos y lo estamos resolviendo."
        : "Nuestro sistema de facturación no responde ahora mismo. Vuelve a intentarlo en unos minutos."}
    </Notice>
  )
}

function money(cents: number, cycle: string): string {
  if (cents === 0) return cycle === "gratuito" ? "Gratuito" : "—"
  return `${formatCents(cents)} ${cycle}`.trim()
}

function Rows({ items, showIps }: { items: readonly WhmcsProductView[]; showIps: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-base text-left">
            {["Servicio", ...(showIps ? ["IP"] : []), "Alta", "Próximo vencimiento", "Importe", "Estado"].map(
              (label) => (
                <th key={label} scope="col" className="label-mono text-text-muted font-normal px-5 py-3 whitespace-nowrap">
                  {label}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-border-base last:border-b-0 align-top">
              <td className="px-5 py-4">
                <p className="text-text-base">{item.label ?? item.name}</p>
                {item.label ? <p className="text-xs text-text-muted">{item.name}</p> : null}
              </td>
              {showIps ? (
                <td className="px-5 py-4 font-mono text-text-base whitespace-nowrap">
                  {item.ips.length > 0 ? item.ips.join(", ") : "—"}
                </td>
              ) : null}
              <td className="px-5 py-4 text-text-muted whitespace-nowrap">{formatDate(item.registeredAt)}</td>
              <td className="px-5 py-4 text-text-muted whitespace-nowrap">
                {item.live ? formatDate(item.nextDueAt) : "—"}
              </td>
              <td className="px-5 py-4 text-text-base whitespace-nowrap">{money(item.amountCents, item.cycle)}</td>
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

/**
 * Live products in a table; finished ones (cancelled, terminated…) folded below so the
 * history is there without crowding what matters.
 */
export function WhmcsProductTable({
  items,
  empty,
  showIps = false,
}: {
  items: readonly WhmcsProductView[]
  empty?: React.ReactNode
  showIps?: boolean
}) {
  const live = items.filter((item) => item.live)
  const past = items.filter((item) => !item.live)

  if (items.length === 0) return empty ? <>{empty}</> : null

  return (
    <div className="space-y-4">
      {live.length > 0 ? (
        <Panel className="p-0 overflow-hidden">
          <Rows items={live} showIps={showIps} />
        </Panel>
      ) : (
        <EmptyState>No tienes ninguno activo ahora mismo.</EmptyState>
      )}
      {past.length > 0 ? (
        <details className="group">
          <summary className="label-mono cursor-pointer text-text-muted hover:text-text-base">
            Ver inactivos ({past.length})
          </summary>
          <Panel className="mt-3 p-0 overflow-hidden opacity-80">
            <Rows items={past} showIps={showIps} />
          </Panel>
        </details>
      ) : null}
    </div>
  )
}
