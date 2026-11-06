import { describe, expect, it } from "vitest"
import type { DunningStage } from "@ola/core"
import { dispatchDunning, handlePaymentSucceeded, runDunningStep, scanDunning } from "../jobs/renewals"
import {
  MockOvhJobs,
  MockWhmcsJobs,
  createFakeDb,
  createTestDeps,
  makeCustomer,
  makeService,
  recordingStepTools,
} from "./fakes"

const DUE_AT = new Date("2026-12-01T00:00:00.000Z")

function setup(options: { now: Date; completed?: readonly DunningStage[]; service?: Parameters<typeof makeService>[0] }) {
  const customer = makeCustomer({ whmcsClientId: 5001 })
  const service = makeService({
    nextDueAt: DUE_AT,
    dunningCompleted: options.completed ?? [],
    ...options.service,
  })
  const fake = createFakeDb({
    customers: new Map([[customer.id, customer]]),
    services: new Map([[service.id, service]]),
  })
  return {
    ...createTestDeps({
      fake,
      ovh: new MockOvhJobs(),
      whmcs: new MockWhmcsJobs({ existingClientId: 5001 }),
      now: options.now,
    }),
    service,
    customer,
  }
}

describe("dunning calendar", () => {
  it("fires the T-7 invoice step on the right day and not before", async () => {
    const early = setup({ now: new Date("2026-11-20T06:15:00.000Z") })
    expect(await scanDunning(early.deps, new Date("2026-11-20T06:15:00.000Z"))).toEqual([])

    const onTime = setup({ now: new Date("2026-11-24T06:15:00.000Z") })
    const dispatches = await scanDunning(onTime.deps, new Date("2026-11-24T06:15:00.000Z"))
    expect(dispatches).toHaveLength(1)
    expect(dispatches[0]).toMatchObject({ stage: "invoiced", action: "issue_invoice" })
  })

  it("does not fire the same step twice", async () => {
    const now = new Date("2026-11-24T06:15:00.000Z")
    const { deps, fake, whmcs, recorded, service } = setup({ now })

    const dispatched = await dispatchDunning(deps, now, "test-dunning")
    expect(dispatched).toHaveLength(1)

    const first = await runDunningStep(deps, recordingStepTools(), {
      serviceId: service.id,
      stage: "invoiced",
      action: "issue_invoice",
      dueAt: DUE_AT.toISOString(),
      correlationId: "test-dunning",
    })
    expect(first).toEqual({ status: "done", stage: "invoiced" })
    expect(whmcs.countOf("createInvoice")).toBe(1)
    expect(recorded.emails.map((email) => email.template)).toContain("renewal-upcoming")
    expect(fake.state.services.get(service.id)?.dunningCompleted).toEqual(["invoiced"])

    // The same scan, run again the same day, finds nothing to do.
    expect(await scanDunning(deps, now)).toEqual([])

    // And the step itself is idempotent if the event is redelivered.
    const second = await runDunningStep(deps, recordingStepTools(), {
      serviceId: service.id,
      stage: "invoiced",
      action: "issue_invoice",
      dueAt: DUE_AT.toISOString(),
      correlationId: "test-dunning",
    })
    expect(second).toEqual({ status: "skipped", reason: "stage_already_completed" })
    expect(whmcs.countOf("createInvoice")).toBe(1)
  })

  it("asks the billing layer for the charge instead of calling Stripe", async () => {
    const now = DUE_AT
    const { deps, recorded, service } = setup({ now, completed: ["invoiced"] })

    const dispatches = await scanDunning(deps, now)
    expect(dispatches[0]).toMatchObject({ stage: "charging", action: "charge" })

    await runDunningStep(deps, recordingStepTools(), {
      serviceId: service.id,
      stage: "charging",
      action: "charge",
      dueAt: DUE_AT.toISOString(),
      correlationId: "test-charge",
    })

    expect(recorded.events.map((event) => event.name)).toEqual(["ola/service.charge.requested"])
    expect(recorded.events[0]?.data).toMatchObject({ serviceId: service.id, attempt: 0 })
  })

  it("suspends the server at T+3 and stops it at OVH", async () => {
    const now = new Date("2026-12-04T06:15:00.000Z")
    const { deps, fake, ovh, recorded, service } = setup({
      now,
      completed: ["invoiced", "charging", "retry_1", "retry_2"],
      service: { dunningStage: "retry_2" },
    })

    const dispatches = await scanDunning(deps, now)
    expect(dispatches[0]).toMatchObject({ stage: "suspended", action: "suspend" })

    await runDunningStep(deps, recordingStepTools(), {
      serviceId: service.id,
      stage: "suspended",
      action: "suspend",
      dueAt: new Date("2026-12-04T00:00:00.000Z").toISOString(),
      correlationId: "test-suspend",
    })

    expect(ovh.countOf("stop")).toBe(1)
    expect(fake.state.services.get(service.id)?.status).toBe("suspended")
    expect(recorded.emails.map((email) => email.template)).toContain("service-suspended")
  })

  it("marks the OVH service for deletion at T+10 without deleting it", async () => {
    const now = new Date("2026-12-11T06:15:00.000Z")
    const { deps, fake, ovh, recorded, service } = setup({
      now,
      completed: ["invoiced", "charging", "retry_1", "retry_2", "suspended"],
      service: { status: "suspended", dunningStage: "suspended" },
    })

    await runDunningStep(deps, recordingStepTools(), {
      serviceId: service.id,
      stage: "terminating",
      action: "terminate",
      dueAt: new Date("2026-12-11T00:00:00.000Z").toISOString(),
      correlationId: "test-terminate",
    })

    expect(ovh.countOf("updateServiceInfos")).toBe(1)
    expect(fake.state.services.get(service.id)?.status).toBe("terminating")
    expect(recorded.emails.map((email) => email.template)).toContain("service-terminating")
  })

  it("reactivates a suspended service when the payment arrives", async () => {
    const now = new Date("2026-12-05T10:00:00.000Z")
    const { deps, fake, ovh, whmcs, service } = setup({
      now,
      completed: ["invoiced", "charging", "retry_1", "retry_2", "suspended"],
      service: { status: "suspended", dunningStage: "suspended", suspendedAt: now },
    })
    const invoice = await deps.db.upsertInvoice({
      customerId: service.customerId,
      serviceId: service.id,
      whmcsInvoiceId: 8001,
      status: "unpaid",
      total: 799,
    })

    const outcome = await handlePaymentSucceeded(deps, recordingStepTools(), {
      customerId: service.customerId,
      serviceId: service.id,
      invoiceId: invoice.id,
      whmcsInvoiceId: 8001,
      stripePaymentIntentId: "pi_renewal",
      amountCents: 799,
      paidAt: now.toISOString(),
    })

    expect(outcome).toEqual({ status: "reactivated", serviceId: service.id })
    expect(ovh.countOf("start")).toBe(1)
    expect(whmcs.countOf("recordPayment")).toBe(1)

    const stored = fake.state.services.get(service.id)
    expect(stored?.status).toBe("active")
    expect(stored?.dunningCompleted).toEqual([])
    expect(stored?.dunningStage).toBe("scheduled")
    expect(stored?.nextDueAt?.toISOString()).toBe("2027-01-01T00:00:00.000Z")
    expect(fake.state.invoices.get(invoice.id)?.status).toBe("paid")
  })

  it("does not reactivate a service that is already terminating", async () => {
    const now = new Date("2026-12-15T10:00:00.000Z")
    const { deps, ovh, recorded, service } = setup({
      now,
      service: { status: "terminating", dunningStage: "terminating" },
    })

    const outcome = await handlePaymentSucceeded(deps, recordingStepTools(), {
      customerId: service.customerId,
      serviceId: service.id,
      stripePaymentIntentId: "pi_late",
      amountCents: 799,
    })

    expect(outcome).toEqual({ status: "skipped", reason: "terminating" })
    expect(ovh.countOf("start")).toBe(0)
    expect(recorded.alerts.some((alert) => alert.severity === "critical")).toBe(true)
  })
})
