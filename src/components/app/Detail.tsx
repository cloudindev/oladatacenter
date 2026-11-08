import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Panel, StatusBadge, type StatusTone } from "@/components/app/ui"
import { cn } from "@/lib/utils"

/**
 * Building blocks of the service detail pages (domain, hosting, VPS): a header with the
 * way back, and OVH-style cards of label/value rows. Same visual language as the rest of
 * the customer area.
 */

export function DetailHeader({
  back,
  title,
  status,
  subtitle,
  action,
}: {
  back: { href: string; label: string }
  title: string
  status?: { label: string; tone: StatusTone }
  subtitle?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="mb-8">
      <Link href={back.href} className="label-mono text-text-muted hover:text-text-base">
        ← {back.label}
      </Link>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="break-all text-3xl font-light tracking-tight text-text-base sm:text-4xl">{title}</h1>
            {status ? <StatusBadge tone={status.tone}>{status.label}</StatusBadge> : null}
          </div>
          {subtitle ? <p className="mt-2 text-text-muted">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  )
}

export function InfoCard({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Panel className={cn("flex flex-col", className)}>
      <h2 className="mb-4 text-lg font-normal tracking-tight text-text-base">{title}</h2>
      <div className="flex-1 space-y-4">{children}</div>
    </Panel>
  )
}

export function InfoRow({
  label,
  children,
  mono = false,
}: {
  label: string
  children: React.ReactNode
  mono?: boolean
}) {
  return (
    <div>
      <p className="label-mono mb-1 text-text-muted">{label}</p>
      <div className={cn("text-sm text-text-base", mono && "font-mono break-all")}>{children}</div>
    </div>
  )
}

/** An action link inside a card. */
export function CardLink({ href, children, external = false }: { href: string; children: React.ReactNode; external?: boolean }) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className="label-mono inline-flex items-center gap-1.5 text-text-base underline decoration-border-base underline-offset-4 hover:decoration-accent-ink"
    >
      {children}
      <ArrowRight aria-hidden className="h-3.5 w-3.5" />
    </a>
  )
}

/**
 * An action the panel will offer but cannot run yet (it depends on a pending decision or
 * integration). Visible, so the customer knows it is coming, and inert.
 */
export function SoonAction({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-text-muted">
      {children}
      <span className="label-mono rounded bg-surface-beige px-1.5 py-0.5 text-[10px]">Pronto</span>
    </span>
  )
}
