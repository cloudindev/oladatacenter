import { z } from "zod"

/**
 * zod schemas for the WHMCS 8.13 responses we consume.
 *
 * WHMCS is an old PHP application with a JSON veneer, so the schemas here absorb four quirks
 * and hand the adapter clean, typed data:
 *
 *  1. Numbers arrive as strings (`"12"`, `"12.10"`, sometimes `""`).
 *  2. Money arrives as a decimal string in the client's currency; our domain is integer cents.
 *  3. Lists are wrapped twice (`{ clients: { client: [...] } }`) and collapse to a single
 *     object when there is exactly one row.
 *  4. An EMPTY list is an empty string or an empty object, never an empty array.
 *
 * `result` is always present and is `"success"` or `"error"`. Anything else is an error.
 */

// ─── scalar coercions ────────────────────────────────────────────────────────

/** `"12"` / `12` / `12.0` -> `12`. Empty and non-numeric values fail validation. */
export const whmcsInt = z.preprocess((value) => {
  if (typeof value === "number") return Number.isInteger(value) ? value : Math.trunc(value)
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (trimmed === "") return value
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? Math.trunc(parsed) : value
  }
  return value
}, z.number().int())

/** Same as `whmcsInt` but tolerates the field being absent, `null` or `""` -> `null`. */
export const whmcsOptionalInt = z.preprocess((value) => {
  if (value === undefined || value === null) return null
  if (typeof value === "string" && value.trim() === "") return null
  return value
}, z.union([whmcsInt, z.null()]))

/** `"12.10"` -> `1210`. Money is ALWAYS integer cents on our side of the port. */
export const whmcsCents = z.preprocess((value) => {
  if (typeof value === "number") return Math.round(value * 100)
  if (typeof value === "string") {
    const trimmed = value.trim().replace(/,/g, "")
    if (trimmed === "") return 0
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : value
  }
  return value
}, z.number().int())

/** WHMCS writes `"0000-00-00"` / `""` for "no date". Both become `null`. */
export const whmcsDate = z.preprocess((value) => {
  if (value === undefined || value === null) return null
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  if (trimmed === "" || trimmed.startsWith("0000-00-00")) return null
  return trimmed
}, z.union([z.string(), z.null()]))

/** WHMCS booleans come back as `"1"` / `"0"` / `"on"` / `true`. */
export const whmcsBoolean = z.preprocess((value) => {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value !== 0
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase()
    if (["1", "true", "on", "yes"].includes(trimmed)) return true
    if (["", "0", "false", "off", "no"].includes(trimmed)) return false
  }
  return value
}, z.boolean())

const optionalText = z.preprocess((value) => {
  if (value === undefined || value === null) return null
  if (typeof value === "string" && value.trim() === "") return null
  if (typeof value === "number") return String(value)
  return value
}, z.union([z.string(), z.null()]))

// ─── envelope ────────────────────────────────────────────────────────────────

export const whmcsResultSchema = z.enum(["success", "error"])
export type WhmcsResult = z.infer<typeof whmcsResultSchema>

/**
 * The only thing we trust before validating anything else. `result` must be present and must
 * be one of the two documented values; a body without it is a proxy/HTML/garbage response.
 */
export const whmcsEnvelopeSchema = z.object({
  result: whmcsResultSchema,
  message: z.string().optional(),
})
export type WhmcsEnvelope = z.infer<typeof whmcsEnvelopeSchema>

/** Response of a write that returns nothing but an acknowledgement. */
export const whmcsAckSchema = z.object({ result: whmcsResultSchema })

/**
 * Unwraps WHMCS's double-wrapped list shape into a plain array.
 *
 *   `{ client: [a, b] }` -> `[a, b]`     (normal case)
 *   `{ client: a }`      -> `[a]`        (exactly one row)
 *   `{}` / `""` / absent -> `[]`         (no rows — WHMCS never sends `[]`)
 */
function whmcsList<TRow extends z.ZodTypeAny>(
  rowKey: string,
  row: TRow,
): z.ZodType<z.output<TRow>[], z.ZodTypeDef, unknown> {
  return z.preprocess((value) => {
    if (value === undefined || value === null || value === "") return []
    if (Array.isArray(value)) return value
    if (typeof value === "object") {
      const inner = (value as Record<string, unknown>)[rowKey]
      if (inner === undefined || inner === null || inner === "") return []
      return Array.isArray(inner) ? inner : [inner]
    }
    return value
  }, z.array(row)) as z.ZodType<z.output<TRow>[], z.ZodTypeDef, unknown>
}

