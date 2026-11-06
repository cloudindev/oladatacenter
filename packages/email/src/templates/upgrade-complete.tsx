/** Plan change applied, with the prorated charge spelled out. */
import * as React from "react"

import { Button, DataTable, EmailLayout, Heading, Muted, Paragraph, UrlFallback } from "../layout"
import { type DateInput, formatDate, formatMoney, plainRows, plainText } from "../format"
import { type BaseEmailProps, greeting } from "./common"

export interface UpgradeCompleteProps extends BaseEmailProps {
  serviceName: string
  previousPlanName?: string
  newPlanName: string
  /** Prorated amount charged for the rest of the current cycle, in integer cents. */
  proratedCents: number
  /** First full invoice under the new plan. */
  nextInvoiceDate?: DateInput
  /** Amount of that first full invoice, in integer cents. */
  nextInvoiceCents?: number
  /** Server page in the customer area. */
  panelUrl: string
}

export function subject(props: UpgradeCompleteProps): string {
  return `Tu plan ${props.newPlanName} ya está activo`
}

export function UpgradeCompleteEmail(props: UpgradeCompleteProps) {
  const {
    serviceName,
    previousPlanName,
    newPlanName,
    proratedCents,
    nextInvoiceDate,
    nextInvoiceCents,
    panelUrl,
    customerAreaUrl,
  } = props
  const prorated = formatMoney(proratedCents)
  return (
    <EmailLayout
      preview={`${serviceName} ya funciona con el plan ${newPlanName}`}
      customerAreaUrl={customerAreaUrl}
    >
      <Heading>Cambio de plan completado</Heading>
      <Paragraph>{greeting(props.name)}</Paragraph>
      <Paragraph>
        {serviceName} ya funciona con el plan {newPlanName}. Los recursos nuevos están
        disponibles y la dirección IP no ha cambiado.
      </Paragraph>
      <DataTable
        rows={[
          { label: "Servicio", value: serviceName },
          previousPlanName ? { label: "Plan anterior", value: previousPlanName } : null,
          { label: "Plan nuevo", value: newPlanName },
          { label: "Cargo prorrateado", value: prorated },
          nextInvoiceDate ? { label: "Próxima factura", value: formatDate(nextInvoiceDate) } : null,
          nextInvoiceCents !== undefined
            ? { label: "Importe previsto", value: formatMoney(nextInvoiceCents) }
            : null,
        ]}
      />
      <Paragraph>
        Hemos cobrado {prorated}, que corresponde solo a la diferencia de precio por los días que
        quedan del periodo en curso. A partir de la próxima factura se aplicará el precio
        completo del plan nuevo.
      </Paragraph>
      <Button href={panelUrl}>Ver el servidor</Button>
      <UrlFallback href={panelUrl} />
      <Muted>
        Si el sistema no refleja la memoria o el disco nuevos, reinicia el servidor desde el área
        de cliente.
      </Muted>
    </EmailLayout>
  )
}

export function text(props: UpgradeCompleteProps): string {
  const {
    serviceName,
    previousPlanName,
    newPlanName,
    proratedCents,
    nextInvoiceDate,
    nextInvoiceCents,
    panelUrl,
  } = props
  const prorated = formatMoney(proratedCents)
  return plainText([
    greeting(props.name),
    "",
    `${serviceName} ya funciona con el plan ${newPlanName}. Los recursos nuevos están disponibles y la dirección IP no ha cambiado.`,
    "",
    ...plainRows([
      ["Servicio", serviceName],
      ["Plan anterior", previousPlanName],
      ["Plan nuevo", newPlanName],
      ["Cargo prorrateado", prorated],
      ["Próxima factura", nextInvoiceDate ? formatDate(nextInvoiceDate) : undefined],
      ["Importe previsto", nextInvoiceCents !== undefined ? formatMoney(nextInvoiceCents) : undefined],
    ]),
    "",
    `Hemos cobrado ${prorated}, que corresponde solo a la diferencia de precio por los días que quedan del periodo en curso. A partir de la próxima factura se aplicará el precio completo del plan nuevo.`,
    "",
    `Ver el servidor: ${panelUrl}`,
  ])
}
