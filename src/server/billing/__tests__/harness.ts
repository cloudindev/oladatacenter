/**
 * The test harness: a complete `BillingDeps` with `MockStripe`, the in-memory store and
 * fake ports. The catalog port is driven by the SAME OVH fixture `packages/core` tests use,
 * so the amounts asserted here are the real published prices.
 *
 * Nothing in here touches Postgres, Stripe, WHMCS, Resend or Inngest.
 */
import rawCatalog from "../../../../packages/core/test/fixtures/ovh-catalog-vps-es.json" with { type: "json" }

import {
  PLAN_BRANDING,
  buildQuote,
  parseCatalog,
  type ParsedCatalog,
  type Quote,
  type Term,
} from "@ola/core"
import { MockStripe } from "@/lib/stripe/mock"

import type { BillingCustomer, BillingService, InvoiceRecord, PaymentMethodRecord } from "../data"
import type {
  AuditPort,
  BillingDeps,
  BillingEvent,
  BillingEventName,
  BillingLedgerPort,
  CatalogPort,
  CheckoutConfiguration,
  EventBusPort,
  NotifierPort,
  PricedConfiguration,
  RawConfigurationParams,
  WhmcsInvoiceLine,
} from "../ports"
import { FakeBillingStore, type FakeStoreSeed } from "./fake-store"

export const catalog: ParsedCatalog = parseCatalog(rawCatalog)

/** Fixed clock, so every expiry assertion is stable. */
export const NOW = new Date("2026-11-06T10:00:00.000Z")

const PLAN_CODE_BY_SLUG: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(PLAN_BRANDING).map(([planCode, branding]) => [branding.slug, planCode]),
)

const DATACENTER_BY_SLUG: Readonly<Record<string, string>> = {
  gravelines: "GRA",
  estrasburgo: "SBG",
  roubaix: "EU-WEST-RBX",
  francfort: "DE",
  londres: "UK",
}

const OS_BY_SLUG: Readonly<Record<string, string>> = {
  "debian-13": "Debian 13",
  "ubuntu-24-04": "Ubuntu 24.04",
}

export const DEFAULT_CONFIGURATION: CheckoutConfiguration = {
  plan: "s",
  dc: "gravelines",
  os: "debian-13",
  term: "P1M",
  addons: [],
}

function firstValue(value: string | readonly string[] | undefined): string | undefined {
  if (value === undefined) return undefined
  return typeof value === "string" ? value : value[0]
}

/** Builds the real `Quote` for a configuration, through `buildQuote`. */
export function quoteFor(configuration: CheckoutConfiguration): Quote {
  const planCode = PLAN_CODE_BY_SLUG[configuration.plan]
  if (!planCode) throw new Error(`unknown plan slug ${configuration.plan}`)
  return buildQuote(catalog, {
    planCode,
    term: configuration.term,
    datacenter: DATACENTER_BY_SLUG[configuration.dc] ?? "GRA",
    operatingSystem: OS_BY_SLUG[configuration.os] ?? "Debian 13",
    addonCodes: [...configuration.addons],
  })
}

export function fakeCatalog(): CatalogPort {
  return {
    async resolve(raw: RawConfigurationParams): Promise<CheckoutConfiguration> {
      const plan = firstValue(raw.plan)
      const term = firstValue(raw.term)
      return {
        plan: plan && PLAN_CODE_BY_SLUG[plan] ? plan : DEFAULT_CONFIGURATION.plan,
        dc: firstValue(raw.dc) ?? DEFAULT_CONFIGURATION.dc,
        os: firstValue(raw.os) ?? DEFAULT_CONFIGURATION.os,
        term: term === "P12M" || term === "anual" ? ("P12M" as Term) : ("P1M" as Term),
        addons: (firstValue(raw.addons) ?? "")
          .split(",")
          .map((value) => value.trim())
          .filter((value) => value.length > 0),
      }
    },

    async price(configuration: CheckoutConfiguration): Promise<PricedConfiguration> {
      const quote = quoteFor(configuration)
      const planCode = PLAN_CODE_BY_SLUG[configuration.plan] ?? "vps-2027-model1"
      return {
        configuration,
        quote,
        planName: PLAN_BRANDING[planCode]?.name ?? "OLA VPS",
        datacenterLabel: "Gravelines, Francia",
        osLabel: OS_BY_SLUG[configuration.os] ?? "Debian 13",
        // Customer-safe lines: a label and two prices, never our cost.
        lines: quote.lines.map((line) => ({
          slug: line.code,
          label: line.kind === "plan" ? (PLAN_BRANDING[planCode]?.name ?? "OLA VPS") : line.label,
          family: line.kind === "plan" ? "plan" : (line.family ?? "addon"),
          monthlyPrice: line.monthlyPrice,
          cyclePrice: line.cyclePrice,
          mandatory: line.mandatory,
        })),
      }
    },
  }
}

