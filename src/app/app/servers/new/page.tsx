import type { Metadata } from "next"
import Link from "next/link"
import { formatCents } from "@ola/core"

import {
  ButtonLink,
  DataRow,
  Eyebrow,
  Notice,
  PageTitle,
  Panel,
  SectionTitle,
} from "@/components/app/ui"
import { CheckoutForm } from "@/components/billing/CheckoutForm"
import { QuoteBreakdown } from "@/components/billing/QuoteBreakdown"
import { stripePublishableKey } from "@/lib/stripe/client"
import { requireUser } from "@/server/auth/session"
import {
  defaultPaymentMethod,
  previewCheckout,
  resolveCheckoutConfiguration,
} from "@/server/billing"

/**
 * The checkout screen.
 *
 * The configuration arrives in the query string from the public configurator — `plan`,
 * `dc`, `os`, `term`, `addons` — and is read defensively: anything missing, stale or
 * hand-edited falls back to a real default, and anything else in the URL is ignored. The
 * price is then computed HERE, on the server, from the catalog. The browser never sends an
 * amount and no amount it could send would be read.
 *
 * Dynamic by nature: it reads the session, the catalog and the customer's credit.
 */

export const metadata: Metadata = {
  title: "Contratar servidor · OLA VPS Cloud",
  description: "Revisa tu configuración, el IVA y el total antes de pagar.",
}

export default async function NewServerPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const session = await requireUser()
  const raw = await props.searchParams

  if (!session.customer) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageTitle description="Necesitamos tus datos de facturación antes de contratar.">
          Completa tu cuenta
        </PageTitle>
        <Panel>
          <Notice
            tone="warn"
            title="Tu cuenta está a medias"
            action={<ButtonLink href="/onboarding" withArrow>Completar</ButtonLink>}
          >
            Para emitir la factura necesitamos tu nombre fiscal, tu NIF y tu dirección.
          </Notice>
        </Panel>
      </div>
    )
  }

  // Slugs only. `resolveCheckoutConfiguration` validates them against the live catalog.
  const configuration = await resolveCheckoutConfiguration(raw)
  const quote = await previewCheckout(session.customer.id, configuration)
  const card = await defaultPaymentMethod(session.customer.id)
  const blocked = quote.block !== null

  return (
    <div className="mx-auto max-w-5xl">
      <PageTitle
        description="Revisa la configuración y el importe. Solo se cobra cuando confirmas."
        action={
          <Link
            href="/servers/configurator"
            className="label-mono text-text-muted hover:text-text-base transition-colors"
          >
            Cambiar configuración
          </Link>
        }
      >
        Contratar tu servidor
      </PageTitle>

      {quote.block ? (
        <div className="mb-8">
          <CheckoutBlockNotice block={quote.block} />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel className="lg:col-span-3">
          <Eyebrow>Configuración</Eyebrow>
          <SectionTitle>{quote.planName}</SectionTitle>
          <dl>
            <DataRow label="Ubicación">{quote.datacenterLabel}</DataRow>
            <DataRow label="Sistema operativo">{quote.osLabel}</DataRow>
            <DataRow label="Compromiso">{quote.termLabel}</DataRow>
            <DataRow label="Precio por mes">{formatCents(quote.monthlyPrice)} sin IVA</DataRow>
          </dl>

          <div className="mt-8">
            <Eyebrow>Importe</Eyebrow>
            <QuoteBreakdown quote={quote} />
          </div>
        </Panel>

        <Panel className="lg:col-span-2">
          <Eyebrow>Pago</Eyebrow>
          <SectionTitle>Confirmar y pagar</SectionTitle>

          {quote.total === 0 ? (
            <div className="mb-5">
              <Notice tone="ok" title="Tu crédito cubre este pedido">
                No vamos a cobrar nada a tu tarjeta. Emitiremos la factura con el crédito
                aplicado como descuento.
              </Notice>
            </div>
          ) : null}

          <CheckoutForm
            configuration={quote.configuration}
            totalLabel={formatCents(quote.total)}
            publishableKey={stripePublishableKey()}
            existingCard={card ? { brand: card.brand, last4: card.last4 } : null}
            disabled={blocked}
          />
        </Panel>
      </div>
    </div>
  )
}

function CheckoutBlockNotice({
  block,
}: {
  block: NonNullable<Awaited<ReturnType<typeof previewCheckout>>["block"]>
}) {
  if (block.kind === "not_verified") {
    return (
      <Notice
        tone="warn"
        title="Verifica tu cuenta para continuar"
        action={<ButtonLink href={block.href} withArrow>Verificar</ButtonLink>}
      >
        {block.message}
      </Notice>
    )
  }
  if (block.kind === "trial_limit") {
    return (
      <Notice tone="warn" title="Límite de la cuenta de prueba">
        {block.message} En cuanto hagas tu primer pago se levantan estos límites.
      </Notice>
    )
  }
  if (block.kind === "under_review") {
    return (
      <Notice tone="warn" title="Cuenta en revisión">
        {block.message}
      </Notice>
    )
  }
  return (
    <Notice tone="danger" title="Cuenta bloqueada">
      {block.message}
    </Notice>
  )
}
