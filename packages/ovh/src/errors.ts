import { DomainError, type ErrorCode } from "@ola/core"

/** Why a call failed, before we know what it means for the domain. */
export type OvhFailureKind =
  /** OVH answered with a non-2xx status. */
  | "http"
  /** fetch itself failed: DNS, TLS, socket, abort, timeout. */
  | "network"
  /** OVH answered 2xx but the payload did not match the schema. */
  | "schema"

export interface OvhApiErrorInit {
  kind: OvhFailureKind
  method: string
  path: string
  httpStatus?: number | null
  ovhErrorCode?: string | null
  /** OVH's own message. Technical, never shown to a customer. */
  detail?: string | null
  correlationId?: string | null
  attempts?: number
  cause?: unknown
}

/**
 * Everything the OVH adapter throws. It carries enough context for the admin panel and
 * the logs, and nothing that could leak a secret: the signature, keys and request body
 * are never stored on it.
 */
export class OvhApiError extends Error {
  readonly kind: OvhFailureKind
  readonly method: string
  readonly path: string
  readonly httpStatus: number | null
  readonly ovhErrorCode: string | null
  readonly detail: string | null
  readonly correlationId: string | null
  readonly attempts: number
  readonly retryable: boolean

  constructor(init: OvhApiErrorInit) {
    const status = init.httpStatus ?? null
    super(`OVH ${init.method} ${init.path} failed (${init.kind}${status ? ` ${status}` : ""})`, {
      cause: init.cause,
    })
    this.name = "OvhApiError"
    this.kind = init.kind
    this.method = init.method
    this.path = init.path
    this.httpStatus = status
    this.ovhErrorCode = init.ovhErrorCode ?? null
    this.detail = init.detail ?? null
    this.correlationId = init.correlationId ?? null
    this.attempts = init.attempts ?? 1
    this.retryable = isRetryableFailure(init.kind, status)
  }

  toJSON() {
    return {
      name: this.name,
      kind: this.kind,
      method: this.method,
      path: this.path,
      httpStatus: this.httpStatus,
      ovhErrorCode: this.ovhErrorCode,
      correlationId: this.correlationId,
      attempts: this.attempts,
      retryable: this.retryable,
    }
  }
}

export function isOvhApiError(error: unknown): error is OvhApiError {
  return error instanceof OvhApiError
}

/**
 * Retry policy: 429 and 5xx are transient, every other 4xx is our own fault and will
 * fail again identically. Network failures are always retryable — note the caller still
 * decides whether the *operation* may be repeated (a checkout may not).
 */
export function isRetryableFailure(kind: OvhFailureKind, httpStatus: number | null): boolean {
  if (kind === "network") return true
  if (kind === "schema") return false
  if (httpStatus === null) return false
  if (httpStatus === 429) return true
  return httpStatus >= 500
}

export function isRetryableStatus(httpStatus: number): boolean {
  return isRetryableFailure("http", httpStatus)
}

/**
 * OVH error codes that mean "the price you were shown is no longer the price".
 * Verified against the checkout error payloads we handle; anything else falls through
 * to provider_rejected rather than silently pretending a price changed.
 */
const PRICE_MISMATCH_CODES = new Set([
  "PRICE_MISMATCH",
  "INVALID_PRICE",
  "ORDER_PRICE_CHANGED",
])

function looksLikePriceMismatch(error: OvhApiError): boolean {
  if (error.ovhErrorCode && PRICE_MISMATCH_CODES.has(error.ovhErrorCode)) return true
  if (error.httpStatus !== 400 && error.httpStatus !== 409) return false
  return error.detail !== null && /\bprice\b/i.test(error.detail)
}

function codeFor(error: OvhApiError): ErrorCode {
  if (looksLikePriceMismatch(error)) return "price_mismatch"
  if (error.kind === "network") return "provider_unavailable"
  if (error.kind === "schema") return "provider_rejected"
  if (error.httpStatus === null) return "provider_unavailable"
  if (error.httpStatus === 429 || error.httpStatus >= 500) return "provider_unavailable"
  return "provider_rejected"
}

/**
 * Translate an adapter failure into the domain error the rest of the app handles.
 * OVH's raw message only ever travels in `detail`, which is admin/log-only.
 */
export function toDomainError(error: unknown): DomainError {
  if (error instanceof DomainError) return error

  if (isOvhApiError(error)) {
    const parts = [
      `${error.method} ${error.path}`,
      error.httpStatus === null ? error.kind : `status ${error.httpStatus}`,
      error.ovhErrorCode ? `code ${error.ovhErrorCode}` : null,
      error.detail,
    ].filter((part): part is string => typeof part === "string" && part.length > 0)

    return new DomainError(codeFor(error), {
      detail: parts.join(" · "),
      retryable: error.retryable,
      cause: error,
    })
  }

  return new DomainError("provider_unavailable", {
    detail: error instanceof Error ? error.message : String(error),
    retryable: true,
    cause: error,
  })
}
