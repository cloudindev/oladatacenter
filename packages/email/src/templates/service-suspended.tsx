/** Dunning step two: the server is stopped, data intact, one payment restores it. */
import * as React from "react"

import { Button, DataTable, EmailLayout, Heading, Muted, Paragraph, UrlFallback } from "../layout"
import { type DateInput, formatDate, formatMoney, plainRows, plainText } from "../format"
import { type BaseEmailProps, greeting } from "./common"

export interface ServiceSuspendedProps extends BaseEmailProps {
  serviceName: string
  invoiceRef: string
  /** Outstanding amount, in integer cents. */
  amountCents: number
  /** Day the server was stopped. */
  suspendedAt: DateInput
  /** Day the server and its backups are deleted. */
  deletionDate: DateInput
  /** Invoice payment page. */
  payUrl: string
}

export function subject(props: ServiceSuspendedProps): string {
  return `${props.serviceName} está suspendido por falta de pago`
}

export function ServiceSuspendedEmail(props: ServiceSuspendedProps) {
  const {
    serviceName,
    invoiceRef,
    amountCents,
    suspendedAt,
    deletionDate,
    payUrl,
    customerAreaUrl,
  } = props
  const amount = formatMoney(amountCents)
  const deletion = formatDate(deletionDate)
  return (
    <EmailLayout
      preview={`${serviceName} está apagado, se restablece al pagar ${amount}`}
      customerAreaUrl={customerAreaUrl}
    >
      <Heading>Servicio suspendido</Heading>
      <Paragraph>{greeting(props.name)}</Paragraph>
      <Paragraph>
        Hemos apagado {serviceName} porque su factura sigue sin pagarse. El servidor no está
        accesible, pero tus datos y tus copias de seguridad están intactos.
      </Paragraph>
      <DataTable
        rows={[
          { label: "Servicio", value: serviceName },
          { label: "Factura", value: invoiceRef, mono: true },
          { label: "Importe pendiente", value: amount },
          { label: "Suspendido el", value: formatDate(suspendedAt) },
          { label: "Se eliminará el", value: deletion },
        ]}
      />
      <Paragraph>
        En cuanto recibamos el pago volveremos a encender el servidor, normalmente en unos
        minutos, con la misma dirección IP y el mismo contenido. Si no se paga, el {deletion}
        {" "}eliminaremos el servidor y sus copias de forma definitiva y no habrá manera de
        recuperarlos.
      </Paragraph>
      <Button href={payUrl}>Pagar y restablecer</Button>
      <UrlFallback href={payUrl} />
      <Muted>
        Si no quieres conservar el servicio, no hace falta que hagas nada: se cancelará en esa
        fecha.
      </Muted>
    </EmailLayout>
  )
}

export function text(props: ServiceSuspendedProps): string {
  const { serviceName, invoiceRef, amountCents, suspendedAt, deletionDate, payUrl } = props
  const deletion = formatDate(deletionDate)
  return plainText([
    greeting(props.name),
    "",
    `Hemos apagado ${serviceName} porque su factura sigue sin pagarse. El servidor no está accesible, pero tus datos y tus copias de seguridad están intactos.`,
    "",
    ...plainRows([
      ["Servicio", serviceName],
      ["Factura", invoiceRef],
      ["Importe pendiente", formatMoney(amountCents)],
      ["Suspendido el", formatDate(suspendedAt)],
      ["Se eliminará el", deletion],
    ]),
    "",
    `En cuanto recibamos el pago volveremos a encender el servidor, normalmente en unos minutos, con la misma dirección IP y el mismo contenido. Si no se paga, el ${deletion} eliminaremos el servidor y sus copias de forma definitiva y no habrá manera de recuperarlos.`,
    "",
    `Pagar y restablecer: ${payUrl}`,
  ])
}
