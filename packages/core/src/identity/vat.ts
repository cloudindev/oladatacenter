/**
 * EU VAT number *shape* validation. Pure: it only says the number could exist in the
 * given member state. Existence and ownership come from VIES.
 */

import { isValidSpanishTaxId } from "./tax-id"

/** Per-country body patterns, without the country prefix. */
const VAT_PATTERNS: Record<string, RegExp> = {
  AT: /^U[0-9]{8}$/,
  BE: /^[01][0-9]{9}$/,
  BG: /^[0-9]{9,10}$/,
  CY: /^[0-9]{8}[A-Z]$/,
  CZ: /^[0-9]{8,10}$/,
  DE: /^[0-9]{9}$/,
  DK: /^[0-9]{8}$/,
  EE: /^[0-9]{9}$/,
  EL: /^[0-9]{9}$/,
  ES: /^[0-9A-Z][0-9]{7}[0-9A-Z]$/,
  FI: /^[0-9]{8}$/,
  FR: /^[0-9A-Z]{2}[0-9]{9}$/,
  HR: /^[0-9]{11}$/,
  HU: /^[0-9]{8}$/,
  IE: /^(?:[0-9]{7}[A-W]|[0-9][A-Z*+][0-9]{5}[A-W]|[0-9]{7}[A-W][A-I])$/,
  IT: /^[0-9]{11}$/,
  LT: /^(?:[0-9]{9}|[0-9]{12})$/,
  LU: /^[0-9]{8}$/,
  LV: /^[0-9]{11}$/,
  MT: /^[0-9]{8}$/,
  NL: /^[0-9]{9}B[0-9]{2}$/,
  PL: /^[0-9]{10}$/,
  PT: /^[0-9]{9}$/,
  RO: /^[0-9]{2,10}$/,
  SE: /^[0-9]{12}$/,
  SI: /^[0-9]{8}$/,
  SK: /^[0-9]{10}$/,
  /** Northern Ireland, still inside the EU VAT area for goods. */
  XI: /^(?:[0-9]{9}|[0-9]{12}|GD[0-9]{3}|HA[0-9]{3})$/,
}

/** Country codes VIES can answer for. `EL` is Greece's VAT code (ISO is `GR`). */
export const EU_VAT_COUNTRIES: readonly string[] = Object.keys(VAT_PATTERNS)

export interface ParsedVatNumber {
  /** VAT country code, upper-case. Greece is `EL`. */
  country: string
  /** The number without the country prefix, upper-case and compacted. */
  number: string
}

/** Greece files VAT under `EL` while its ISO country code is `GR`. */
export function vatCountryOf(countryCode: string): string {
  const upper = countryCode.trim().toUpperCase()
  return upper === "GR" ? "EL" : upper
}

/**
 * Splits `ESB12345674` into its country and body. Returns `null` when there is no
 * recognisable country prefix.
 */
export function parseVatNumber(raw: string): ParsedVatNumber | null {
  const compact = raw.replace(/[\s.\-/]/g, "").toUpperCase()
  if (compact.length < 3) return null
  const country = vatCountryOf(compact.slice(0, 2))
  if (!(country in VAT_PATTERNS)) return null
  return { country, number: compact.slice(2) }
}

/** True when `number` has a possible shape for `countryCode`. */
export function isValidVatShape(countryCode: string, number: string): boolean {
  const country = vatCountryOf(countryCode)
  const pattern = VAT_PATTERNS[country]
  if (!pattern) return false
  const body = number.replace(/[\s.\-/]/g, "").toUpperCase()
  if (country === "ES") return isValidSpanishTaxId(body)
  return pattern.test(body)
}

/** True when a prefixed number such as `ESB12345674` has a possible shape. */
export function isValidEuVatNumber(raw: string): boolean {
  const parsed = parseVatNumber(raw)
  if (!parsed) return false
  return isValidVatShape(parsed.country, parsed.number)
}

/** `ES` + `B12345674` → `ESB12345674`. Used to build the VIES query. */
export function formatVatNumber(countryCode: string, number: string): string {
  return `${vatCountryOf(countryCode)}${number.replace(/[\s.\-/]/g, "").toUpperCase()}`
}
