import { beforeEach, describe, expect, it } from "vitest"
import { isDomainError } from "@ola/core"
import { HttpOvhClient, type HttpOvhClientOptions } from "../src/http-client.js"
import { isOvhApiError, toDomainError } from "../src/errors.js"
import { resetClockSkew } from "../src/signer.js"
import type { OvhLogRecord, OvhLogger } from "../src/client.js"

const BASE = "http://ovh.test/1.0"
const NOW_MS = 1_762_387_200_000
const APP_SECRET = "the-application-secret"
const CONSUMER_KEY = "the-consumer-key"

interface RecordedCall {
  url: string
  method: string
  headers: Headers
  body: string | null
}

type Handler = (call: RecordedCall, index: number) => Response | Error

interface Harness {
  client: HttpOvhClient
  calls: RecordedCall[]
  logs: OvhLogRecord[]
  sleeps: number[]
}

function json(payload: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  })
}

function harness(handler: Handler, options: Partial<HttpOvhClientOptions> = {}): Harness {
  const calls: RecordedCall[] = []
  const logs: OvhLogRecord[] = []
  const sleeps: number[] = []

  const logger: OvhLogger = {
    info: (record) => logs.push(record),
    warn: (record) => logs.push(record),
    error: (record) => logs.push(record),
  }

  const client = new HttpOvhClient({
    endpoint: BASE,
    applicationKey: "the-application-key",
    applicationSecret: APP_SECRET,
    consumerKey: CONSUMER_KEY,
    subsidiary: "ES",
    now: () => NOW_MS,
    random: () => 0,
    retryBaseMs: 1,
    correlationId: () => "corr-test",
    logger,
    sleep: async (ms) => {
      sleeps.push(ms)
    },
    fetchImpl: async (url, init) => {
      // The clock-skew probe is not part of what a test asserts on.
      if (url.endsWith("/auth/time")) return new Response(String(NOW_MS / 1000))
      const call: RecordedCall = {
        url,
        method: init?.method ?? "GET",
        headers: new Headers(init?.headers),
        body: typeof init?.body === "string" ? init.body : null,
      }
      calls.push(call)
      const result = handler(call, calls.length - 1)
      if (result instanceof Error) throw result
      return result
    },
    ...options,
  })

  return { client, calls, logs, sleeps }
}

const VPS_PAYLOAD = {
  name: "vps-abc.vps.ovh.net",
  displayName: null,
  state: "running",
  vcore: 2,
  memoryLimit: 4096,
  netbootMode: "local",
  zone: "GRA",
  zoneType: "region",
  offerType: "classic",
  cluster: "cluster001",
  slaMonitoring: false,
  monitoringIpBlocks: [],
  lockStatus: { locked: false, reason: null },
  model: {
    name: "vps-2027-model1",
    offer: "VPS-1 2027",
    version: "2025v1",
    vcore: 2,
    memory: 4096,
    disk: 40,
    diskLocationType: "local",
    maximumAdditionnalIp: 16,
    datacenter: ["GRA", "DE"],
    availableOptions: ["snapshot", "automatedBackup"],
  },
}

const CHECKOUT_PAYLOAD = {
  orderId: 98765,
  url: "https://www.ovh.com/manager/order/98765",
  prices: {
    withoutTax: { currencyCode: "EUR", value: 4.49, text: "4,49 €", priceInUcents: 449000000 },
    tax: { currencyCode: "EUR", value: 0.94, text: "0,94 €", priceInUcents: 94000000 },
    withTax: { currencyCode: "EUR", value: 5.43, text: "5,43 €", priceInUcents: 543000000 },
  },
  details: [],
  contracts: [],
}

beforeEach(() => {
  resetClockSkew()
})

