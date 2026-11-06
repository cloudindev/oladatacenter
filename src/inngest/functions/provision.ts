import { inngest } from "../client"
import { jobDeps } from "../deps"
import { runProvisioning } from "../jobs/provision"
import { stepTools } from "../steps"

/**
 * Provisioning, triggered by payment (`ola/order.paid`) or by an admin retry
 * (`ola/order.provision`).
 *
 * `concurrency.limit = 1` keyed on the order id is load-bearing: two runs over the same
 * order would both read `orders.completedSteps`, both decide the same next step and both
 * do it. `scope: "env"` makes the key shared by every function in this environment, so
 * the paid trigger and a manual retry cannot overlap either.
 *
 * Inngest retries are left at the default and are safe because every step re-checks the
 * database before acting; the one call that must never repeat (the OVH checkout) detects
 * its own prior attempt by asking OVH for our recent orders.
 */
export const provisionOrder = inngest.createFunction(
  {
    id: "provision-order",
    name: "Aprovisionar pedido",
    concurrency: { limit: 1, key: "event.data.orderId", scope: "env" },
    retries: 3,
  },
  [{ event: "ola/order.paid" }, { event: "ola/order.provision" }],
  async ({ event, step }) => {
    const data = event.data
    const correlationId = data.correlationId ?? `order-${data.orderId}`
    const deps = jobDeps()

    return runProvisioning(deps, stepTools(step), {
      orderId: data.orderId,
      stripePaymentIntentId:
        "stripePaymentIntentId" in data ? data.stripePaymentIntentId : undefined,
      paidAt: "paidAt" in data ? data.paidAt : undefined,
      correlationId,
    })
  },
)

/**
 * Fan-out delivery re-check. The provisioning run polls OVH itself; this function exists
 * for the admin panel and for a run that was lost mid-poll: it simply resumes
 * provisioning, which starts again at `ovh_delivery`.
 */
export const checkOrderDelivery = inngest.createFunction(
  {
    id: "check-order-delivery",
    name: "Comprobar entrega del pedido",
    concurrency: { limit: 1, key: "event.data.orderId", scope: "env" },
    retries: 2,
  },
  { event: "ola/order.delivery.check" },
  async ({ event, step }) => {
    const correlationId = event.data.correlationId ?? `order-${event.data.orderId}`
    const deps = jobDeps()

    return runProvisioning(deps, stepTools(step), {
      orderId: event.data.orderId,
      correlationId,
    })
  },
)
