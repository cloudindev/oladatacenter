import { formatCents } from "@ola/core"

import { ButtonLink, DataRow, Notice } from "@/components/app/ui"
import type { CreditSummary } from "@/server/billing"

/**
 * The credit balance.
 *
 * Credit is a discount on the next order, applied before VAT, and it expires. The expiry
 * is stated plainly and warned about a week ahead, because silently losing ten euros is
 * exactly the kind of surprise that makes someone distrust a panel.
 */

function dateLabel(value: Date): string {
  return value.toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })
}

export function CreditPanel({ summary }: { summary: CreditSummary }) {
  if (summary.balance === 0) {
    return (
      <p className="text-sm text-text-muted leading-relaxed">
        No tienes crédito disponible. El crédito de bienvenida se activa al verificar la cuenta
        y añadir una tarjeta.
      </p>
    )
  }

  return (
    <div>
      <p className="text-3xl font-light tracking-tight text-text-base">
        {formatCents(summary.balance)}
      </p>
      <p className="mt-1 label-mono text-text-muted">disponible como descuento</p>

      <dl className="mt-6">
        {summary.expiresAt ? (
          <DataRow label="Caduca el">{dateLabel(summary.expiresAt)}</DataRow>
        ) : (
          <DataRow label="Caduca el">sin fecha de caducidad</DataRow>
        )}
      </dl>

      {summary.expiringSoon && summary.expiringAt ? (
        <div className="mt-5">
          <Notice
            tone="warn"
            title="Tu crédito caduca pronto"
            action={
              <ButtonLink href="/servers/configurator" withArrow>
                Usarlo
              </ButtonLink>
            }
          >
            {formatCents(summary.expiringAmount)} caducan el {dateLabel(summary.expiringAt)}. Se
            aplica automáticamente en tu próximo pedido.
          </Notice>
        </div>
      ) : null}

      <p className="mt-5 text-[13px] leading-relaxed text-text-muted">
        El crédito se descuenta del importe sin IVA de tu próximo pedido y nunca genera una
        devolución en metálico.
      </p>
    </div>
  )
}