// ─── clients ─────────────────────────────────────────────────────────────────

/**
 * One row of `GetClients`, which is also a safe subset of `GetClientsDetails`.
 * Only `id` and `email` are guaranteed; everything else may be blank for a stub client.
 */
export const whmcsClientSchema = z.object({
  id: whmcsInt,
  firstname: optionalText,
  lastname: optionalText,
  companyname: optionalText,
  email: z.string(),
  address1: optionalText.optional().default(null),
  address2: optionalText.optional().default(null),
  city: optionalText.optional().default(null),
  state: optionalText.optional().default(null),
  postcode: optionalText.optional().default(null),
  country: optionalText.optional().default(null),
  phonenumber: optionalText.optional().default(null),
  tax_id: optionalText.optional().default(null),
  currency_code: optionalText.optional().default(null),
  status: optionalText.optional().default(null),
  datecreated: whmcsDate.optional().default(null),
})
export type WhmcsClientRecord = z.infer<typeof whmcsClientSchema>

export const getClientsResponseSchema = z.object({
  result: whmcsResultSchema,
  totalresults: whmcsOptionalInt.optional().default(null),
  clients: whmcsList("client", whmcsClientSchema).optional().default([]),
})

/** `GetClientsDetails` flattens the client onto the root and ALSO nests it under `client`. */
export const getClientDetailsResponseSchema = z.object({
  result: whmcsResultSchema,
  client: whmcsClientSchema.optional(),
  userid: whmcsOptionalInt.optional().default(null),
  id: whmcsOptionalInt.optional().default(null),
  email: z.string().optional(),
})

export const addClientResponseSchema = z.object({
  result: whmcsResultSchema,
  clientid: whmcsInt,
})

export const updateClientResponseSchema = z.object({
  result: whmcsResultSchema,
  clientid: whmcsOptionalInt.optional().default(null),
})

// ─── orders ──────────────────────────────────────────────────────────────────

export const addOrderResponseSchema = z.object({
  result: whmcsResultSchema,
  orderid: whmcsInt,
  /** `0` when the order was created with `noinvoice`; we always want a real invoice. */
  invoiceid: whmcsInt,
  /** Comma-separated ids, e.g. `"41"` or `"41,42"`. */
  productids: optionalText.optional().default(null),
  serviceids: optionalText.optional().default(null),
})

export const acceptOrderResponseSchema = whmcsAckSchema

// ─── invoices ────────────────────────────────────────────────────────────────

/**
 * WHMCS invoice statuses, verbatim. Our own `invoices.status` enum is narrower, so use
 * `whmcsInvoiceStatusToDomain` when persisting.
 */
export const WHMCS_INVOICE_STATUSES = [
  "Draft",
  "Unpaid",
  "Paid",
  "Cancelled",
  "Refunded",
  "Collections",
  "Payment Pending",
] as const
export type WhmcsInvoiceStatus = (typeof WHMCS_INVOICE_STATUSES)[number]

export type DomainInvoiceStatus = "unpaid" | "paid" | "cancelled" | "refunded"

/** Anything unknown is treated as unpaid: safe direction, never marks money as received. */
export function whmcsInvoiceStatusToDomain(status: string): DomainInvoiceStatus {
  switch (status.trim().toLowerCase()) {
    case "paid":
      return "paid"
    case "cancelled":
    case "canceled":
      return "cancelled"
    case "refunded":
      return "refunded"
    default:
      return "unpaid"
  }
}

export const whmcsInvoiceItemSchema = z.object({
  id: whmcsOptionalInt.optional().default(null),
  type: optionalText.optional().default(null),
  relid: whmcsOptionalInt.optional().default(null),
  description: optionalText.optional().default(null),
  amount: whmcsCents.optional().default(0),
  taxed: whmcsBoolean.optional().default(false),
})
export type WhmcsInvoiceItem = z.infer<typeof whmcsInvoiceItemSchema>

const invoiceMoney = {
  subtotal: whmcsCents.optional().default(0),
  credit: whmcsCents.optional().default(0),
  tax: whmcsCents.optional().default(0),
  tax2: whmcsCents.optional().default(0),
  total: whmcsCents.optional().default(0),
  balance: whmcsCents.optional().default(0),
}

