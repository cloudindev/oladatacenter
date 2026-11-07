import type { z } from "zod"

import {
  WhmcsApiError,
  isWhmcsApiError,
  writesDisabledError,
} from "./errors"
import { encodePhpArrayParam, type PhpFlatArray } from "./php-serialize"
import {
  acceptOrderResponseSchema,
  addClientResponseSchema,
  addInvoicePaymentResponseSchema,
  addOrderResponseSchema,
  createInvoiceResponseSchema,
  createSsoTokenResponseSchema,
  getClientsDomainsResponseSchema,
  getClientsProductsResponseSchema,
  getClientsResponseSchema,
  getInvoiceResponseSchema,
  getInvoicesResponseSchema,
  updateClientProductResponseSchema,
  updateClientResponseSchema,
  whmcsEnvelopeSchema,
  whmcsInvoiceStatusToDomain,
  type WhmcsClientRecord,
  type WhmcsDomainRecord,
  type WhmcsInvoiceRow,
  type WhmcsServiceRecord,
} from "./types"
import type {
  CreateClientInput,
  CreateInvoiceInput,
  CreateOrderInput,
  CreateSsoTokenOptions,
  ListInvoicesFilter,
  RecordPaymentInput,
  UpdateClientInput,
  UpdateServiceInput,
  WhmcsClient,
  WhmcsClientAccount,
  WhmcsDomain,
  WhmcsInvoiceDetail,
  WhmcsInvoiceSummary,
  WhmcsLogger,
  WhmcsService,
  WhmcsSsoDestination,
} from "./client"

/**
 * HTTP adapter for WHMCS 8.13 (`includes/api.php`).
 *
 * Transport notes
 * ---------------
 * - Everything is a POST of `application/x-www-form-urlencoded` carrying `identifier`,
 *   `secret`, `action` and `responsetype=json`. WHMCS ignores the HTTP method for reads but
 *   refuses credentials in a query string, so there is no GET path.
 * - WHMCS requires an IP allowlist and Vercel has no static egress IP. When `proxyUrl` is
 *   set we POST the identical body to the proxy and put the real WHMCS endpoint in the
 *   `X-Target-Url` header; the proxy forwards it verbatim from its fixed IP and returns the
 *   response untouched. The adapter behaves identically either way — see
 *   `docs/whmcs-setup.md` for the proxy contract.
 * - Reads retry on 5xx / network / timeout with exponential backoff. Writes that may already
 *   have taken effect (`AddOrder`, `AddInvoicePayment`, `CreateInvoice`) are NEVER retried:
 *   the error is surfaced so the job can re-check by querying instead of double-charging.
 */

const DEFAULT_TIMEOUT_MS = 20_000
const DEFAULT_MAX_RETRIES = 3
const DEFAULT_BACKOFF_MS = 250
/** Listing pages: 100 rows each, at most 10 pages (1000 rows) per client. */
const PAGE_SIZE = 100
const MAX_PAGES = 10
/** Form field carrying the proxy token; stripped by the proxy before forwarding. */
export const PROXY_TOKEN_FIELD = "ola_proxy_token"

export interface HttpWhmcsClientOptions {
  /** Full URL of `includes/api.php`, e.g. `https://panel.cloudin.pro/includes/api.php`. */
  apiUrl: string
  identifier: string
  secret: string
  /** Optional fixed-IP forwarder. When set, requests go here with `X-Target-Url: apiUrl`. */
  proxyUrl?: string
  /** Shared secret the proxy requires in `X-Ola-Token`, so nobody else can use it. */
  proxyToken?: string
  /** Mirrors WHMCS_WRITE_ENABLED. When false every mutating method throws without calling. */
  writeEnabled: boolean
  /**
   * Allows single sign-on tokens even with writes off: a token lets the customer into their
   * own WHMCS client area and changes nothing in the books. Defaults to `writeEnabled`.
   */
  ssoEnabled?: boolean
  fetchImpl?: typeof fetch
  logger?: WhmcsLogger
  /** Correlation id for the whole job; a per-request id is generated when absent. */
  correlationId?: string
  timeoutMs?: number
  /** Number of RETRIES after the first attempt. Default 3, so at most 4 attempts. */
  maxRetries?: number
  /** Injected so tests do not actually sleep. */
  sleepImpl?: (ms: number) => Promise<void>
  nowMs?: () => number
}

