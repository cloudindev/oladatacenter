import { describe, expect, it } from "vitest"
import { handleWhmcsWebhook, type SignatureVerifier } from "@/app/api/webhooks/whmcs/handler"
import {
  MockOvhJobs,
  MockWhmcsJobs,
  createFakeDb,
  createTestDeps,
  makeCustomer,
  makeService,
} from "./fakes"

const ACCEPT: SignatureVerifier = () => ({ valid: true })
const REJECT: SignatureVerifier = () => ({
  valid: false,
  reason: "signature_mismatch",
  message: "HMAC does not match the body",
})

/** The canonical payload `whmcs-hook/ola_vps.php` posts. */
function body(
  event: "invoice.paid" | "invoice.cancelled" | "client.updated" | string,
  data: Record<string, unknown>,
  eventId = "whmcs-evt-1",
): string {
  return JSON.stringify({ eventId, event, timestamp: 1764936000, data })
}

async function setup(serviceOverrides: Parameters<typeof makeService>[0] = {}) {
  const customer = makeCustomer({ whmcsClientId: 5001 })
  const service = makeService({ status: "suspended", dunningStage: "suspended", ...serviceOverrides })
  const fake = createFakeDb({
    customers: new Map([[customer.id, customer]]),
    services: new Map([[service.id, service]]),
  })
  const test = createTestDeps({
    fake,
    ovh: new MockOvhJobs(),
    whmcs: new MockWhmcsJobs({ existingClientId: 5001 }),
    now: new Date("2026-12-05T10:00:00.000Z"),
  })
  const invoice = await test.deps.db.upsertInvoice({
    customerId: customer.id,
    serviceId: service.id,
    whmcsInvoiceId: 8001,
    status: "unpaid",
    total: 799,
  })
  return { ...test, customer, service, invoice }
}

describe("WHMCS webhook", () => {
  it("rejects a bad signature with 401 and processes nothing", async () => {
    const { deps, fake } = await setup()

    const response = await handleWhmcsWebhook(deps, REJECT, {
      rawBody: body("invoice.paid", { invoiceId: 8001 }),
      signature: "deadbeef",
      timestamp: "1764936000",
      secret: "shhh",
      correlationId: "test-bad-signature",
    })

    expect(response.status).toBe(401)
    expect(response.body).toEqual({ ok: false })
    expect(fake.state.webhookEvents.size).toBe(0)
    expect(fake.state.invoices.get("inv_1")?.status).not.toBe("paid")
  })

  it("rejects a request with no signature, timestamp or secret", async () => {
    const { deps } = await setup()
    const request = {
      rawBody: body("invoice.paid", { invoiceId: 8001 }),
      signature: null,
      timestamp: null,
      secret: "shhh",
      correlationId: "test-missing-headers",
    }
    expect((await handleWhmcsWebhook(deps, ACCEPT, request)).status).toBe(401)
  })

  it("InvoicePaid marks the invoice paid and brings a suspended server back", async () => {
    const { deps, fake, ovh, whmcs, invoice, service } = await setup()
    const rawBody = body("invoice.paid", {
      invoiceId: 8001,
      clientId: 5001,
      status: "Paid",
      total: "7.99",
      transactionId: "bank-transfer-1",
    })

    const first = await handleWhmcsWebhook(deps, ACCEPT, {
      rawBody,
      signature: "ok",
      timestamp: "1764936000",
      secret: "shhh",
      correlationId: "test-paid",
    })

    expect(first.status).toBe(200)
    expect(first.body.ok).toBe(true)
    expect(first.body.handled).toBe("invoice_paid:reactivated")
    expect(fake.state.invoices.get(invoice.id)?.status).toBe("paid")

    const stored = fake.state.services.get(service.id)
    expect(stored?.status).toBe("active")
    expect(stored?.dunningStage).toBe("scheduled")
    expect(ovh.countOf("start")).toBe(1)
    // The payment was taken inside WHMCS: it must not be registered there again.
    expect(whmcs.countOf("recordPayment")).toBe(0)
  })

  it("is idempotent when WHMCS redelivers the same event", async () => {
    const { deps, ovh } = await setup()
    const request = {
      rawBody: body("invoice.paid", { invoiceId: 8001, clientId: 5001, total: "7.99" }),
      signature: "ok",
      timestamp: "1764936000",
      secret: "shhh",
      correlationId: "test-duplicate",
    }

    const first = await handleWhmcsWebhook(deps, ACCEPT, request)
    const second = await handleWhmcsWebhook(deps, ACCEPT, request)

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(second.body).toEqual({ ok: true, duplicate: true })
    expect(ovh.countOf("start")).toBe(1)
  })

  it("answers 200 to a verified event it does not know", async () => {
    const { deps, fake } = await setup()

    const response = await handleWhmcsWebhook(deps, ACCEPT, {
      rawBody: body("SomethingElse", { foo: "bar" }, "whmcs-evt-unknown"),
      signature: "ok",
      timestamp: "1764936000",
      secret: "shhh",
      correlationId: "test-unknown",
    })

    expect(response.status).toBe(200)
    expect(response.body.handled).toBe("ignored")
    expect(fake.state.webhookEvents.get("whmcs:whmcs-evt-unknown")?.processedAt).toBeInstanceOf(Date)
  })

  it("invoice.cancelled and client.updated mirror into our tables", async () => {
    const { deps, fake, invoice, customer } = await setup()

    const cancelled = await handleWhmcsWebhook(deps, ACCEPT, {
      rawBody: body("invoice.cancelled", { invoiceId: 8001 }, "whmcs-evt-cancel"),
      signature: "ok",
      timestamp: "1764936000",
      secret: "shhh",
      correlationId: "test-cancel",
    })
    expect(cancelled.status).toBe(200)
    expect(fake.state.invoices.get(invoice.id)?.status).toBe("cancelled")

    const edited = await handleWhmcsWebhook(deps, ACCEPT, {
      rawBody: body(
        "client.updated",
        { clientId: 5001, companyName: "Cliente SLU", country: "pt" },
        "whmcs-evt-edit",
      ),
      signature: "ok",
      timestamp: "1764936000",
      secret: "shhh",
      correlationId: "test-edit",
    })
    expect(edited.body.handled).toBe("client_edited")
    const stored = fake.state.customers.get(customer.id)
    expect(stored?.legalName).toBe("Cliente SLU")
    expect(stored?.country).toBe("PT")
  })
})
