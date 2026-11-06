/**
 * Dense primitives for the internal panel.
 *
 * Same design language as `src/components/app/ui.tsx` — off-white canvas, hairline
 * borders, monospace uppercase labels, one accent, no shadows, no gradients — at the
 * higher density an operator needs. This is NOT a second design system: every colour,
 * button, badge and notice comes from the shared kit; what is added here is layout for
 * tables, raw ids and raw errors, which the customer area has no use for.
 */
import * as React from "react"
import Link from "next/link"
import {
  Notice,
  ORDER_STATUS_UI,
  SERVICE_STATUS_UI,
  StatusBadge,
  type StatusTone,
} from "@/components/app/ui"
import { cn } from "@/lib/utils"

// ─── page scaffolding ────────────────────────────────────────────────────────

export function AdminHeader({
  title,
  hint,
  actions,
}: {
  title: string
  hint?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-light tracking-tight text-text-base">{title}</h1>
        {hint ? <p className="mt-1 text-sm leading-relaxed text-text-muted">{hint}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}

export function AdminSection({
  title,
  hint,
  actions,
  children,
}: {
  title: string
  hint?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-normal tracking-tight text-text-base">{title}</h2>
          {hint ? <p className="mt-0.5 text-xs text-text-muted">{hint}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  )
}

// ─── tables ──────────────────────────────────────────────────────────────────

/** Horizontally scrollable at 360 px instead of squeezing the columns to nothing. */
export function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border-base bg-surface-light">
      <table className="w-full min-w-[40rem] border-collapse text-sm">{children}</table>
    </div>
  )
}

export function Th({
  children,
  align = "left",
  className,
}: {
  children?: React.ReactNode
  align?: "left" | "right" | "center"
  className?: string
}) {
  return (
    <th
      scope="col"
      className={cn(
        "label-mono border-b border-border-base px-3 py-2.5 text-text-muted whitespace-nowrap",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className,
      )}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  align = "left",
  mono,
  className,
  colSpan,
}: {
  children?: React.ReactNode
  align?: "left" | "right" | "center"
  mono?: boolean
  className?: string
  colSpan?: number
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        "border-b border-border-base px-3 py-2.5 align-top text-text-base",
        align === "right" && "text-right",
        align === "center" && "text-center",
        mono && "font-mono text-xs",
        className,
      )}
    >
      {children}
    </td>
  )
}

export function TableEmpty({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <Td colSpan={colSpan} className="py-10 text-center text-text-muted">
        {children}
      </Td>
    </tr>
  )
}

// ─── values ──────────────────────────────────────────────────────────────────

/** A raw id, cost or provider reference. Internal only, which is the point here. */
export function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("font-mono text-xs text-text-base", className)}>{children}</span>
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-text-muted">{children}</span>
}

/** `—` for an absent value, so an empty cell is never ambiguous. */
export function Maybe({ value }: { value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return <Muted>—</Muted>
  return <>{value}</>
}

export function Timestamp({ value, time = true }: { value: Date | null; time?: boolean }) {
  if (!value) return <Muted>—</Muted>
  const iso = value.toISOString()
  return (
    <time dateTime={iso} className="font-mono text-xs whitespace-nowrap">
      {time ? iso.slice(0, 16).replace("T", " ") : iso.slice(0, 10)}
    </time>
  )
}

/** Dense label/value list for the detail pages. */
export function Kv({ children }: { children: React.ReactNode }) {
  return <dl className="divide-y divide-border-base">{children}</dl>
}

export function KvRow({
  label,
  children,
  mono,
}: {
  label: string
  children: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="label-mono shrink-0 text-text-muted">{label}</dt>
      <dd
        className={cn(
          "min-w-0 break-words text-right text-sm text-text-base",
          mono && "font-mono text-xs",
        )}
      >
        {children}
      </dd>
    </div>
  )
}

/**
 * The raw provider error, shown verbatim. The internal panel is the one place in the
 * product where this is allowed; it never reaches the customer area.
 */
export function RawError({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="rounded-lg border border-[#f3c9c5] bg-[#fdeceb] p-3">
      <p className="label-mono mb-1.5 text-[#8a2d26]">{label ?? "error sin filtrar"}</p>
      <pre className="overflow-x-auto font-mono text-xs leading-relaxed whitespace-pre-wrap text-[#8a2d26]">
        {children}
      </pre>
    </div>
  )
}

/**
 * What a page shows when a read failed instead of crashing.
 *
 * There is no database configured in this environment, so this is the state most of the
 * panel renders in until there is one. The raw message is included on purpose.
 */
export function LoadFailure({ message, detail }: { message: string; detail: string }) {
  return (
    <div className="space-y-3">
      <Notice tone="danger" title="No se han podido leer los datos">
        {message}
      </Notice>
      <RawError>{detail}</RawError>
    </div>
  )
}

// ─── counters ────────────────────────────────────────────────────────────────

/** A dashboard number with the filtered list behind it. One click, no drill-down. */
export function CountTile({
  label,
  value,
  href,
  tone = "neutral",
  hint,
}: {
  label: string
  value: number
  href: string
  tone?: StatusTone
  hint?: string
}) {
  const alarming = value > 0 && (tone === "danger" || tone === "warn")
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-xl border p-4 transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink",
        alarming
          ? "border-[#f3c9c5] bg-[#fdeceb] hover:bg-[#fbe0de]"
          : "border-border-base bg-surface-light hover:bg-surface-beige",
      )}
    >
      <p className="label-mono text-text-muted">{label}</p>
      <p
        className={cn(
          "mt-1 text-3xl font-light tabular-nums",
          alarming ? "text-[#8a2d26]" : "text-text-base",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-text-muted">{hint}</p> : null}
    </Link>
  )
}

