import { formatCents } from "@ola/core"

import { DataRow, Divider } from "@/components/app/ui"
import type { CheckoutQuoteView } from "@/server/billing"

/**
 * The price breakdown. A Server Component: it only ever receives the customer-safe view,
 * which carries no cost of ours and no provider plan name.
 *
 * Prices are quoted net on the site and VAT is added here, which is why the subtotal is
 * labelled "sin IVA" and the tax line is always visible — even when it is zero because of
 * the reverse charge, so a B2B customer can see why.
 */
export function QuoteBreakdown({ quote }: { quote: CheckoutQuoteView }) {
  const cycle = quote.months === 12 ? "cada 12 meses" : "cada mes"

  return (
    <div>
      <dl>
        {quote.lines.map((line) => (
          <DataRow key={`${line.family}-${line.slug}`} label={line.label}>
            {line.cyclePrice === 0 ? (
              <span className="text-text-muted">incluido</span>
            ) : (
              formatCents(line.cyclePrice)
            )}
          </DataRow>
        ))}
      </dl>

      <Divider className="my-4" />

      <dl>
        <DataRow label="Subtotal sin IVA">{formatCents(quote.subtotal)}</DataRow>

        {quote.creditApplied > 0 ? (
          <DataRow label="Crédito aplicado">−{formatCents(quote.creditApplied)}</DataRow>
        ) : null}

        {quote.creditApplied > 0 ? (
          <DataRow label="Base imponible">{formatCents(quote.taxableBase)}</DataRow>
        ) : null}

        <DataRow label={quote.vat.label}>
          {quote.vat.kind === "standard" ? formatCents(quote.tax) : formatCents(0)}
        </DataRow>
      </dl>

      {quote.vat.note ? (
        <p className="mt-3 text-[13px] leading-relaxed text-text-muted">{quote.vat.note}</p>
      ) : null}

      <Divider className="my-4" />

      <div className="flex items-baseline justify-between gap-6">
        <span className="label-mono text-text-base">Total a pagar</span>
        <span className="text-2xl font-light tracking-tight text-text-base">
          {formatCents(quote.total)}
        </span>
      </div>

      <p className="mt-2 text-[13px] text-text-muted">
        Se renueva {cycle} por {formatCents(quote.subtotal)} sin IVA. Puedes cancelar la
        renovación cuando quieras.
      </p>

      {quote.creditAvailable > quote.creditApplied ? (
        <p className="mt-2 text-[13px] text-text-muted">
          Te quedarán {formatCents(quote.creditAvailable - quote.creditApplied)} de crédito para
          el próximo pedido.
        </p>
      ) : null}
    </div>
  )
}
