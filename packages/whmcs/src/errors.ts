import { DomainError } from "@ola/core"

/** Why the call failed. Drives `retryable` and the admin-facing detail line. */
export type WhmcsErrorKind =
  /** WHMCS answered `result: "error"` with a message. */
  | "api_error"
  /** Transport failed: DNS, TLS, connection reset, proxy down. */
  | "network"
  /** The request exceeded our own deadline. */
  | "timeout"
  /** HTTP 5xx from WHMCS or from the fixed-IP proxy. */
  | "server_error"
  /** HTTP 4xx: bad credentials, IP not allowlisted, unknown action. */
  | "client_error"
  /** Body was not JSON, or did not match the schema for the action. */
  | "invalid_response"
  /** `WHMCS_WRITE_ENABLED` is false and the method would have written. */
  | "writes_disabled"

export interface WhmcsApiErrorOptions {
  action: string
  kind: WhmcsErrorKind
  httpStatus?: number
  correlationId?: string
  cause?: unknown
}

/**
 * Every failure leaving this package is a `WhmcsApiError`. It carries the WHMCS message, the
 * action name and the HTTP status for the logs and for /admin — and nothing else: the message
 * may quote WHMCS verbatim, so it must never be rendered to a customer. Use `toDomainError()`
 * at the service boundary to get the Spanish customer-safe message.
 */
export class WhmcsApiError extends Error {
  readonly action: string
  readonly kind: WhmcsErrorKind
  readonly httpStatus?: number
  readonly correlationId?: string
  readonly retryable: boolean

  constructor(message: string, options: WhmcsApiErrorOptions) {
    super(message, { cause: options.cause })
    this.name = "WhmcsApiError"
    this.action = options.action
    this.kind = options.kind
    this.httpStatus = options.httpStatus
    this.correlationId = options.correlationId
    this.retryable = isRetryableKind(options.kind, options.httpStatus)
  }

  /**
   * The only representation that may cross into customer-facing code. The technical detail
   * stays in `detail`, which the UI never renders.
   */
  toDomainError(): DomainError {
    return new DomainError("billing_unavailable", {
      detail: this.detail,
      retryable: this.retryable,
      cause: this,
    })
  }

  /** One-line technical summary for logs and /admin. Never contains credentials. */
  get detail(): string {
    const status = this.httpStatus === undefined ? "" : ` http=${this.httpStatus}`
    const correlation = this.correlationId === undefined ? "" : ` cid=${this.correlationId}`
    return `whmcs ${this.action} ${this.kind}${status}${correlation}: ${this.message}`
  }

  toJSON() {
    return {
      name: this.name,
      action: this.action,
      kind: this.kind,
      httpStatus: this.httpStatus,
      correlationId: this.correlationId,
      retryable: this.retryable,
      message: this.message,
    }
  }
}

/**
 * 5xx, network failures and timeouts are worth another attempt. A `result: "error"` from
 * WHMCS is a deliberate refusal (bad data, duplicate, unknown id) and never is.
 */
function isRetryableKind(kind: WhmcsErrorKind, httpStatus?: number): boolean {
  switch (kind) {
    case "network":
    case "timeout":
    case "server_error":
      return true
    case "invalid_response":
      // A truncated or HTML body behind a 5xx is the same outage in different clothing.
      return httpStatus !== undefined && httpStatus >= 500
    case "api_error":
    case "client_error":
    case "writes_disabled":
      return false
  }
}

export function isWhmcsApiError(error: unknown): error is WhmcsApiError {
  return error instanceof WhmcsApiError
}

/** Thrown instead of calling the API when `writeEnabled` is false. */
export function writesDisabledError(action: string): WhmcsApiError {
  return new WhmcsApiError(
    `WHMCS writes are disabled: ${action} was not sent. Set WHMCS_WRITE_ENABLED=true to allow it.`,
    { action, kind: "writes_disabled" },
  )
}

/** Maps any thrown value to a customer-safe `DomainError`. */
export function toBillingDomainError(error: unknown): DomainError {
  if (isWhmcsApiError(error)) return error.toDomainError()
  if (error instanceof DomainError) return error
  return new DomainError("billing_unavailable", {
    detail: error instanceof Error ? error.message : String(error),
    cause: error,
  })
}
