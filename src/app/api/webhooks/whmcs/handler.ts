import { DEFAULT_WEBHOOK_TOLERANCE_SECONDS, whmcsWebhookEventSchema } from "@ola/whmcs"
import type { VerifyWebhookSignatureInput, WebhookVerification } from "@ola/whmcs"
import { directStepTools } from "@/inngest/steps"
import { handlePaymentSucceeded } from "@/inngest/jobs/renewals"
import type { CustomerProfilePatch, JobDeps } from "@/inngest/ports"

/**
 * Receiver for the WHMCS PHP hook (`whmcs-hook/ola_vps.php`).
 *
 * Three guarantees:
 *  1. the HMAC is verified before the body is read as data (`401`, with no explanation,
 *     on failure — a probe must not learn whether it was the clock or the digest);
 *  2. processing is idempotent through `webhookEvents` (provider "whmcs", unique on
 *     `eventId`): a redelivery answers 200 and does nothing;
 *  3. a verified event we do not know is a 200, so WHMCS stops retrying it.
 *
 * `invoice.paid` is the path that matters: it is how a bank transfer registered by hand in
 * WHMCS brings a suspended server back to life.
 */

export const SIGNATURE_TOLERANCE_SECONDS = DEFAULT_WEBHOOK_TOLERANCE_SECONDS

/** `verifyWebhookSignature` from `@ola/whmcs`; tests pass a stub with the same shape. */
export type SignatureVerifier = (input: VerifyWebhookSignatureInput) => WebhookVerification

export interface WhmcsWebhookRequest {
  /** The body byte for byte: re-serialising it invalidates the signature. */
  rawBody: string
  timestamp: string | null
  signature: string | null
  secret: string | null
  correlationId: string
}

export interface WhmcsWebhookResponse {
  status: 200 | 401 | 500
  body: { ok: boolean; duplicate?: boolean; handled?: string }
}

const UNAUTHORIZED: WhmcsWebhookResponse = { status: 401, body: { ok: false } }

/** WHMCS sends ids as numbers or as numeric strings depending on the hook. */
function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return Math.trunc(parsed)
  }
  return null
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null
}

/** WHMCS money arrives as a decimal string ("12.34"). We keep integer cents. */
function asCents(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value * 100)
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(",", "."))
    if (Number.isFinite(parsed)) return Math.round(parsed * 100)
  }
  return null
}

interface InvoiceEvent {
  eventId: string
  kind: "invoice.paid" | "invoice.cancelled"
  invoiceId: number
  clientId: number | null
  totalCents: number
  transactionId: string | null
  paidAt: Date | null
}

interface ClientEvent {
  eventId: string
  kind: "client.updated"
  clientId: number
  profile: CustomerProfilePatch
}

type NormalizedEvent = InvoiceEvent | ClientEvent | { eventId: string; kind: "unknown" }

/**
 * Normalises the payload.
 *
 * `whmcsWebhookEventSchema` from `@ola/whmcs` is the contract our PHP hook emits
 * (`invoice.paid`, `invoice.cancelled`, `client.updated`). The second branch accepts the
 * raw WHMCS hook names and snake_case fields as well, so a hook deployed from an older
 * revision is still processed instead of being silently dropped.
 */
export function normalizeWhmcsEvent(raw: unknown): NormalizedEvent | null {
  const canonical = whmcsWebhookEventSchema.safeParse(raw)
  if (canonical.success) {
    const event = canonical.data
    if (event.event === "client.updated") {
      return {
        eventId: event.eventId,
        kind: "client.updated",
        clientId: event.data.clientId,
        profile: profilePatch({
          companyname: event.data.companyName,
          country: event.data.country,
          tax_id: event.data.taxId,
        }),
      }
    }
    return {
      eventId: event.eventId,
      kind: event.event === "invoice.paid" ? "invoice.paid" : "invoice.cancelled",
      invoiceId: event.data.invoiceId,
      clientId: event.data.clientId ?? null,
      totalCents: event.data.total,
      transactionId: event.data.transactionId ?? null,
      paidAt: null,
    }
  }

  if (typeof raw !== "object" || raw === null) return null
  const legacy = raw as Record<string, unknown>
  const eventId = asString(legacy.eventId ?? legacy.event_id)
  const name = asString(legacy.event)
  if (!eventId || !name) return null
  const data = (
    typeof legacy.data === "object" && legacy.data !== null ? legacy.data : {}
  ) as Record<string, unknown>

  if (name === "InvoicePaid" || name === "InvoiceCancelled") {
    const invoiceId = asNumber(data.invoiceid ?? data.invoiceId)
    if (invoiceId === null) return { eventId, kind: "unknown" }
    const paidAtRaw = asString(data.date ?? data.datepaid)
    return {
      eventId,
      kind: name === "InvoicePaid" ? "invoice.paid" : "invoice.cancelled",
      invoiceId,
      clientId: asNumber(data.userid ?? data.clientId),
      totalCents: asCents(data.amount ?? data.total) ?? 0,
      transactionId: asString(data.transid ?? data.transactionId),
      paidAt: paidAtRaw ? new Date(paidAtRaw) : null,
    }
  }

  if (name === "ClientEdit" || name === "ClientChangePassword") {
    const clientId = asNumber(data.userid ?? data.clientId)
    if (clientId === null) return { eventId, kind: "unknown" }
    return { eventId, kind: "client.updated", clientId, profile: profilePatch(data) }
  }

  return { eventId, kind: "unknown" }
}

