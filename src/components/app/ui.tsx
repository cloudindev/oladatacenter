/**
 * Shared primitives for the customer area and the admin panel.
 *
 * They deliberately mirror the oladc.com language: off-white canvas, hairline borders,
 * monospace uppercase labels, one lime accent, black pill buttons with an arrow,
 * no shadows, no gradients. Do not start a second design system.
 */
import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

// ─── labels and headings ─────────────────────────────────────────────────────
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("label-mono text-text-muted mb-3", className)}>{children}</p>
}

export function PageTitle({
  children,
  description,
  action,
}: {
  children: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
      <div className="max-w-2xl">
        <h1 className="text-3xl sm:text-4xl font-light tracking-tight text-text-base">{children}</h1>
        {description ? <p className="mt-2 text-text-muted leading-relaxed">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-normal tracking-tight text-text-base mb-4">{children}</h2>
}

// ─── surfaces ────────────────────────────────────────────────────────────────
export function Panel({
  children,
  className,
  as: Tag = "section",
}: {
  children: React.ReactNode
  className?: string
  as?: "section" | "div" | "article"
}) {
  return (
    <Tag className={cn("border border-border-base rounded-xl bg-surface-light p-6", className)}>
      {children}
    </Tag>
  )
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-0 border-t border-border-base", className)} />
}

/** Label/value row used across the whole customer area. */
export function DataRow({
  label,
  children,
  mono,
}: {
  label: string
  children: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-2.5 border-b border-border-base last:border-b-0">
      <dt className="label-mono text-text-muted shrink-0">{label}</dt>
      <dd className={cn("text-sm text-text-base text-right", mono && "font-mono")}>{children}</dd>
    </div>
  )
}

// ─── buttons ─────────────────────────────────────────────────────────────────
const ARROW = (
  <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
  </svg>
)

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger"

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-bg-dark text-text-dark hover:bg-surface-dark border border-bg-dark",
  secondary: "bg-transparent text-text-base border border-border-base hover:bg-surface-beige",
  ghost: "bg-transparent text-text-muted border border-transparent hover:text-text-base",
  danger: "bg-transparent text-red-700 border border-red-200 hover:bg-red-50",
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  withArrow?: boolean
  loading?: boolean
}

export function Button({
  variant = "primary",
  withArrow = false,
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        "label-mono inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink",
        BUTTON_STYLES[variant],
        className,
      )}
    >
      {loading ? <Spinner /> : null}
      {children}
      {withArrow && !loading ? ARROW : null}
    </button>
  )
}

export function ButtonLink({
  href,
  variant = "primary",
  withArrow = false,
  className,
  children,
}: {
  href: string
  variant?: ButtonVariant
  withArrow?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn(
        "label-mono inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink",
        BUTTON_STYLES[variant],
        className,
      )}
    >
      {children}
      {withArrow ? ARROW : null}
    </Link>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Cargando"
      className={cn(
        "inline-block w-3.5 h-3.5 rounded-full border-2 border-current border-r-transparent animate-spin",
        className,
      )}
    />
  )
}

// ─── status ──────────────────────────────────────────────────────────────────
export type StatusTone = "ok" | "warn" | "danger" | "neutral" | "busy"

const TONE_STYLES: Record<StatusTone, string> = {
  ok: "bg-[#eef7e4] text-[#3d5a2a] border-[#cfe6b4]",
  warn: "bg-[#fdf4e3] text-[#7a5a16] border-[#f0dcae]",
  danger: "bg-[#fdeceb] text-[#8a2d26] border-[#f3c9c5]",
  neutral: "bg-surface-beige text-text-muted border-border-base",
  busy: "bg-[#eaf1f1] text-[#2f4b4c] border-[#c9d9d9]",
}

export function StatusBadge({
  tone = "neutral",
  children,
  pulse = false,
}: {
  tone?: StatusTone
  children: React.ReactNode
  pulse?: boolean
}) {
  return (
    <span
      className={cn(
        "label-mono inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border whitespace-nowrap",
        TONE_STYLES[tone],
      )}
    >
      {pulse ? <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" /> : null}
      {children}
    </span>
  )
}

/** Spanish label + tone for a service status. Single source of truth for the whole UI. */
export const SERVICE_STATUS_UI: Record<string, { label: string; tone: StatusTone }> = {
  provisioning: { label: "Creando", tone: "busy" },
  active: { label: "Activo", tone: "ok" },
  stopped: { label: "Apagado", tone: "neutral" },
  suspended: { label: "Suspendido", tone: "danger" },
  review: { label: "En revisión", tone: "warn" },
  terminating: { label: "Cancelando", tone: "warn" },
  terminated: { label: "Cancelado", tone: "neutral" },
}

export const ORDER_STATUS_UI: Record<string, { label: string; tone: StatusTone }> = {
  draft: { label: "Borrador", tone: "neutral" },
  pending_payment: { label: "Pendiente de pago", tone: "warn" },
  paid: { label: "Pagado", tone: "busy" },
  provisioning: { label: "Creando", tone: "busy" },
  delivered: { label: "Entregado", tone: "ok" },
  delayed: { label: "Con retraso", tone: "warn" },
  failed: { label: "Fallido", tone: "danger" },
  cancelled: { label: "Cancelado", tone: "neutral" },
}

// ─── feedback ────────────────────────────────────────────────────────────────
export function Notice({
  tone = "neutral",
  title,
  children,
  action,
}: {
  tone?: StatusTone
  title?: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className={cn("rounded-xl border px-4 py-3 text-sm", TONE_STYLES[tone])}>
      <div className="flex items-start justify-between gap-4">
        <div>
          {title ? <p className="font-medium mb-0.5">{title}</p> : null}
          <div className="leading-relaxed">{children}</div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  )
}

export function EmptyState({
  children,
  action,
  illustration,
}: {
  children: React.ReactNode
  action?: React.ReactNode
  /** Optional drawing shown above the message. Decorative. */
  illustration?: React.ReactNode
}) {
  return (
    <div className="border border-dashed border-border-base rounded-xl px-6 py-12 text-center">
      {illustration ? <div className="mx-auto mb-8 max-w-[440px]">{illustration}</div> : null}
      <p className="text-text-muted mb-5">{children}</p>
      {action}
    </div>
  )
}

// ─── forms ───────────────────────────────────────────────────────────────────
export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-4">
      <label htmlFor={htmlFor} className="label-mono text-text-muted block mb-2">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="mt-1.5 text-xs text-text-muted">{hint}</p> : null}
      {error ? (
        <p className="mt-1.5 text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export const inputClass = cn(
  "w-full h-11 px-3 rounded-lg bg-surface-light border border-border-base text-sm text-text-base",
  "placeholder:text-text-muted/60",
  "focus:outline-none focus:ring-2 focus:ring-accent-ink/30 focus:border-accent-ink",
  "disabled:opacity-60",
)

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(inputClass, className)} {...props} />
  },
)

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(inputClass, "pr-8", className)} {...props}>
      {children}
    </select>
  )
})

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(inputClass, "h-auto py-2.5", className)} {...props} />
})

/** Copy-to-clipboard, used for IPs and generated passwords. */
export function CopyValue({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1600)
        })
      }}
      className="group inline-flex items-center gap-2 font-mono text-sm text-text-base hover:text-accent-ink transition-colors"
      aria-label={label ? `Copiar ${label}` : "Copiar"}
    >
      {value}
      <span className="label-mono text-text-muted group-hover:text-accent-ink">
        {copied ? "copiado" : "copiar"}
      </span>
    </button>
  )
}
