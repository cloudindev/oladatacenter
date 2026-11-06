/**
 * Phone number shape. Pure: E.164 only, no carrier lookup and no region database.
 */

const E164_RE = /^\+[1-9][0-9]{6,14}$/

/** Strips spaces, dashes, dots and brackets; turns a leading `00` into `+`. */
export function normalizePhone(raw: string, defaultCountryPrefix = "+34"): string {
  let value = raw.replace(/[\s.\-()/]/g, "")
  if (value.startsWith("00")) value = `+${value.slice(2)}`
  if (!value.startsWith("+")) value = `${defaultCountryPrefix}${value}`
  return value
}

export function isValidPhone(raw: string): boolean {
  return E164_RE.test(raw)
}

/** Normalises and validates in one step. Returns `null` when unusable. */
export function parsePhone(raw: string, defaultCountryPrefix = "+34"): string | null {
  const normalized = normalizePhone(raw, defaultCountryPrefix)
  return isValidPhone(normalized) ? normalized : null
}

/** `+34600123456` → `+34 ··· 456`. Safe to show in the UI and in audit diffs. */
export function maskPhone(phone: string): string {
  if (phone.length < 6) return "···"
  return `${phone.slice(0, 3)} ··· ${phone.slice(-3)}`
}
