"use server"

import { customerMessageFor } from "@ola/core"
import { requireUser } from "@/server/auth/session"
import {
  confirmCardSetup,
  createOrderDraft,
  payOrder,
  startCardSetup,
} from "@/server/billing"
import { confirmPendingPayment } from "@/server/billing/checkout"
import { orderProgress, type OrderProgressView } from "@/server/billing/progress"
import { clearPendingOrder } from "@/server/pending-order"

/**
 * Server Actions for the checkout.
 *
 * A Server Action is reachable by a direct POST, not only through our own UI, so every one
 * of these re-authenticates with `requireUser()` and re-prices on the server. Nothing the
 * browser sends about money is read: the only thing that crosses is the configuration of
 * slugs, and `createOrderDraft` validates even that with zod before pricing it.
 *
 * Every action returns a plain, serialisable object instead of throwing, so the form can
 * show a Spanish message rather than Next.js's error boundary.
 */

export type CheckoutActionResult =
  | { ok: true; status: "paid"; orderId: string }
  | { ok: true; status: "requires_action"; orderId: string; clientSecret: string }
  | { ok: false; message: string }

/** Validates, prices, creates the order and charges it. One call, one order. */
export async function startCheckout(configuration: unknown): Promise<CheckoutActionResult> {
  const session = await requireUser()
  if (!session.customer) {
    return { ok: false, message: "Necesitas completar tu cuenta antes de contratar." }
  }

  try {
    const order = await createOrderDraft(
      { user: { id: session.user.id, email: session.user.email }, customer: session.customer },
      configuration,
    )
    // The order exists now: the "a medio contratar" reminder has done its job.
    await clearPendingOrder()
    const result = await payOrder(order.id)

    if (result.status === "paid") return { ok: true, status: "paid", orderId: order.id }
    if (result.status === "requires_action") {
      return {
        ok: true,
        status: "requires_action",
        orderId: order.id,
        clientSecret: result.clientSecret,
      }
    }
    return { ok: false, message: result.failure.customerMessage }
  } catch (error) {
    return { ok: false, message: customerMessageFor(error) }
  }
}

/** Called once the browser finished the 3D Secure challenge. */
export async function finishCheckout(orderId: string): Promise<CheckoutActionResult> {
  const session = await requireUser()
  if (!session.customer) {
    return { ok: false, message: "Necesitas completar tu cuenta antes de contratar." }
  }

  try {
    const progress = await orderProgress(session.customer.id, orderId)
    if (!progress) return { ok: false, message: "No encontramos este pedido." }

    const result = await confirmPendingPayment(orderId)
    if (result.status === "paid") return { ok: true, status: "paid", orderId }
    if (result.status === "requires_action") {
      return { ok: true, status: "requires_action", orderId, clientSecret: result.clientSecret }
    }
    return { ok: false, message: result.failure.customerMessage }
  } catch (error) {
    return { ok: false, message: customerMessageFor(error) }
  }
}

export type CardSetupActionResult =
  | { ok: true; setupIntentId: string; clientSecret: string }
  | { ok: false; message: string }

/** Starts a 3DS-authenticated card setup. The secret authorises this intent only. */
export async function beginCardSetup(): Promise<CardSetupActionResult> {
  const session = await requireUser()
  if (!session.customer) {
    return { ok: false, message: "Necesitas completar tu cuenta antes de añadir una tarjeta." }
  }
  try {
    const ticket = await startCardSetup(session.customer.id)
    return { ok: true, setupIntentId: ticket.setupIntentId, clientSecret: ticket.clientSecret }
  } catch (error) {
    return { ok: false, message: customerMessageFor(error) }
  }
}

export type CardStoredResult =
  | { ok: true; brand: string | null; last4: string | null }
  | { ok: false; message: string }

/**
 * Persists the card once the SetupIntent succeeded. Idempotent, and the
 * `setup_intent.succeeded` webhook calls the same function, so a browser that closed
 * mid-flow still ends up with its card on file.
 */
export async function storeCard(setupIntentId: string): Promise<CardStoredResult> {
  const session = await requireUser()
  if (!session.customer) {
    return { ok: false, message: "Necesitas completar tu cuenta antes de añadir una tarjeta." }
  }
  try {
    const method = await confirmCardSetup(setupIntentId)
    if (method.customerId !== session.customer.id) {
      return { ok: false, message: "Esta tarjeta no pertenece a tu cuenta." }
    }
    return { ok: true, brand: method.brand, last4: method.last4 }
  } catch (error) {
    return { ok: false, message: customerMessageFor(error) }
  }
}

/** Polled by the order progress screen. Returns `null` for an order that is not yours. */
export async function readOrderProgress(orderId: string): Promise<OrderProgressView | null> {
  const session = await requireUser()
  if (!session.customer) return null
  return orderProgress(session.customer.id, orderId)
}