interface RequestOptions {
  /** False for writes whose effect we cannot distinguish from a lost response. */
  retry: boolean
}

type FormValue = string | number | boolean | undefined | null

export class HttpWhmcsClient implements WhmcsClient {
  private readonly apiUrl: string
  private readonly identifier: string
  private readonly secret: string
  private readonly proxyUrl?: string
  private readonly proxyToken?: string
  private readonly writeEnabled: boolean
  private readonly ssoEnabled: boolean
  private readonly fetchImpl: typeof fetch
  private readonly logger?: WhmcsLogger
  private readonly correlationId?: string
  private readonly timeoutMs: number
  private readonly maxRetries: number
  private readonly sleepImpl: (ms: number) => Promise<void>
  private readonly nowMs: () => number

  constructor(options: HttpWhmcsClientOptions) {
    this.apiUrl = options.apiUrl
    this.identifier = options.identifier
    this.secret = options.secret
    this.proxyUrl = options.proxyUrl
    this.proxyToken = options.proxyToken
    this.writeEnabled = options.writeEnabled
    this.ssoEnabled = options.ssoEnabled ?? options.writeEnabled
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis)
    this.logger = options.logger
    this.correlationId = options.correlationId
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES
    this.sleepImpl = options.sleepImpl ?? defaultSleep
    this.nowMs = options.nowMs ?? (() => Date.now())
  }

  // ── clients ───────────────────────────────────────────────────────────────

  async findClientByEmail(email: string): Promise<WhmcsClientAccount | null> {
    const response = await this.request(
      "GetClients",
      { search: email, limitnum: 25, sorting: "ASC" },
      getClientsResponseSchema,
      { retry: true },
    )
    // `search` is a LIKE across name, company and email, so match the email exactly here.
    const wanted = email.trim().toLowerCase()
    const row = response.clients.find((client) => client.email.trim().toLowerCase() === wanted)
    return row ? toClientAccount(row) : null
  }

  async createClient(input: CreateClientInput): Promise<{ clientId: number }> {
    this.assertWriteEnabled("AddClient")
    const response = await this.request(
      "AddClient",
      {
        ...clientFields(input),
        // We own authentication: the WHMCS client gets no login of its own.
        noemail: true,
        skipvalidation: true,
      },
      addClientResponseSchema,
      { retry: true },
    )
    return { clientId: response.clientid }
  }

  async updateClient(clientId: number, input: UpdateClientInput): Promise<void> {
    this.assertWriteEnabled("UpdateClient")
    await this.request(
      "UpdateClient",
      { clientid: clientId, ...clientFields(input), status: input.status, skipvalidation: true },
      updateClientResponseSchema,
      { retry: true },
    )
  }

  // ── orders ────────────────────────────────────────────────────────────────

  async createOrder(input: CreateOrderInput): Promise<{ orderId: number; invoiceId: number }> {
    this.assertWriteEnabled("AddOrder")
    // AddOrder takes one product per numeric index; we only ever order one line at a time.
    const fields: Record<string, FormValue> = {
      clientid: input.clientId,
      "pid[0]": input.pid,
      "billingcycle[0]": input.billingcycle,
      "domain[0]": input.domain,
      paymentmethod: input.paymentmethod,
      noemail: input.noemail ?? true,
      // WHMCS must not email the invoice either; our own templates do that.
      noinvoiceemail: true,
      promocode: input.promoCode,
    }
    if (input.configoptions && Object.keys(input.configoptions).length > 0) {
      fields["configoptions[0]"] = encodePhpArrayParam(toPhpArray(input.configoptions))
    }
    if (input.customfields && Object.keys(input.customfields).length > 0) {
      fields["customfields[0]"] = encodePhpArrayParam(toPhpArray(input.customfields))
    }
    if (input.priceOverrideCents !== undefined) {
      fields["priceoverride[0]"] = centsToDecimal(input.priceOverrideCents)
    }
    const response = await this.request("AddOrder", fields, addOrderResponseSchema, {
      retry: false,
    })
    return { orderId: response.orderid, invoiceId: response.invoiceid }
  }

  async acceptOrder(orderId: number): Promise<void> {
    this.assertWriteEnabled("AcceptOrder")
    await this.request(
      "AcceptOrder",
      {
        orderid: orderId,
        // We provision at OVH ourselves: WHMCS must not run a provisioning module.
        autosetup: false,
        sendemail: false,
        sendregistrar: false,
      },
      acceptOrderResponseSchema,
      // Accepting an already-accepted order answers `result: "error"`, which is not retried
      // anyway, so a transport retry here is safe.
      { retry: true },
    )
  }

  // ── invoices and payments ─────────────────────────────────────────────────

  async recordPayment(input: RecordPaymentInput): Promise<void> {
    this.assertWriteEnabled("AddInvoicePayment")
    await this.request(
      "AddInvoicePayment",
      {
        invoiceid: input.invoiceId,
        transid: input.transactionId,
        gateway: input.gateway,
        date: formatWhmcsDateTime(input.date),
        amount: centsToDecimal(input.amount),
        fees: input.feesCents === undefined ? undefined : centsToDecimal(input.feesCents),
        noemail: true,
      },
      addInvoicePaymentResponseSchema,
      // Money. A lost response may still have landed, so never resend: re-check with
      // getInvoice instead.
      { retry: false },
    )
  }

  async createInvoice(input: CreateInvoiceInput): Promise<{ invoiceId: number }> {
    this.assertWriteEnabled("CreateInvoice")
    const fields: Record<string, FormValue> = {
      userid: input.clientId,
      status: input.status ?? "Unpaid",
      sendinvoice: input.sendInvoice ?? false,
      paymentmethod: input.paymentMethod,
      taxrate: input.taxRate,
      date: input.date === undefined ? undefined : formatWhmcsDate(input.date),
      duedate: input.dueDate === undefined ? undefined : formatWhmcsDate(input.dueDate),
      notes: input.notes,
    }
    input.lines.forEach((line, index) => {
      const n = index + 1
      fields[`itemdescription${n}`] = line.description
      fields[`itemamount${n}`] = centsToDecimal(line.amount)
      fields[`itemtaxed${n}`] = line.taxed ?? false
    })
    const response = await this.request("CreateInvoice", fields, createInvoiceResponseSchema, {
      retry: false,
    })
    return { invoiceId: response.invoiceid }
  }

  async getInvoice(invoiceId: number): Promise<WhmcsInvoiceDetail> {
    const response = await this.request(
      "GetInvoice",
      { invoiceid: invoiceId },
      getInvoiceResponseSchema,
      { retry: true },
    )
    return {
      invoiceId: response.invoiceid,
      invoiceNumber: response.invoicenum,
      clientId: response.userid,
      status: response.status,
      domainStatus: whmcsInvoiceStatusToDomain(response.status),
      date: response.date,
      dueDate: response.duedate,
      datePaid: response.datepaid,
      subtotalCents: response.subtotal,
      taxCents: response.tax + response.tax2,
      creditCents: response.credit,
      totalCents: response.total,
      balanceCents: response.balance,
      currencyCode: response.currencycode,
      paymentMethod: response.paymentmethod,
      notes: response.notes,
      items: response.items,
    }
  }

  async listInvoices(filter: ListInvoicesFilter): Promise<WhmcsInvoiceSummary[]> {
    const response = await this.request(
      "GetInvoices",
      {
        userid: filter.clientId,
        status: filter.status,
        limitnum: filter.limit ?? 100,
        limitstart: filter.offset,
        orderby: "id",
        order: "desc",
      },
      getInvoicesResponseSchema,
      { retry: true },
    )
    return response.invoices.map(toInvoiceSummary)
  }

  // ── services ──────────────────────────────────────────────────────────────

  async updateService(input: UpdateServiceInput): Promise<void> {
    this.assertWriteEnabled("UpdateClientProduct")
    await this.request(
      "UpdateClientProduct",
      {
        serviceid: input.serviceId,
        status: input.status,
        nextduedate:
          input.nextDueDate === undefined ? undefined : formatWhmcsDate(input.nextDueDate),
      },
      updateClientProductResponseSchema,
      { retry: true },
    )
  }

  async listServices(clientId: number): Promise<WhmcsService[]> {
    const rows: WhmcsServiceRecord[] = []
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const response = await this.request(
        "GetClientsProducts",
        { clientid: clientId, limitstart: page * PAGE_SIZE, limitnum: PAGE_SIZE, stats: false },
        getClientsProductsResponseSchema,
        { retry: true },
      )
      rows.push(...response.products)
      if (response.products.length < PAGE_SIZE || rows.length >= (response.totalresults ?? 0)) break
    }
    return rows.map(toService)
  }

  async listDomains(clientId: number): Promise<WhmcsDomain[]> {
    const rows: WhmcsDomainRecord[] = []
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const response = await this.request(
        "GetClientsDomains",
        { clientid: clientId, limitstart: page * PAGE_SIZE, limitnum: PAGE_SIZE },
        getClientsDomainsResponseSchema,
        { retry: true },
      )
      rows.push(...response.domains)
      if (response.domains.length < PAGE_SIZE || rows.length >= (response.totalresults ?? 0)) break
    }
    return rows.map(toDomain)
  }

  // ── single sign-on ────────────────────────────────────────────────────────

  async createSsoToken(
    clientId: number,
    destination: WhmcsSsoDestination,
    options: CreateSsoTokenOptions = {},
  ): Promise<{ redirectUrl: string }> {
    // CreateSsoToken issues a short-lived credential inside WHMCS: gated on its own switch.
    if (!this.ssoEnabled) this.assertWriteEnabled("CreateSsoToken")
    const response = await this.request(
      "CreateSsoToken",
      {
        client_id: clientId,
        destination,
        service_id: options.serviceId,
        sso_redirect_path: options.redirectPath,
      },
      createSsoTokenResponseSchema,
      { retry: true },
    )
    return { redirectUrl: response.redirect_url }
  }

  // ── plumbing ──────────────────────────────────────────────────────────────

  private assertWriteEnabled(action: string): void {
    if (this.writeEnabled) return
    this.logger?.warn({
      action,
      status: "skipped",
      durationMs: 0,
      correlationId: this.correlationId ?? "n/a",
      message: "WHMCS_WRITE_ENABLED is false",
    })
    throw writesDisabledError(action)
  }

  private async request<TSchema extends z.ZodTypeAny>(
    action: string,
    fields: Record<string, FormValue>,
    schema: TSchema,
    options: RequestOptions,
  ): Promise<z.output<TSchema>> {
    const correlationId = this.correlationId ?? newCorrelationId()
    const body = this.buildBody(action, fields)
    let attempt = 0

    for (;;) {
      attempt += 1
      const startedAt = this.nowMs()
      try {
        const result = await this.attempt(action, body, schema, correlationId)
        this.logger?.info({
          action,
          status: "success",
          httpStatus: result.httpStatus,
          durationMs: this.nowMs() - startedAt,
          correlationId,
          attempt,
        })
        return result.value
      } catch (error) {
        const apiError = asWhmcsApiError(error, action, correlationId)
        const durationMs = this.nowMs() - startedAt
        const canRetry = options.retry && apiError.retryable && attempt <= this.maxRetries
        this.logger?.[canRetry ? "warn" : "error"]({
          action,
          status: canRetry ? "retry" : "error",
          httpStatus: apiError.httpStatus,
          durationMs,
          correlationId,
          attempt,
          message: apiError.message,
        })
        if (!canRetry) throw apiError
        await this.sleepImpl(DEFAULT_BACKOFF_MS * 2 ** (attempt - 1))
      }
    }
  }

  /** One attempt: transport, HTTP status, JSON, envelope, schema. Throws `WhmcsApiError`. */
  private async attempt<TSchema extends z.ZodTypeAny>(
    action: string,
    body: string,
    schema: TSchema,
    correlationId: string,
  ): Promise<{ value: z.output<TSchema>; httpStatus: number }> {
    const target = this.proxyUrl ?? this.apiUrl
    const headers: Record<string, string> = {
      "content-type": "application/x-www-form-urlencoded; charset=utf-8",
      accept: "application/json",
      "x-ola-correlation-id": correlationId,
    }
    // The proxy only ever forwards; it must be told where. Documented in docs/whmcs-setup.md.
    if (this.proxyUrl) {
      headers["x-target-url"] = this.apiUrl
      // X-Ola-Token: Plesk strips headers containing "Proxy", so the old name never arrived.
      if (this.proxyToken) headers["x-ola-token"] = this.proxyToken
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    let response: Response
    try {
      response = await this.fetchImpl(target, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
        redirect: "follow",
      })
    } catch (error) {
      const aborted = controller.signal.aborted || isAbortError(error)
      throw new WhmcsApiError(
        aborted ? `request timed out after ${this.timeoutMs}ms` : transportMessage(error),
        { action, kind: aborted ? "timeout" : "network", correlationId, cause: error },
      )
    } finally {
      clearTimeout(timer)
    }

    const httpStatus = response.status
    const text = await response.text().catch(() => "")

    if (httpStatus >= 500) {
      throw new WhmcsApiError(`WHMCS returned HTTP ${httpStatus}`, {
        action,
        kind: "server_error",
        httpStatus,
        correlationId,
      })
    }
    if (httpStatus >= 400) {
      // 403 here is almost always "IP not allowlisted" or a bad API credential.
      throw new WhmcsApiError(`WHMCS returned HTTP ${httpStatus}: ${truncate(text)}`, {
        action,
        kind: "client_error",
        httpStatus,
        correlationId,
      })
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(text) as unknown
    } catch (error) {
      throw new WhmcsApiError(`response was not JSON: ${truncate(text)}`, {
        action,
        kind: "invalid_response",
        httpStatus,
        correlationId,
        cause: error,
      })
    }

    const envelope = whmcsEnvelopeSchema.safeParse(parsed)
    if (!envelope.success) {
      throw new WhmcsApiError(`response has no usable "result": ${truncate(text)}`, {
        action,
        kind: "invalid_response",
        httpStatus,
        correlationId,
      })
    }
    if (envelope.data.result !== "success") {
      throw new WhmcsApiError(envelope.data.message ?? "WHMCS reported an error", {
        action,
        kind: "api_error",
        httpStatus,
        correlationId,
      })
    }

    const validated = schema.safeParse(parsed)
    if (!validated.success) {
      throw new WhmcsApiError(`unexpected response shape: ${validated.error.message}`, {
        action,
        kind: "invalid_response",
        httpStatus,
        correlationId,
        cause: validated.error,
      })
    }
    return { value: validated.data as z.output<TSchema>, httpStatus }
  }

  private buildBody(action: string, fields: Record<string, FormValue>): string {
    const params = new URLSearchParams()
    params.set("identifier", this.identifier)
    params.set("secret", this.secret)
    params.set("action", action)
    params.set("responsetype", "json")
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined || value === null) continue
      // WHMCS reads booleans with its own truthiness helper: "1"/"0" is always understood.
      params.set(key, typeof value === "boolean" ? (value ? "1" : "0") : String(value))
    }
    // Also in the body: front-ends may strip custom headers, never the body. The proxy
    // removes this field before forwarding, so WHMCS never sees it.
    if (this.proxyUrl && this.proxyToken) params.set(PROXY_TOKEN_FIELD, this.proxyToken)
    return params.toString()
  }
}