describe("retries", () => {
  it("retries a 500 and then succeeds", async () => {
    const { client, calls, sleeps } = harness((_call, index) =>
      index === 0 ? json({ message: "boom" }, 500) : json(VPS_PAYLOAD),
    )

    const vps = await client.getVps("vps-abc.vps.ovh.net")

    expect(vps.name).toBe("vps-abc.vps.ovh.net")
    expect(calls).toHaveLength(2)
    expect(sleeps).toHaveLength(1)
  })

  it("gives up after four attempts and reports the last failure", async () => {
    const { client, calls } = harness(() => json({ message: "down" }, 503))

    await expect(client.listVps()).rejects.toMatchObject({
      name: "OvhApiError",
      httpStatus: 503,
      retryable: true,
      attempts: 4,
    })
    expect(calls).toHaveLength(4)
  })

  it("retries a network failure", async () => {
    const { client, calls } = harness((_call, index) =>
      index === 0 ? new TypeError("fetch failed") : json(["vps-abc.vps.ovh.net"]),
    )

    expect(await client.listVps()).toEqual(["vps-abc.vps.ovh.net"])
    expect(calls).toHaveLength(2)
  })

  it("honours Retry-After instead of its own backoff", async () => {
    const { client, sleeps } = harness((_call, index) =>
      index === 0
        ? json({ message: "slow down" }, 429, { "Retry-After": "2" })
        : json(["vps-abc.vps.ovh.net"]),
    )

    await client.listVps()
    expect(sleeps).toEqual([2000])
  })

  it("does not retry a 404", async () => {
    const { client, calls } = harness(() =>
      json({ class: "Client::NotFound", message: "This service does not exist" }, 404),
    )

    await expect(client.getVps("nope")).rejects.toMatchObject({ retryable: false })
    expect(calls).toHaveLength(1)
  })

  it("never retries a checkout", async () => {
    const { client, calls } = harness(() => json({ message: "gateway timeout" }, 504))

    await expect(
      client.checkout({
        cartId: "cart-1",
        autoPayWithPreferredPaymentMethod: true,
        waiveRetractationPeriod: true,
      }),
    ).rejects.toMatchObject({ httpStatus: 504 })

    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe(`${BASE}/order/cart/cart-1/checkout`)
    expect(calls[0]?.method).toBe("POST")
  })

  it("sends the checkout body documented by order.cart.Checkout", async () => {
    const { client, calls } = harness(() => json(CHECKOUT_PAYLOAD))

    const order = await client.checkout({
      cartId: "cart-1",
      autoPayWithPreferredPaymentMethod: true,
      waiveRetractationPeriod: false,
    })

    expect(order.orderId).toBe(98765)
    expect(JSON.parse(calls[0]?.body ?? "null")).toEqual({
      autoPayWithPreferredPaymentMethod: true,
      waiveRetractationPeriod: false,
    })
  })
})

