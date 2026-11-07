import { beforeEach, describe, expect, it, vi } from "vitest"

import { HttpWhmcsClient } from "../src/http-client.js"
import { isWhmcsApiError, WhmcsApiError } from "../src/errors.js"
import { phpSerializeFlatArray } from "../src/php-serialize.js"
import type { WhmcsLogFields, WhmcsLogger } from "../src/client.js"

// ─── harness ─────────────────────────────────────────────────────────────────

interface FetchCall {
  url: string
  body: string
  headers: Record<string, string>
}

interface FetchStub {
  impl: typeof fetch
  calls: FetchCall[]
}

type Responder = () => Response | Promise<Response>

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function textResponse(body: string, status: number): Response {
  return new Response(body, { status, headers: { "content-type": "text/html" } })
}

/** Replays `responders` in order; the last one is reused once the list runs out. */
function stubFetch(responders: Responder[]): FetchStub {
  const calls: FetchCall[] = []
  let index = 0
  const impl: typeof fetch = async (input, init) => {
    const headers: Record<string, string> = {}
    const rawHeaders = init?.headers
    if (rawHeaders && !Array.isArray(rawHeaders) && !(rawHeaders instanceof Headers)) {
      for (const [key, value] of Object.entries(rawHeaders)) headers[key.toLowerCase()] = value
    }
    calls.push({
      url: typeof input === "string" ? input : input.toString(),
      body: typeof init?.body === "string" ? init.body : "",
      headers,
    })
    const responder = responders[Math.min(index, responders.length - 1)]
    index += 1
    if (!responder) throw new Error("no responder configured")
    return responder()
  }
  return { impl, calls }
}

function recordingLogger(): { logger: WhmcsLogger; entries: WhmcsLogFields[] } {
  const entries: WhmcsLogFields[] = []
  const push = (fields: WhmcsLogFields) => {
    entries.push(fields)
  }
  return { logger: { info: push, warn: push, error: push }, entries }
}

const CREDENTIALS = {
  apiUrl: "https://panel.cloudin.pro/includes/api.php",
  identifier: "test-identifier",
  secret: "test-secret",
}

function client(
  responders: Responder[],
  overrides: Partial<ConstructorParameters<typeof HttpWhmcsClient>[0]> = {},
) {
  const fetchStub = stubFetch(responders)
  const { logger, entries } = recordingLogger()
  const instance = new HttpWhmcsClient({
    ...CREDENTIALS,
    writeEnabled: true,
    fetchImpl: fetchStub.impl,
    logger,
    correlationId: "cid-1",
    sleepImpl: async () => {},
    ...overrides,
  })
  return { instance, calls: fetchStub.calls, logs: entries }
}

function bodyParams(body: string): URLSearchParams {
  return new URLSearchParams(body)
}

// ─── request shape ───────────────────────────────────────────────────────────

describe("HttpWhmcsClient request shape", () => {
  it("posts form-urlencoded credentials, action and responsetype", async () => {
    const { instance, calls } = client([
      () =>
        jsonResponse({
          result: "success",
          totalresults: "1",
          clients: { client: [{ id: "7", firstname: "Ana", lastname: "Gil", email: "a@b.es" }] },
        }),
    ])

    await instance.findClientByEmail("a@b.es")

    expect(calls).toHaveLength(1)
    const call = calls[0]
    if (!call) throw new Error("expected a call")
    expect(call.url).toBe(CREDENTIALS.apiUrl)
    expect(call.headers["content-type"]).toContain("application/x-www-form-urlencoded")
    const params = bodyParams(call.body)
    expect(params.get("identifier")).toBe("test-identifier")
    expect(params.get("secret")).toBe("test-secret")
    expect(params.get("action")).toBe("GetClients")
    expect(params.get("responsetype")).toBe("json")
    expect(params.get("search")).toBe("a@b.es")
  })

  it("routes through the proxy with X-Target-Url when proxyUrl is set", async () => {
    const { instance, calls } = client(
      [() => jsonResponse({ result: "success", clients: {} })],
      { proxyUrl: "https://whmcs-proxy.internal/forward", proxyToken: "proxy-token-1" },
    )

    await instance.findClientByEmail("nobody@oladc.com")

    const call = calls[0]
    if (!call) throw new Error("expected a call")
    expect(call.url).toBe("https://whmcs-proxy.internal/forward")
    expect(call.headers["x-target-url"]).toBe(CREDENTIALS.apiUrl)
    expect(call.headers["x-ola-token"]).toBe("proxy-token-1")
    expect(new URLSearchParams(String(call.body)).get("ola_proxy_token")).toBe("proxy-token-1")
  })

  it("never logs the identifier or the secret", async () => {
    const { instance, logs } = client([
      () => jsonResponse({ result: "success", clients: {} }),
    ])

    await instance.findClientByEmail("a@b.es")

    const serialized = JSON.stringify(logs)
    expect(serialized).not.toContain("test-identifier")
    expect(serialized).not.toContain("test-secret")
    expect(logs[0]).toMatchObject({
      action: "GetClients",
      status: "success",
      correlationId: "cid-1",
    })
    expect(typeof logs[0]?.durationMs).toBe("number")
  })
})

