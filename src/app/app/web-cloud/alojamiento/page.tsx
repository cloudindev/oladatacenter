import type { Metadata } from "next"
import { EmptyState, Notice, PageTitle } from "@/components/app/ui"
import { ManagedByCloudinNote, WhmcsProductTable, WhmcsReadNotice } from "@/components/app/WhmcsProducts"
import { customerContext } from "@/server/services/customer"
import { whmcsProductsOfKind } from "@/server/whmcs-products"

/** Web Cloud → Alojamiento web: the hosting plans the customer has in WHMCS. */

export const metadata: Metadata = {
  title: "Alojamiento web · Web Cloud · OLA",
}

export default async function WebHostingPage() {
  const context = await customerContext()
  if (!context.ok) {
    return (
      <>
        <PageTitle>Alojamiento web</PageTitle>
        <Notice tone="warn" title="No hemos podido cargar tus alojamientos">
          {context.message}
        </Notice>
      </>
    )
  }

  const read = await whmcsProductsOfKind(context.customerId, "web_hosting")
  const empty = (
    <EmptyState>
      No tienes ningún alojamiento web con nosotros. Pronto podrás contratarlo desde aquí.
    </EmptyState>
  )

  return (
    <>
      <PageTitle description="Tus planes de hosting, con el dominio de cada uno, su estado y su renovación.">
        Alojamiento web
      </PageTitle>
      <WhmcsReadNotice read={read} what="tus alojamientos" />
      {read.state === "ok" ? (
        <>
          <WhmcsProductTable items={read.items} empty={empty} />
          {read.items.length > 0 ? <ManagedByCloudinNote /> : null}
        </>
      ) : read.state === "not_linked" ? (
        empty
      ) : null}
    </>
  )
}
