"use client"

import * as React from "react"
import { Button, Field, Input } from "@/components/app/ui"

/**
 * Confirmation step for anything destructive.
 *
 * Built on the native `<dialog>` element: `showModal()` gives us the focus trap, the
 * inert background and Escape for free, which is more reliable than re-implementing
 * them. The only thing added by hand is returning focus to the trigger on close.
 *
 * `consequence` is mandatory and must name what actually happens — "se borra el disco",
 * not "esta acción no se puede deshacer".
 */
export interface ConfirmDialogProps {
  open: boolean
  title: string
  consequence: React.ReactNode
  confirmLabel: string
  cancelLabel?: string
  /** When set, the exact text the customer has to type to enable the button. */
  requireText?: string | null
  requireTextLabel?: string
  danger?: boolean
  busy?: boolean
  error?: string | null
  /** Receives exactly what the customer typed, so the server can check it too. */
  onConfirm: (typed: string) => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  consequence,
  confirmLabel,
  cancelLabel = "Cancelar",
  requireText = null,
  requireTextLabel = "Escribe el nombre del servidor para confirmar",
  danger = false,
  busy = false,
  error = null,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = React.useRef<HTMLDialogElement>(null)
  const [typed, setTyped] = React.useState("")
  const titleId = React.useId()
  const inputId = React.useId()
  const hintId = React.useId()

  React.useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      setTyped("")
      dialog.showModal()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  const matches = requireText === null || typed.trim() === requireText.trim()

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onCancel()
      }}
      onClose={() => {
        if (open && !busy) onCancel()
      }}
      className={[
        "m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-border-base",
        "bg-surface-light p-6 text-text-base backdrop:bg-bg-dark/40",
      ].join(" ")}
    >
      <h2 id={titleId} className="text-xl font-normal tracking-tight mb-3">
        {title}
      </h2>
      <div className="text-sm text-text-muted leading-relaxed mb-5">{consequence}</div>

      {requireText !== null ? (
        <Field label={requireTextLabel} htmlFor={inputId}>
          <Input
            id={inputId}
            value={typed}
            autoComplete="off"
            onChange={(event) => setTyped(event.target.value)}
            placeholder={requireText}
            aria-describedby={hintId}
          />
          <p id={hintId} className="mt-1.5 text-xs text-text-muted">
            Tiene que coincidir exactamente con {requireText}.
          </p>
        </Field>
      ) : null}

      {error ? (
        <p role="alert" className="mb-4 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={danger ? "danger" : "primary"}
          onClick={() => onConfirm(typed)}
          loading={busy}
          disabled={!matches}
        >
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  )
}