/** Only the columns we own are mirrored; the login email is ours, never WHMCS's. */
function profilePatch(data: Record<string, unknown>): CustomerProfilePatch {
  const patch: CustomerProfilePatch = {}
  const company = asString(data.companyname ?? data.companyName)
  const address1 = asString(data.address1)
  const address2 = asString(data.address2)
  const city = asString(data.city)
  const postcode = asString(data.postcode ?? data.postalCode)
  const country = asString(data.country)
  const phone = asString(data.phonenumber ?? data.phoneNumber)
  const taxId = asString(data.tax_id ?? data.taxId)

  if (company !== null) patch.legalName = company
  if (address1 !== null) patch.addressLine1 = address1
  if (address2 !== null) patch.addressLine2 = address2
  if (city !== null) patch.city = city
  if (postcode !== null) patch.postalCode = postcode
  if (country !== null) patch.country = country.toUpperCase()
  if (phone !== null) patch.phone = phone
  if (taxId !== null) patch.taxId = taxId
  return patch
}

export async function handleWhmcsWebhook(
  deps: JobDeps,
  verify: SignatureVerifier,
  request: WhmcsWebhookRequest,
): Promise<WhmcsWebhookResponse> {
  const log = deps.log(request.correlationId, { job: "whmcs-webhook" })

  if (!request.secret || !request.signature || !request.timestamp) return UNAUTHORIZED

  let verification: WebhookVerification
  try {
    verification = verify({
      rawBody: request.rawBody,
      timestamp: request.timestamp,
      signature: request.signature,
      secret: request.secret,
      toleranceSeconds: SIGNATURE_TOLERANCE_SECONDS,
    })
  } catch (error) {
    verification = {
      valid: false,
      reason: "signature_mismatch",
      message: error instanceof Error ? error.message : String(error),
    }
  }
  if (!verification.valid) {
    log.warn({ reason: verification.reason }, "whmcs webhook rejected")
    return UNAUTHORIZED
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(request.rawBody)
  } catch {
    log.warn({}, "whmcs webhook body is not JSON")
    return { status: 200, body: { ok: true } }
  }

  const event = normalizeWhmcsEvent(parsed)
  if (!event) {
    // Verified, but nothing we can key on: answer 200 so WHMCS stops retrying.
    log.warn({}, "whmcs webhook payload could not be normalised")
    return { status: 200, body: { ok: true } }
  }

  const claim = await deps.db.claimWebhookEvent({
    provider: "whmcs",
    eventId: event.eventId,
    eventType: event.kind,
    payload: parsed as Record<string, unknown>,
  })
  if (claim === "duplicate") {
    log.info({ eventId: event.eventId, event: event.kind }, "whmcs webhook duplicate ignored")
    return { status: 200, body: { ok: true, duplicate: true } }
  }

  try {
    const handled = await dispatch(deps, event, request.correlationId)
    await deps.db.markWebhookProcessed("whmcs", event.eventId, null)
    log.info({ eventId: event.eventId, event: event.kind, handled }, "whmcs webhook processed")
    return { status: 200, body: { ok: true, handled } }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    await deps.db.markWebhookProcessed("whmcs", event.eventId, detail)
    await deps.alerts.raise({
      severity: "critical",
      title: "Webhook de WHMCS fallido",
      entity: "webhook",
      entityId: event.eventId,
      detail: `${event.kind}: ${detail}`,
      correlationId: request.correlationId,
    })
    log.error({ eventId: event.eventId, error: detail }, "whmcs webhook failed")
    return { status: 500, body: { ok: false } }
  }
}