describe("error mapping", () => {
  it("maps 404 to provider_rejected", async () => {
    const { client } = harness(() =>
      json({ class: "Client::NotFound", message: "This service does not exist" }, 404),
    )

    const error = await client.getVps("nope").catch((caught: unknown) => caught)
    expect(isOvhApiError(error)).toBe(true)
    if (!isOvhApiError(error)) return

    expect(error.httpStatus).toBe(404)
    expect(error.ovhErrorCode).toBe("Client::NotFound")
    expect(error.method).toBe("GET")
    expect(error.path).toBe("/vps/nope")
    expect(error.retryable).toBe(false)

    const domain = toDomainError(error)
    expect(isDomainError(domain)).toBe(true)
    expect(domain.code).toBe("provider_rejected")
    expect(domain.retryable).toBe(false)
    // OVH's own wording stays in `detail`, never in the customer message.
    expect(domain.detail).toContain("This service does not exist")
    expect(domain.customerMessage).not.toContain("This service does not exist")
  })

  it("maps 403 to provider_rejected without retrying", async () => {
    const { client, calls } = harness(() =>
      json({ errorCode: "INVALID_SIGNATURE", message: "Invalid signature" }, 403),
    )

    const error = await client.listVps().catch((caught: unknown) => caught)
    expect(isOvhApiError(error)).toBe(true)
    if (!isOvhApiError(error)) return
    expect(error.ovhErrorCode).toBe("INVALID_SIGNATURE")
    expect(toDomainError(error).code).toBe("provider_rejected")
    expect(calls).toHaveLength(1)
  })

  it("maps 429 to a retryable provider_unavailable", async () => {
    const { client } = harness(() => json({ message: "Too many requests" }, 429))

    const error = await client.listVps().catch((caught: unknown) => caught)
    expect(isOvhApiError(error)).toBe(true)
    if (!isOvhApiError(error)) return
    expect(error.httpStatus).toBe(429)
    expect(error.retryable).toBe(true)

    const domain = toDomainError(error)
    expect(domain.code).toBe("provider_unavailable")
    expect(domain.retryable).toBe(true)
  })

  it("maps a rejected price to price_mismatch", async () => {
    const { client } = harness(() =>
      json({ errorCode: "PRICE_MISMATCH", message: "price has changed" }, 400),
    )

    const error = await client
      .checkout({
        cartId: "cart-1",
        autoPayWithPreferredPaymentMethod: true,
        waiveRetractationPeriod: true,
      })
      .catch((caught: unknown) => caught)

    expect(isOvhApiError(error)).toBe(true)
    if (!isOvhApiError(error)) return
    expect(toDomainError(error).code).toBe("price_mismatch")
  })

  it("maps a network failure to a retryable provider_unavailable", async () => {
    const { client } = harness(() => new TypeError("fetch failed"))

    const error = await client.listVps().catch((caught: unknown) => caught)
    expect(isOvhApiError(error)).toBe(true)
    if (!isOvhApiError(error)) return
    expect(error.kind).toBe("network")
    expect(error.httpStatus).toBeNull()
    expect(toDomainError(error).code).toBe("provider_unavailable")
  })
})

describe("authentication", () => {
  it("signs every authenticated call", async () => {
    const { client, calls } = harness(() => json(VPS_PAYLOAD))

    await client.getVps("vps-abc.vps.ovh.net")

    const headers = calls[0]?.headers
    expect(headers?.get("X-Ovh-Application")).toBe("the-application-key")
    expect(headers?.get("X-Ovh-Consumer")).toBe(CONSUMER_KEY)
    expect(headers?.get("X-Ovh-Timestamp")).toBe(String(NOW_MS / 1000))
    expect(headers?.get("X-Ovh-Signature")).toMatch(/^\$1\$[0-9a-f]{40}$/)
  })

  it("does not send auth headers for the public catalog", async () => {
    const { client, calls } = harness(() => json({ plans: [], addons: [] }))

    const raw = await client.fetchPublicCatalog("ES")

    expect(raw).toEqual({ plans: [], addons: [] })
    expect(calls[0]?.url).toBe(`${BASE}/order/catalog/public/vps?ovhSubsidiary=ES`)
    expect(calls[0]?.headers.get("X-Ovh-Application")).toBeNull()
    expect(calls[0]?.headers.get("X-Ovh-Signature")).toBeNull()
    expect(calls[0]?.headers.get("X-Ovh-Consumer")).toBeNull()
  })
})

describe("datacenter stock", () => {
  it("reads the public stock rule without auth and keeps only Linux availability", async () => {
    const { client, calls } = harness(() =>
      json({
        datacenters: [
          { datacenter: "GRA", code: "eu-west-gra", status: "available", daysBeforeDelivery: 0, linuxStatus: "available", windowsStatus: "out-of-stock" },
          { datacenter: "SBG", code: "eu-west-sbg", status: "out-of-stock", daysBeforeDelivery: 0, linuxStatus: "out-of-stock", windowsStatus: "out-of-stock" },
        ],
      }),
    )

    const stock = await client.getDatacenterStock("vps-2027-model1", "ES")

    expect(stock).toEqual([
      { datacenter: "GRA", linux: true, windows: false, daysBeforeDelivery: 0 },
      { datacenter: "SBG", linux: false, windows: false, daysBeforeDelivery: 0 },
    ])
    expect(calls[0]?.url).toBe(
      `${BASE}/vps/order/rule/datacenter?ovhSubsidiary=ES&planCode=vps-2027-model1`,
    )
    expect(calls[0]?.headers.get("X-Ovh-Signature")).toBeNull()
  })
})

