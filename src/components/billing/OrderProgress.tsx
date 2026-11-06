"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { ButtonLink, Notice, Spinner, StatusBadge, type StatusTone } from "@/components/app/ui"
import { readOrderProgress } from "@/app/app/servers/new/actions"
import type { OrderProgressView, PhaseState } from "@/server/billing/progress"

/**
 * Live order progress.
 *
 * Every line is the real provisioning step the job wrote to `orders.completedSteps` — never
 * a fake spinner and never an invented percentage. Polling stops the moment the order
 * reaches a state that does not move on its own, and the `delayed` and `failed` states say
 * plainly what happened instead of spinning forever.
 */

const POLL_MS = 4000

const STATUS_TONE: Readonly<Record<string, StatusTone>> = {
  pending_payment: "warn",
  paid: "busy",
  provisioning: "busy",
  delivered: "ok",
  delayed: "warn",
  failed: "danger",
  cancelled: "neutral",
}

const STATUS_LABEL: Readonly<Record<string, string>> = {
  pending_payment: "Pendiente de pago",
  paid: "Pagado",
  provisioning: "Creando",
  delivered: "Entregado",
  delayed: "Con retraso",
  failed: "Fallido",
  cancelled: "Cancelado",
}

export function OrderProgress({ initial }: { initial: OrderProgressView }) {
  const router = useRouter()
  const [view, setView] = React.useState(initial)
  const wasLive = React.useRef(initial.live)

  React.useEffect(() => {
    if (!view.live) {
      // One refresh on the transition out of a live state, so the rest of the page
      // (the server link, the invoice) catches up.
      if (wasLive.current) {
        wasLive.current = false
        router.refresh()
      }
      return
    }
    wasLive.current = true

    let cancelled = false
    const timer = setInterval(() => {
      void (async () => {
        const next = await readOrderProgress(view.orderId)
        if (!cancelled && next) setView(next)
      })()
    }, POLL_MS)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [view.live, view.orderId, router])

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <StatusBadge tone={STATUS_TONE[view.status] ?? "neutral"} pulse={view.live}>
          {STATUS_LABEL[view.status] ?? view.status}
        </StatusBadge>
        <span className="label-mono text-text-muted">Pedido {view.reference}</span>
      </div>

      <h2 className="text-2xl font-light tracking-tight text-text-base">{view.headline}</h2>
      <p className="mt-2 text-text-muted leading-relaxed">{view.detail}</p>

      <ol className="mt-8 border-t border-border-base">
        {view.phases.map((phase) => (
          <li
            key={phase.key}
            className="flex items-center justify-between gap-4 py-3 border-b border-border-base"
          >
            <span
              className={
                phase.state === "pending" || phase.state === "stalled"
                  ? "text-sm text-text-muted"
                  : "text-sm text-text-base"
              }
            >
              {phase.label}
            </span>
            <PhaseMark state={phase.state} />
          </li>
        ))}
      </ol>

      {view.delivery === "timed_out" ? (
        <div className="mt-6">
          <Notice tone="danger" title="Fuera de plazo">
            Hemos avisado a nuestro equipo. Si el proveedor no entrega el servidor, cancelamos el
            pedido y te devolvemos el importe completo sin que tengas que pedirlo.
          </Notice>
        </div>
      ) : null}

      {view.error ? (
        <div className="mt-6">
          <Notice tone="danger" title="Detalle">
            {view.error}
          </Notice>
        </div>
      ) : null}

      {view.status === "delivered" ? (
        <div className="mt-8">
          <ButtonLink href="/app" withArrow>
            Ir a mis servidores
          </ButtonLink>
        </div>
      ) : null}

      {view.status === "failed" ? (
        <div className="mt-8">
          <ButtonLink href="/contact" variant="secondary">
            Hablar con soporte
          </ButtonLink>
        </div>
      ) : null}

      {view.live ? (
        <p className="mt-8 flex items-center gap-2 label-mono text-text-muted">
          <Spinner /> Actualizando automáticamente
        </p>
      ) : null}
    </div>
  )
}

function PhaseMark({ state }: { state: PhaseState }) {
  if (state === "done") {
    return (
      <span className="label-mono text-[#3d5a2a]" aria-label="Completado">
        hecho
      </span>
    )
  }
  if (state === "current") {
    return (
      <span className="label-mono text-text-base inline-flex items-center gap-2">
        <Spinner /> en curso
      </span>
    )
  }
  if (state === "stalled") {
    return (
      <span className="label-mono text-text-muted" aria-label="Sin completar">
        sin completar
      </span>
    )
  }
  return (
    <span className="label-mono text-text-muted" aria-label="Pendiente">
      pendiente
    </span>
  )
}
