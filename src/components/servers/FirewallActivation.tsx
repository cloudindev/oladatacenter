"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button, Notice, StatusBadge } from "@/components/app/ui"
import { enableFirewall, getFirewallStatus } from "@/server/services/actions"
import type { ActionResult, FirewallActivation as Activation } from "./types"
import { useRunner } from "./useRunner"

/**
 * Step one of the network firewall: putting the IP on it.
 *
 * OVH rejects any rule on an IP that is not on the firewall, so this comes first and is
 * shown as its own step. While OVH reports `enableFirewallPending` the component polls
 * the real state with `getFirewallStatus` and only shows the rule form once OVH says
 * `ok` — it never assumes the activation went through.
 */

const INTERVAL_MS = 3000
/** ~5 minutes; past that we say it is slow instead of polling forever. */
const MAX_ATTEMPTS = 100

export function FirewallActivation({
  serviceId,
  ip,
  initial,
  allowed,
}: {
  serviceId: string
  ip: string
  /** `off` or `pending`; the page renders the rules directly when it is `on`. */
  initial: Exclude<Activation, "on">
  allowed: boolean
}) {
  const router = useRouter()
  const runner = useRunner<ActionResult>()
  const [activation, setActivation] = React.useState<Activation>(initial)
  const [pollError, setPollError] = React.useState<string | null>(null)
  const [slow, setSlow] = React.useState(false)

  React.useEffect(() => {
    if (activation !== "pending") return
    let cancelled = false
    let attempts = 0
    let timer: ReturnType<typeof setTimeout> | null = null

    const poll = async (): Promise<void> => {
      attempts += 1
      try {
        const result = await getFirewallStatus({ serviceId, ip })
        if (cancelled) return
        if (!result.ok) {
          setPollError(result.message)
        } else {
          setPollError(null)
          if (result.activation !== "pending") {
            setActivation(result.activation)
            if (result.activation === "on") router.refresh()
            return
          }
        }
      } catch {
        if (cancelled) return
        setPollError("No hemos podido comprobar el estado del firewall.")
      }
      if (attempts >= MAX_ATTEMPTS) {
        setSlow(true)
        return
      }
      timer = setTimeout(() => void poll(), INTERVAL_MS)
    }

    timer = setTimeout(() => void poll(), INTERVAL_MS)
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [activation, serviceId, ip, router])

  if (activation === "on") {
    return (
      <Notice tone="ok" title="Firewall activado">
        El proveedor ha confirmado que la IP ya está en el firewall. Cargando las reglas.
      </Notice>
    )
  }

  if (activation === "pending") {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3" role="status" aria-live="polite">
          <StatusBadge tone="busy" pulse={!slow}>
            Activándose
          </StatusBadge>
          <p className="text-sm text-text-muted">
            Estado real en el proveedor: activación pendiente. Suele tardar un par de
            minutos.
          </p>
        </div>
        {pollError ? <Notice tone="warn">{pollError}</Notice> : null}
        {slow ? (
          <Notice tone="warn" title="La activación tarda más de lo normal">
            Sigue en curso en el proveedor. Vuelve a esta página en unos minutos.
          </Notice>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted leading-relaxed max-w-2xl">
        El firewall de red no está activado en {ip}. Mientras no lo esté, todo el tráfico
        llega al servidor sin filtrar y no se pueden añadir reglas. Activarlo no corta
        nada: sin reglas sigue dejando pasar todo, y luego añades las que necesites.
      </p>

      {runner.error ? <Notice tone="danger">{runner.error}</Notice> : null}

      <div>
        <Button
          type="button"
          variant="primary"
          withArrow
          loading={runner.busy}
          disabled={!allowed}
          onClick={() =>
            void runner.run(async () => {
              const result = await enableFirewall({ serviceId, ip })
              if (result.ok) setActivation("pending")
              return result
            })
          }
        >
          Activar firewall
        </Button>
        {!allowed ? (
          <p className="mt-2 text-xs text-text-muted">
            Disponible cuando el servidor está activo.
          </p>
        ) : null}
      </div>
    </div>
  )
}