// ─── parsing ─────────────────────────────────────────────────────────────────

describe("HttpWhmcsClient response parsing", () => {
  it("parses a client and coerces WHMCS string numbers", async () => {
    const { instance } = client([
      () =>
        jsonResponse({
          result: "success",
          totalresults: "1",
          clients: {
            client: [
              {
                id: "42",
                firstname: "Ana",
                lastname: "Gil",
                companyname: "",
                email: "ANA@oladc.com",
                country: "ES",
                tax_id: "ESB12345678",
                status: "Active",
              },
            ],
          },
        }),
    ])

    const account = await instance.findClientByEmail("ana@oladc.com")

    expect(account).toEqual({
      clientId: 42,
      email: "ANA@oladc.com",
      firstName: "Ana",
      lastName: "Gil",
      companyName: null,
      address1: null,
      city: null,
      postcode: null,
      state: null,
      country: "ES",
      phoneNumber: null,
      taxId: "ESB12345678",
      currencyCode: null,
      status: "Active",
    })
  })

  it("ignores rows whose email only matches WHMCS's fuzzy search", async () => {
    const { instance } = client([
      () =>
        jsonResponse({
          result: "success",
          clients: { client: [{ id: "9", email: "other@oladc.com" }] },
        }),
    ])

    expect(await instance.findClientByEmail("ana@oladc.com")).toBeNull()
  })

  it("normalises WHMCS's empty object instead of an empty array to []", async () => {
    const { instance } = client([
      () => jsonResponse({ result: "success", totalresults: "0", clients: {} }),
      () => jsonResponse({ result: "success", totalresults: "0", invoices: {} }),
      () => jsonResponse({ result: "success", totalresults: "0", products: "" }),
    ])

    expect(await instance.findClientByEmail("nobody@oladc.com")).toBeNull()
    expect(await instance.listInvoices({ clientId: 1 })).toEqual([])
    expect(await instance.listServices(1)).toEqual([])
  })

  it("accepts a single row that WHMCS did not wrap in an array", async () => {
    const { instance } = client([
      () =>
        jsonResponse({
          result: "success",
          invoices: {
            invoice: {
              id: "3001",
              userid: "42",
              status: "Paid",
              subtotal: "10.00",
              tax: "2.10",
              tax2: "0.00",
              credit: "0.00",
              total: "12.10",
              balance: "0.00",
              date: "2026-02-01",
              duedate: "2026-02-01",
              datepaid: "2026-02-01 10:00:00",
            },
          },
        }),
    ])

    const invoices = await instance.listInvoices({ clientId: 42 })

    expect(invoices).toHaveLength(1)
    expect(invoices[0]).toMatchObject({
      invoiceId: 3001,
      clientId: 42,
      status: "Paid",
      domainStatus: "paid",
      subtotalCents: 1000,
      taxCents: 210,
      totalCents: 1210,
      balanceCents: 0,
    })
  })

  it("turns money strings into integer cents and 0000-00-00 into null", async () => {
    const { instance } = client([
      () =>
        jsonResponse({
          result: "success",
          invoiceid: "3002",
          invoicenum: "",
          userid: "42",
          date: "2026-02-01",
          duedate: "2026-02-08",
          datepaid: "0000-00-00 00:00:00",
          status: "Unpaid",
          subtotal: "1,234.56",
          tax: "259.26",
          tax2: "0.00",
          credit: "0.00",
          total: "1493.82",
          balance: "1493.82",
          items: { item: [{ id: "1", description: "VPS", amount: "1234.56", taxed: "1" }] },
        }),
    ])

    const invoice = await instance.getInvoice(3002)

    expect(invoice.invoiceId).toBe(3002)
    expect(invoice.invoiceNumber).toBeNull()
    expect(invoice.subtotalCents).toBe(123456)
    expect(invoice.taxCents).toBe(25926)
    expect(invoice.totalCents).toBe(149382)
    expect(invoice.datePaid).toBeNull()
    expect(invoice.domainStatus).toBe("unpaid")
    expect(invoice.items).toEqual([
      { id: 1, type: null, relid: null, description: "VPS", amount: 123456, taxed: true },
    ])
  })

  it('turns result:"error" into a non-retryable WhmcsApiError', async () => {
    const { instance } = client([
      () => jsonResponse({ result: "error", message: "Invoice ID Not Found" }),
    ])

    const error = await instance.getInvoice(999).catch((caught: unknown) => caught)

    expect(isWhmcsApiError(error)).toBe(true)
    const apiError = error as WhmcsApiError
    expect(apiError.message).toBe("Invoice ID Not Found")
    expect(apiError.action).toBe("GetInvoice")
    expect(apiError.kind).toBe("api_error")
    expect(apiError.httpStatus).toBe(200)
    expect(apiError.retryable).toBe(false)
    expect(apiError.toDomainError().code).toBe("billing_unavailable")
    // The WHMCS wording must never reach the customer.
    expect(apiError.toDomainError().message).not.toContain("Invoice ID Not Found")
  })

  it("rejects a body without a usable result", async () => {
    const { instance } = client([() => jsonResponse({ unexpected: true })])

    const error = await instance.getInvoice(1).catch((caught: unknown) => caught)

    expect(isWhmcsApiError(error)).toBe(true)
    expect((error as WhmcsApiError).kind).toBe("invalid_response")
    expect((error as WhmcsApiError).retryable).toBe(false)
  })

  it("rejects a non-JSON body", async () => {
    const { instance } = client([() => textResponse("<html>maintenance</html>", 200)])

    const error = await instance.getInvoice(1).catch((caught: unknown) => caught)

    expect((error as WhmcsApiError).kind).toBe("invalid_response")
  })

  it("rejects a success body whose shape does not match the action", async () => {
    const { instance } = client([() => jsonResponse({ result: "success" })])

    const error = await instance.getInvoice(1).catch((caught: unknown) => caught)

    expect((error as WhmcsApiError).kind).toBe("invalid_response")
  })
})

