import { beforeEach, describe, expect, it } from "vitest"

import { MockWhmcsClient, MOCK_DEFAULT_PRICE_CENTS } from "../src/mock-client.js"
import { isWhmcsApiError, WhmcsApiError } from "../src/errors.js"
import { billingCycleForTerm, buildConfigOptions } from "../src/client.js"
import type { CreateClientInput } from "../src/client.js"

const NOW = new Date("2026-02-01T09:00:00.000Z")

const ANA: CreateClientInput = {
  firstName: "Ana",
  lastName: "Gil",
  companyName: "Ola Test SL",
  email: "ana@oladc.com",
  address1: "Calle Mayor 1",
  city: "Madrid",
  postcode: "28013",
  country: "ES",
  phoneNumber: "+34600000000",
  taxId: "ESB12345678",
}

let whmcs: MockWhmcsClient

beforeEach(() => {
  whmcs = new MockWhmcsClient({ now: () => NOW })
})

describe("MockWhmcsClient full flow", () => {
  it("runs find -> create client -> order -> accept -> payment -> paid invoice", async () => {
    expect(await whmcs.findClientByEmail(ANA.email)).toBeNull()

    const { clientId } = await whmcs.createClient(ANA)
    expect(clientId).toBe(1001)

    const found = await whmcs.findClientByEmail("ANA@OLADC.COM")
    expect(found).toMatchObject({ clientId: 1001, taxId: "ESB12345678", status: "Active" })

    const { orderId, invoiceId } = await whmcs.createOrder({
      clientId,
      pid: 12,
      billingcycle: billingCycleForTerm("P12M"),
      configoptions: buildConfigOptions(
        { datacenter: 5, os: 6, term: 7, addons: { backup: 8 } },
        { datacenter: 31, os: 44, term: 52, addons: { backup: 61 } },
      ),
      customfields: { 9: "ola-vps-01" },
      paymentmethod: "stripe",
      domain: "ola-vps-01",
      priceOverrideCents: 11988,
    })
    expect(orderId).toBe(2001)
    expect(invoiceId).toBe(3001)

    const unpaid = await whmcs.listInvoices({ clientId })
    expect(unpaid).toHaveLength(1)
    expect(unpaid[0]).toMatchObject({
      invoiceId: 3001,
      status: "Unpaid",
      domainStatus: "unpaid",
      totalCents: 11988,
      balanceCents: 11988,
      datePaid: null,
    })

    const pendingServices = await whmcs.listServices(clientId)
    expect(pendingServices).toHaveLength(1)
    expect(pendingServices[0]).toMatchObject({
      serviceId: 4001,
      status: "Pending",
      billingCycle: "Annually",
      nextDueDate: "2027-02-01",
      recurringAmountCents: 11988,
    })

    await whmcs.acceptOrder(orderId)
    expect((await whmcs.listServices(clientId))[0]?.status).toBe("Active")

    await whmcs.recordPayment({
      invoiceId,
      amount: 11988,
      transactionId: "pi_3Nabc",
      gateway: "stripe",
      date: new Date("2026-02-01T09:05:00.000Z"),
    })

    const paid = await whmcs.listInvoices({ clientId })
    expect(paid[0]).toMatchObject({
      invoiceId: 3001,
      status: "Paid",
      domainStatus: "paid",
      balanceCents: 0,
      datePaid: "2026-02-01 09:05:00",
    })

    expect(await whmcs.listInvoices({ clientId, status: "Paid" })).toHaveLength(1)
    expect(await whmcs.listInvoices({ clientId, status: "Unpaid" })).toHaveLength(0)

    const detail = await whmcs.getInvoice(invoiceId)
    expect(detail.items).toHaveLength(1)
    expect(detail.items[0]).toMatchObject({ amount: 11988, relid: 4001, type: "Hosting" })
  })

  it("prices an order with the default amount when no override is given", async () => {
    const { clientId } = await whmcs.createClient(ANA)
    const { invoiceId } = await whmcs.createOrder({
      clientId,
      pid: 12,
      billingcycle: "monthly",
      paymentmethod: "stripe",
    })

    const invoice = await whmcs.getInvoice(invoiceId)
    expect(invoice.totalCents).toBe(MOCK_DEFAULT_PRICE_CENTS)
    expect((await whmcs.listServices(clientId))[0]?.nextDueDate).toBe("2026-03-01")
  })

  it("assigns deterministic, auto-incrementing ids", async () => {
    const first = await whmcs.createClient(ANA)
    const second = await whmcs.createClient({ ...ANA, email: "luis@oladc.com" })
    expect([first.clientId, second.clientId]).toEqual([1001, 1002])

    const orderA = await whmcs.createOrder({
      clientId: first.clientId,
      pid: 12,
      billingcycle: "monthly",
      paymentmethod: "stripe",
    })
    const orderB = await whmcs.createOrder({
      clientId: second.clientId,
      pid: 13,
      billingcycle: "monthly",
      paymentmethod: "stripe",
    })
    expect([orderA.orderId, orderB.orderId]).toEqual([2001, 2002])
    expect([orderA.invoiceId, orderB.invoiceId]).toEqual([3001, 3002])
    expect(whmcs.snapshot().services.map((service) => service.serviceId)).toEqual([4001, 4002])
  })
})

