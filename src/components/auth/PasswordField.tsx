"use client"

import * as React from "react"
import { passwordStrength } from "@ola/core/identity/index"
import { Field, inputClass } from "@/components/app/ui"
import { bareInputClass, bareLabelClass, fieldNumber } from "./styles"
import { cn } from "@/lib/utils"

/**
 * Password input with a reveal toggle and an optional strength meter.
 *
 * The meter runs the same pure helper the server enforces, so what the customer is told
 * and what is accepted cannot drift. Nothing leaves the browser while typing.
 *
 * Two looks, one component: `bare` for the editorial `(auth)` screens, the boxed kit
 * from `src/components/app/ui.tsx` everywhere in the customer area.
 */

const STRENGTH_LABELS = ["Muy débil", "Débil", "Aceptable", "Buena", "Fuerte"] as const

export function PasswordField({
  name,
  label,
  id,
  autoComplete = "current-password",
  hint,
  withMeter = false,
  email,
  required = true,
  autoFocus = false,
  bare = false,
  index,
  labelAction,
}: {
  name: string
  label: string
  id?: string
  autoComplete?: "current-password" | "new-password"
  hint?: string
  withMeter?: boolean
  email?: string
  required?: boolean
  autoFocus?: boolean
  /** Bottom-rule style for the `(auth)` screens. */
  bare?: boolean
  /** Position in the form, rendered as `02 /` when `bare`. */
  index?: number
  /** Rendered at the right of the label row, e.g. the "forgot password" link. */
  labelAction?: React.ReactNode
}) {
  const inputId = id ?? name
  const [value, setValue] = React.useState("")
  const [visible, setVisible] = React.useState(false)

  const verdict = withMeter ? passwordStrength(value, email) : null
  const issue = verdict && value.length > 0 && !verdict.ok ? verdict.issues[0] : null

  const control = (
    <div className="relative">
      <input
        id={inputId}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        required={required}
        autoFocus={autoFocus}
        minLength={autoComplete === "new-password" ? 12 : undefined}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={bare ? "••••••••••••" : undefined}
        className={cn(bare ? bareInputClass : inputClass, "pr-20")}
        aria-describedby={verdict ? `${inputId}-fuerza` : undefined}
      />
      <button
        type="button"
        onClick={() => setVisible((previous) => !previous)}
        className={cn(
          "font-mono text-[11px] uppercase tracking-[0.06em] absolute right-0 px-2 py-1",
          "text-text-base/55 hover:text-text-base transition-colors",
          bare ? "bottom-3" : "top-1/2 -translate-y-1/2 right-2",
        )}
        aria-pressed={visible}
      >
        {visible ? "ocultar" : "ver"}
      </button>
    </div>
  )

  const meter = verdict ? (
    <div id={`${inputId}-fuerza`} className="mt-3" aria-live="polite">
      <div className="flex gap-1" aria-hidden>
        {[0, 1, 2, 3].map((segment) => (
          <span
            key={segment}
            className={cn(
              "h-1 flex-1",
              bare ? "" : "rounded-full",
              value.length > 0 && verdict.score > segment
                ? verdict.ok
                  ? "bg-primary-hover"
                  : "bg-[#f0dcae]"
                : bare
                  ? "bg-bg-dark/12"
                  : "bg-border-base",
            )}
          />
        ))}
      </div>
      <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-text-base/55 mt-2">
        {value.length === 0
          ? "Mínimo 12 caracteres"
          : `${STRENGTH_LABELS[verdict.score]}${issue ? ` · ${describe(issue)}` : ""}`}
      </p>
    </div>
  ) : null

  if (!bare) {
    return (
      <Field label={label} htmlFor={inputId} hint={hint}>
        {control}
        {meter}
      </Field>
    )
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 mb-2">
        <label htmlFor={inputId} className={bareLabelClass}>
          {index === undefined ? label : `${fieldNumber(index)} / ${label}`}
        </label>
        {labelAction ? <div className="shrink-0">{labelAction}</div> : null}
      </div>
      {control}
      {meter}
      {hint && !meter ? <p className="mt-2 text-xs text-text-base/50">{hint}</p> : null}
    </div>
  )
}

/** Short hints, kept separate from the server's full sentences. */
function describe(issue: string): string {
  switch (issue) {
    case "too_short":
      return "usa al menos 12 caracteres"
    case "too_long":
      return "demasiado larga"
    case "too_few_classes":
      return "mezcla mayúsculas, números y símbolos"
    case "contains_email":
      return "no uses tu correo"
    case "repeated_characters":
      return "evita caracteres repetidos"
    case "sequential_characters":
      return "evita secuencias"
    case "common_password":
      return "demasiado común"
    default:
      return "revísala"
  }
}
