import "server-only"

import { DomainError, TERM_MONTHS, type Quote } from "@ola/core"
import { stripeGateway } from "@/lib/stripe/client"

import { billingStore } from "./store"
import {
  BILLING_EVENTS,
  type AuditPort,
  type BillingDeps,
  type BillingEvent,
  type BillingLedgerPort,
  type CatalogPort,
  type CheckoutConfiguration,
  type EventBusPort,
  type NotifierPort,
  type PricedConfiguration,
  type RawConfigurationParams,
  type WhmcsInvoiceLine,
} from "./ports"

/**
 * Where billing meets the modules other people own.
 *
 * Every cross-module call is a lazy `import()` inside the method that needs it. That is
 * deliberate: the test suite injects fakes and therefore never loads the catalog service,
 * the email package or the Inngest client, and a module that is still being written
 * elsewhere cannot break the billing unit tests.
 *
 * TODO(integration): the names below are the ones documented in `docs/architecture.md` and
 * in the build brief. If a signature lands differently, fix it HERE — never by growing a
 * second implementation.
 */

const WHMCS_GATEWAY = "stripe"

// ─── catalog ─────────────────────────────────────────────────────────────────

/**
 * TODO(integration): expects `loadCatalog()`, `listSellablePlans()` and `quoteFor(request)`
 * in `src/server/catalog/service.ts`, and the shared slug helpers in
 * `@ola/core/catalog/presentation` — the same ones the public configurator encodes with.
 */
export function liveCatalog(): CatalogPort {
  return {
    async resolve(raw: RawConfigurationParams): Promise<CheckoutConfiguration> {
      const [service, presentation] = await Promise.all([
        import("@/server/catalog/service"),
        import("@ola/core/catalog/presentation"),
      ])
      const plans = await service.listSellablePlans()
      const config = presentation.resolveConfig(plans, raw)
      return { plan: config.plan, dc: config.dc, os: config.os, term: config.term, addons: config.addons }
    },

    async price(configuration: CheckoutConfiguration): Promise<PricedConfiguration> {
      const service = await import("@/server/catalog/service")
      const publicConfig = {
        plan: configuration.plan,
        dc: configuration.dc,
        os: configuration.os,
        term: configuration.term,
        addons: [...configuration.addons],
      }

      let quote: Quote
      let publicQuote: Awaited<ReturnType<typeof service.publicQuoteFor>>
      try {
        // `quoteFor` carries our cost; `publicQuoteFor` is the same figures with the cost
        // and OVH's own plan name stripped out. Both read the cached catalog.
        quote = await service.quoteFor(publicConfig)
        publicQuote = await service.publicQuoteFor(publicConfig)
      } catch (error) {
        throw new DomainError("catalog_out_of_sync", {
          detail: error instanceof Error ? error.message : String(error),
          cause: error,
        })
      }

      return {
        configuration,
        quote,
        planName: publicQuote.planName,
        datacenterLabel: publicQuote.datacenter,
        osLabel: publicQuote.os,
        lines: publicQuote.lines.map((line) => ({
          slug: line.slug,
          label: line.label,
          family: line.family,
          monthlyPrice: line.monthlyPrice,
          cyclePrice: line.cyclePrice,
          mandatory: line.mandatory,
        })),
      }
    },
  }
}

// ─── WHMCS ───────────────────────────────────────────────────────────────────

export function liveLedger(): BillingLedgerPort {
  return {
    async ensureClient(customerId: string): Promise<number | null> {
      const store = billingStore()
      const customer = await store.getCustomer(customerId)
      if (!customer) return null
      if (customer.whmcsClientId !== null) return customer.whmcsClientId

      // Billing never CREATES a WHMCS client: the `whmcs_client` provisioning step owns
      // that, because it is the only place with the full postal address. We only adopt a
      // client that already exists for this email.
      const { whmcs } = await import("@/server/providers")
      const existing = await whmcs().findClientByEmail(customer.email)
      return existing?.clientId ?? null
    },

    async createInvoice(input): Promise<{ invoiceId: number }> {
      const { whmcs } = await import("@/server/providers")
      return whmcs().createInvoice({
        clientId: input.whmcsClientId,
        status: input.status,
        paymentMethod: WHMCS_GATEWAY,
        lines: input.lines.map((line: WhmcsInvoiceLine) => ({
          description: line.description,
          amount: line.amount,
          taxed: line.taxed,
        })),
        ...(input.taxRatePercent === null ? {} : { taxRate: input.taxRatePercent }),
        ...(input.notes === null ? {} : { notes: input.notes }),
        sendInvoice: false,
      })
    },

    async invoiceAreaUrl(whmcsClientId: number): Promise<string | null> {
      try {
        const { whmcs } = await import("@/server/providers")
        const token = await whmcs().createSsoToken(whmcsClientId, "clientarea:invoices")
        return token.redirectUrl
      } catch {
        // A missing SSO link must never break the billing page; it falls back to a notice.
        return null
      }
    },
  }
}

// ─── email ───────────────────────────────────────────────────────────────────