// ─── write guard ─────────────────────────────────────────────────────────────

describe("HttpWhmcsClient write guard", () => {
  const unreachable: Responder = () => {
    throw new Error("the adapter must not call WHMCS when writes are disabled")
  }

  it("throws without calling WHMCS when writeEnabled is false", async () => {
    const { instance, calls } = client([unreachable], { writeEnabled: false })

    const attempts: Array<[string, Promise<unknown>]> = [
      [
        "createClient",
        instance.createClient({
          firstName: "Ana",
          lastName: "Gil",
          email: "ana@oladc.com",
          address1: "Calle 1",
          city: "Madrid",
          postcode: "28001",
          country: "ES",
        }),
      ],
      ["updateClient", instance.updateClient(42, { city: "Madrid" })],
      [
        "createOrder",
        instance.createOrder({ clientId: 42, pid: 12, billingcycle: "monthly", paymentmethod: "stripe" }),
      ],
      ["acceptOrder", instance.acceptOrder(1)],
      [
        "recordPayment",
        instance.recordPayment({
          invoiceId: 1,
          amount: 1210,
          transactionId: "pi_1",
          gateway: "stripe",
          date: new Date("2026-02-01T10:00:00Z"),
        }),
      ],
      [
        "createInvoice",
        instance.createInvoice({ clientId: 42, paymentMethod: "stripe", lines: [] }),
      ],
      ["updateService", instance.updateService({ serviceId: 1, status: "Suspended" })],
      ["createSsoToken", instance.createSsoToken(42, "clientarea:invoices")],
    ]

    for (const [name, promise] of attempts) {
      const error = await promise.catch((caught: unknown) => caught)
      expect(isWhmcsApiError(error), `${name} should throw WhmcsApiError`).toBe(true)
      expect((error as WhmcsApiError).kind).toBe("writes_disabled")
      expect((error as WhmcsApiError).retryable).toBe(false)
      expect((error as WhmcsApiError).message).toContain("WHMCS_WRITE_ENABLED")
    }
    expect(calls).toHaveLength(0)
  })

  it("still allows reads when writes are disabled", async () => {
    const { instance, calls } = client(
      [() => jsonResponse({ result: "success", clients: {} })],
      { writeEnabled: false },
    )

    expect(await instance.findClientByEmail("ana@oladc.com")).toBeNull()
    expect(calls).toHaveLength(1)
  })
})

