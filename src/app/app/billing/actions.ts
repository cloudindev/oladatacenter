"use server"

import { revalidatePath } from "next/cache"

import { customerMessageFor } from "@ola/core"
import { requireUser } from "@/server/auth/session"
import {
  confirmCardSetup,
  detachPaymentMethod,
  setDefaultPaymentMethod,
  startCardSetup,
} from "@/server/billing"

/**
 * Server Actions for the billing area.
 *
 * Reachable by a direct POST, so each one re-authenticates and passes the session's own
 * customer id — a card id from the request is only ever used to look up a row that must
 * already belong to that customer.
 */

export type BillingActionResult = { ok: true } | { ok: false; message: string }

export type CardSetupResult =
  | { ok: true; setupIntentId: string; clientSecret: string }
  | { ok: false; message: string }

export async function beginCardSetupHere(): Promise<CardSetupResult> {
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

export async function storeCardHere(setupIntentId: string): Promise<BillingActionResult> {
  const session = await requireUser()
  if (!session.customer) {
    return { ok: false, message: "Necesitas completar tu cuenta antes de añadir una tarjeta." }
  }
  try {
    const method = await confirmCardSetup(setupIntentId)
    if (method.customerId !== session.customer.id) {
      return { ok: false, message: "Esta tarjeta no pertenece a tu cuenta." }
    }
    revalidatePath("/app/billing")
    return { ok: true }
  } catch (error) {
    return { ok: false, message: customerMessageFor(error) }
  }
}

export async function makeCardDefault(paymentMethodId: string): Promise<BillingActionResult> {
  const session = await requireUser()
  if (!session.customer) return { ok: false, message: "Tu cuenta no está completa." }
  try {
    await setDefaultPaymentMethod(session.customer.id, paymentMethodId)
    revalidatePath("/app/billing")
    return { ok: true }
  } catch (error) {
    return { ok: false, message: customerMessageFor(error) }
  }
}

export async function removeCard(paymentMethodId: string): Promise<BillingActionResult> {
  const session = await requireUser()
  if (!session.customer) return { ok: false, message: "Tu cuenta no está completa." }
  try {
    await detachPaymentMethod(session.customer.id, paymentMethodId)
    revalidatePath("/app/billing")
    return { ok: true }
  } catch (error) {
    // The "no puedes quitar la última tarjeta" case lands here with its own message.
    return { ok: false, message: customerMessageFor(error) }
  }
}
