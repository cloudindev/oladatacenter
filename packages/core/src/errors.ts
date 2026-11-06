/**
 * Domain errors carry a stable `code` and a Spanish message meant for the customer.
 * Technical detail goes in `detail` and is only ever shown in /admin and the logs.
 */
export type ErrorCode =
  | "catalog_out_of_sync"
  | "price_mismatch"
  | "provider_unavailable"
  | "provider_rejected"
  | "billing_unavailable"
  | "payment_failed"
  | "not_verified"
  | "limit_reached"
  | "action_not_allowed"
  | "service_not_found"
  | "conflict"
  | "internal"

const CUSTOMER_MESSAGES: Record<ErrorCode, string> = {
  catalog_out_of_sync: "Este plan no está disponible ahora mismo. Inténtalo en unos minutos.",
  price_mismatch:
    "El precio ha cambiado mientras preparábamos tu pedido. Vuelve a cargar la página para ver el importe actualizado.",
  provider_unavailable:
    "No hemos podido contactar con el proveedor de infraestructura. Lo estamos reintentando.",
  provider_rejected: "El proveedor ha rechazado la operación. Nuestro equipo ya está avisado.",
  billing_unavailable: "No hemos podido emitir la factura. Lo estamos reintentando.",
  payment_failed: "No hemos podido completar el cobro con tu tarjeta.",
  not_verified: "Necesitas terminar de verificar tu cuenta antes de continuar.",
  limit_reached: "Has alcanzado el límite de tu cuenta.",
  action_not_allowed: "Esta acción no está disponible con el estado actual del servidor.",
  service_not_found: "No encontramos este servidor.",
  conflict: "Hay otra operación en curso sobre este servidor. Espera a que termine.",
  internal: "Algo ha ido mal por nuestra parte. Nuestro equipo ya está avisado.",
}

export class DomainError extends Error {
  readonly code: ErrorCode
  readonly detail?: string
  readonly retryable: boolean

  constructor(code: ErrorCode, options: { detail?: string; retryable?: boolean; cause?: unknown } = {}) {
    super(CUSTOMER_MESSAGES[code], { cause: options.cause })
    this.name = "DomainError"
    this.code = code
    this.detail = options.detail
    this.retryable = options.retryable ?? false
  }

  /** Safe to render in the customer UI. */
  get customerMessage(): string {
    return CUSTOMER_MESSAGES[this.code]
  }

  toJSON() {
    return { code: this.code, message: this.customerMessage, retryable: this.retryable }
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError
}

export function customerMessageFor(error: unknown): string {
  return isDomainError(error) ? error.customerMessage : CUSTOMER_MESSAGES.internal
}
