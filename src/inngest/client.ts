import { EventSchemas, Inngest } from "inngest"
import type { DunningStage, DunningStep, ProvisionStep, Term } from "@ola/core"

/**
 * The Inngest client and the full event contract of the platform.
 *
 * Every payload below is JSON-only: dates travel as ISO strings because Inngest
 * serialises event data and step output. `correlationId` is carried end to end so one
 * order can be followed across Stripe, WHMCS and OVH in the logs and the audit trail.
 *
 * Ownership of each event is stated explicitly. The jobs layer owns the provisioning,
 * renewal, dunning, catalog and sync events; the billing layer (Stripe) owns charging and
 * refunding and is the only module allowed to talk to Stripe.
 */

export type AlertSeverity = "info" | "warning" | "critical"

/** What one dunning step must do. Mirrors `DunningStep["action"]` in `@ola/core`. */
export type DunningAction = DunningStep["action"]

export interface OrderPaidData {
  orderId: string
  /** Stripe PaymentIntent that paid the order. Used as the WHMCS transaction id. */
  stripePaymentIntentId: string
  /** ISO timestamp of the payment; defaults to the order's `paidAt` when absent. */
  paidAt?: string
  correlationId?: string
}

export interface OrderProvisionData {
  orderId: string
  /** Set by an admin retry: resume from `orders.completedSteps` instead of starting over. */
  resume?: boolean
  correlationId?: string
}

export interface OrderDeliveryCheckData {
  orderId: string
  ovhOrderId: number
  /** How many polls have already happened, so the fan-out cannot loop forever. */
  attempt?: number
  correlationId?: string
}

export interface ServiceRenewTickData {
  /** ISO timestamp to evaluate the dunning calendar at. Defaults to now. Tests pass it. */
  at?: string
  correlationId?: string
}

export interface ServiceDunningStepData {
  serviceId: string
  stage: DunningStage
  action: DunningAction
  /** ISO timestamp the step was due. */
  dueAt: string
  correlationId?: string
}

export interface CatalogSyncData {
  reason?: "cron" | "manual"
  correlationId?: string
}

export interface ServiceSyncData {
  /** Reconcile one service only; omitted means every non-terminated service. */
  serviceId?: string
  correlationId?: string
}

export interface AlertRaiseData {
  severity: AlertSeverity
  title: string
  entity: string
  entityId?: string | null
  /** Technical detail for the admin. Never a secret. */
  detail?: string
  correlationId?: string
}

/**
 * Emitted by the jobs layer, HANDLED BY THE BILLING LAYER.
 * The jobs layer never calls Stripe: a price mismatch or a failed provisioning asks
 * billing for the refund through this event.
 */
export interface OrderRefundRequestedData {
  orderId: string
  amountCents: number
  reason: "price_mismatch" | "provisioning_failed" | "delivery_timeout"
  detail?: string
  correlationId?: string
}

/**
 * Emitted by the jobs layer, HANDLED BY THE BILLING LAYER.
 * Asks for an off-session charge of a renewal invoice.
 */
export interface ServiceChargeRequestedData {
  serviceId: string
  customerId: string
  /** Our `invoices.id`, when the invoice has already been mirrored. */
  invoiceId?: string
  whmcsInvoiceId?: number
  amountCents: number
  /** 0 for the T-0 charge, 1 and 2 for the retries. */
  attempt: number
  stage: DunningStage
  correlationId?: string
}

/** Emitted by the billing layer (Stripe webhook or off-session charge), handled here. */
export interface PaymentSucceededData {
  customerId: string
  serviceId?: string
  invoiceId?: string
  whmcsInvoiceId?: number
  stripePaymentIntentId: string
  amountCents: number
  /** ISO timestamp the money moved. */
  paidAt?: string
  /**
   * Where the money came from. `whmcs` means the payment was taken inside WHMCS (a bank
   * transfer, typically) and is therefore already on the books: the handler must not
   * register it again.
   */
  source?: "stripe" | "whmcs"
  correlationId?: string
}

/** Emitted by the billing layer, handled here to advance the dunning calendar. */
export interface PaymentFailedData {
  customerId: string
  serviceId?: string
  invoiceId?: string
  whmcsInvoiceId?: number
  amountCents: number
  failureCode?: string
  failureMessage?: string
  correlationId?: string
}

export type OlaEvents = {
  "ola/order.paid": { data: OrderPaidData }
  "ola/order.provision": { data: OrderProvisionData }
  "ola/order.delivery.check": { data: OrderDeliveryCheckData }
  "ola/service.renew.tick": { data: ServiceRenewTickData }
  "ola/service.dunning.step": { data: ServiceDunningStepData }
  "ola/catalog.sync": { data: CatalogSyncData }
  "ola/service.sync": { data: ServiceSyncData }
  "ola/alert.raise": { data: AlertRaiseData }
  "ola/order.refund.requested": { data: OrderRefundRequestedData }
  "ola/service.charge.requested": { data: ServiceChargeRequestedData }
  "ola/payment.succeeded": { data: PaymentSucceededData }
  "ola/payment.failed": { data: PaymentFailedData }
}

export const inngest = new Inngest({
  id: "ola-vps",
  schemas: new EventSchemas().fromRecord<OlaEvents>(),
})

/** Re-exported for the functions so they do not each import from `@ola/core`. */
export type { DunningStage, ProvisionStep, Term }