/** `GetInvoice`: the single-invoice shape, with items. */
export const getInvoiceResponseSchema = z.object({
  result: whmcsResultSchema,
  invoiceid: whmcsInt,
  invoicenum: optionalText.optional().default(null),
  userid: whmcsInt,
  date: whmcsDate.optional().default(null),
  duedate: whmcsDate.optional().default(null),
  datepaid: whmcsDate.optional().default(null),
  status: z.string(),
  paymentmethod: optionalText.optional().default(null),
  taxrate: optionalText.optional().default(null),
  notes: optionalText.optional().default(null),
  currencycode: optionalText.optional().default(null),
  ...invoiceMoney,
  items: whmcsList("item", whmcsInvoiceItemSchema).optional().default([]),
})

/**
 * One row of `GetInvoices`. The list endpoint names the primary key `id` while `GetInvoice`
 * names it `invoiceid`; normalise to `invoiceid` so callers never have to care.
 */
export const whmcsInvoiceRowSchema = z.preprocess(
  (value) => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return value
    const row = { ...(value as Record<string, unknown>) }
    if (row.invoiceid === undefined && row.id !== undefined) row.invoiceid = row.id
    return row
  },
  z.object({
    invoiceid: whmcsInt,
    invoicenum: optionalText.optional().default(null),
    userid: whmcsInt,
    date: whmcsDate.optional().default(null),
    duedate: whmcsDate.optional().default(null),
    datepaid: whmcsDate.optional().default(null),
    status: z.string(),
    paymentmethod: optionalText.optional().default(null),
    currencycode: optionalText.optional().default(null),
    ...invoiceMoney,
  }),
)

export type WhmcsInvoiceRow = z.infer<typeof whmcsInvoiceRowSchema>

export const getInvoicesResponseSchema = z.object({
  result: whmcsResultSchema,
  totalresults: whmcsOptionalInt.optional().default(null),
  invoices: whmcsList("invoice", whmcsInvoiceRowSchema).optional().default([]),
})

export const createInvoiceResponseSchema = z.object({
  result: whmcsResultSchema,
  invoiceid: whmcsInt,
})

export const addInvoicePaymentResponseSchema = whmcsAckSchema

// ─── products / services ─────────────────────────────────────────────────────

export const whmcsServiceRowSchema = z.object({
  id: whmcsInt,
  clientid: whmcsInt,
  orderid: whmcsOptionalInt.optional().default(null),
  pid: whmcsInt,
  name: optionalText.optional().default(null),
  groupname: optionalText.optional().default(null),
  domain: optionalText.optional().default(null),
  dedicatedip: optionalText.optional().default(null),
  /** Extra IPs, one per line. */
  assignedips: optionalText.optional().default(null),
  status: z.string(),
  regdate: whmcsDate.optional().default(null),
  nextduedate: whmcsDate.optional().default(null),
  billingcycle: optionalText.optional().default(null),
  recurringamount: whmcsCents.optional().default(0),
  firstpaymentamount: whmcsCents.optional().default(0),
  paymentmethod: optionalText.optional().default(null),
  paymentmethodname: optionalText.optional().default(null),
})
export type WhmcsServiceRecord = z.infer<typeof whmcsServiceRowSchema>

export const getClientsProductsResponseSchema = z.object({
  result: whmcsResultSchema,
  totalresults: whmcsOptionalInt.optional().default(null),
  products: whmcsList("product", whmcsServiceRowSchema).optional().default([]),
})

// ─── domains ─────────────────────────────────────────────────────────────────

/**
 * One row of `GetClientsDomains`. Only the fields the customer area shows: the response
 * also carries registrar and EPP data that must never leave the server.
 */
export const whmcsDomainRowSchema = z.object({
  id: whmcsInt,
  domainname: z.string(),
  status: z.string(),
  regdate: whmcsDate.optional().default(null),
  expirydate: whmcsDate.optional().default(null),
  nextduedate: whmcsDate.optional().default(null),
  recurringamount: whmcsCents.optional().default(0),
  registrationperiod: whmcsOptionalInt.optional().default(null),
  donotrenew: whmcsBoolean.optional().default(false),
})
export type WhmcsDomainRecord = z.infer<typeof whmcsDomainRowSchema>

export const getClientsDomainsResponseSchema = z.object({
  result: whmcsResultSchema,
  totalresults: whmcsOptionalInt.optional().default(null),
  domains: whmcsList("domain", whmcsDomainRowSchema).optional().default([]),
})

export const updateClientProductResponseSchema = z.object({
  result: whmcsResultSchema,
  serviceid: whmcsOptionalInt.optional().default(null),
})

// ─── single sign-on ──────────────────────────────────────────────────────────

export const createSsoTokenResponseSchema = z.object({
  result: whmcsResultSchema,
  access_token: z.string(),
  redirect_url: z.string(),
})