describe("MockWhmcsClient WHMCS behaviours it models", () => {
  it("refuses a duplicate email, like AddClient does", async () => {
    await whmcs.createClient(ANA)
    const error = await whmcs.createClient(ANA).catch((caught: unknown) => caught)

    expect(isWhmcsApiError(error)).toBe(true)
    expect((error as WhmcsApiError).action).toBe("AddClient")
    expect((error as WhmcsApiError).message).toContain("already exists")
  })

  it("refuses a duplicate transaction id, which is our payment idempotency", async () => {
    const { clientId } = await whmcs.createClient(ANA)
    const { invoiceId } = await whmcs.createOrder({
      clientId,
      pid: 12,
      billingcycle: "monthly",
      paymentmethod: "stripe",
    })
    const payment = {
      invoiceId,
      amount: MOCK_DEFAULT_PRICE_CENTS,
      transactionId: "pi_dup",
      gateway: "stripe",
      date: NOW,
    }

    await whmcs.recordPayment(payment)
    const error = await whmcs.recordPayment(payment).catch((caught: unknown) => caught)

    expect((error as WhmcsApiError).action).toBe("AddInvoicePayment")
    expect((error as WhmcsApiError).message).toContain("already exists")
  })

  it("refuses to accept the same order twice", async () => {
    const { clientId } = await whmcs.createClient(ANA)
    const { orderId } = await whmcs.createOrder({
      clientId,
      pid: 12,
      billingcycle: "monthly",
      paymentmethod: "stripe",
    })

    await whmcs.acceptOrder(orderId)
    const error = await whmcs.acceptOrder(orderId).catch((caught: unknown) => caught)

    expect((error as WhmcsApiError).message).toContain("already been accepted")
  })

  it("errors on unknown ids instead of inventing rows", async () => {
    await expect(whmcs.getInvoice(999)).rejects.toThrow(WhmcsApiError)
    await expect(whmcs.updateService({ serviceId: 999, status: "Active" })).rejects.toThrow(
      WhmcsApiError,
    )
    await expect(whmcs.updateClient(999, { city: "Madrid" })).rejects.toThrow(WhmcsApiError)
  })

  it("suspends and reschedules a service without deleting anything", async () => {
    const { clientId } = await whmcs.createClient(ANA)
    await whmcs.createOrder({ clientId, pid: 12, billingcycle: "monthly", paymentmethod: "stripe" })

    await whmcs.updateService({
      serviceId: 4001,
      status: "Suspended",
      nextDueDate: new Date("2026-04-15T00:00:00.000Z"),
    })

    const services = await whmcs.listServices(clientId)
    expect(services).toHaveLength(1)
    expect(services[0]).toMatchObject({ status: "Suspended", nextDueDate: "2026-04-15" })
  })

  it("issues an SSO redirect url for an existing client", async () => {
    const { clientId } = await whmcs.createClient(ANA)

    const { redirectUrl } = await whmcs.createSsoToken(clientId, "clientarea:invoices")
    expect(redirectUrl).toContain("mock-sso-1001-1")

    await expect(whmcs.createSsoToken(4242, "clientarea:invoices")).rejects.toThrow(WhmcsApiError)
  })

  it("creates a standalone invoice with tax applied to taxed lines only", async () => {
    const { clientId } = await whmcs.createClient(ANA)

    const { invoiceId } = await whmcs.createInvoice({
      clientId,
      paymentMethod: "stripe",
      taxRate: 21,
      lines: [
        { description: "Ampliación de RAM", amount: 1000, taxed: true },
        { description: "Crédito de bienvenida", amount: -500 },
      ],
    })

    const invoice = await whmcs.getInvoice(invoiceId)
    expect(invoice.subtotalCents).toBe(500)
    expect(invoice.taxCents).toBe(210)
    expect(invoice.totalCents).toBe(710)
  })
})

describe("MockWhmcsClient test helpers", () => {
  it("failNextCall makes exactly the next call fail", async () => {
    const boom = new Error("WHMCS is down")
    whmcs.failNextCall(boom)

    await expect(whmcs.findClientByEmail(ANA.email)).rejects.toBe(boom)
    await expect(whmcs.findClientByEmail(ANA.email)).resolves.toBeNull()
  })

  it("failNextCall queues several failures in order", async () => {
    whmcs.failNextCall(new Error("first"))
    whmcs.failNextCall(new Error("second"))

    await expect(whmcs.createClient(ANA)).rejects.toThrow("first")
    await expect(whmcs.createClient(ANA)).rejects.toThrow("second")
    await expect(whmcs.createClient(ANA)).resolves.toEqual({ clientId: 1001 })
  })

  it("reset clears the book and the id counters", async () => {
    await whmcs.createClient(ANA)
    await whmcs.createOrder({ clientId: 1001, pid: 12, billingcycle: "monthly", paymentmethod: "stripe" })
    expect(whmcs.snapshot().invoices).toHaveLength(1)

    whmcs.reset()

    expect(whmcs.snapshot()).toEqual({ clients: [], orders: [], invoices: [], services: [] })
    expect(await whmcs.createClient(ANA)).toEqual({ clientId: 1001 })
  })

  it("honours writeEnabled: false just like the HTTP adapter", async () => {
    const readOnly = new MockWhmcsClient({ writeEnabled: false, now: () => NOW })

    const error = await readOnly.createClient(ANA).catch((caught: unknown) => caught)
    expect((error as WhmcsApiError).kind).toBe("writes_disabled")
    // Reads still work.
    await expect(readOnly.findClientByEmail(ANA.email)).resolves.toBeNull()
  })
})
