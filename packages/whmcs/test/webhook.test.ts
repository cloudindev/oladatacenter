import { describe, expect, it, vi } from "vitest"

const { timingSafeEqualSpy } = vi.hoisted(() => ({ timingSafeEqualSpy: vi.fn() }))

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>()
  timingSafeEqualSpy.mockImplementation(actual.timingSafeEqual)
  return { ...actual, default: actual, timingSafeEqual: timingSafeEqualSpy }
})

const {
  DEFAULT_WEBHOOK_TOLERANCE_SECONDS,
  assertWebhookSignature,
  signWebhookPayload,
  verifyWebhookSignature,
  WebhookSignatureError,
  whmcsWebhookEventSchema,
  webhookInvoiceDomainStatus,
} = await import("../src/webhook.js")

const SECRET = "whsec_ola_vps_test_secret"
const TIMESTAMP = 1_767_000_000
const NOW_MS = TIMESTAMP * 1000

const PAYLOAD = JSON.stringify({
  event: "invoice.paid",
  eventId: "invoice.paid:3001:0123456789abcdef",
  timestamp: TIMESTAMP,
  data: { invoiceId: 3001, clientId: 42, status: "Paid", total: "12.10", transactionId: "pi_1" },
})

function sign(rawBody = PAYLOAD, timestamp: number | string = TIMESTAMP, secret = SECRET): string {
  return signWebhookPayload({ rawBody, timestamp, secret })
}

describe("verifyWebhookSignature", () => {
  it("accepts a signature produced by the documented algorithm", () => {
    const result = verifyWebhookSignature({
      rawBody: PAYLOAD,
      timestamp: TIMESTAMP,
      signature: sign(),
      secret: SECRET,
      nowMs: NOW_MS,
    })

    expect(result).toEqual({ valid: true })
  })

  it("produces the same digest as the PHP hook would (timestamp + '.' + rawBody)", async () => {
    const { createHmac } = await import("node:crypto")
    const expected =
      "sha256=" + createHmac("sha256", SECRET).update(`${TIMESTAMP}.${PAYLOAD}`, "utf8").digest("hex")

    expect(sign()).toBe(expected)
  })

  it("rejects a tampered body", () => {
    const signature = sign()
    const tampered = PAYLOAD.replace('"total":"12.10"', '"total":"1200.00"')

    const result = verifyWebhookSignature({
      rawBody: tampered,
      timestamp: TIMESTAMP,
      signature,
      secret: SECRET,
      nowMs: NOW_MS,
    })

    expect(result).toEqual({
      valid: false,
      reason: "signature_mismatch",
      message: expect.any(String) as unknown as string,
    })
  })

  it("rejects a signature made with another secret", () => {
    const result = verifyWebhookSignature({
      rawBody: PAYLOAD,
      timestamp: TIMESTAMP,
      signature: sign(PAYLOAD, TIMESTAMP, "wrong-secret"),
      secret: SECRET,
      nowMs: NOW_MS,
    })

    expect(result.valid).toBe(false)
  })

  it("rejects a replayed timestamp older than five minutes", () => {
    const result = verifyWebhookSignature({
      rawBody: PAYLOAD,
      timestamp: TIMESTAMP,
      signature: sign(),
      secret: SECRET,
      nowMs: NOW_MS + (DEFAULT_WEBHOOK_TOLERANCE_SECONDS + 1) * 1000,
    })

    expect(result).toMatchObject({ valid: false, reason: "stale_timestamp" })
  })

  it("accepts a timestamp right at the tolerance boundary", () => {
    const result = verifyWebhookSignature({
      rawBody: PAYLOAD,
      timestamp: TIMESTAMP,
      signature: sign(),
      secret: SECRET,
      nowMs: NOW_MS + DEFAULT_WEBHOOK_TOLERANCE_SECONDS * 1000,
    })

    expect(result.valid).toBe(true)
  })

  it("defaults the tolerance to 300 seconds", () => {
    expect(DEFAULT_WEBHOOK_TOLERANCE_SECONDS).toBe(300)
  })

  it("rejects a post-dated timestamp beyond the tolerance", () => {
    const result = verifyWebhookSignature({
      rawBody: PAYLOAD,
      timestamp: TIMESTAMP,
      signature: sign(),
      secret: SECRET,
      nowMs: NOW_MS - (DEFAULT_WEBHOOK_TOLERANCE_SECONDS + 1) * 1000,
    })

    expect(result).toMatchObject({ valid: false, reason: "future_timestamp" })
  })

  it("rejects a non-numeric timestamp", () => {
    const result = verifyWebhookSignature({
      rawBody: PAYLOAD,
      timestamp: "not-a-timestamp",
      signature: sign(),
      secret: SECRET,
      nowMs: NOW_MS,
    })

    expect(result).toMatchObject({ valid: false, reason: "bad_timestamp" })
  })

  it("rejects a signature without the sha256= prefix", () => {
    const result = verifyWebhookSignature({
      rawBody: PAYLOAD,
      timestamp: TIMESTAMP,
      signature: sign().slice("sha256=".length),
      secret: SECRET,
      nowMs: NOW_MS,
    })

    expect(result).toMatchObject({ valid: false, reason: "malformed_signature" })
  })

  it("rejects a missing signature or secret", () => {
    expect(
      verifyWebhookSignature({ rawBody: PAYLOAD, timestamp: TIMESTAMP, signature: "", secret: SECRET }),
    ).toMatchObject({ valid: false, reason: "missing_fields" })
    expect(
      verifyWebhookSignature({ rawBody: PAYLOAD, timestamp: TIMESTAMP, signature: sign(), secret: "" }),
    ).toMatchObject({ valid: false, reason: "missing_fields" })
  })

  it("uses a timing-safe comparison on equal-length buffers", () => {
    timingSafeEqualSpy.mockClear()
    const good = sign()
    // Same length, last hex digit flipped: a naive `===` would short-circuit here.
    const forged = good.slice(0, -1) + (good.endsWith("a") ? "b" : "a")

    const result = verifyWebhookSignature({
      rawBody: PAYLOAD,
      timestamp: TIMESTAMP,
      signature: forged,
      secret: SECRET,
      nowMs: NOW_MS,
    })

    expect(result.valid).toBe(false)
    expect(timingSafeEqualSpy).toHaveBeenCalledTimes(1)
    const call = timingSafeEqualSpy.mock.calls[0]
    if (!call) throw new Error("expected timingSafeEqual to be called")
    const [left, right] = call as [Uint8Array, Uint8Array]
    expect(left).toBeInstanceOf(Uint8Array)
    expect(right).toBeInstanceOf(Uint8Array)
    expect(left.length).toBe(right.length)
  })

  it("does not call timingSafeEqual when the lengths differ", () => {
    timingSafeEqualSpy.mockClear()

    const result = verifyWebhookSignature({
      rawBody: PAYLOAD,
      timestamp: TIMESTAMP,
      signature: "sha256=deadbeef",
      secret: SECRET,
      nowMs: NOW_MS,
    })

    expect(result.valid).toBe(false)
    expect(timingSafeEqualSpy).not.toHaveBeenCalled()
  })
})

