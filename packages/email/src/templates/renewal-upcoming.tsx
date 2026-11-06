/** Invoice issued ahead of the renewal charge. Pure notice, nothing to do. */
import * as React from "react"

import { Button, DataTable, EmailLayout, Heading, Muted, Paragraph, UrlFallback } from "../layout"
import { type DateInput, formatDate, formatMoney, plainRows, plainText } from "../format"
import { type BaseEmailProps, greeting } from "./common"

export interface RenewalUpcomingProps extends BaseEmailProps {
  serviceName: string
  planName?: string
  invoiceRef: string
  /** Invoice total including VAT, in integer cents. */
  amountCents: number
  /** Day the card will be charged. */
  chargeDate: DateInput
  /** Card brand as the processor reports it, for example "Visa". */
  cardBrand?: string
  /** Last four digits of the card on file. */
  cardLast4?: string
  /** Invoice page in the customer area. */
  invoiceUrl: string
}

export function subject(props: RenewalUpcomingProps): string {
  return `Factura emitida para la renovación de ${props.serviceName}`
}

export function RenewalUpcomingEmail(props: RenewalUpcomingProps) {
  const {
    serviceName,
    planName,
    invoiceRef,
    amountCents,
    chargeDate,
    cardBrand,
    cardLast4,
    invoiceUrl,
    customerAreaUrl,
  } = props
  const amount = formatMoney(amountCents)
  const date = formatDate(chargeDate)
  const card = cardLast4 ? `${cardBrand ?? "Tarjeta"} ····${cardLast4}` : undefined
  return (
    <EmailLayout
      preview={`${amount} se cobrarán el ${date} por la renovación de ${serviceName}`}
      customerAreaUrl={customerAreaUrl}
    >
      <Heading>Renovación próxima</Heading>
      <Paragraph>{greeting(props.name)}</Paragraph>
      <Paragraph>
        Hemos emitido la factura de renovación de {serviceName}. El cargo se hará de forma
        automática con la tarjeta que tienes guardada, así que no tienes que hacer nada.
      </Paragraph>
      <DataTable
        rows={[
          { label: "Servicio", value: serviceName },
          planName ? { label: "Plan", value: planName } : null,
          { label: "Factura", value: invoiceRef, mono: true },
          { label: "Importe", value: amount },
          { label: "Fecha de cargo", value: date },
          card ? { label: "Tarjeta", value: card, mono: true } : null,
        ]}
      />
      <Paragraph>
        Si quieres cambiar de plan, cambiar la tarjeta o cancelar el servicio, hazlo antes del{" "}
        {date} desde el área de cliente.
      </Paragraph>
      <Button href={invoiceUrl}>Ver la factura</Button>
      <UrlFallback href={invoiceUrl} />
      <Muted>El importe incluye los impuestos aplicables según tus datos de facturación.</Muted>
    </EmailLayout>
  )
}

export function text(props: RenewalUpcomingProps): string {
  const {
    serviceName,
    planName,
    invoiceRef,
    amountCents,
    chargeDate,
    cardBrand,
    cardLast4,
    invoiceUrl,
  } = props
  const date = formatDate(chargeDate)
  return plainText([
    greeting(props.name),
    "",
    `Hemos emitido la factura de renovación de ${serviceName}. El cargo se hará de forma automática con la tarjeta que tienes guardada, así que no tienes que hacer nada.`,
    "",
    ...plainRows([
      ["Servicio", serviceName],
      ["Plan", planName],
      ["Factura", invoiceRef],
      ["Importe", formatMoney(amountCents)],
      ["Fecha de cargo", date],
      ["Tarjeta", cardLast4 ? `${cardBrand ?? "Tarjeta"} ····${cardLast4}` : undefined],
    ]),
    "",
    `Si quieres cambiar de plan, cambiar la tarjeta o cancelar el servicio, hazlo antes del ${date} desde el área de cliente.`,
    "",
    `Ver la factura: ${invoiceUrl}`,
  ])
}
