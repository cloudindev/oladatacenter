import type { Metadata } from "next"

import { ButtonLink, Eyebrow, Notice, PageTitle, Panel, SectionTitle } from "@/components/app/ui"
import { CreditPanel } from "@/components/billing/CreditPanel"
import { InvoiceTable } from "@/components/billing/InvoiceTable"
import { PaymentMethods, type CardView } from "@/components/billing/PaymentMethods"
import { stripePublishableKey } from "@/lib/stripe/client"
import { requireUser } from "@/server/auth/session"
import { creditSummary, listBillingInvoices, listPaymentMethods } from "@/server/billing"

/**
 * Facturación: invoices, cards and credit.
 *
 * Everything is read on the server and handed to the components already formatted, so no
 * money arithmetic happens in the browser and no provider identifier is ever rendered.
 */

export const metadata: Metadata = {
  title: "Facturación · OLA VPS Cloud",
  description: "Tus facturas, tus tarjetas y tu crédito disponible.",
}

export default async function BillingPage() {
  const session = await requireUser()

  if (!session.customer) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageTitle>Facturación</PageTitle>
        <Panel>
          <Notice
            tone="warn"
            title="Tu cuenta está a medias"
            action={
              <ButtonLink href="/onboarding" withArrow>
                Completar
              </ButtonLink>
            }
          >
            Necesitamos tus datos de facturación antes de poder emitir facturas.
          </Notice>
        </Panel>
      </div>
    )
  }

  const customerId = session.customer.id
  const [invoices, methods, credit] = await Promise.all([
    listBillingInvoices(customerId),
    listPaymentMethods(customerId),
    creditSummary(customerId),
  ])

  const cards: CardView[] = methods.map((method) => ({
    id: method.id,
    brand: method.brand,
    last4: method.last4,
    expMonth: method.expMonth,
    expYear: method.expYear,
    isDefault: method.isDefault,
    verified: method.verifiedAt !== null,
  }))

  return (
    <div className="mx-auto max-w-5xl">
      <PageTitle description="Tus facturas, el método de pago con el que cobramos las renovaciones y tu crédito.">
        Facturación
      </PageTitle>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <Eyebrow>Facturas</Eyebrow>
          <SectionTitle>Historial</SectionTitle>
          <InvoiceTable invoices={invoices.invoices} clientAreaUrl={invoices.clientAreaUrl} />
        </Panel>

        <Panel>
          <Eyebrow>Crédito</Eyebrow>
          <SectionTitle>Saldo disponible</SectionTitle>
          <CreditPanel summary={credit} />
        </Panel>

        <Panel className="lg:col-span-3">
          <Eyebrow>Métodos de pago</Eyebrow>
          <SectionTitle>Tarjetas</SectionTitle>
          <PaymentMethods cards={cards} publishableKey={stripePublishableKey()} />
        </Panel>
      </div>
    </div>
  )
}
