import { inngest } from "../client"
import { jobDeps } from "../deps"
import {
  dispatchDunning,
  handlePaymentFailed,
  handlePaymentSucceeded,
  runDunningStep,
} from "../jobs/renewals"
import { stepTools } from "../steps"

/**
 * 06:15 Europe/Madrid, every day: look at the renewal calendar and dispatch whatever is
 * due. Early morning on purpose — a card declined at 06:15 still leaves the whole working
 * day for the customer to fix it before the next step of the calendar.
 */
export const renewalTick = inngest.createFunction(
  { id: "renewal-tick", name: "Calendario de renovaciones", retries: 2 },
  [{ cron: "TZ=Europe/Madrid 15 6 * * *" }, { event: "ola/service.renew.tick" }],
  async ({ event, step }) => {
    const deps = jobDeps()
    const data = "data" in event ? event.data : undefined
    const at = data && "at" in data && data.at ? new Date(data.at) : deps.now()
    const correlationId =
      (data && "correlationId" in data ? data.correlationId : undefined) ??
      `renewals-${at.toISOString().slice(0, 10)}`

    const dispatched = await step.run("scan-dunning", () =>
      dispatchDunning(deps, at, correlationId),
    )
    return { dispatched: dispatched.length }
  },
)

/**
 * One dunning step for one service. Serialised per service so a retry can never suspend
 * and terminate at the same time.
 */
export const dunningStep = inngest.createFunction(
  {
    id: "dunning-step",
    name: "Paso de dunning",
    concurrency: { limit: 1, key: "event.data.serviceId", scope: "env" },
    retries: 3,
  },
  { event: "ola/service.dunning.step" },
  async ({ event, step }) => {
    const deps = jobDeps()
    return runDunningStep(deps, stepTools(step), {
      serviceId: event.data.serviceId,
      stage: event.data.stage,
      action: event.data.action,
      dueAt: event.data.dueAt,
      correlationId: event.data.correlationId ?? `dunning-${event.data.serviceId}`,
    })
  },
)

/**
 * A payment landed — from the billing layer's off-session charge or from the WHMCS
 * webhook. Registers it, moves the due date and reactivates a suspended server.
 */
export const paymentSucceeded = inngest.createFunction(
  {
    id: "payment-succeeded",
    name: "Pago recibido",
    concurrency: { limit: 1, key: "event.data.customerId", scope: "env" },
    retries: 3,
  },
  { event: "ola/payment.succeeded" },
  async ({ event, step }) => {
    const deps = jobDeps()
    return handlePaymentSucceeded(deps, stepTools(step), event.data)
  },
)

export const paymentFailed = inngest.createFunction(
  { id: "payment-failed", name: "Cobro rechazado", retries: 2 },
  { event: "ola/payment.failed" },
  async ({ event }) => handlePaymentFailed(jobDeps(), event.data),
)