// ─── status vocabulary ───────────────────────────────────────────────────────

export function OrderStatus({ status }: { status: string }) {
  const ui = ORDER_STATUS_UI[status] ?? { label: status, tone: "neutral" as StatusTone }
  return <StatusBadge tone={ui.tone}>{ui.label}</StatusBadge>
}

export function ServiceStatus({ status }: { status: string }) {
  const ui = SERVICE_STATUS_UI[status] ?? { label: status, tone: "neutral" as StatusTone }
  return <StatusBadge tone={ui.tone}>{ui.label}</StatusBadge>
}

export const DELIVERY_UI: Record<string, { label: string; tone: StatusTone }> = {
  on_time: { label: "En plazo", tone: "ok" },
  late: { label: "Fuera de plazo", tone: "warn" },
  timed_out: { label: "Plazo agotado", tone: "danger" },
}

export function DeliveryBadge({ state }: { state: string | null }) {
  if (!state) return <Muted>—</Muted>
  const ui = DELIVERY_UI[state] ?? { label: state, tone: "neutral" as StatusTone }
  return <StatusBadge tone={ui.tone}>{ui.label}</StatusBadge>
}

export const DUNNING_UI: Record<string, { label: string; tone: StatusTone }> = {
  scheduled: { label: "Programado", tone: "neutral" },
  invoiced: { label: "Facturado", tone: "neutral" },
  charging: { label: "Cobrando", tone: "busy" },
  retry_1: { label: "Reintento 1", tone: "warn" },
  retry_2: { label: "Reintento 2", tone: "warn" },
  suspended: { label: "Suspendido", tone: "danger" },
  terminating: { label: "En cancelación", tone: "danger" },
  paid: { label: "Pagado", tone: "ok" },
}

export function DunningBadge({ stage }: { stage: string | null }) {
  if (!stage) return <Muted>—</Muted>
  const ui = DUNNING_UI[stage] ?? { label: stage, tone: "neutral" as StatusTone }
  return <StatusBadge tone={ui.tone}>{ui.label}</StatusBadge>
}

export const CUSTOMER_STATUS_UI: Record<string, { label: string; tone: StatusTone }> = {
  unverified: { label: "Sin verificar", tone: "warn" },
  verified: { label: "Verificado", tone: "ok" },
  review: { label: "En revisión", tone: "warn" },
  blocked: { label: "Bloqueado", tone: "danger" },
}

export function CustomerStatus({ status }: { status: string }) {
  const ui = CUSTOMER_STATUS_UI[status] ?? { label: status, tone: "neutral" as StatusTone }
  return <StatusBadge tone={ui.tone}>{ui.label}</StatusBadge>
}

export const ACTION_STATUS_UI: Record<string, { label: string; tone: StatusTone }> = {
  queued: { label: "En cola", tone: "neutral" },
  running: { label: "En curso", tone: "busy" },
  done: { label: "Hecho", tone: "ok" },
  error: { label: "Error", tone: "danger" },
}

// ─── external references ─────────────────────────────────────────────────────

/**
 * Read-only deep link into OVH or WHMCS, built from the ids we stored.
 *
 * Nothing is signed and nothing is proxied: the operator follows the link and
 * authenticates there. That is deliberate — the panel never acts on OVH or WHMCS behind
 * a link.
 */
export function ProviderLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="label-mono inline-flex items-center gap-1 text-accent-ink underline decoration-dotted underline-offset-4 hover:no-underline"
    >
      {children}
      <span aria-hidden>↗</span>
    </a>
  )
}

export const OVH_MANAGER = "https://www.ovh.com/manager"

export function ovhOrderUrl(ovhOrderId: number): string {
  return `${OVH_MANAGER}/#/dedicated/billing/orders/${ovhOrderId}`
}

export function ovhVpsUrl(serviceName: string): string {
  return `${OVH_MANAGER}/#/vps/${encodeURIComponent(serviceName)}`
}

export function whmcsOrderUrl(base: string, orderId: number): string {
  return `${base.replace(/\/$/, "")}/admin/orders.php?action=view&id=${orderId}`
}

export function whmcsInvoiceUrl(base: string, invoiceId: number): string {
  return `${base.replace(/\/$/, "")}/admin/invoices.php?action=edit&id=${invoiceId}`
}

export function whmcsClientUrl(base: string, clientId: number): string {
  return `${base.replace(/\/$/, "")}/admin/clientssummary.php?userid=${clientId}`
}

// ─── margin presentation ─────────────────────────────────────────────────────

/**
 * The margin, with the floor breach made impossible to miss.
 *
 * Always fed `trueMargin` — the figure over the plan + mandatory addons. The bare-cost
 * figure is shown next to it, labelled, never in this component.
 */
export function MarginCell({
  margin,
  belowFloor,
  format,
}: {
  margin: number | null
  belowFloor: boolean
  format: (value: number | null) => string
}) {
  if (margin === null) return <Muted>—</Muted>
  return (
    <span
      className={cn(
        "font-mono text-xs tabular-nums",
        belowFloor && "rounded bg-[#fdeceb] px-1.5 py-0.5 font-medium text-[#8a2d26]",
      )}
    >
      {format(margin)}
      {belowFloor ? <span className="label-mono ml-1">bajo mínimo</span> : null}
    </span>
  )
}
