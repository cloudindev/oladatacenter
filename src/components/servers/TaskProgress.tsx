"use client"

import { useRouter } from "next/navigation"
import { Notice, Spinner, StatusBadge } from "@/components/app/ui"
import { ACTION_STATUS_UI, actionLabel } from "./labels"
import { useTaskStatus } from "./useTaskStatus"

/**
 * The real state of one operation at the provider.
 *
 * It shows what `getTask` last returned — queued, running, done or error — and refreshes
 * the page once the task is terminal so the rest of the panel catches up.
 */
export function TaskProgress({
  serviceId,
  actionId,
  onFinished,
}: {
  serviceId: string
  actionId: string | null
  onFinished?: () => void
}) {
  const router = useRouter()
  const { state, error, polling, gaveUp } = useTaskStatus(serviceId, actionId, {
    onDone: () => {
      router.refresh()
      onFinished?.()
    },
  })

  if (!actionId) return null

  if (error) {
    return (
      <Notice tone="warn" title="No podemos seguir la operación">
        {error} La operación puede seguir en curso en el servidor.
      </Notice>
    )
  }

  if (gaveUp) {
    return (
      <Notice tone="warn" title="La operación tarda más de lo normal">
        Sigue en curso en el proveedor. Puedes cerrar esta página y volver más tarde: el
        historial de actividad guarda el resultado.
      </Notice>
    )
  }

  if (!state) {
    return (
      <p className="label-mono text-text-muted inline-flex items-center gap-2">
        <Spinner /> Comprobando el estado
      </p>
    )
  }

  const ui = ACTION_STATUS_UI[state.status]

  if (state.status === "error") {
    return (
      <Notice tone="danger" title={`${actionLabel(state.type)}: no se ha completado`}>
        {state.message ?? "La operación no ha podido completarse."}
      </Notice>
    )
  }

  if (state.status === "done") {
    return (
      <Notice tone="ok" title={`${actionLabel(state.type)}: completada`}>
        El proveedor ha confirmado la operación.
      </Notice>
    )
  }

  return (
    <div
      className="flex items-center gap-3"
      role="status"
      aria-live="polite"
      aria-label={`${actionLabel(state.type)}: ${ui.label}`}
    >
      <StatusBadge tone={ui.tone} pulse={polling}>
        {ui.label}
      </StatusBadge>
      <p className="text-sm text-text-muted">
        {actionLabel(state.type)} · estado real de la tarea en el proveedor
      </p>
    </div>
  )
}
