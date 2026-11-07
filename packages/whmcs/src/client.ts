/**
 * The WHMCS port.
 *
 * WHMCS is the accounting book of record: every customer, order, invoice and payment that
 * exists on our platform must also exist there. We charge with Stripe and then REGISTER the
 * payment in WHMCS, which is why `recordPayment` exists and no "charge" method does.
 *
 * Rules baked into this interface:
 *  - Methods are named for what WE need, never for the WHMCS action. The action names live
 *    only in `http-client.ts`.
 *  - There is NO delete method, by design. WHMCS rows are cancelled or marked, never removed.
 *  - Money is integer cents everywhere, like the rest of `@ola/core`.
 *  - Every mutating method is gated by the adapter's `writeEnabled` flag (WHMCS_WRITE_ENABLED)
 *    and throws `WhmcsApiError` with kind `writes_disabled` instead of calling the API.
 *
 * ── configoptions / customfields encoding ──────────────────────────────────────────────────
 * WHMCS's `AddOrder` documents these two parameters as "base64 encoded serialized array",
 * i.e. `base64_encode(serialize(array($optionId => $value)))`, and unserializes them on its
 * side. We implement exactly that (see `php-serialize.ts`) rather than the `configoptions[N]`
 * bracket form, because the bracket form is what the *order form in the browser* posts and
 * is not what `includes/api/addorder.php` reads — it reads the product-indexed array
 * `configoptions[0]` whose VALUE is the base64 blob. So the wire format we emit is:
 *
 *     pid[0]=12&billingcycle[0]=monthly&configoptions[0]=<base64(serialize(...))>
 *
 * The array keys are WHMCS configurable-option ids and the values are the chosen
 * configurable-option-value ids (or the literal value for quantity/text options). Resolving
 * our domain names (datacenter / OS / term / addons) to those ids is the caller's job;
 * `buildConfigOptions` below is the one place that mapping is expressed.
 */

import type {
  DomainInvoiceStatus,
  WhmcsInvoiceItem,
} from "./types"

// ─── logging ─────────────────────────────────────────────────────────────────

export interface WhmcsLogFields {
  /** The WHMCS action name, e.g. `AddInvoicePayment`. Never a credential. */
  action: string
  status: "success" | "error" | "retry" | "skipped"
  durationMs: number
  correlationId: string
  httpStatus?: number
  attempt?: number
  message?: string
}

export interface WhmcsLogger {
  info(fields: WhmcsLogFields): void
  warn(fields: WhmcsLogFields): void
  error(fields: WhmcsLogFields): void
}

// ─── clients ─────────────────────────────────────────────────────────────────

/**
 * A WHMCS client as we care about it. Named `…Account` because `WhmcsClient` is the port
 * interface below.
 */
export interface WhmcsClientAccount {
  clientId: number
  email: string
  firstName: string | null
  lastName: string | null
  companyName: string | null
  address1: string | null
  city: string | null
  postcode: string | null
  state: string | null
  /** ISO 3166-1 alpha-2, as WHMCS stores it. */
  country: string | null
  phoneNumber: string | null
  /** VAT number. WHMCS calls this field `tax_id`. */
  taxId: string | null
  currencyCode: string | null
  /** WHMCS client status: `Active`, `Inactive`, `Closed`. */
  status: string | null
}

export interface CreateClientInput {
  firstName: string
  lastName: string
  email: string
  /** `company` customers must have one; WHMCS treats a non-empty value as "is a company". */
  companyName?: string
  address1: string
  address2?: string
  city: string
  state?: string
  postcode: string
  /** ISO 3166-1 alpha-2. WHMCS rejects anything else. */
  country: string
  phoneNumber?: string
  /** VAT number. Only send it once VIES has validated it. */
  taxId?: string
  /** ISO 4217. Must match a currency configured in WHMCS; we only use EUR. */
  currencyCode?: string
  /** WHMCS language name, e.g. `spanish`. */
  language?: string
  /** Customer IP at signup, for WHMCS's own fraud log. */
  clientIp?: string
  notes?: string
}

/** Every field optional: we only ever push what actually changed. */
export type UpdateClientInput = Partial<CreateClientInput> & {
  /** `Active` | `Inactive` | `Closed`. We never delete a client. */
  status?: WhmcsClientStatus
}

export const WHMCS_CLIENT_STATUSES = ["Active", "Inactive", "Closed"] as const
export type WhmcsClientStatus = (typeof WHMCS_CLIENT_STATUSES)[number]

// ─── orders ──────────────────────────────────────────────────────────────────

/** The only two cycles we sell. `P1M` -> monthly, `P12M` -> annually. */
export type WhmcsBillingCycle = "monthly" | "annually"

/** WHMCS configurable-option id -> chosen option-value id (or literal for quantity/text). */
export type WhmcsConfigOptions = Readonly<Record<number, string | number>>

/** WHMCS custom-field id -> value. */
export type WhmcsCustomFields = Readonly<Record<number, string | number>>

