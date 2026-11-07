import type { Metadata } from "next"

import { PageTitle, Panel } from "@/components/app/ui"
import { CreditPanel } from "@/components/billing/CreditPanel"
import { requireUser } from "@/server/auth/session"
import { creditSummary } from "@/server/billing"
import { BillingIncomplete } from "../incomplete"

/** Inicio → Mi saldo: credit available and when it expires. */

export const metadata: Metadata = {
  title: "Mi saldo · OLA",
}

export default async function CreditPage() {
  const session = await requireUser()
  if (!session.customer) return <BillingIncomplete title="Mi saldo" />

  const credit = await creditSummary(session.customer.id)

  return (
    <>
      <PageTitle description="El saldo se descuenta solo de tus próximas facturas, antes de cobrar la tarjeta.">
        Mi saldo
      </PageTitle>
      <Panel className="max-w-xl">
        <CreditPanel summary={credit} />
      </Panel>
    </>
  )
}
