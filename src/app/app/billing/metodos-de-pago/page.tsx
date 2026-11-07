import type { Metadata } from "next"

import { PageTitle, Panel } from "@/components/app/ui"
import { PaymentMethods, type CardView } from "@/components/billing/PaymentMethods"
import { stripePublishableKey } from "@/lib/stripe/client"
import { requireUser } from "@/server/auth/session"
import { listPaymentMethods } from "@/server/billing"
import { BillingIncomplete } from "../incomplete"

/** Inicio → Mis formas de pago: the cards renewals are charged to. */

export const metadata: Metadata = {
  title: "Mis formas de pago · OLA",
}

export default async function PaymentMethodsPage() {
  const session = await requireUser()
  if (!session.customer) return <BillingIncomplete title="Mis formas de pago" />

  const methods = await listPaymentMethods(session.customer.id)
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
    <>
      <PageTitle description="La tarjeta predeterminada es la que usamos para cobrar las renovaciones.">
        Mis formas de pago
      </PageTitle>
      <Panel>
        <PaymentMethods cards={cards} publishableKey={stripePublishableKey()} />
      </Panel>
    </>
  )
}
