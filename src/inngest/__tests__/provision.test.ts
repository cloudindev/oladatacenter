import { describe, expect, it } from "vitest"
import { CHECKOUT_ATTEMPT_ACTION, runProvisioning } from "../jobs/provision"
import {
  ALL_WHMCS_STEPS,
  MockOvhJobs,
  MockWhmcsJobs,
  createFakeDb,
  createTestDeps,
  makeCustomer,
  makeOrder,
  makePlan,
  makeService,
  recordingStepTools,
} from "./fakes"

function seed(options: {
  previewCents?: number
  completedSteps?: typeof ALL_WHMCS_STEPS
  orderOverrides?: Parameters<typeof makeOrder>[0]
}) {
  const customer = makeCustomer({ whmcsClientId: 5001 })
  const order = makeOrder({
    completedSteps: options.completedSteps ?? [],
    whmcsOrderId: 7001,
    whmcsInvoiceId: 8001,
    ...options.orderOverrides,
  })
  const fake = createFakeDb({
    customers: new Map([[customer.id, customer]]),
    orders: new Map([[order.id, order]]),
    plans: [makePlan()],
  })
  const ovh = new MockOvhJobs({ previewCents: options.previewCents })
  const whmcs = new MockWhmcsJobs({ existingClientId: 5001 })
  return { ...createTestDeps({ fake, ovh, whmcs }), customer, order }
}