describe("response validation", () => {
  it("throws a schema error on a malformed payload and does not retry it", async () => {
    const { client, calls } = harness(() => json({ ...VPS_PAYLOAD, state: "exploded" }))

    const error = await client.getVps("vps-abc.vps.ovh.net").catch((caught: unknown) => caught)
    expect(isOvhApiError(error)).toBe(true)
    if (!isOvhApiError(error)) return

    expect(error.kind).toBe("schema")
    expect(error.retryable).toBe(false)
    expect(error.detail).toContain("state")
    expect(calls).toHaveLength(1)
  })

  it("throws when a required field is missing", async () => {
    const { client } = harness(() => json({ id: 42, state: "done", progress: 0 }))

    await expect(client.getTask("vps-abc.vps.ovh.net", 42)).rejects.toMatchObject({
      kind: "schema",
    })
  })

  it("rejects a body that is not JSON", async () => {
    const { client } = harness(() => new Response("<html>502</html>", { status: 200 }))

    await expect(client.listVps()).rejects.toMatchObject({ kind: "schema" })
  })

  it("accepts an empty body for a void route", async () => {
    const { client, calls } = harness(() => new Response(null, { status: 204 }))

    await expect(
      client.updateServiceInfos("vps-abc.vps.ovh.net", { renew: { automatic: true } }),
    ).resolves.toBeUndefined()

    expect(calls[0]?.method).toBe("PUT")
    expect(JSON.parse(calls[0]?.body ?? "null")).toEqual({ renew: { automatic: true } })
  })

  it("parses a task and its enum state", async () => {
    const { client } = harness(() =>
      json({
        id: 11,
        state: "doing",
        type: "startVm",
        progress: 50,
        date: "2026-11-05T10:00:00+01:00",
      }),
    )

    const task = await client.getTask("vps-abc.vps.ovh.net", 11)
    expect(task.state).toBe("doing")
    expect(task.date).toBeInstanceOf(Date)
  })

  it("classifies the IPs of a VPS", async () => {
    const { client } = harness(() => json(["203.0.113.7", "2001:db8:1::/64"]))

    const ips = await client.getVpsIps("vps-abc.vps.ovh.net")
    expect(ips).toEqual([
      { address: "203.0.113.7", version: 4, isBlock: false },
      { address: "2001:db8:1::/64", version: 6, isBlock: true },
    ])
  })
})