export interface FakeLedger extends BillingLedgerPort {
  readonly invoicesCreated: {
    whmcsClientId: number
    lines: readonly WhmcsInvoiceLine[]
    taxRatePercent: number | null
    status: string
  }[]
}

export function fakeLedger(options: { whmcsClientId?: number | null } = {}): FakeLedger {
  const invoicesCreated: FakeLedger["invoicesCreated"] = []
  let nextInvoiceId = 5000

  return {
    invoicesCreated,
    async ensureClient(): Promise<number | null> {
      return options.whmcsClientId === undefined ? 4242 : options.whmcsClientId
    },
    async createInvoice(input) {
      nextInvoiceId += 1
      invoicesCreated.push({
        whmcsClientId: input.whmcsClientId,
        lines: input.lines,
        taxRatePercent: input.taxRatePercent,
        status: input.status,
      })
      return { invoiceId: nextInvoiceId }
    },
    // No `recordPayment`: the jobs layer's `ola/payment.succeeded` handler is the only
    // writer that books a payment in WHMCS.
    async invoiceAreaUrl() {
      return "https://billing.example/clientarea/invoices?token=mock"
    },
  }
}

export interface FakeNotifier extends NotifierPort {
  readonly sent: { template: string; to: string }[]
}

export function fakeNotifier(): FakeNotifier {
  const sent: FakeNotifier["sent"] = []
  return {
    sent,
    async orderReceived(input) {
      sent.push({ template: "order-received", to: input.to })
    },
    async paymentFailed(input) {
      sent.push({ template: "payment-failed", to: input.to })
    },
    async creditExpiring(input) {
      sent.push({ template: "credit-expiring", to: input.to })
    },
    async orderRefunded(input) {
      sent.push({ template: "order-failed", to: input.to })
    },
  }
}

export interface FakeEvents extends EventBusPort {
  /** Events that reached the queue. */
  readonly emitted: BillingEvent[]
  /** Events the queue refused, in order — what a down Inngest would have lost. */
  readonly dropped: BillingEvent[]
}

/**
 * `failing` lists event names the fake queue refuses, so a test can take Inngest down for
 * exactly one event (say `ola/payment.succeeded`) while the alert still gets through.
 */
export function fakeEvents(options: { failing?: readonly BillingEventName[] } = {}): FakeEvents {
  const emitted: BillingEvent[] = []
  const dropped: BillingEvent[] = []
  const failing = new Set<string>(options.failing ?? [])
  return {
    emitted,
    dropped,
    async emit(event) {
      if (failing.has(event.name)) {
        dropped.push(event)
        return false
      }
      emitted.push(event)
      return true
    },
  }
}

export interface FakeAudit extends AuditPort {
  readonly entries: { entity: string; action: string }[]
}

export function fakeAudit(): FakeAudit {
  const entries: FakeAudit["entries"] = []
  return {
    entries,
    async record(entry) {
      entries.push({ entity: entry.entity, action: entry.action })
    },
  }
}

// ─── fixtures ────────────────────────────────────────────────────────────────

export function spanishCompany(overrides: Partial<BillingCustomer> = {}): BillingCustomer {
  return {
    id: "cust_es",
    userId: "user_es",
    email: "cliente@example.es",
    kind: "company",
    legalName: "Ejemplo S.L.",
    country: "ES",
    taxId: "B12345678",
    taxIdValidated: true,
    status: "verified",
    phone: "+34600000000",
    phoneVerifiedAt: NOW,
    emailVerifiedAt: NOW,
    whmcsClientId: 4242,
    stripeCustomerId: "cus_es",
    firstPaidAt: NOW,
    billingComplete: true,
    ...overrides,
  }
}