// ─── mapping ─────────────────────────────────────────────────────────────────

function toClientAccount(row: WhmcsClientRecord): WhmcsClientAccount {
  return {
    clientId: row.id,
    email: row.email,
    firstName: row.firstname,
    lastName: row.lastname,
    companyName: row.companyname,
    address1: row.address1,
    city: row.city,
    postcode: row.postcode,
    state: row.state,
    country: row.country,
    phoneNumber: row.phonenumber,
    taxId: row.tax_id,
    currencyCode: row.currency_code,
    status: row.status,
  }
}

function toInvoiceSummary(row: WhmcsInvoiceRow): WhmcsInvoiceSummary {
  return {
    invoiceId: row.invoiceid,
    invoiceNumber: row.invoicenum,
    clientId: row.userid,
    status: row.status,
    domainStatus: whmcsInvoiceStatusToDomain(row.status),
    date: row.date,
    dueDate: row.duedate,
    datePaid: row.datepaid,
    subtotalCents: row.subtotal,
    taxCents: row.tax + row.tax2,
    creditCents: row.credit,
    totalCents: row.total,
    balanceCents: row.balance,
    currencyCode: row.currencycode,
    paymentMethod: row.paymentmethod,
  }
}

function toService(row: WhmcsServiceRecord): WhmcsService {
  return {
    serviceId: row.id,
    clientId: row.clientid,
    orderId: row.orderid,
    pid: row.pid,
    productName: row.name,
    groupName: row.groupname,
    ips: [row.dedicatedip, ...(row.assignedips ?? "").split(/[\s,]+/)].filter(
      (ip): ip is string => typeof ip === "string" && ip.length > 0,
    ),
    domain: row.domain,
    status: row.status,
    registrationDate: row.regdate,
    nextDueDate: row.nextduedate,
    billingCycle: row.billingcycle,
    recurringAmountCents: row.recurringamount,
    paymentMethod: row.paymentmethod,
  }
}