describe("provisioning", () => {
  it("resumes from a half-done completedSteps without redoing the paid WHMCS steps", async () => {
    const { deps, fake, ovh, whmcs, recorded, order } = seed({
      completedSteps: ALL_WHMCS_STEPS,
    })
    const step = recordingStepTools()

    const outcome = await runProvisioning(deps, step, {
      orderId: order.id,
      stripePaymentIntentId: "pi_123",
      correlationId: "test-resume",
    })

    expect(outcome.status).toBe("delivered")

    // Nothing that costs money or writes to the books was repeated.
    expect(whmcs.countOf("createClient")).toBe(0)
    expect(whmcs.countOf("createOrder")).toBe(0)
    expect(whmcs.countOf("acceptOrder")).toBe(0)
    expect(whmcs.countOf("recordPayment")).toBe(0)
    expect(step.ran).not.toContain("whmcs-order")
    expect(step.ran).not.toContain("whmcs-payment")

    // And the remaining steps ran exactly once.
    expect(ovh.countOf("createCart")).toBe(1)
    expect(ovh.countOf("checkout")).toBe(1)
    expect(ovh.countOf("rebuild")).toBe(1)

    const stored = fake.state.orders.get(order.id)
    expect(stored?.status).toBe("delivered")
    expect(stored?.completedSteps).toEqual([
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
    ])

    const service = [...fake.state.services.values()][0]
    expect(service?.status).toBe("active")
    expect(service?.ipv4).toBe("203.0.113.10")
    expect(service?.nextDueAt).toBeInstanceOf(Date)
    expect(recorded.emails.map((email) => email.template)).toContain("server-ready")

    // No SSH key on the customer: a one-time root password was stored before the rebuild.
    expect(recorded.passwords).toHaveLength(1)
  })

  it("re-uses a stored OVH cart instead of creating a second one", async () => {
    const { deps, ovh, order } = seed({
      completedSteps: ALL_WHMCS_STEPS,
      orderOverrides: { ovhCartId: "cart-existing", status: "provisioning" },
    })

    await runProvisioning(deps, recordingStepTools(), {
      orderId: order.id,
      correlationId: "test-cart-reuse",
    })

    expect(ovh.countOf("createCart")).toBe(0)
  })

  it("stops before checkout when the OVH price does not match the order", async () => {
    const { deps, fake, ovh, recorded, order } = seed({
      completedSteps: ALL_WHMCS_STEPS,
      previewCents: 600,
    })

    const outcome = await runProvisioning(deps, recordingStepTools(), {
      orderId: order.id,
      correlationId: "test-mismatch",
    })

    expect(outcome).toMatchObject({ status: "failed", code: "price_mismatch" })
    expect(ovh.countOf("checkout")).toBe(0)
    expect(ovh.countOf("rebuild")).toBe(0)

    const stored = fake.state.orders.get(order.id)
    expect(stored?.status).toBe("failed")
    expect(stored?.errorCode).toBe("price_mismatch")
    expect(stored?.error).toContain("El precio ha cambiado")
    // Partial progress is kept so a manual retry resumes.
    expect(stored?.completedSteps).toContain("ovh_configure")
    expect(stored?.completedSteps).not.toContain("ovh_price_check")

    expect(recorded.events.map((event) => event.name)).toEqual(["ola/order.refund.requested"])
    expect(recorded.events[0]?.data).toMatchObject({ reason: "price_mismatch", orderId: order.id })
    expect(recorded.alerts.some((alert) => alert.severity === "critical")).toBe(true)
  })

  it("never posts the checkout twice: a previous attempt is recovered from the VPS inventory", async () => {
    const customer = makeCustomer({ whmcsClientId: 5001 })
    const order = makeOrder({
      completedSteps: [...ALL_WHMCS_STEPS, "ovh_cart", "ovh_configure", "ovh_price_check"],
      whmcsOrderId: 7001,
      whmcsInvoiceId: 8001,
      ovhCartId: "cart-1",
      status: "provisioning",
    })
    const fake = createFakeDb({
      customers: new Map([[customer.id, customer]]),
      orders: new Map([[order.id, order]]),
      plans: [makePlan()],
      // The marker a previous run wrote immediately before posting the checkout.
      auditActions: [
        { entity: "order", entityId: order.id, action: CHECKOUT_ATTEMPT_ACTION },
      ],
    })
    const ovh = new MockOvhJobs({ vpsNames: ["vps-recovered.ovh.net"] })
    const { deps, recorded } = createTestDeps({ fake, ovh, whmcs: new MockWhmcsJobs() })

    const outcome = await runProvisioning(deps, recordingStepTools(), {
      orderId: order.id,
      correlationId: "test-recover",
    })

    expect(outcome.status).toBe("delivered")
    expect(ovh.countOf("checkout")).toBe(0)
    expect([...fake.state.services.values()][0]?.ovhServiceName).toBe("vps-recovered.ovh.net")
    expect(recorded.alerts.some((alert) => alert.severity === "warning")).toBe(true)
  })

  it("refuses to re-post a checkout when OVH shows no new server", async () => {
    const customer = makeCustomer({ whmcsClientId: 5001 })
    const order = makeOrder({
      completedSteps: [...ALL_WHMCS_STEPS, "ovh_cart", "ovh_configure", "ovh_price_check"],
      ovhCartId: "cart-1",
      status: "provisioning",
    })
    const service = makeService({ id: "svc_known", ovhServiceName: "vps-known.ovh.net" })
    const fake = createFakeDb({
      customers: new Map([[customer.id, customer]]),
      orders: new Map([[order.id, order]]),
      services: new Map([[service.id, service]]),
      plans: [makePlan()],
      auditActions: [
        { entity: "order", entityId: order.id, action: CHECKOUT_ATTEMPT_ACTION },
      ],
    })
    // Every VPS OVH lists is one we already know about: nothing new was created.
    const ovh = new MockOvhJobs({ vpsNames: ["vps-known.ovh.net"] })
    const { deps } = createTestDeps({ fake, ovh, whmcs: new MockWhmcsJobs() })

    const outcome = await runProvisioning(deps, recordingStepTools(), {
      orderId: order.id,
      correlationId: "test-no-recover",
    })

    expect(outcome).toMatchObject({ status: "failed", code: "conflict", step: "ovh_checkout" })
    expect(ovh.countOf("checkout")).toBe(0)
  })

  it("fails the order with a Spanish message when a step throws", async () => {
    const customer = makeCustomer({ whmcsClientId: null, addressLine1: null })
    const order = makeOrder()
    const fake = createFakeDb({
      customers: new Map([[customer.id, customer]]),
      orders: new Map([[order.id, order]]),
      plans: [makePlan()],
    })
    const { deps, recorded } = createTestDeps({
      fake,
      ovh: new MockOvhJobs(),
      whmcs: new MockWhmcsJobs(),
    })

    const outcome = await runProvisioning(deps, recordingStepTools(), {
      orderId: order.id,
      correlationId: "test-fail",
    })

    expect(outcome).toMatchObject({ status: "failed", step: "whmcs_client" })
    const stored = fake.state.orders.get(order.id)
    expect(stored?.status).toBe("failed")
    expect(stored?.error).toContain("No hemos podido emitir la factura")
    expect(stored?.completedSteps).toEqual([])
    expect(recorded.alerts.some((alert) => alert.severity === "critical")).toBe(true)
  })
})
