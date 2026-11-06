"use client"

import * as React from "react"
import { formatCents } from "@ola/core"
import { Button, ButtonLink, EmptyState, Notice, Panel } from "@/components/app/ui"
import { requestUpgradeQuote } from "@/server/services/actions"
import { specsLine } from "./labels"
import type { UpgradeQuoteResult } from "./types"
import { useRunner } from "./useRunner"

/**
 * Plans this server can grow into, with the prorated amount for the rest of the current
 * period computed from our own prices.
 *
 * TODO(integration): placing the upgrade order belongs to the checkout flow, which owns
 * `src/app/app/servers/new` and the `orders` table. This screen quotes the change and
 * hands over; it never charges anything by itself.
 */
export function UpgradeOptions({
  serviceId,
  options,
  allowed,
}: {
  serviceId: string
  options: readonly {
    planId: string
    planName: string
    specs: { vcores: number; ramGb: number; nvmeGb: number; bandwidthMbps: number }
    monthlyPrice: number
  }[]
  allowed: boolean
}) {
  const runner = useRunner<UpgradeQuoteResult>()
  const [asked, setAsked] = React.useState<string | null>(null)

  if (options.length === 0) {
    return (
      <EmptyState>
        Este servidor ya está en el plan más grande que podemos ampliar sin migrarlo.
      </EmptyState>
    )
  }

  return (
    <div className="space-y-4">
      {options.map((option) => (
        <Panel key={option.planId} as="article">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-normal tracking-tight text-text-base">
                {option.planName}
              </h3>
              <p className="mt-1 text-sm text-text-muted">{specsLine(option.specs)}</p>
              <p className="mt-1 text-sm text-text-base">
                {formatCents(option.monthlyPrice)} al mes
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              loading={runner.busy && asked === option.planId}
              disabled={!allowed}
              onClick={() => {
                setAsked(option.planId)
                void runner.run(() => requestUpgradeQuote({ serviceId, planId: option.planId }))
              }}
            >
              Ver el precio del cambio
            </Button>
          </div>

          {asked === option.planId && runner.error ? (
            <div className="mt-4">
              <Notice tone="danger">{runner.error}</Notice>
            </div>
          ) : null}

          {asked === option.planId && runner.result ? (
            <div className="mt-4">
              <Notice tone="neutral" title="Importe del cambio">
                <p>
                  Quedan {runner.result.remainingDays} días del periodo que ya has pagado.
                  Por el cambio a {runner.result.planName} pagarías{" "}
                  <strong>{formatCents(runner.result.amountDue)}</strong> ahora, y a partir
                  de la siguiente renovación {formatCents(runner.result.monthlyPrice)} al
                  mes.
                </p>
                <p className="mt-2">
                  La ampliación se aplica en caliente y el servidor se reinicia una vez.
                </p>
                <div className="mt-3">
                  <ButtonLink href="/contact" variant="secondary">
                    Confirmar con soporte
                  </ButtonLink>
                </div>
              </Notice>
            </div>
          ) : null}
        </Panel>
      ))}

      {!allowed ? (
        <p className="text-sm text-text-muted">
          El cambio de plan está disponible cuando el servidor no está suspendido.
        </p>
      ) : null}
    </div>
  )
}