function toDomain(row: WhmcsDomainRecord): WhmcsDomain {
  return {
    domainId: row.id,
    domain: row.domainname,
    status: row.status,
    registrationDate: row.regdate,
    expiryDate: row.expirydate,
    nextDueDate: row.nextduedate,
    recurringAmountCents: row.recurringamount,
    registrationPeriod: row.registrationperiod,
    doNotRenew: row.donotrenew,
  }
}

/** The WHMCS field names for AddClient / UpdateClient, minus whatever the caller omitted. */
function clientFields(input: UpdateClientInput): Record<string, FormValue> {
  return {
    firstname: input.firstName,
    lastname: input.lastName,
    companyname: input.companyName,
    email: input.email,
    address1: input.address1,
    address2: input.address2,
    city: input.city,
    state: input.state,
    postcode: input.postcode,
    country: input.country,
    phonenumber: input.phoneNumber,
    tax_id: input.taxId,
    currency: input.currencyCode,
    language: input.language,
    clientip: input.clientIp,
    notes: input.notes,
  }
}

// ─── formatting ──────────────────────────────────────────────────────────────

function toPhpArray(input: Readonly<Record<number, string | number>>): PhpFlatArray {
  const out: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(input)) out[key] = value
  return out
}

/** Integer cents -> the decimal string WHMCS stores, e.g. `1210` -> `"12.10"`. */
export function centsToDecimal(cents: number): string {
  if (!Number.isInteger(cents)) throw new TypeError(`amount must be integer cents, got ${cents}`)
  const sign = cents < 0 ? "-" : ""
  const absolute = Math.abs(cents)
  return `${sign}${Math.trunc(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`
}

/** `YYYY-MM-DD`, UTC. */
export function formatWhmcsDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * `YYYY-MM-DD HH:mm:ss`, UTC. WHMCS stores this verbatim and renders it in the admin's own
 * timezone, so keep WHMCS configured to UTC (see docs/whmcs-setup.md).
 */
export function formatWhmcsDateTime(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ")
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function newCorrelationId(): string {
  const maybeCrypto: { randomUUID?: () => string } | undefined = globalThis.crypto
  if (typeof maybeCrypto?.randomUUID === "function") return maybeCrypto.randomUUID()
  return `whmcs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function asWhmcsApiError(error: unknown, action: string, correlationId: string): WhmcsApiError {
  if (isWhmcsApiError(error)) return error
  return new WhmcsApiError(transportMessage(error), {
    action,
    kind: "network",
    correlationId,
    cause: error,
  })
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError"
}

function transportMessage(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`
  return String(error)
}

function truncate(text: string, max = 300): string {
  const collapsed = text.replace(/\s+/g, " ").trim()
  return collapsed.length > max ? `${collapsed.slice(0, max)}…` : collapsed
}