/**
 * The shared sender from `src/server/providers.ts` — the one place adapters are built. It
 * already picks `MockEmailSender` when the providers are mocked or no Resend key is set,
 * so billing has no sender of its own to keep in step.
 */
async function sender() {
  const { emailSender } = await import("@/server/providers")
  return emailSender()
}

function daysUntil(from: Date, to: Date): number {
  return Math.max(0, Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)))
}

export function liveNotifier(siteUrl: string): NotifierPort {
  return {
    async orderReceived(input): Promise<void> {
      const target = await sender()
      await target.send({
        to: input.to,
        template: "order-received",
        props: {
          ...(input.name === null ? {} : { name: input.name }),
          orderRef: input.orderRef,
          planName: input.planName,
          amountCents: input.amountCents,
          termLabel: input.termLabel,
          orderUrl: input.orderUrl,
          customerAreaUrl: `${siteUrl}/app`,
        },
      })
    },

    async paymentFailed(input): Promise<void> {
      const target = await sender()
      await target.send({
        to: input.to,
        template: "payment-failed",
        props: {
          ...(input.name === null ? {} : { name: input.name }),
          serviceName: input.serviceName,
          invoiceRef: input.invoiceRef,
          amountCents: input.amountCents,
          retryDate: input.retryDate,
          suspendDate: input.suspendDate,
          deletionDate: input.deletionDate,
          updateCardUrl: input.updateCardUrl,
          ...(input.cardBrand === null ? {} : { cardBrand: input.cardBrand }),
          ...(input.cardLast4 === null ? {} : { cardLast4: input.cardLast4 }),
          customerAreaUrl: `${siteUrl}/app`,
        },
      })
    },

    async creditExpiring(input): Promise<void> {
      const target = await sender()
      await target.send({
        to: input.to,
        template: "credit-expiring",
        props: {
          ...(input.name === null ? {} : { name: input.name }),
          amountCents: input.amountCents,
          days: daysUntil(new Date(), input.expiresAt),
          expiresAt: input.expiresAt,
          shopUrl: `${siteUrl}/vps`,
          customerAreaUrl: `${siteUrl}/app`,
        },
      })
    },

    async orderRefunded(input): Promise<void> {
      const target = await sender()
      await target.send({
        to: input.to,
        template: "order-failed",
        props: {
          ...(input.name === null ? {} : { name: input.name }),
          orderRef: input.orderRef,
          ...(input.planName === null ? {} : { planName: input.planName }),
          refundedCents: input.refundedCents,
          supportUrl: input.supportUrl,
          customerAreaUrl: `${siteUrl}/app`,
        },
      })
    },
  }
}

// ─── Inngest ─────────────────────────────────────────────────────────────────

/**
 * Expects `src/inngest/client.ts` to export an `inngest` client with Inngest's own
 * `send({ name, data })`. A queue that cannot be reached is logged and reported as `false`,
 * never thrown: the money has already moved, and the caller decides whether a lost event
 * is merely a delay or something a human has to know about right now.
 */
export function liveEvents(): EventBusPort {
  return {
    async emit(event: BillingEvent): Promise<boolean> {
      try {
        const { inngest } = await import("@/inngest/client")
        // The switch is what narrows the union down to one event payload per branch,
        // which is how Inngest's typed `send` stays checked.
        switch (event.name) {
          case BILLING_EVENTS.orderPaid:
            await inngest.send({ name: event.name, data: event.data })
            break
          case BILLING_EVENTS.paymentSucceeded:
            await inngest.send({ name: event.name, data: event.data })
            break
          case BILLING_EVENTS.paymentFailed:
            await inngest.send({ name: event.name, data: event.data })
            break
          case BILLING_EVENTS.alertRaise:
            await inngest.send({ name: event.name, data: event.data })
            break
        }
        return true
      } catch (error) {
        console.error("[billing] could not emit the job event", {
          event: event.name,
          error: error instanceof Error ? error.message : String(error),
        })
        return false
      }
    },
  }
}

// ─── audit ───────────────────────────────────────────────────────────────────

export function liveAudit(): AuditPort {
  return {
    async record(entry): Promise<void> {
      const { recordAudit } = await import("@/server/audit")
      await recordAudit(entry)
    },
  }
}

// ─── the bundle ──────────────────────────────────────────────────────────────

export function liveBillingDeps(): BillingDeps {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://oladc.com"
  return {
    store: billingStore(),
    stripe: stripeGateway(),
    catalog: liveCatalog(),
    ledger: liveLedger(),
    notifier: liveNotifier(siteUrl),
    events: liveEvents(),
    audit: liveAudit(),
    now: () => new Date(),
    siteUrl,
  }
}

/** Spanish label for a term, used on invoice lines and in emails. */
export function termLabel(term: "P1M" | "P12M"): string {
  return TERM_MONTHS[term] === 12 ? "Anual" : "Mensual"
}

/** Guard used by the services when a dependency is simply not configured. */
export function billingUnavailable(detail: string): DomainError {
  return new DomainError("billing_unavailable", { detail, retryable: true })
}
