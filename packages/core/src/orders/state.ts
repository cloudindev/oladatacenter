import { z } from "zod"

/**
 * Order lifecycle. Every transition is explicit; anything else throws.
 *
 *   draft -> pending_payment -> paid -> provisioning -> delivered
 *                                                   \-> delayed -> delivered
 *   (pending_payment | paid | provisioning | delayed) -> failed
 *   (draft | pending_payment) -> cancelled
 */
export const ORDER_STATUSES = [
  "draft",
  "pending_payment",
  "paid",
  "provisioning",
  "delivered",
  "delayed",
  "failed",
  "cancelled",
] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]
export const orderStatusSchema = z.enum(ORDER_STATUSES)

export const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  draft: ["pending_payment", "cancelled"],
  pending_payment: ["paid", "failed", "cancelled"],
  paid: ["provisioning", "failed"],
  provisioning: ["delivered", "delayed", "failed"],
  delayed: ["delivered", "failed"],
  delivered: [],
  failed: [],
  cancelled: [],
}

export const ORDER_KINDS = ["new", "upgrade", "addon"] as const
export type OrderKind = (typeof ORDER_KINDS)[number]
export const orderKindSchema = z.enum(ORDER_KINDS)

export class OrderTransitionError extends Error {
  constructor(
    readonly from: OrderStatus,
    readonly to: OrderStatus,
  ) {
    super(`invalid order transition: ${from} -> ${to}`)
    this.name = "OrderTransitionError"
  }
}

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to)
}

export function assertOrderTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransitionOrder(from, to)) throw new OrderTransitionError(from, to)
}

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return ORDER_TRANSITIONS[status].length === 0
}

/**
 * Steps of the provisioning job, in order. Each one is persisted as it completes so a
 * retry resumes instead of ordering twice at OVH.
 */
export const PROVISION_STEPS = [
  "whmcs_client",
  "whmcs_order",
  "whmcs_invoice",
  "whmcs_payment",
  "ovh_cart",
  "ovh_configure",
  "ovh_price_check",
  "ovh_checkout",
  "ovh_delivery",
  "ovh_first_boot",
  "service_active",
] as const
export type ProvisionStep = (typeof PROVISION_STEPS)[number]
export const provisionStepSchema = z.enum(PROVISION_STEPS)

export function nextProvisionStep(completed: readonly ProvisionStep[]): ProvisionStep | null {
  const done = new Set(completed)
  return PROVISION_STEPS.find((step) => !done.has(step)) ?? null
}

export function isProvisionComplete(completed: readonly ProvisionStep[]): boolean {
  return nextProvisionStep(completed) === null
}

/** How long we wait for OVH to deliver before flagging the order as delayed. */
export const DELIVERY_SLA_HOURS = 2
export const DELIVERY_TIMEOUT_HOURS = 24

export function deliveryState(
  paidAt: Date,
  now: Date,
): "on_time" | "late" | "timed_out" {
  const elapsedHours = (now.getTime() - paidAt.getTime()) / (60 * 60 * 1000)
  if (elapsedHours >= DELIVERY_TIMEOUT_HOURS) return "timed_out"
  if (elapsedHours >= DELIVERY_SLA_HOURS) return "late"
  return "on_time"
}
