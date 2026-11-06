/** Dunning notice at T+7: the suspended server is deleted in three days unless it is paid. */
import * as React from "react"

import { Button, DataTable, EmailLayout, Heading, Muted, Paragraph, UrlFallback } from "../layout"
import { type DateInput, formatDate, formatDateTime, formatMoney, plainRows, plainText } from "../format"
import { type BaseEmailProps, greeting } from "./common"

export interface DeletionWarningProps extends BaseEmailProps {
  serviceName: string
  invoiceRef?: string
  /** Outstanding amount, in integer cents. */
  amountCents?: number
  /** Moment the service is cancelled and marked for deletion. */
  deletionDate: DateInput
  /** Invoice payment page. */
  payUrl: string
}

export function subject(props: DeletionWarningProps): string {
  return `${props.serviceName} se dará de baja el ${formatDate(props.deletionDate)}`
}

export function DeletionWarningEmail(props: DeletionWarningProps) {
  const { serviceName, invoiceRef, amountCents, deletionDate, payUrl } = props
  const deletion = formatDateTime(deletionDate)
  return (
    <EmailLayout
      preview={`Paga antes del ${formatDate(deletionDate)} para conservar ${serviceName}`}
      customerAreaUrl={props.customerAreaUrl}
    >
      <Heading>Tu servidor se dará de baja en tres días</Heading>
      <Paragraph>{greeting(props.name)}</Paragraph>
      <Paragraph>
        {serviceName} sigue parado porque la renovación no se ha podido cobrar. Si no se paga
        antes del {deletion}, lo daremos de baja y sus datos se borrarán.
      </Paragraph>
      <DataTable
        rows={[
          { label: "Servicio", value: serviceName },
          invoiceRef ? { label: "Factura", value: invoiceRef, mono: true } : null,
          amountCents !== undefined
            ? { label: "Importe pendiente", value: formatMoney(amountCents) }
            : null,
          { label: "Baja", value: deletion },
        ]}
      />
      <Paragraph>
        Al pagar, el servidor vuelve a arrancar en unos minutos con todos sus datos intactos.
      </Paragraph>
      <Button href={payUrl}>Pagar y reactivar</Button>
      <UrlFallback href={payUrl} />
      <Muted>
        Si ya no lo necesitas, no tienes que hacer nada. Descarga antes los datos que quieras
        conservar.
      </Muted>
    </EmailLayout>
  )
}

export function text(props: DeletionWarningProps): string {
  const { serviceName, invoiceRef, amountCents, deletionDate, payUrl } = props
  const deletion = formatDateTime(deletionDate)
  return plainText([
    greeting(props.name),
    "",
    `${serviceName} sigue parado porque la renovación no se ha podido cobrar. Si no se paga antes del ${deletion}, lo daremos de baja y sus datos se borrarán.`,
    "",
    ...plainRows([
      ["Servicio", serviceName],
      ["Factura", invoiceRef],
      ["Importe pendiente", amountCents !== undefined ? formatMoney(amountCents) : undefined],
      ["Baja", deletion],
    ]),
    "",
    "Al pagar, el servidor vuelve a arrancar en unos minutos con todos sus datos intactos.",
    "",
    `Pagar y reactivar: ${payUrl}`,
    "",
    "Si ya no lo necesitas, no tienes que hacer nada. Descarga antes los datos que quieras conservar.",
  ])
}
