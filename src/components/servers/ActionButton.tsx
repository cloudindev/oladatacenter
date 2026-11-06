"use client"

import * as React from "react"
import { Button, Notice } from "@/components/app/ui"
import { ConfirmDialog } from "./ConfirmDialog"
import { TaskProgress } from "./TaskProgress"
import type { ActionResult } from "./types"

/**
 * One operation on the server: an optional confirmation step, the Server Action, and
 * then the real state of the OVH task.
 *
 * `run` is a Server Action bound to the service id in the Server Component that renders
 * this button, so the browser never gets to choose which service is acted on.
 */

export interface ActionConfirmProps {
  title: string
  /** Must name the consequence in plain Spanish. */
  consequence: React.ReactNode
  confirmLabel: string
  /** Set to require the customer to type this exact text (the server name). */
  requireText?: string
  requireTextLabel?: string
  danger?: boolean
}

export function ActionButton({
  serviceId,
  label,
  run,
  variant = "secondary",
  withArrow = false,
  confirm,
  disabled = false,
  disabledReason,
  className,
}: {
  serviceId: string
  label: string
  run: () => Promise<ActionResult>
  variant?: "primary" | "secondary" | "ghost" | "danger"
  withArrow?: boolean
  confirm?: ActionConfirmProps
  disabled?: boolean
  disabledReason?: string
  className?: string
}) {
  const [confirming, setConfirming] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [actionId, setActionId] = React.useState<string | null>(null)
  const reasonId = React.useId()

  const execute = React.useCallback(async () => {
    setBusy(true)
    setMessage(null)
    try {
      const result = await run()
      if (result.ok) {
        setConfirming(false)
        setActionId(result.actionId)
      } else {
        setMessage(result.message)
      }
    } catch {
      setMessage("No hemos podido enviar la orden. Inténtalo de nuevo.")
    } finally {
      setBusy(false)
    }
  }, [run])

  return (
    <div className={className}>
      <Button
        type="button"
        variant={variant}
        withArrow={withArrow}
        loading={busy && !confirming}
        disabled={disabled}
        aria-describedby={disabled && disabledReason ? reasonId : undefined}
        onClick={() => {
          if (confirm) setConfirming(true)
          else void execute()
        }}
      >
        {label}
      </Button>

      {disabled && disabledReason ? (
        <p id={reasonId} className="mt-2 text-xs text-text-muted">
          {disabledReason}
        </p>
      ) : null}

      {message ? (
        <div className="mt-3">
          <Notice tone="danger">{message}</Notice>
        </div>
      ) : null}

      {actionId ? (
        <div className="mt-3">
          <TaskProgress serviceId={serviceId} actionId={actionId} />
        </div>
      ) : null}

      {confirm ? (
        <ConfirmDialog
          open={confirming}
          title={confirm.title}
          consequence={confirm.consequence}
          confirmLabel={confirm.confirmLabel}
          requireText={confirm.requireText ?? null}
          requireTextLabel={confirm.requireTextLabel}
          danger={confirm.danger}
          busy={busy}
          error={message}
          onConfirm={() => void execute()}
          onCancel={() => {
            if (busy) return
            setConfirming(false)
            setMessage(null)
          }}
        />
      ) : null}
    </div>
  )
}
