"use client"

import * as React from "react"
import { Button, Notice, StatusBadge } from "@/components/app/ui"
import { setAutoRenew } from "@/server/services/actions"
import { ConfirmDialog } from "./ConfirmDialog"
import { formatDate } from "./labels"
import type { ActionResult } from "./types"
import { useRunner } from "./useRunner"

/**
 * Renewal.
 *
 * Turning it off is how a customer cancels: the server keeps running until the end of
 * the period already paid and is released then. It is destructive, so the confirmation
 * says the date on which the data disappears.
 */
export function AutoRenewToggle({
  serviceId,
  serverName,
  autoRenew,
  nextDueAt,
  disabled,
}: {
  serviceId: string
  serverName: string
  autoRenew: boolean
  nextDueAt: Date | null
  disabled: boolean
}) {
  const runner = useRunner<ActionResult>({ refreshOnSuccess: true })
  const [confirming, setConfirming] = React.useState(false)

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <StatusBadge tone={autoRenew ? "ok" : "warn"}>
          {autoRenew ? "Renovación automática activada" : "Renovación cancelada"}
        </StatusBadge>
        {nextDueAt ? (
          <p className="text-sm text-text-muted">
            {autoRenew ? "Próxima renovación" : "El servicio termina"} el{" "}
            {formatDate(nextDueAt)}
          </p>
        ) : null}
      </div>

      {runner.error ? (
        <div className="mb-4">
          <Notice tone="danger">{runner.error}</Notice>
        </div>
      ) : null}

      {autoRenew ? (
        <>
          <Button
            type="button"
            variant="danger"
            disabled={disabled}
            onClick={() => setConfirming(true)}
          >
            Cancelar la renovación
          </Button>
          <p className="mt-2 text-xs text-text-muted">
            El servidor seguirá funcionando hasta el final del periodo ya pagado.
          </p>
        </>
      ) : (
        <Button
          type="button"
          variant="primary"
          withArrow
          loading={runner.busy}
          disabled={disabled}
          onClick={() => void runner.run(() => setAutoRenew({ serviceId, autoRenew: true }))}
        >
          Volver a activar la renovación
        </Button>
      )}

      <ConfirmDialog
        open={confirming}
        title="Cancelar la renovación"
        consequence={
          <>
            {serverName} dejará de renovarse. El{" "}
            {nextDueAt ? formatDate(nextDueAt) : "día de la próxima renovación"} se
            liberará el servidor y se borrarán sus datos de forma definitiva. Puedes
            volver a activarla antes de esa fecha.
          </>
        }
        confirmLabel="Cancelar la renovación"
        danger
        busy={runner.busy}
        error={runner.error}
        onConfirm={() =>
          void runner.run(async () => {
            const result = await setAutoRenew({ serviceId, autoRenew: false })
            if (result.ok) setConfirming(false)
            return result
          })
        }
        onCancel={() => {
          if (runner.busy) return
          setConfirming(false)
          runner.reset()
        }}
      />
    </div>
  )
}