describe("paths and query strings", () => {
  it("uses the real task path parameter and encodes path segments", async () => {
    const { client, calls } = harness(() =>
      json({ id: 7, state: "done", type: "startVm", progress: 100, date: "2026-11-05T09:00:00Z" }),
    )

    await client.getTask("vps-ab/cd.ovh.net", 7)
    expect(calls[0]?.url).toBe(`${BASE}/vps/vps-ab%2Fcd.ovh.net/tasks/7`)
  })

  it("passes the required restore point state as a query parameter", async () => {
    const { client, calls } = harness(() => json(["2026-11-04T22:00:00Z"]))

    const points = await client.listRestorePoints("vps-abc.vps.ovh.net", "available")
    expect(points).toEqual(["2026-11-04T22:00:00Z"])
    expect(calls[0]?.url).toBe(
      `${BASE}/vps/vps-abc.vps.ovh.net/automatedBackup/restorePoints?state=available`,
    )
  })

  it("puts the planCode of a service option in the body, not the path", async () => {
    const { client, calls } = harness(() =>
      json({
        cartId: "cart-9",
        itemId: 3,
        productId: "vps",
        offerId: "option-snapshot-2027-model1",
        duration: "P1M",
        options: [],
        prices: [],
        settings: {},
      }),
    )

    await client.orderServiceOption("vps-abc.vps.ovh.net", {
      cartId: "cart-9",
      planCode: "option-snapshot-2027-model1",
      duration: "P1M",
      pricingMode: "default",
      quantity: 1,
    })

    expect(calls[0]?.url).toBe(`${BASE}/order/cartServiceOption/vps/vps-abc.vps.ovh.net`)
    expect(JSON.parse(calls[0]?.body ?? "null")).toMatchObject({
      planCode: "option-snapshot-2027-model1",
      cartId: "cart-9",
    })
  })

  it("sets rescue mode through PUT /vps/{serviceName}", async () => {
    const { client, calls } = harness(() => new Response("", { status: 200 }))

    await client.setNetbootMode("vps-abc.vps.ovh.net", "rescue")

    expect(calls[0]?.method).toBe("PUT")
    expect(calls[0]?.url).toBe(`${BASE}/vps/vps-abc.vps.ovh.net`)
    expect(JSON.parse(calls[0]?.body ?? "null")).toEqual({ netbootMode: "rescue" })
  })
})

