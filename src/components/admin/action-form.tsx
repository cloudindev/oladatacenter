"use client"

import * as React from "react"
import { useActionState } from "react"
import { Button, Input, Notice } from "@/components/app/ui"
import { cn } from "@/lib/utils"
import type { AdminActionResult } from "@/server/admin/results"

type Action = (
  previous: AdminActionResult | null,
  form: FormData,
) => Promise<AdminActionResult>

function ResultNotice({ result }: { result: AdminActionResult | null }) {
  if (!result) return null
  // A successful write can still carry a warning — a price saved below the margin floor,
  // for one — so the tone follows the message, not just `ok`.
  const warns = result.ok && result.message.includes("por debajo")
  return (
    <div className="mt-3">
      <Notice tone={result.ok ? (warns ? "warn" : "ok") : "danger"}>
        <p>{result.message}</p>
        {result.detail ? (
          <pre className="mt-2 overflow-x-auto font-mono text-xs whitespace-pre-wrap">
            {result.detail}
          </pre>
        ) : null}
      </Notice>
    </div>
  )
}

function HiddenFields({ fields }: { fields: Record<string, string> }) {
  return (
    <>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </>
  )
}

/**
 * A form bound to an admin Server Action, for operations that need no confirmation:
 * re-ordering a plan, asking for a sync, flipping a read-only view.
 */
export function ActionForm({
  action,
  fields = {},
  submitLabel,
  variant = "secondary",
  children,
  className,
}: {
  action: Action
  fields?: Record<string, string>
  submitLabel: string
  variant?: "primary" | "secondary" | "ghost" | "danger"
  children?: React.ReactNode
  className?: string
}) {
  const [result, submit, pending] = useActionState(action, null)
  return (
    <div className={className}>
      <form action={submit} className="flex flex-wrap items-end gap-2">
        <HiddenFields fields={fields} />
        {children}
        <Button type="submit" variant={variant} loading={pending}>
          {submitLabel}
        </Button>
      </form>
      <ResultNotice result={result} />
    </div>
  )
}

/**
 * The confirmation gate for anything destructive or money-moving.
 *
 * Three things have to be true before the action can fire, and all three are deliberate:
 *  - the consequence is spelled out, with the exact amount and the exact customer;
 *  - the operator types the confirmation word, so a stray click cannot refund anybody;
 *  - the form carries the amount and the customer it was rendered with, and the Server
 *    Action re-checks them against the live row. A figure that moved under the operator
 *    is a refusal, not a surprise.
 */
export function ConfirmAction({
  action,
  fields = {},
  trigger,
  title,
  consequence,
  confirmWord,
  variant = "danger",
  children,
  className,
}: {
  action: Action
  fields?: Record<string, string>
  /** The button that opens the confirmation. */
  trigger: string
  /** Names the exact amount and the exact customer. */
  title: string
  /** What will happen, in one sentence. */
  consequence: string
  /** The word the operator has to type. */
  confirmWord: string
  variant?: "primary" | "secondary" | "danger"
  /** Extra inputs the action needs, such as the reason. */
  children?: React.ReactNode
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [typed, setTyped] = React.useState("")
  const [result, submit, pending] = useActionState(action, null)
  const armed = typed.trim().toUpperCase() === confirmWord.toUpperCase()

  if (!open) {
    return (
      <div className={className}>
        <Button type="button" variant={variant} onClick={() => setOpen(true)}>
          {trigger}
        </Button>
        <ResultNotice result={result} />
      </div>
    )
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-[#f3c9c5] bg-[#fdeceb] p-4",
        variant !== "danger" && "border-[#f0dcae] bg-[#fdf4e3]",
        className,
      )}
    >
      <p className="text-sm font-medium text-text-base">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-text-base">{consequence}</p>

      <form action={submit} className="mt-4">
        <HiddenFields fields={fields} />
        {children}
        <label className="label-mono mb-2 block text-text-muted" htmlFor={`confirm-${confirmWord}`}>
          Escribe {confirmWord} para confirmar
        </label>
        <Input
          id={`confirm-${confirmWord}`}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="max-w-xs"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="submit" variant={variant} loading={pending} disabled={!armed}>
            {trigger}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setOpen(false)
              setTyped("")
            }}
          >
            Cancelar
          </Button>
        </div>
      </form>
      <ResultNotice result={result} />
    </div>
  )
}
