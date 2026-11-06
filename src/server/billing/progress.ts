import {
  DELIVERY_SLA_HOURS,
  DELIVERY_TIMEOUT_HOURS,
  PROVISION_STEPS,
  deliveryState,
  formatCents,
  type Cents,
  type OrderStatus,
  type ProvisionStep,
} from "@ola/core"

import { resolveDeps } from "./deps"
import type { BillingDepsOverride } from "./ports"

/**
 * The order progress screen's view model.
 *
 * `orders.completedSteps` is the real provisioning state the job writes as it goes, so this
 * screen never shows a fake spinner. The eleven internal steps are grouped into five
 * phases the customer can actually read, and no provider name appears in any of them.
 */

export const PROGRESS_PHASES = [
  {
    key: "payment",
    label: "Confirmando el pago",
    steps: ["whmcs_client", "whmcs_order", "whmcs_invoice", "whmcs_payment"],
  },
  {
    key: "order",
    label: "Reservando los recursos",
    steps: ["ovh_cart", "ovh_configure", "ovh_price_check", "ovh_checkout"],
  },
  { key: "build", label: "Creando tu servidor", steps: ["ovh_delivery"] },
  { key: "install", label: "Configurando el sistema", steps: ["ovh_first_boot"] },
  { key: "ready", label: "Comprobando que todo arranca", steps: ["service_active"] },
] as const satisfies readonly {
  key: string
  label: string
  steps: readonly ProvisionStep[]
}[]

export type ProgressPhaseKey = (typeof PROGRESS_PHASES)[number]["key"]

export type PhaseState = "done" | "current" | "pending" | "stalled"

export interface ProgressPhase {
  key: ProgressPhaseKey
  label: string
  state: PhaseState
}

export interface OrderProgressView {
  orderId: string
  reference: string
  status: OrderStatus
  /** Spanish, one short sentence: what is happening right now. */
  headline: string
  /** Spanish, one sentence more: what the customer should expect or do. */
  detail: string
  phases: readonly ProgressPhase[]
  /** True while the page should keep polling. */
  live: boolean
  planName: string
  total: Cents
  totalLabel: string
  paidAt: Date | null
  deliveredAt: Date | null
  /** Set when OVH is slower than the SLA. */
  delivery: "on_time" | "late" | "timed_out" | null
  /** Technical reason, only when the order failed. Already customer-safe. */
  error: string | null
}

const UNKNOWN_PLAN = "OLA VPS"

function phasesFor(
  completed: readonly string[],
  status: OrderStatus,
): readonly ProgressPhase[] {
  const done = new Set(completed)
  const stalled = status === "failed" || status === "cancelled"
  let currentTaken = status === "failed" || status === "cancelled" || status === "delivered"

  return PROGRESS_PHASES.map((phase) => {
    const allDone = phase.steps.every((step) => done.has(step))
    if (allDone) return { key: phase.key, label: phase.label, state: "done" as PhaseState }
    if (stalled) return { key: phase.key, label: phase.label, state: "stalled" as PhaseState }
    if (!currentTaken) {
      currentTaken = true
      return { key: phase.key, label: phase.label, state: "current" as PhaseState }
    }
    return { key: phase.key, label: phase.label, state: "pending" as PhaseState }
  })
}

interface Copy {
  headline: string
  detail: string
}

function copyFor(status: OrderStatus, delivery: OrderProgressView["delivery"]): Copy {
  switch (status) {
    case "pending_payment":
      return {
        headline: "Pendiente de pago",
        detail: "Vuelve al paso de pago para terminar el pedido.",
      }
    case "paid":
      return {
        headline: "Pago recibido",
        detail: "Estamos empezando a crear tu servidor. No hace falta que hagas nada.",
      }
    case "provisioning":
      return {
        headline: "Creando tu servidor",
        detail: `Suele tardar unos minutos. Te avisamos por correo en cuanto esté listo.`,
      }
    case "delayed":
      return delivery === "timed_out"
        ? {
            headline: "El proveedor está tardando más de lo normal",
            detail: `Llevamos más de ${DELIVERY_TIMEOUT_HOURS} horas esperando la entrega. Nuestro equipo ya está revisándolo y te devolveremos el dinero si no podemos entregarlo.`,
          }
        : {
            headline: "Va con retraso",
            detail: `Normalmente tardamos menos de ${DELIVERY_SLA_HOURS} horas. Seguimos esperando la entrega y lo estamos vigilando.`,
          }
    case "delivered":
      return {
        headline: "Tu servidor está listo",
        detail: "Ya puedes entrar en el panel del servidor y empezar a usarlo.",
      }
    case "failed":
      return {
        headline: "No hemos podido completar el pedido",
        detail:
          "Hemos devuelto el importe a tu tarjeta. El banco suele tardar unos días en reflejarlo.",
      }
    case "cancelled":
      return { headline: "Pedido cancelado", detail: "No se ha cobrado nada." }
    default:
      return { headline: "Pedido en curso", detail: "Estamos trabajando en él." }
  }
}

export async function orderProgress(
  customerId: string,
  orderId: string,
  override: BillingDepsOverride = {},
): Promise<OrderProgressView | null> {
  const deps = await resolveDeps(override)
  const order = await deps.store.getOrder(orderId)
  // A missing order and someone else's order are the same answer: not found.
  if (!order || order.customerId !== customerId) return null

  const items = order.items as { planName?: unknown }
  const planName = typeof items.planName === "string" ? items.planName : UNKNOWN_PLAN

  const delivery =
    order.paidAt && order.status !== "delivered"
      ? deliveryState(order.paidAt, deps.now())
      : null

  const live =
    order.status === "paid" || order.status === "provisioning" || order.status === "delayed"

  return {
    orderId: order.id,
    reference: order.id.slice(-8).toUpperCase(),
    status: order.status,
    ...copyFor(order.status, delivery),
    phases: phasesFor(order.completedSteps, order.status),
    live,
    planName,
    total: order.total,
    totalLabel: formatCents(order.total),
    paidAt: order.paidAt,
    deliveredAt: order.deliveredAt,
    delivery,
    error: order.status === "failed" ? order.error : null,
  }
}

/** Every provisioning step, for the admin view. Not shown to a customer. */
export const ALL_PROVISION_STEPS: readonly ProvisionStep[] = PROVISION_STEPS
