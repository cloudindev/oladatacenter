/**
 * Spanish tax identifier validation. Pure: format and checksum only, no network.
 *
 * A valid *format* never means the identifier exists. Only a VIES check can say that,
 * and that check lives in the app layer (`src/server/auth/vies.ts`).
 */

export type SpanishTaxIdKind = "nif" | "nie" | "cif"

/** Control letter table for NIF and NIE (mod 23). */
const NIF_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE"

/** Control letter table for CIF (the control digit mapped to a letter). */
const CIF_LETTERS = "JABCDEFGHI"

/** CIF organisation types whose control character must be a letter. */
const CIF_LETTER_ONLY = "KLMNPQRSW"
/** CIF organisation types whose control character must be a digit. */
const CIF_DIGIT_ONLY = "ABEH"
/** CIF organisation types that accept either. */
const CIF_EITHER = "CDFGJUV"

const NIF_RE = /^[0-9]{8}[A-Z]$/
const NIE_RE = /^[XYZ][0-9]{7}[A-Z]$/
const CIF_RE = /^[A-HJ-NP-SUVW][0-9]{7}[0-9A-J]$/

/**
 * Upper-cases and strips spaces, dots and dashes. Also drops a leading `ES`
 * country prefix so a VAT number and a NIF can be fed to the same validator.
 */
export function normalizeTaxId(raw: string): string {
  const compact = raw.replace(/[\s.\-/]/g, "").toUpperCase()
  return compact.startsWith("ES") && compact.length > 9 ? compact.slice(2) : compact
}

function nifControlLetter(numberPart: number): string {
  return NIF_LETTERS[numberPart % 23] as string
}

/** 8 digits plus the mod-23 control letter. */
export function isValidNif(raw: string): boolean {
  const value = normalizeTaxId(raw)
  if (!NIF_RE.test(value)) return false
  const digits = Number.parseInt(value.slice(0, 8), 10)
  return nifControlLetter(digits) === value[8]
}

/** X/Y/Z plus 7 digits plus the mod-23 control letter (X→0, Y→1, Z→2). */
export function isValidNie(raw: string): boolean {
  const value = normalizeTaxId(raw)
  if (!NIE_RE.test(value)) return false
  const prefix = "XYZ".indexOf(value[0] as string)
  const digits = Number.parseInt(`${prefix}${value.slice(1, 8)}`, 10)
  return nifControlLetter(digits) === value[8]
}

/**
 * Organisation identifier: an organisation-type letter, 7 digits and a control
 * character. Odd positions are doubled and their digits summed, even positions are
 * added as they are; the control is `(10 - total % 10) % 10`, rendered as a digit or
 * as a letter depending on the organisation type.
 */
export function isValidCif(raw: string): boolean {
  const value = normalizeTaxId(raw)
  if (!CIF_RE.test(value)) return false

  const type = value[0] as string
  const body = value.slice(1, 8)
  const control = value[8] as string

  let total = 0
  for (let index = 0; index < 7; index += 1) {
    const digit = Number.parseInt(body[index] as string, 10)
    if (index % 2 === 0) {
      // 1-based odd position: double and sum the digits of the result.
      const doubled = digit * 2
      total += Math.floor(doubled / 10) + (doubled % 10)
    } else {
      total += digit
    }
  }

  const controlDigit = (10 - (total % 10)) % 10
  const controlLetter = CIF_LETTERS[controlDigit] as string

  if (CIF_LETTER_ONLY.includes(type)) return control === controlLetter
  if (CIF_DIGIT_ONLY.includes(type)) return control === String(controlDigit)
  if (CIF_EITHER.includes(type)) {
    return control === controlLetter || control === String(controlDigit)
  }
  return false
}

/** Which kind of Spanish identifier this is, or `null` when it is not valid. */
export function classifySpanishTaxId(raw: string): SpanishTaxIdKind | null {
  if (isValidNif(raw)) return "nif"
  if (isValidNie(raw)) return "nie"
  if (isValidCif(raw)) return "cif"
  return null
}

export function isValidSpanishTaxId(raw: string): boolean {
  return classifySpanishTaxId(raw) !== null
}

/**
 * The identifier a customer of the given kind is expected to hold. A company must
 * present a CIF; an individual a NIF or a NIE.
 */
export function taxIdMatchesCustomerKind(
  raw: string,
  kind: "company" | "individual",
): boolean {
  const classified = classifySpanishTaxId(raw)
  if (classified === null) return false
  return kind === "company" ? classified === "cif" : classified !== "cif"
}
