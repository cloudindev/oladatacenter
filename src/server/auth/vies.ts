import "server-only"
import { formatVatNumber, isValidVatShape, vatCountryOf } from "@ola/core/identity/index"

/**
 * VIES VAT number check.
 *
 * VIES is a façade over 27 national registries and is regularly slow or partly down, so
 * this is best-effort by design: a 5 s budget, no retry, and an "unavailable" verdict
 * that leaves `customers.tax_id_validated` false. Only a `valid` answer may set it,
 * because that flag decides reverse charge and therefore how much VAT we collect.
 *
 * The REST endpoint is used instead of the SOAP one: same data, no XML.
 */

const VIES_ENDPOINT = "https://ec.europa.eu/taxation_customs/vies/rest-api/ms"
const TIMEOUT_MS = 5000

export type ViesStatus = "valid" | "invalid" | "unavailable" | "bad_shape"

export interface ViesResult {
  status: ViesStatus
  /** Registered name, when the member state publishes it. */
  name: string | null
  address: string | null
  /** The number exactly as queried, e.g. `ESB12345674`. */
  queried: string
  checkedAt: Date
  /** Why the check could not conclude. Logged and shown only in /admin. */
  detail?: string
}

interface ViesResponse {
  valid?: boolean
  name?: string | null
  address?: string | null
  userError?: string | null
}

/**
 * Checks one VAT number. Never throws: a network failure, a timeout or a malformed
 * answer all come back as `unavailable`, and the caller leaves the number unvalidated.
 */
export async function checkVies(countryCode: string, vatNumber: string): Promise<ViesResult> {
  const country = vatCountryOf(countryCode)
  const number = vatNumber.replace(/[\s.\-/]/g, "").toUpperCase()
  const queried = formatVatNumber(country, number)
  const checkedAt = new Date()

  // A number that cannot exist is never sent to VIES: it would just burn the budget.
  if (!isValidVatShape(country, number)) {
    return { status: "bad_shape", name: null, address: null, queried, checkedAt }
  }

  try {
    const response = await fetch(
      `${VIES_ENDPOINT}/${encodeURIComponent(country)}/vat/${encodeURIComponent(number)}`,
      {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    )

    if (!response.ok) {
      return {
        status: "unavailable",
        name: null,
        address: null,
        queried,
        checkedAt,
        detail: `vies http ${response.status}`,
      }
    }

    const payload = (await response.json()) as ViesResponse
    if (payload.userError && payload.userError !== "VALID" && payload.userError !== "INVALID") {
      // MS_UNAVAILABLE, MS_MAX_CONCURRENT_REQ, TIMEOUT, SERVICE_UNAVAILABLE, …
      return {
        status: "unavailable",
        name: null,
        address: null,
        queried,
        checkedAt,
        detail: payload.userError,
      }
    }
    if (payload.valid !== true) {
      return { status: "invalid", name: null, address: null, queried, checkedAt }
    }
    return {
      status: "valid",
      name: cleanField(payload.name),
      address: cleanField(payload.address),
      queried,
      checkedAt,
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.warn("[vies] check failed", { queried, detail })
    return { status: "unavailable", name: null, address: null, queried, checkedAt, detail }
  }
}

/** VIES pads missing values with `---`. */
function cleanField(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (trimmed.length === 0 || /^-+$/.test(trimmed)) return null
  return trimmed
}

/**
 * Spain is the only country where we accept a tax id without a VIES answer: a NIF or a
 * NIE belonging to an individual is not in VIES at all, and those customers pay Spanish
 * VAT anyway, so nothing depends on the flag for them.
 */
export function viesAppliesTo(kind: "company" | "individual", country: string | null): boolean {
  if (kind === "individual") return false
  return country !== null && country.length === 2
}