export interface CreateOrderInput {
  clientId: number
  /** WHMCS product id of the plan, in the hidden "OLA VPS" group. */
  pid: number
  billingcycle: WhmcsBillingCycle
  /** See the configoptions note at the top of this file. */
  configoptions?: WhmcsConfigOptions
  customfields?: WhmcsCustomFields
  /** WHMCS gateway name, e.g. `stripe`. The gateway must exist even though we charge outside. */
  paymentmethod: string
  /**
   * Always true in production: WHMCS must not email the customer, we own every email.
   * Defaults to true.
   */
  noemail?: boolean
  /** WHMCS requires a non-empty "domain" per line item; we send our own service label. */
  domain?: string
  /** Overrides the product price for this order, in integer cents. Our price is the truth. */
  priceOverrideCents?: number
  promoCode?: string
}

// ─── invoices ────────────────────────────────────────────────────────────────

export interface WhmcsInvoiceSummary {
  invoiceId: number
  invoiceNumber: string | null
  clientId: number
  /** Raw WHMCS status (`Unpaid`, `Paid`, …). */
  status: string
  /** The same status narrowed to our own `invoices.status` enum. */
  domainStatus: DomainInvoiceStatus
  /** `YYYY-MM-DD` as WHMCS stores it, in the WHMCS server's timezone. `null` when unset. */
  date: string | null
  dueDate: string | null
  datePaid: string | null
  subtotalCents: number
  taxCents: number
  creditCents: number
  totalCents: number
  balanceCents: number
  currencyCode: string | null
  paymentMethod: string | null
}

export interface WhmcsInvoiceDetail extends WhmcsInvoiceSummary {
  notes: string | null
  items: readonly WhmcsInvoiceItem[]
}

export interface ListInvoicesFilter {
  clientId: number
  /** WHMCS filters on its own status names. */
  status?: WhmcsInvoiceStatusFilter
  limit?: number
  offset?: number
}

export const WHMCS_INVOICE_STATUS_FILTERS = [
  "Draft",
  "Unpaid",
  "Paid",
  "Cancelled",
  "Refunded",
  "Collections",
  "Payment Pending",
] as const
export type WhmcsInvoiceStatusFilter = (typeof WHMCS_INVOICE_STATUS_FILTERS)[number]

export interface RecordPaymentInput {
  invoiceId: number
  /** INTEGER CENTS, like everywhere else in the platform. Converted to decimal on the wire. */
  amount: number
  /** Stripe PaymentIntent / Charge id. WHMCS rejects a duplicate, which is our idempotency. */
  transactionId: string
  /** WHMCS gateway name, e.g. `stripe`. */
  gateway: string
  /** When the money actually moved. Sent as `YYYY-MM-DD HH:mm:ss` in UTC. */
  date: Date
  /** Gateway fee in integer cents, if we want it on the books. */
  feesCents?: number
}

export interface CreateInvoiceLine {
  description: string
  /** Integer cents. */
  amount: number
  /** Whether this line is subject to the invoice tax rate. */
  taxed?: boolean
}

export interface CreateInvoiceInput {
  clientId: number
  /** Defaults to `Unpaid`. We create the invoice first and register the payment after. */
  status?: "Draft" | "Unpaid" | "Paid"
  paymentMethod: string
  lines: readonly CreateInvoiceLine[]
  /** Defaults to today in WHMCS. */
  date?: Date
  dueDate?: Date
  /** Percentage, e.g. `21` for Spanish VAT. Omit for reverse charge / out of scope. */
  taxRate?: number
  notes?: string
  /** Defaults to false: WHMCS never emails our customers. */
  sendInvoice?: boolean
}

// ─── services ────────────────────────────────────────────────────────────────

export const WHMCS_SERVICE_STATUSES = [
  "Pending",
  "Active",
  "Suspended",
  "Terminated",
  "Cancelled",
  "Fraud",
  "Completed",
] as const
export type WhmcsServiceStatus = (typeof WHMCS_SERVICE_STATUSES)[number]

export interface WhmcsService {
  serviceId: number
  clientId: number
  orderId: number | null
  /** WHMCS product id. */
  pid: number
  productName: string | null
  /** Product group as named in WHMCS, e.g. "Hosting Web". */
  groupName: string | null
  /** Dedicated IP plus any assigned ones, in that order. */
  ips: string[]
  /** WHMCS's per-line "domain" field: we store our service label there. */
  domain: string | null
  status: string
  registrationDate: string | null
  nextDueDate: string | null
  billingCycle: string | null
  recurringAmountCents: number
  paymentMethod: string | null
}

export interface WhmcsDomain {
  domainId: number
  domain: string
  status: string
  registrationDate: string | null
  expiryDate: string | null
  nextDueDate: string | null
  recurringAmountCents: number
  /** Years per renewal. */
  registrationPeriod: number | null
  /** True when the customer asked not to renew it. */
  doNotRenew: boolean
}

export interface UpdateServiceInput {
  serviceId: number
  status?: WhmcsServiceStatus
  /** Sent as `YYYY-MM-DD`. */
  nextDueDate?: Date
}