describe("assertWebhookSignature", () => {
  it("throws WebhookSignatureError with the reason", () => {
    expect(() =>
      assertWebhookSignature({
        rawBody: PAYLOAD,
        timestamp: TIMESTAMP,
        signature: sign(PAYLOAD, TIMESTAMP, "nope"),
        secret: SECRET,
        nowMs: NOW_MS,
      }),
    ).toThrowError(WebhookSignatureError)
  })

  it("returns silently for a valid signature", () => {
    expect(() =>
      assertWebhookSignature({
        rawBody: PAYLOAD,
        timestamp: TIMESTAMP,
        signature: sign(),
        secret: SECRET,
        nowMs: NOW_MS,
      }),
    ).not.toThrow()
  })
})

describe("whmcsWebhookEventSchema", () => {
  it("parses what the PHP hook sends and coerces its strings", () => {
    const event = whmcsWebhookEventSchema.parse(JSON.parse(PAYLOAD))

    expect(event.event).toBe("invoice.paid")
    if (event.event === "client.updated") throw new Error("wrong branch")
    expect(event.data.invoiceId).toBe(3001)
    expect(event.data.clientId).toBe(42)
    expect(event.data.total).toBe(1210)
    expect(webhookInvoiceDomainStatus(event)).toBe("paid")
  })

  it("parses a client.updated event", () => {
    const event = whmcsWebhookEventSchema.parse({
      event: "client.updated",
      eventId: "client.updated:42:abc",
      timestamp: String(TIMESTAMP),
      data: { clientId: "42", email: "ana@oladc.com", status: "Active", taxId: null },
    })

    expect(event.event).toBe("client.updated")
    if (event.event !== "client.updated") throw new Error("wrong branch")
    expect(event.data.clientId).toBe(42)
    expect(event.data.taxId).toBeNull()
  })

  it("rejects an unknown event name", () => {
    expect(
      whmcsWebhookEventSchema.safeParse({
        event: "invoice.deleted",
        eventId: "x",
        timestamp: TIMESTAMP,
        data: {},
      }).success,
    ).toBe(false)
  })
})
