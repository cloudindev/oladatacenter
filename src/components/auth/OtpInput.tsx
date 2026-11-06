"use client"

import * as React from "react"
import { Field, inputClass } from "@/components/app/ui"
import { cn } from "@/lib/utils"

/**
 * Six-digit code input: one field per digit, paste-aware.
 *
 * Two names are submitted on purpose: a hidden `codigo` with the joined value for the
 * normal path, and `codigo_0…codigo_5` from the boxes themselves, which is what arrives
 * when JavaScript has not loaded. `joinCode` on the server accepts either, so the form
 * degrades instead of silently posting an empty code.
 *
 * Digits only, so it is never used where a recovery code is also valid.
 */
export function OtpInput({
  name = "codigo",
  label = "Código de 6 dígitos",
  length = 6,
  autoFocus = false,
}: {
  name?: string
  label?: string
  length?: number
  autoFocus?: boolean
}) {
  const [digits, setDigits] = React.useState<string[]>(() => Array.from({ length }, () => ""))
  const refs = React.useRef<Array<HTMLInputElement | null>>([])

  function setDigit(index: number, value: string) {
    setDigits((previous) => {
      const next = [...previous]
      next[index] = value
      return next
    })
  }

  function handleChange(index: number, raw: string) {
    const clean = raw.replace(/\D/g, "")
    if (clean.length === 0) {
      setDigit(index, "")
      return
    }
    if (clean.length === 1) {
      setDigit(index, clean)
      refs.current[index + 1]?.focus()
      return
    }
    // A pasted or auto-filled code fills the remaining boxes.
    setDigits((previous) => {
      const next = [...previous]
      for (let offset = 0; offset < clean.length && index + offset < length; offset += 1) {
        next[index + offset] = clean[offset] as string
      }
      return next
    })
    refs.current[Math.min(index + clean.length, length - 1)]?.focus()
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && digits[index] === "") {
      refs.current[index - 1]?.focus()
    }
    if (event.key === "ArrowLeft") refs.current[index - 1]?.focus()
    if (event.key === "ArrowRight") refs.current[index + 1]?.focus()
  }

  return (
    <Field label={label} htmlFor={`${name}-0`}>
      <div className="flex gap-2">
        {digits.map((digit, index) => (
          <input
            key={index}
            id={`${name}-${index}`}
            name={`${name}_${index}`}
            ref={(element) => {
              refs.current[index] = element
            }}
            value={digit}
            onChange={(event) => handleChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={length}
            autoFocus={autoFocus && index === 0}
            aria-label={`Dígito ${index + 1} de ${length}`}
            className={cn(inputClass, "w-11 px-0 text-center font-mono text-base")}
          />
        ))}
      </div>
      <input type="hidden" name={name} value={digits.join("")} />
    </Field>
  )
}
