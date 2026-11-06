"use client"

import * as React from "react"
import { Button, EmptyState, Notice } from "@/components/app/ui"
import { restoreBackup } from "@/server/services/actions"
import { ConfirmDialog } from "./ConfirmDialog"
import { TaskProgress } from "./TaskProgress"
import type { ActionResult } from "./types"
import { useRunner } from "./useRunner"
import { cn } from "@/lib/utils"

/**
 * Automated backup restore points.
 *
 * The values come from `listRestorePoints` and are sent back to OVH byte for byte, so
 * the raw string travels untouched and only its label is formatted for reading.
 */
export function BackupRestorePanel({
  serviceId,
  serverName,
  restorePoints,
  canRestore,
}: {
  serviceId: string
  serverName: string
  restorePoints: readonly string[]
  canRestore: boolean
}) {
  const runner = useRunner<ActionResult>()
  const [selected, setSelected] = React.useState(restorePoints[0] ?? "")
  const [confirming, setConfirming] = React.useState(false)

  if (restorePoints.length === 0) {
    return (
      <EmptyState>
        Todavía no hay copias disponibles para restaurar. La primera suele estar lista al
        día siguiente de crear el servidor.
      </EmptyState>
    )
  }

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="label-mono text-text-muted mb-3">Punto de restauración</legend>
        <div className="space-y-2">
          {restorePoints.map((point) => {
            const active = selected === point
            return (
              <label
                key={point}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors",
                  "focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent-ink",
                  active
                    ? "border-accent-ink bg-surface-beige"
                    : "border-border-base hover:bg-surface-beige/60",
                )}
              >
                <input
                  type="radio"
                  name="restore-point"
                  value={point}
                  checked={active}
                  onChange={() => setSelected(point)}
                  className="accent-[var(--ag-sys-color-accent-ink)]"
                />
                <span className="text-sm text-text-base">{labelFor(point)}</span>
              </label>
            )
          })}
        </div>
      </fieldset>

      {runner.error ? <Notice tone="danger">{runner.error}</Notice> : null}

      <div>
        <Button
          type="button"
          variant="danger"
          disabled={!canRestore || !selected}
          onClick={() => setConfirming(true)}
        >
          Restaurar esta copia
        </Button>
        {!canRestore ? (
          <p className="mt-2 text-xs text-text-muted">
            La restauración está disponible cuando el servidor está activo o apagado.
          </p>
        ) : null}
      </div>

      {runner.result ? (
        <TaskProgress serviceId={serviceId} actionId={runner.result.actionId} />
      ) : null}

      <ConfirmDialog
        open={confirming}
        title="Restaurar una copia"
        consequence={
          <>
            El disco de {serverName} vuelve al estado del {labelFor(selected)}. Todo lo
            que se haya escrito después se pierde. El servidor se reinicia durante la
            restauración.
          </>
        }
        confirmLabel="Restaurar"
        danger
        busy={runner.busy}
        error={runner.error}
        onConfirm={() =>
          void runner.run(async () => {
            const result = await restoreBackup({ serviceId, restorePoint: selected })
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

/** Restore points are ISO datetimes. Shown in Spanish, sent back verbatim. */
function labelFor(restorePoint: string): string {
  const date = new Date(restorePoint)
  if (Number.isNaN(date.getTime())) return restorePoint
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  }).format(date)
}
