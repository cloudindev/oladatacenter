import { createHash } from "node:crypto"

/**
 * OVH request signing.
 *
 *   signature = "$1$" + sha1Hex(
 *     appSecret + "+" + consumerKey + "+" + METHOD + "+" + fullUrl + "+" + body + "+" + timestamp
 *   )
 *
 * `fullUrl` is the absolute URL including the query string; `body` is the exact serialised
 * request body, or the empty string when there is none. The timestamp is in seconds and
 * must match OVH's clock, which is why a skew offset is read once from `GET /auth/time`.
 */

/** API endpoints we support. Verified hosts, 2026-11-05. */
export const OVH_ENDPOINTS: Readonly<Record<string, string>> = {
  "ovh-eu": "https://eu.api.ovh.com/1.0",
  "ovh-ca": "https://ca.api.ovh.com/1.0",
  "ovh-us": "https://api.us.ovhcloud.com/1.0",
  "kimsufi-eu": "https://eu.api.kimsufi.com/1.0",
  "kimsufi-ca": "https://ca.api.kimsufi.com/1.0",
  "soyoustart-eu": "https://eu.api.soyoustart.com/1.0",
  "soyoustart-ca": "https://ca.api.soyoustart.com/1.0",
}

export class OvhEndpointError extends Error {}

/** Resolve an endpoint name ("ovh-eu") or a full base URL to a base URL without a trailing slash. */
export function resolveEndpoint(endpoint: string): string {
  const known = OVH_ENDPOINTS[endpoint]
  if (known) return known
  if (/^https?:\/\//.test(endpoint)) return endpoint.replace(/\/+$/, "")
  throw new OvhEndpointError(`unknown OVH endpoint: ${endpoint}`)
}

export interface SignatureInput {
  applicationSecret: string
  consumerKey: string
  method: string
  /** Absolute URL, query string included. */
  url: string
  /** Serialised body, or "" when the request has none. */
  body: string
  /** Unix timestamp in seconds, already corrected for clock skew. */
  timestamp: number
}

export function ovhSignature(input: SignatureInput): string {
  const payload = [
    input.applicationSecret,
    input.consumerKey,
    input.method.toUpperCase(),
    input.url,
    input.body,
    String(input.timestamp),
  ].join("+")
  return `$1$${createHash("sha1").update(payload, "utf8").digest("hex")}`
}

export interface SignedHeadersInput extends Omit<SignatureInput, "applicationSecret"> {
  applicationKey: string
  applicationSecret: string
}

/** The four signing headers. Never log these: the signature is derived from the secret. */
export function signedHeaders(input: SignedHeadersInput): Record<string, string> {
  return {
    "X-Ovh-Application": input.applicationKey,
    "X-Ovh-Consumer": input.consumerKey,
    "X-Ovh-Timestamp": String(input.timestamp),
    "X-Ovh-Signature": ovhSignature(input),
  }
}

/* -------------------------------------------------------------------------- */
/* clock skew                                                                 */
/* -------------------------------------------------------------------------- */

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export interface ClockSkewInput {
  baseUrl: string
  fetchImpl: FetchLike
  /** Local wall clock in milliseconds. */
  now: () => number
}

/**
 * Module-level cache on purpose: the offset belongs to the process, not to one client
 * instance, and one `GET /auth/time` per process is the whole point.
 */
let cachedSkewSeconds: number | null = null
let inFlight: Promise<number> | null = null

/** Drop the cached offset. Tests call this between cases. */
export function resetClockSkew(): void {
  cachedSkewSeconds = null
  inFlight = null
}

/** The cached offset, or null when it has not been fetched yet. */
export function peekClockSkew(): number | null {
  return cachedSkewSeconds
}

/**
 * Seconds to add to the local clock to match OVH's.
 *
 * `GET /auth/time` is unauthenticated and answers with a bare unix timestamp as plain
 * text. A failure is not fatal — we fall back to a zero offset and do not cache it, so
 * the next call tries again. Signing with a local clock still works whenever the machine
 * is roughly on time, and failing the whole request here would be worse.
 */
export async function clockSkewSeconds(input: ClockSkewInput): Promise<number> {
  if (cachedSkewSeconds !== null) return cachedSkewSeconds
  if (inFlight) return inFlight

  const pending = (async () => {
    const response = await input.fetchImpl(`${input.baseUrl}/auth/time`, { method: "GET" })
    if (!response.ok) throw new Error(`GET /auth/time returned ${response.status}`)
    const serverSeconds = Number.parseInt((await response.text()).trim(), 10)
    if (!Number.isFinite(serverSeconds)) throw new Error("GET /auth/time returned a non-numeric body")
    const skew = serverSeconds - Math.floor(input.now() / 1000)
    cachedSkewSeconds = skew
    return skew
  })()

  inFlight = pending.catch(() => 0)
  try {
    return await pending
  } catch {
    return 0
  } finally {
    inFlight = null
  }
}

/** The timestamp to sign with: local clock in seconds, corrected by the cached offset. */
export async function signingTimestamp(input: ClockSkewInput): Promise<number> {
  const skew = await clockSkewSeconds(input)
  return Math.floor(input.now() / 1000) + skew
}