// ─── write encoding ──────────────────────────────────────────────────────────

describe("HttpWhmcsClient write encoding", () => {
  it("sends AddOrder with indexed products and base64 serialized configoptions", async () => {
    const { instance, calls } = client([
      () => jsonResponse({ result: "success", orderid: "2001", invoiceid: "3001" }),
    ])

    const result = await instance.createOrder({
      clientId: 42,
      pid: 12,
      billingcycle: "annually",
      configoptions: { 5: 31, 6: 44 },
      customfields: { 9: "ola-vps-01" },
      paymentmethod: "stripe",
      domain: "ola-vps-01",
      priceOverrideCents: 11988,
    })

    expect(result).toEqual({ orderId: 2001, invoiceId: 3001 })
    const call = calls[0]
    if (!call) throw new Error("expected a call")
    const params = bodyParams(call.body)
    expect(params.get("action")).toBe("AddOrder")
    expect(params.get("pid[0]")).toBe("12")
    expect(params.get("billingcycle[0]")).toBe("annually")
    expect(params.get("domain[0]")).toBe("ola-vps-01")
    expect(params.get("paymentmethod")).toBe("stripe")
    expect(params.get("noemail")).toBe("1")
    expect(params.get("priceoverride[0]")).toBe("119.88")

    const configOptions = params.get("configoptions[0]")
    if (!configOptions) throw new Error("expected configoptions[0]")
    expect(atob(configOptions)).toBe(phpSerializeFlatArray({ 5: 31, 6: 44 }))
    expect(atob(configOptions)).toBe('a:2:{i:5;i:31;i:6;i:44;}')

    const customFields = params.get("customfields[0]")
    if (!customFields) throw new Error("expected customfields[0]")
    expect(atob(customFields)).toBe('a:1:{i:9;s:10:"ola-vps-01";}')
  })

  it("sends AddInvoicePayment with cents converted to a decimal amount and a UTC timestamp", async () => {
    const { instance, calls } = client([() => jsonResponse({ result: "success" })])

    await instance.recordPayment({
      invoiceId: 3001,
      amount: 1210,
      transactionId: "pi_3Nabc",
      gateway: "stripe",
      date: new Date("2026-02-01T10:30:05.123Z"),
    })

    const params = bodyParams(calls[0]?.body ?? "")
    expect(params.get("action")).toBe("AddInvoicePayment")
    expect(params.get("invoiceid")).toBe("3001")
    expect(params.get("amount")).toBe("12.10")
    expect(params.get("transid")).toBe("pi_3Nabc")
    expect(params.get("gateway")).toBe("stripe")
    expect(params.get("date")).toBe("2026-02-01 10:30:05")
  })

  it("numbers CreateInvoice lines the way WHMCS expects", async () => {
    const { instance, calls } = client([
      () => jsonResponse({ result: "success", invoiceid: "3005" }),
    ])

    const result = await instance.createInvoice({
      clientId: 42,
      paymentMethod: "stripe",
      taxRate: 21,
      lines: [
        { description: "Ampliación", amount: 500, taxed: true },
        { description: "Crédito de bienvenida", amount: -1000 },
      ],
    })

    expect(result).toEqual({ invoiceId: 3005 })
    const params = bodyParams(calls[0]?.body ?? "")
    expect(params.get("userid")).toBe("42")
    expect(params.get("status")).toBe("Unpaid")
    expect(params.get("sendinvoice")).toBe("0")
    expect(params.get("taxrate")).toBe("21")
    expect(params.get("itemdescription1")).toBe("Ampliación")
    expect(params.get("itemamount1")).toBe("5.00")
    expect(params.get("itemtaxed1")).toBe("1")
    expect(params.get("itemdescription2")).toBe("Crédito de bienvenida")
    expect(params.get("itemamount2")).toBe("-10.00")
    expect(params.get("itemtaxed2")).toBe("0")
  })

  it("sends only the changed fields on UpdateClient", async () => {
    const { instance, calls } = client([
      () => jsonResponse({ result: "success", clientid: "42" }),
    ])

    await instance.updateClient(42, { taxId: "ESB12345678", status: "Active" })

    const params = bodyParams(calls[0]?.body ?? "")
    expect(params.get("clientid")).toBe("42")
    expect(params.get("tax_id")).toBe("ESB12345678")
    expect(params.get("status")).toBe("Active")
    expect(params.has("city")).toBe(false)
    expect(params.has("firstname")).toBe(false)
  })

  it("formats UpdateClientProduct dates as YYYY-MM-DD", async () => {
    const { instance, calls } = client([
      () => jsonResponse({ result: "success", serviceid: "4001" }),
    ])

    await instance.updateService({
      serviceId: 4001,
      status: "Suspended",
      nextDueDate: new Date("2026-03-01T12:00:00Z"),
    })

    const params = bodyParams(calls[0]?.body ?? "")
    expect(params.get("action")).toBe("UpdateClientProduct")
    expect(params.get("serviceid")).toBe("4001")
    expect(params.get("status")).toBe("Suspended")
    expect(params.get("nextduedate")).toBe("2026-03-01")
  })

  it("returns the SSO redirect url", async () => {
    const { instance, calls } = client([
      () =>
        jsonResponse({
          result: "success",
          access_token: "tok",
          redirect_url: "https://panel.cloudin.pro/cdin/dologin.php?token=tok",
        }),
    ])

    const result = await instance.createSsoToken(42, "clientarea:invoices")

    expect(result).toEqual({
      redirectUrl: "https://panel.cloudin.pro/cdin/dologin.php?token=tok",
    })
    expect(bodyParams(calls[0]?.body ?? "").get("client_id")).toBe("42")
    expect(bodyParams(calls[0]?.body ?? "").get("destination")).toBe("clientarea:invoices")
  })
})