// ─── single sign-on ──────────────────────────────────────────────────────────

/**
 * WHMCS SSO destinations we use. `sso:custom_redirect` needs `redirectPath`; the
 * `clientarea:*` destinations land straight on the matching page.
 */
export const WHMCS_SSO_DESTINATIONS = [
  "sso:custom_redirect",
  "clientarea:services",
  "clientarea:invoices",
  "clientarea:billing_info",
  "clientarea:product_details",
] as const
export type WhmcsSsoDestination = (typeof WHMCS_SSO_DESTINATIONS)[number]

export interface CreateSsoTokenOptions {
  /** Required by `clientarea:product_details`. */
  serviceId?: number
  /** Required by `sso:custom_redirect`, e.g. `/index.php?rp=/download/1`. */
  redirectPath?: string
}

// ─── the port ────────────────────────────────────────────────────────────────

export interface WhmcsClient {
  /** `null` when WHMCS has nobody with that email. Reads are always allowed. */
  findClientByEmail(email: string): Promise<WhmcsClientAccount | null>

  /** WRITE. Creates the client without a WHMCS login: our platform owns authentication. */
  createClient(input: CreateClientInput): Promise<{ clientId: number }>

  /** WRITE. Only sends the fields present in `input`. */
  updateClient(clientId: number, input: UpdateClientInput): Promise<void>

  /**
   * WRITE, NOT RETRYABLE. Creates the order and its invoice in one call. If this throws, the
   * caller must re-check with `listInvoices` / `listServices` before trying again: WHMCS may
   * well have created the order before the connection died.
   */
  createOrder(input: CreateOrderInput): Promise<{ orderId: number; invoiceId: number }>

  /** WRITE. Moves the order to Active without running WHMCS's own provisioning module. */
  acceptOrder(orderId: number): Promise<void>

  /**
   * WRITE, NOT RETRYABLE. Registers a payment we already took with Stripe. WHMCS refuses a
   * duplicate `transactionId`, which is what makes the job safe to re-run after a re-check.
   */
  recordPayment(input: RecordPaymentInput): Promise<void>

  /** WRITE, NOT RETRYABLE. For charges that do not come from a product order (credit, proration). */
  createInvoice(input: CreateInvoiceInput): Promise<{ invoiceId: number }>

  getInvoice(invoiceId: number): Promise<WhmcsInvoiceDetail>

  listInvoices(filter: ListInvoicesFilter): Promise<WhmcsInvoiceSummary[]>

  /** WRITE. Suspend / unsuspend / terminate and renewal dates. Never deletes. */
  updateService(input: UpdateServiceInput): Promise<void>

  /** Every product of one client, all pages. */
  listServices(clientId: number): Promise<WhmcsService[]>

  /** Every domain of one client, all pages. Needs `GetClientsDomains` in the API role. */
  listDomains(clientId: number): Promise<WhmcsDomain[]>

  /** WRITE. Short-lived token so the customer reaches the WHMCS client area already logged in. */
  createSsoToken(
    clientId: number,
    destination: WhmcsSsoDestination,
    options?: CreateSsoTokenOptions,
  ): Promise<{ redirectUrl: string }>
}

// ─── helpers shared by both implementations ──────────────────────────────────

/** `Term` from `@ola/core` -> the WHMCS billing cycle name. */
export function billingCycleForTerm(term: "P1M" | "P12M"): WhmcsBillingCycle {
  return term === "P12M" ? "annually" : "monthly"
}

/**
 * The single place where our domain configuration is mapped onto WHMCS configurable-option
 * ids. `ids` comes from the WHMCS product setup (see `docs/whmcs-setup.md`) and must be
 * supplied by configuration, never hard-coded in a service.
 */
export interface OlaConfigOptionIds {
  /** Configurable option id of the "Datacenter" dropdown. */
  datacenter: number
  /** Configurable option id of the "Sistema operativo" dropdown. */
  os: number
  /** Configurable option id of the "Compromiso" dropdown (monthly / annual). */
  term: number
  /** Addon slug -> configurable option id of that addon's yes/no or quantity option. */
  addons?: Readonly<Record<string, number>>
}

export interface OlaConfigSelection {
  /** Configurable-option-value id of the chosen datacenter. */
  datacenter: string | number
  os: string | number
  term: string | number
  /** Addon slug -> chosen option-value id or quantity. Unknown slugs are ignored. */
  addons?: Readonly<Record<string, string | number>>
}

export function buildConfigOptions(
  ids: OlaConfigOptionIds,
  selection: OlaConfigSelection,
): WhmcsConfigOptions {
  const options: Record<number, string | number> = {
    [ids.datacenter]: selection.datacenter,
    [ids.os]: selection.os,
    [ids.term]: selection.term,
  }
  if (selection.addons && ids.addons) {
    for (const [slug, value] of Object.entries(selection.addons)) {
      const optionId = ids.addons[slug]
      if (optionId !== undefined) options[optionId] = value
    }
  }
  return options
}
