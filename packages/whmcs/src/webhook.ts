import { createHmac, timingSafeEqual } from "node:crypto"
import { z } from "zod"

import { whmcsInvoiceStatusToDomain, whmcsCents, whmcsInt, whmcsOptionalInt } from "./types"

/**
 * Verification for the webhooks that `whmcs-hook/ola_vps.php` posts to
 * `POST {platform}/api/webhooks/whmcs`.
 *
 * The algorithm is intentionally the same three lines on both sides:
 *
 *     signedPayload = timestamp + "." + rawBody        // rawBody EXACTLY as transmitted
 *     signature     = "sha256=" + hex(hmac_sha256(secret, signedPayload))
 *
 * The timestamp is in the signed payload, so an attacker cannot replay an old body under a
 * fresh timestamp. Bodies older than `toleranceSeconds` (5 minutes by default) are rejected.
 *
 * The route handler MUST read the raw request body (`await request.text()`) and verify it
 * before parsing it: re-serializing JSON changes the bytes and invalidates the signature.
 */

export const WEBHOOK_SIGNATURE_PREFIX = "sha256="
export const DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 300

/** Header names the PHP hook sends. Keep in sync with `whmcs-hook/ola_vps.php`. */
export const WEBHOOK_HEADERS = {
  eventId: "x-ola-event-id",
  timestamp: "x-ola-timestamp",
  signature: "x-ola-signature",
} as const

export type WebhookRejectionReason =
  | "missing_fields"
  | "bad_timestamp"
  | "stale_timestamp"
  | "future_timestamp"
  | "malformed_signature"
  | "signature_mismatch"

export type WebhookVerification =
  | { valid: true }
  | { valid: false; reason: WebhookRejectionReason; message: string }

export interface VerifyWebhookSignatureInput {
  /** The request body byte-for-byte, never a re-serialized object. */
  rawBody: string
  /** Unix seconds, as sent in `X-Ola-Timestamp`. */
  timestamp: string | number
  /** The `X-Ola-Signature` header value, including the `sha256=` prefix. */
  signature: string
  secret: string
  /** Default 300 s. */
  toleranceSeconds?: number
  /** Injectable clock, in milliseconds. Defaults to `Date.now()`. */
  nowMs?: number
}

/** Builds the signature for a body. Used by the tests and by any local replay tooling. */
export function signWebhookPayload(input: {
  rawBody: string
  timestamp: string | number
  secret: string
}): string {
  const digest = createHmac("sha256", input.secret)
    .update(`${input.timestamp}.${input.rawBody}`, "utf8")
    .digest("hex")
  return `${WEBHOOK_SIGNATURE_PREFIX}${digest}`
}

export function verifyWebhookSignature(input: VerifyWebhookSignatureInput): WebhookVerification {
  const { rawBody, signature, secret } = input
  if (!secret || !signature || rawBody === undefined || rawBody === null) {
    return reject("missing_fields", "rawBody, signature and secret are all required")
  }

  const timestampSeconds = Number(String(input.timestamp).trim())
  if (!Number.isFinite(timestampSeconds) || !Number.isInteger(timestampSeconds)) {
    return reject("bad_timestamp", "X-Ola-Timestamp is not an integer number of seconds")
  }

  const tolerance = input.toleranceSeconds ?? DEFAULT_WEBHOOK_TOLERANCE_SECONDS
  const nowSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000)
  const ageSeconds = nowSeconds - timestampSeconds
  if (ageSeconds > tolerance) {
    return reject("stale_timestamp", `webhook is ${ageSeconds}s old, tolerance is ${tolerance}s`)
  }
  // The same tolerance in the other direction absorbs clock skew without accepting
  // arbitrarily post-dated payloads.
  if (ageSeconds < -tolerance) {
    return reject("future_timestamp", `webhook timestamp is ${-ageSeconds}s in the future`)
  }

  if (!signature.startsWith(WEBHOOK_SIGNATURE_PREFIX)) {
    return reject("malformed_signature", `signature must start with "${WEBHOOK_SIGNATURE_PREFIX}"`)
  }

  const expected = signWebhookPayload({ rawBody, timestamp: timestampSeconds, secret })
  if (!constantTimeEquals(expected, signature)) {
    return reject("signature_mismatch", "HMAC does not match the body")
  }
  return { valid: true }
}

/** Throws instead of returning a result, for route handlers that answer 401 on throw. */
export class WebhookSignatureError extends Error {
  constructor(readonly reason: WebhookRejectionReason, message: string) {
    super(message)
    this.name = "WebhookSignatureError"
  }
}

export function assertWebhookSignature(input: VerifyWebhookSignatureInput): void {
  const result = verifyWebhookSignature(input)
  if (!result.valid) throw new WebhookSignatureError(result.reason, result.message)
}

function reject(reason: WebhookRejectionReason, message: string): WebhookVerification {
  return { valid: false, reason, message }
}

const encoder = new TextEncoder()

/**
 * Compares two hex signatures without leaking where they first differ. Lengths are compared
 * first because `timingSafeEqual` throws on a length mismatch; the length of a hex SHA-256
 * digest is public information, so that comparison leaks nothing.
 */
function constantTimeEquals(a: string, b: string): boolean {
  const left = encoder.encode(a)
  const right = encoder.encode(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

// ─── payload ─────────────────────────────────────────────────────────────────

/**
 * What `ola_vps.php` sends. Validated here so the route handler never reads an unchecked
 * field; the hook is ours, but the endpoint is public.
 */
export const WHMCS_WEBHOOK_EVENTS = ["invoice.paid", "invoice.cancelled", "client.updated"] as const
export type WhmcsWebhookEventName = (typeof WHMCS_WEBHOOK_EVENTS)[number]

const invoicePayloadSchema = z.object({
  invoiceId: whmcsInt,
  clientId: whmcsOptionalInt.optional().default(null),
  status: z.string().optional().default("Unpaid"),
  /** Integer cents. */
  total: whmcsCents.optional().default(0),
  transactionId: z.string().nullish().default(null),
  paymentMethod: z.string().nullish().default(null),
})

const clientPayloadSchema = z.object({
  clientId: whmcsInt,
  email: z.string().nullish().default(null),
  status: z.string().nullish().default(null),
  companyName: z.string().nullish().default(null),
  country: z.string().nullish().default(null),
  taxId: z.string().nullish().default(null),
})

export const whmcsWebhookEventSchema = z.discriminatedUnion("event", [
  z.object({
    event: z.literal("invoice.paid"),
    eventId: z.string().min(1),
    timestamp: whmcsInt,
    data: invoicePayloadSchema,
  }),
  z.object({
    event: z.literal("invoice.cancelled"),
    eventId: z.string().min(1),
    timestamp: whmcsInt,
    data: invoicePayloadSchema,
  }),
  z.object({
    event: z.literal("client.updated"),
    eventId: z.string().min(1),
    timestamp: whmcsInt,
    data: clientPayloadSchema,
  }),
])
export type WhmcsWebhookEvent = z.infer<typeof whmcsWebhookEventSchema>

/** Convenience for the invoice events: the WHMCS status narrowed to our own enum. */
export function webhookInvoiceDomainStatus(event: WhmcsWebhookEvent): "unpaid" | "paid" | "cancelled" | "refunded" {
  if (event.event === "client.updated") return "unpaid"
  return whmcsInvoiceStatusToDomain(event.data.status)
}