// ─── retries ─────────────────────────────────────────────────────────────────

describe("HttpWhmcsClient retries", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("retries a read after a 5xx and succeeds", async () => {
    const { instance, calls, logs } = client([
      () => textResponse("gateway error", 502),
      () => jsonResponse({ result: "success", clients: {} }),
    ])

    expect(await instance.findClientByEmail("ana@oladc.com")).toBeNull()
    expect(calls).toHaveLength(2)
    expect(logs.map((entry) => entry.status)).toEqual(["retry", "success"])
  })

  it("retries a read after a network failure", async () => {
    let attempts = 0
    const { instance, calls } = client([
      () => {
        attempts += 1
        if (attempts === 1) throw new TypeError("fetch failed")
        return jsonResponse({ result: "success", clients: {} })
      },
    ])

    expect(await instance.findClientByEmail("ana@oladc.com")).toBeNull()
    expect(calls).toHaveLength(2)
  })

  it("gives up after maxRetries and surfaces a retryable error", async () => {
    const { instance, calls } = client([() => textResponse("boom", 500)])

    const error = await instance.findClientByEmail("ana@oladc.com").catch((caught: unknown) => caught)

    // One attempt plus three retries.
    expect(calls).toHaveLength(4)
    expect((error as WhmcsApiError).kind).toBe("server_error")
    expect((error as WhmcsApiError).retryable).toBe(true)
  })

  it("does not retry a 4xx", async () => {
    const { instance, calls } = client([() => textResponse("IP not allowlisted", 403)])

    const error = await instance.findClientByEmail("ana@oladc.com").catch((caught: unknown) => caught)

    expect(calls).toHaveLength(1)
    expect((error as WhmcsApiError).kind).toBe("client_error")
    expect((error as WhmcsApiError).retryable).toBe(false)
  })

  it("NEVER retries recordPayment: the payment may already have been registered", async () => {
    const { instance, calls } = client([() => textResponse("boom", 500)])

    const error = await instance
      .recordPayment({
        invoiceId: 3001,
        amount: 1210,
        transactionId: "pi_1",
        gateway: "stripe",
        date: new Date("2026-02-01T10:00:00Z"),
      })
      .catch((caught: unknown) => caught)

    expect(calls).toHaveLength(1)
    expect((error as WhmcsApiError).action).toBe("AddInvoicePayment")
    // Still flagged retryable so the job knows to re-check, but the adapter did not resend.
    expect((error as WhmcsApiError).retryable).toBe(true)
  })

  it("NEVER retries createOrder or createInvoice", async () => {
    const order = client([() => textResponse("boom", 500)])
    await order.instance
      .createOrder({ clientId: 42, pid: 12, billingcycle: "monthly", paymentmethod: "stripe" })
      .catch(() => undefined)
    expect(order.calls).toHaveLength(1)

    const invoice = client([() => textResponse("boom", 500)])
    await invoice.instance
      .createInvoice({ clientId: 42, paymentMethod: "stripe", lines: [] })
      .catch(() => undefined)
    expect(invoice.calls).toHaveLength(1)
  })

  it("times out and reports a retryable timeout", async () => {
    const { instance } = client(
      [
        (): Promise<Response> =>
          new Promise((_resolve, reject) => {
            setTimeout(() => {
              const error = new Error("aborted")
              error.name = "AbortError"
              reject(error)
            }, 5)
          }),
      ],
      { timeoutMs: 1, maxRetries: 0 },
    )

    const error = await instance.findClientByEmail("ana@oladc.com").catch((caught: unknown) => caught)

    expect((error as WhmcsApiError).kind).toBe("timeout")
    expect((error as WhmcsApiError).retryable).toBe(true)
  })
})

