/**
 * Form parsing for the admin panel.
 *
 * The operator types prices in Spanish — `7,99` — and money is integer cents everywhere
 * else, so the conversion happens exactly once, here, and never with a float multiply
 * that turns 7,99 € into 798 cents. Pure and unit-tested.
 */
import type { Cents } from "@ola/core"

export class InputError extends Error {}

export function formObject(form: FormData): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") out[key] = value
  }
  return out
}

export function text(form: FormData, field: string): string {
  const value = form.get(field)
  return typeof value === "string" ? value.trim() : ""
}

export function requiredText(form: FormData, field: string, label: string): string {
  const value = text(form, field)
  if (value === "") throw new InputError(`Falta ${label}.`)
  return value
}

export function flag(form: FormData, field: string): boolean {
  const value = form.get(field)
  return value === "on" || value === "true" || value === "1"
}

const AMOUNT = /^-?\d{1,9}(?:[.,]\d{1,2})?$/

/**
 * `"7,99"` -> 799. An empty string is `null`, which is how the pricing screen clears a
 * manual PVP and falls back to the margin rule. The integer and decimal halves are parsed
 * separately so no float ever touches the amount.
 */
export function euroToCents(raw: string): Cents | null {
  const value = raw.trim().replace(/\s|€/g, "")
  if (value === "") return null
  if (!AMOUNT.test(value)) throw new InputError(`«${raw}» no es un importe válido.`)
  const negative = value.startsWith("-")
  const [whole, fraction = ""] = value.replace("-", "").split(/[.,]/)
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"))
  return negative ? -cents : cents
}

export function requiredEuroToCents(raw: string, label: string): Cents {
  const value = euroToCents(raw)
  if (value === null) throw new InputError(`Falta ${label}.`)
  return value
}

/** `"75"` or `"75,5"` -> 7500 / 7550 basis points. */
export function percentToBasisPoints(raw: string): number {
  const value = raw.trim().replace(/\s|%/g, "")
  if (value === "" || !AMOUNT.test(value) || value.startsWith("-")) {
    throw new InputError(`«${raw}» no es un porcentaje válido.`)
  }
  const [whole, fraction = ""] = value.split(/[.,]/)
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"))
}

/** A `<input type="date">` or `datetime-local` value, read as UTC. Empty is `null`. */
export function dateField(raw: string): Date | null {
  const value = raw.trim()
  if (value === "") return null
  const parsed = new Date(/\d{2}:\d{2}/.test(value) ? `${value}:00Z` : `${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) throw new InputError(`«${raw}» no es una fecha válida.`)
  return parsed
}

/** One of a fixed set, or `undefined` when the field is absent or not in the set. */
export function oneOf<T extends string>(
  raw: string,
  allowed: readonly T[],
): T | undefined {
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : undefined
}

/** Comma-separated values restricted to a fixed set, for the list filters. */
export function manyOf<T extends string>(raw: string, allowed: readonly T[]): T[] {
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is T => (allowed as readonly string[]).includes(value))
}
