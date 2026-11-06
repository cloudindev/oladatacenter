/** Dunning step three: deletion is scheduled. Last email before the data is gone. */
import * as React from "react"

import { Button, DataTable, EmailLayout, Heading, Muted, Paragraph, UrlFallback } from "../layout"
import { type DateInput, formatDate, formatDateTime, formatMoney, plainRows, plainText } from "../format"
import { type BaseEmailProps, greeting } from "./common"

export interface ServiceTerminatingProps extends BaseEmailProps {
  serviceName: string
  invoiceRef?: string
  /** Outstanding amount, in integer cents, when the deletion comes from non-payment. */
  amountCents?: number
  /** Exact moment the server and its backups are deleted. */
  deletionDate: DateInput
  /** Invoice payment page, or the cancellation page when the customer asked for it. */
  payUrl: string
}

export function subject(props: ServiceTerminatingProps): string {
  return `Aviso final antes de eliminar ${props.serviceName}`
}

export function ServiceTerminatingEmail(props: ServiceTerminatingProps) {
  const { serviceName, invoiceRef, amountCents, deletionDate, payUrl, customerAreaUrl } = props
  const deletion = formatDateTime(deletionDate)
  return (
    <EmailLayout
      preview={`${serviceName} se eliminará el ${formatDate(deletionDate)}`}
      customerAreaUrl={customerAreaUrl}
    >
      <Heading>Aviso final de eliminación</Heading>
      <Paragraph>{greeting(props.name)}</Paragraph>
      <Paragraph>
        {serviceName} está programado para eliminarse. Es el último aviso que te enviamos sobre
        este servicio.
      </Paragraph>
      <DataTable
        rows={[
          { label: "Servicio", value: serviceName },
          invoiceRef ? { label: "Factura", value: invoiceRef, mono: true } : null,
          amountCents !== undefined
            ? { label: "Importe pendiente", value: formatMoney(amountCents) }
            : null,
          { label: "Eliminación", value: deletion },
        ]}
      />
      <Paragraph>
        El {deletion} borraremos el servidor, sus discos y todas sus copias de seguridad. La
        operación es irreversible: después de esa fecha no podremos recuperar nada, ni siquiera
        con un pago posterior. Si todavía necesitas los datos, descárgalos antes.
      </Paragraph>
      <Button href={payUrl}>Conservar el servicio</Button>
      <UrlFallback href={payUrl} />
      <Muted>
        Si ya no lo necesitas, no tienes que hacer nada. No habrá más cargos por este servicio.
      </Muted>
    </EmailLayout>
  )
}

export function text(props: ServiceTerminatingProps): string {
  const { serviceName, invoiceRef, amountCents, deletionDate, payUrl } = props
  const deletion = formatDateTime(deletionDate)
  return plainText([
    greeting(props.name),
    "",
    `${serviceName} está programado para eliminarse. Es el último aviso que te enviamos sobre este servicio.`,
    "",
    ...plainRows([
      ["Servicio", serviceName],
      ["Factura", invoiceRef],
      ["Importe pendiente", amountCents !== undefined ? formatMoney(amountCents) : undefined],
      ["Eliminación", deletion],
    ]),
    "",
    `El ${deletion} borraremos el servidor, sus discos y todas sus copias de seguridad. La operación es irreversible: después de esa fecha no podremos recuperar nada, ni siquiera con un pago posterior. Si todavía necesitas los datos, descárgalos antes.`,
    "",
    `Conservar el servicio: ${payUrl}`,
    "",
    "Si ya no lo necesitas, no tienes que hacer nada. No habrá más cargos por este servicio.",
  ])
}