async function dispatch(
  deps: JobDeps,
  event: NormalizedEvent,
  correlationId: string,
): Promise<string> {
  switch (event.kind) {
    case "invoice.paid":
      return invoicePaid(deps, event, correlationId)
    case "invoice.cancelled":
      return invoiceCancelled(deps, event, correlationId)
    case "client.updated":
      return clientUpdated(deps, event, correlationId)
    default:
      // Verified but unknown: accepted and ignored.
      return "ignored"
  }
}

/* -------------------------------------------------------------------------- */
/* invoice.paid                                                               */
/* -------------------------------------------------------------------------- */

async function invoicePaid(
  deps: JobDeps,
  event: InvoiceEvent,
  correlationId: string,
): Promise<string> {
  const paidAt = event.paidAt ?? deps.now()
  let invoice = await deps.db.findInvoiceByWhmcsId(event.invoiceId)
  const customer =
    (invoice ? await deps.db.getCustomer(invoice.customerId) : null) ??
    (event.clientId !== null ? await deps.db.findCustomerByWhmcsClientId(event.clientId) : null)

  if (!customer) {
    await deps.alerts.raise({
      severity: "warning",
      title: "Factura pagada en WHMCS sin cliente conocido",
      entity: "invoice",
      entityId: null,
      detail: `whmcsInvoiceId=${event.invoiceId} whmcsClientId=${event.clientId ?? "null"}`,
      correlationId,
    })
    return "unknown_customer"
  }

  const amountCents = event.totalCents > 0 ? event.totalCents : (invoice?.total ?? 0)

  if (!invoice) {
    // The invoice was created inside WHMCS: mirror it before marking it paid.
    invoice = await deps.db.upsertInvoice({
      customerId: customer.id,
      whmcsInvoiceId: event.invoiceId,
      status: "paid",
      total: amountCents,
      paidAt,
    })
  }

  const outcome = await handlePaymentSucceeded(deps, directStepTools, {
    customerId: customer.id,
    serviceId: invoice.serviceId ?? undefined,
    invoiceId: invoice.id,
    whmcsInvoiceId: event.invoiceId,
    // WHMCS is the payer of record here; `source: "whmcs"` stops us registering it again.
    stripePaymentIntentId: event.transactionId ?? `whmcs-invoice-${event.invoiceId}`,
    amountCents,
    paidAt: paidAt.toISOString(),
    source: "whmcs",
    correlationId,
  })

  await deps.audit.record({
    actorType: "webhook",
    entity: "invoice",
    entityId: invoice.id,
    action: "whmcs.invoice.paid",
    diff: { whmcsInvoiceId: event.invoiceId, amountCents, outcome: outcome.status },
    correlationId,
  })
  return `invoice_paid:${outcome.status}`
}

/* -------------------------------------------------------------------------- */
/* invoice.cancelled                                                          */
/* -------------------------------------------------------------------------- */

async function invoiceCancelled(
  deps: JobDeps,
  event: InvoiceEvent,
  correlationId: string,
): Promise<string> {
  const invoice = await deps.db.findInvoiceByWhmcsId(event.invoiceId)
  if (!invoice) return "unknown_invoice"

  await deps.db.updateInvoice(invoice.id, { status: "cancelled" })
  await deps.audit.record({
    actorType: "webhook",
    entity: "invoice",
    entityId: invoice.id,
    action: "whmcs.invoice.cancelled",
    diff: { whmcsInvoiceId: event.invoiceId, status: { from: invoice.status, to: "cancelled" } },
    correlationId,
  })
  return "invoice_cancelled"
}

/* -------------------------------------------------------------------------- */
/* client.updated                                                             */
/* -------------------------------------------------------------------------- */

async function clientUpdated(
  deps: JobDeps,
  event: ClientEvent,
  correlationId: string,
): Promise<string> {
  const customer = await deps.db.findCustomerByWhmcsClientId(event.clientId)
  if (!customer) return "unknown_customer"

  // Only fields that really changed are written, so the audit diff stays readable.
  const current: Record<string, unknown> = { ...customer }
  const patch: CustomerProfilePatch = {}
  for (const [key, value] of Object.entries(event.profile)) {
    if (value !== undefined && current[key] !== value) {
      Object.assign(patch, { [key]: value })
    }
  }
  if (Object.keys(patch).length === 0) return "client_unchanged"

  await deps.db.updateCustomerProfile(customer.id, patch)
  await deps.audit.record({
    actorType: "webhook",
    entity: "customer",
    entityId: customer.id,
    action: "whmcs.client.edited",
    diff: { ...patch },
    correlationId,
  })
  return "client_edited"
}