/** German company with a VIES-validated VAT number: reverse charge, 0 %. */
export function reverseChargeCompany(overrides: Partial<BillingCustomer> = {}): BillingCustomer {
  return spanishCompany({
    id: "cust_de",
    userId: "user_de",
    email: "kunde@example.de",
    legalName: "Beispiel GmbH",
    country: "DE",
    taxId: "DE123456789",
    taxIdValidated: true,
    stripeCustomerId: "cus_de",
    ...overrides,
  })
}

export function card(
  overrides: Partial<PaymentMethodRecord> = {},
): PaymentMethodRecord {
  return {
    id: "pm_row_1",
    customerId: "cust_es",
    stripePaymentMethodId: "pm_card_visa",
    fingerprint: "fp_visa",
    brand: "visa",
    last4: "4242",
    expMonth: 12,
    expYear: 2030,
    verifiedAt: NOW,
    isDefault: true,
    detachedAt: null,
    createdAt: NOW,
    ...overrides,
  }
}

export function activeService(overrides: Partial<BillingService> = {}): BillingService {
  return {
    id: "svc_1",
    customerId: "cust_es",
    status: "active",
    displayName: "mi-servidor",
    term: "P1M",
    monthlyPrice: 898,
    nextDueAt: new Date("2026-12-01T00:00:00.000Z"),
    whmcsServiceId: 77,
    ...overrides,
  }
}

export function unpaidInvoice(overrides: Partial<InvoiceRecord> = {}): InvoiceRecord {
  return {
    id: "inv_1",
    customerId: "cust_es",
    serviceId: "svc_1",
    orderId: null,
    whmcsInvoiceId: 9001,
    number: "2026-0001",
    status: "unpaid",
    subtotal: 898,
    tax: 189,
    credit: 0,
    total: 1087,
    dueAt: new Date("2026-12-01T00:00:00.000Z"),
    paidAt: null,
    createdAt: NOW,
    ...overrides,
  }
}

export interface Harness {
  deps: BillingDeps
  store: FakeBillingStore
  stripe: MockStripe
  ledger: FakeLedger
  notifier: FakeNotifier
  events: FakeEvents
  audit: FakeAudit
}

export function harness(
  seed: FakeStoreSeed = {},
  options: {
    whmcsClientId?: number | null
    webhookSecret?: string
    failingEvents?: readonly BillingEventName[]
  } = {},
): Harness {
  const store = new FakeBillingStore(seed)
  const stripe = new MockStripe({
    webhookSecret: options.webhookSecret ?? "whsec_test",
    now: () => NOW,
  })
  const ledger = fakeLedger(
    options.whmcsClientId === undefined ? {} : { whmcsClientId: options.whmcsClientId },
  )
  const notifier = fakeNotifier()
  const events = fakeEvents({ failing: options.failingEvents ?? [] })
  const audit = fakeAudit()

  // Register the seeded cards with Stripe so a confirmation can find them.
  for (const method of seed.paymentMethods ?? []) {
    stripe.seedPaymentMethod(method.stripePaymentMethodId, null)
  }
  for (const customer of seed.customers ?? []) {
    if (customer.stripeCustomerId) {
      // Seeded with its own id so `ensureCustomer` reuses it instead of creating one.
      void stripe.ensureCustomer({
        stripeCustomerId: customer.stripeCustomerId,
        email: customer.email,
      })
    }
  }

  const deps: BillingDeps = {
    store,
    stripe,
    catalog: fakeCatalog(),
    ledger,
    notifier,
    events,
    audit,
    now: () => NOW,
    siteUrl: "https://oladc.test",
  }

  return { deps, store, stripe, ledger, notifier, events, audit }
}

/** The session shape `createOrderDraft` takes. */
export function sessionFor(customer: BillingCustomer) {
  return {
    user: { id: customer.userId, email: customer.email },
    customer: { id: customer.id },
  }
}