describe("per-entity routes (verified 2026-11-06)", () => {
  it("reads the configuration an item still requires", async () => {
    const { client, calls } = harness(() =>
      json([
        { label: "vps_datacenter", required: true, type: "string", fields: null },
        { label: "vps_os", required: false, type: "string" },
      ]),
    )

    const required = await client.listCartItemRequiredConfiguration("cart-1", 42)

    expect(calls[0]?.url).toBe(`${BASE}/order/cart/cart-1/item/42/requiredConfiguration`)
    expect(required.map((entry) => entry.label)).toEqual(["vps_datacenter", "vps_os"])
    expect(required[0]?.required).toBe(true)
  })

  it("puts an IP on the firewall", async () => {
    const { client, calls } = harness(() =>
      json({ ipOnFirewall: "203.0.113.7", enabled: false, state: "enableFirewallPending" }),
    )

    const firewall = await client.enableFirewall("203.0.113.0/24", "203.0.113.7")

    expect(firewall).toEqual({
      ipOnFirewall: "203.0.113.7",
      enabled: false,
      state: "enableFirewallPending",
    })
    expect(calls[0]?.method).toBe("POST")
    expect(calls[0]?.url).toBe(`${BASE}/ip/203.0.113.0%2F24/firewall`)
    expect(JSON.parse(calls[0]?.body ?? "null")).toEqual({ ipOnFirewall: "203.0.113.7" })
  })

  it("rejects an unknown firewall state rather than passing it through", async () => {
    const { client } = harness(() =>
      json({ ipOnFirewall: "203.0.113.7", enabled: true, state: "halfOn" }),
    )

    await expect(
      client.enableFirewall("203.0.113.0/24", "203.0.113.7"),
    ).rejects.toMatchObject({ kind: "schema" })
  })

  it("lists the firewalled IPs of a block, with its filters", async () => {
    const { client, calls } = harness(() => json(["203.0.113.7"]))

    expect(await client.listFirewalledIps("203.0.113.0/24")).toEqual(["203.0.113.7"])
    expect(calls[0]?.url).toBe(`${BASE}/ip/203.0.113.0%2F24/firewall`)

    await client.listFirewalledIps("203.0.113.0/24", { enabled: true, state: "ok" })
    expect(calls[1]?.url).toBe(
      `${BASE}/ip/203.0.113.0%2F24/firewall?enabled=true&state=ok`,
    )
  })

  it("reads and deletes one firewall rule", async () => {
    const rulePayload = {
      sequence: 0,
      action: "permit",
      protocol: "tcp",
      state: "ok",
      rule: "permit tcp to port 443",
      source: "any",
      destination: "203.0.113.7",
      sourcePort: null,
      destinationPort: "443",
      fragments: null,
      l3PacketLength: null,
      tcpOption: null,
      creationDate: "2026-11-05T10:00:00+01:00",
    }
    const { client, calls } = harness((_call, index) =>
      json(index === 1 ? { ...rulePayload, state: "removalPending" } : rulePayload),
    )

    const rule = await client.getFirewallRule("203.0.113.0/24", "203.0.113.7", 0)
    expect(rule.action).toBe("permit")
    expect(rule.creationDate).toBeInstanceOf(Date)
    expect(calls[0]?.method).toBe("GET")
    expect(calls[0]?.url).toBe(
      `${BASE}/ip/203.0.113.0%2F24/firewall/203.0.113.7/rule/0`,
    )

    const removed = await client.deleteFirewallRule("203.0.113.0/24", "203.0.113.7", 0)
    expect(removed.state).toBe("removalPending")
    expect(calls[1]?.method).toBe("DELETE")
  })

  it("reads one reverse and deletes it", async () => {
    const { client, calls } = harness((_call, index) =>
      index === 0
        ? json({ ipReverse: "203.0.113.7", reverse: "server.example.com" })
        : new Response(null, { status: 204 }),
    )

    expect(await client.getReverse("203.0.113.0/24", "203.0.113.7")).toEqual({
      ipReverse: "203.0.113.7",
      reverse: "server.example.com",
    })
    expect(calls[0]?.url).toBe(`${BASE}/ip/203.0.113.0%2F24/reverse/203.0.113.7`)

    await expect(
      client.deleteReverse("203.0.113.0/24", "203.0.113.7"),
    ).resolves.toBeUndefined()
    expect(calls[1]?.method).toBe("DELETE")
  })

  it("keeps listReverseIps for the whole block", async () => {
    const { client, calls } = harness(() => json(["203.0.113.7", "203.0.113.8"]))

    expect(await client.listReverseIps("203.0.113.0/24")).toEqual([
      "203.0.113.7",
      "203.0.113.8",
    ])
    expect(calls[0]?.url).toBe(`${BASE}/ip/203.0.113.0%2F24/reverse`)
  })

  it("reads the mitigation state of one IP", async () => {
    const { client, calls } = harness(() =>
      json({
        ipOnMitigation: "203.0.113.7",
        auto: true,
        permanent: false,
        state: "creationPending",
      }),
    )

    const mitigation = await client.getMitigationIp("203.0.113.0/24", "203.0.113.7")
    expect(mitigation.state).toBe("creationPending")
    expect(calls[0]?.url).toBe(`${BASE}/ip/203.0.113.0%2F24/mitigation/203.0.113.7`)
  })

  it("rejects an unknown mitigation state rather than passing it through", async () => {
    const { client } = harness(() =>
      json({ ipOnMitigation: "203.0.113.7", auto: true, permanent: false, state: "whatever" }),
    )

    await expect(
      client.getMitigationIp("203.0.113.0/24", "203.0.113.7"),
    ).rejects.toMatchObject({ kind: "schema" })
  })
})

describe("logging", () => {
  it("logs method, path, status, duration and correlation id — and no secret", async () => {
    const { client, logs } = harness((_call, index) =>
      index === 0 ? json({ message: "boom" }, 500) : json(["vps-abc.vps.ovh.net"]),
    )

    await client.listVps()

    expect(logs).toHaveLength(2)
    expect(logs[0]).toMatchObject({
      method: "GET",
      path: "/vps",
      status: 500,
      correlationId: "corr-test",
      outcome: "retrying",
    })
    expect(logs[1]).toMatchObject({ status: 200, outcome: "ok" })
    for (const record of logs) {
      expect(typeof record.durationMs).toBe("number")
      const serialised = JSON.stringify(record)
      expect(serialised).not.toContain(APP_SECRET)
      expect(serialised).not.toContain(CONSUMER_KEY)
    }
  })
})
