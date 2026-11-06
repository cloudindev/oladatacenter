/**
 * Stripe decline codes translated into something the dunning job can act on.
 *
 * The distinction that matters is `retryable`: a soft decline (no funds today, issuer
 * temporarily unavailable) is worth the scheduled retry, while a hard decline (stolen card,
 * card not supported) is not — retrying it only annoys the issuer and the customer.
 */
import { StripeGatewayError } from "./types"

export const PAYMENT_FAILURE_REASONS = [
  "no_payment_method",
  "card_declined",
  "insufficient_funds",
  "expired_card",
  "incorrect_details",
  "authentication_required",
  "processing_error",
  "amount_invalid",
  /** Nothing to charge: the renewal invoice has not been issued yet. */
  "no_invoice",
  /** The service is in a state we must not charge (terminated, cancelled). */
  "not_chargeable",
  "unknown",
] as const
export type PaymentFailureReason = (typeof PAYMENT_FAILURE_REASONS)[number]

export interface PaymentFailure {
  reason: PaymentFailureReason
  /** True when the scheduled dunning retry has a realistic chance of succeeding. */
  retryable: boolean
  /** True when the charge needs the customer present for a 3DS challenge. */
  requiresAction: boolean
  /** Stripe's own code, kept for the admin view and the audit row. */
  stripeCode: string | null
  stripeDeclineCode: string | null
  /** Spanish, safe to show the customer. */
  customerMessage: string
}

const MESSAGES: Readonly<Record<PaymentFailureReason, string>> = {
  no_payment_method: "No hay ninguna tarjeta guardada para cobrar.",
  card_declined: "El banco ha rechazado el cargo.",
  insufficient_funds: "La tarjeta no tiene saldo suficiente.",
  expired_card: "La tarjeta ha caducado.",
  incorrect_details: "Los datos de la tarjeta no son correctos.",
  authentication_required: "El banco pide autenticación para completar el cargo.",
  processing_error: "Ha habido un problema al procesar el cargo. Lo reintentaremos.",
  amount_invalid: "El importe del cargo no es válido.",
  no_invoice: "Todavía no hay una factura de renovación que cobrar.",
  not_chargeable: "Este servidor no admite cobros con su estado actual.",
  unknown: "No hemos podido completar el cobro con tu tarjeta.",
}

/** Decline codes that go away on their own. Everything else is treated as hard. */
const SOFT_DECLINE_CODES: ReadonlySet<string> = new Set([
  "generic_decline",
  "insufficient_funds",
  "try_again_later",
  "processing_error",
  "issuer_not_available",
  "approve_with_id",
  "card_velocity_exceeded",
  "withdrawal_count_limit_exceeded",
  "authentication_required",
])

function reasonFor(code: string | null, declineCode: string | null): PaymentFailureReason {
  if (declineCode === "insufficient_funds") return "insufficient_funds"
  if (declineCode === "expired_card" || code === "expired_card") return "expired_card"
  if (code === "authentication_required" || declineCode === "authentication_required") {
    return "authentication_required"
  }
  if (code === "incorrect_cvc" || code === "incorrect_number" || code === "invalid_cvc") {
    return "incorrect_details"
  }
  if (code === "processing_error") return "processing_error"
  if (code === "card_declined") return "card_declined"
  if (code?.startsWith("parameter_invalid") || code === "amount_too_small") return "amount_invalid"
  return "unknown"
}

/** Classifies anything thrown while charging. Never looks at the card itself. */
export function classifyPaymentFailure(error: unknown): PaymentFailure {
  if (!(error instanceof StripeGatewayError)) {
    return {
      reason: "unknown",
      retryable: true,
      requiresAction: false,
      stripeCode: null,
      stripeDeclineCode: null,
      customerMessage: MESSAGES.unknown,
    }
  }

  const reason = reasonFor(error.code, error.declineCode)
  const requiresAction = reason === "authentication_required"
  const retryable =
    reason === "processing_error" ||
    reason === "insufficient_funds" ||
    (error.declineCode !== null && SOFT_DECLINE_CODES.has(error.declineCode)) ||
    (error.declineCode === null && error.code === null)

  return {
    reason,
    retryable,
    requiresAction,
    stripeCode: error.code,
    stripeDeclineCode: error.declineCode,
    customerMessage: MESSAGES[reason],
  }
}

/**
 * A failure that did not come from Stripe at all: no card on file, no invoice yet, a
 * service we must not charge. The dunning job reads the same shape either way.
 */
export function localFailure(
  reason: PaymentFailureReason,
  options: { retryable?: boolean; requiresAction?: boolean } = {},
): PaymentFailure {
  return {
    reason,
    retryable: options.retryable ?? false,
    requiresAction: options.requiresAction ?? false,
    stripeCode: null,
    stripeDeclineCode: null,
    customerMessage: MESSAGES[reason],
  }
}

/** The failure used when the customer simply has no usable card on file. */
export function noPaymentMethodFailure(): PaymentFailure {
  return localFailure("no_payment_method")
}

export function paymentFailureMessage(reason: PaymentFailureReason): string {
  return MESSAGES[reason]
}
