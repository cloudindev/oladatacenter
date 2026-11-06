"use client"

/**
 * Sticky summary. It renders exactly what the server returned: the last good quote stays
 * on screen while a new one is being calculated, so the price never flickers to zero.
 */
import Link from "next/link"
import { TERM_LABELS, formatCents, type PublicQuote } from "@ola/core"
import { cn } from "@/lib/utils"

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-[13.5px]">
      <span className={muted ? "text-text-muted" : undefined}>{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  )
}

export function SummaryPanel({
  quote,
  pending,
  error,
  continueHref,
  outOfStock = false,
}: {
  quote: PublicQuote
  pending: boolean
  error: string | null
  /** Checkout owned by another agent: the configuration travels in the query string. */
  continueHref: string
  /** No datacenter has stock for this plan: the customer cannot continue. */
  outOfStock?: boolean
}) {
  const billed = quote.lines.filter((line) => line.monthlyPrice > 0)
  const annual = quote.months > 1

  return (
    <aside
      aria-label="Resumen de la configuración"
      className="lg:sticky lg:top-[108px] rounded-[18px] border border-bg-dark/12 bg-surface-light p-6"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.06em] text-text-muted">
          Resumen
        </h2>
        <span
          aria-live="polite"
          className={cn(
            "font-mono text-[10px] uppercase tracking-[0.06em] transition-opacity",
            pending ? "text-accent-ink opacity-100" : "opacity-0",
          )}
        >
          Calculando
        </span>
      </div>

      <p className="text-[20px] tracking-[-0.02em]">{quote.planName}</p>
      <p className="mb-5 text-[13px] text-text-muted">
        {quote.datacenter} · {quote.os} · {TERM_LABELS[quote.term].toLowerCase()}
      </p>

      <div
        className={cn("divide-y divide-bg-dark/10 border-y border-bg-dark/10 transition-opacity", pending && "opacity-60")}
      >
        {billed.map((line) => (
          <Row
            key={line.slug}
            label={line.label}
            value={`${formatCents(line.monthlyPrice)} / mes`}
          />
        ))}
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-4">
          <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-text-muted">
            Total mensual
          </span>
          <span className="font-mono text-[24px] tabular-nums tracking-[-0.02em]">
            {formatCents(quote.monthlyPrice)}
          </span>
        </div>
        {annual ? (
          <Row
            label={`Pago único por ${quote.months} meses`}
            value={formatCents(quote.cycleNet)}
            muted
          />
        ) : null}
        <p className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.06em] text-text-muted">
          IVA no incluido
        </p>
      </div>

      <ul className="mt-5 flex flex-col gap-1.5 text-[12.5px] text-text-muted">
        {quote.included.map((feature) => (
          <li key={feature}>· {feature}</li>
        ))}
      </ul>

      {error ? (
        <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">
          {error}
        </p>
      ) : null}

      {outOfStock ? (
        <span
          aria-disabled="true"
          className="mt-6 inline-flex h-12 w-full cursor-not-allowed items-center justify-center rounded-lg border border-dashed border-bg-dark/25 font-mono text-[11px] uppercase tracking-[0.06em] text-text-muted"
        >
          Sin stock ahora mismo
        </span>
      ) : (
        <Link
          href={continueHref}
          className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-bg-dark font-mono text-[11px] uppercase tracking-[0.06em] text-text-dark transition-colors hover:bg-surface-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink"
        >
          Continuar
          <span aria-hidden>→</span>
        </Link>
      )}
      <p className="mt-3 text-[12px] leading-relaxed text-text-muted">
        En el siguiente paso confirmas los datos de facturación y el IVA antes de pagar.
      </p>
    </aside>
  )
}