// ─── customer area reads ─────────────────────────────────────────────────────

describe("HttpWhmcsClient customer area reads", () => {
  const product = (id: number, pid: number) => ({
    id: String(id),
    clientid: "16",
    pid: String(pid),
    name: "VPS KVM Starter Int.",
    groupname: "Servidores VPS",
    domain: "",
    dedicatedip: "51.75.1.2",
    assignedips: "51.75.1.3\r\n51.75.1.4",
    status: "Active",
    regdate: "2024-08-06",
    nextduedate: "2026-02-06",
    billingcycle: "Monthly",
    recurringamount: "72.00",
    // Returned by WHMCS and never wanted on our side.
    password: "service-root-password",
    username: "root",
  })

  it("maps products with their group and IPs, and drops credentials", async () => {
    const { instance } = client([
      () => jsonResponse({ result: "success", totalresults: "1", products: { product: [product(463, 85)] } }),
    ])

    const [service] = await instance.listServices(16)

    expect(service).toMatchObject({
      serviceId: 463,
      pid: 85,
      groupName: "Servidores VPS",
      ips: ["51.75.1.2", "51.75.1.3", "51.75.1.4"],
      recurringAmountCents: 7200,
    })
    expect(JSON.stringify(service)).not.toContain("service-root-password")
  })

  it("follows the pages until it has every product", async () => {
    const page = (start: number, count: number) =>
      Array.from({ length: count }, (_, index) => product(start + index, 1))
    const { instance, calls } = client([
      () => jsonResponse({ result: "success", totalresults: "130", products: { product: page(1, 100) } }),
      () => jsonResponse({ result: "success", totalresults: "130", products: { product: page(101, 30) } }),
    ])

    const services = await instance.listServices(16)

    expect(services).toHaveLength(130)
    expect(calls).toHaveLength(2)
    expect(bodyParams(String(calls[1]?.body)).get("limitstart")).toBe("100")
  })

  it("reads the client's domains", async () => {
    const { instance, calls } = client([
      () =>
        jsonResponse({
          result: "success",
          totalresults: "1",
          domains: {
            domain: [
              {
                id: "9",
                domainname: "omnisauto.com",
                status: "Active",
                regdate: "2024-02-01",
                expirydate: "2027-02-01",
                nextduedate: "2027-02-01",
                recurringamount: "14.99",
                registrationperiod: "1",
                donotrenew: "0",
              },
            ],
          },
        }),
    ])

    const domains = await instance.listDomains(16)

    expect(bodyParams(String(calls[0]?.body)).get("action")).toBe("GetClientsDomains")
    expect(domains).toEqual([
      {
        domainId: 9,
        domain: "omnisauto.com",
        status: "Active",
        registrationDate: "2024-02-01",
        expiryDate: "2027-02-01",
        nextDueDate: "2027-02-01",
        recurringAmountCents: 1499,
        registrationPeriod: 1,
        doNotRenew: false,
      },
    ])
  })
})
