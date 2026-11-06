/** Dunning notice at T-3: the renewal is charged in three days. Nothing to do if the card works. */
import * as React from "react"

import { Button, DataTable, EmailLayout, Heading, Muted, Paragraph, UrlFallback } from "../layout"
import { type DateInput, formatDate, formatMoney, plainRows, plainText } from "../format"
import { type BaseEmailProps, greeting } from "./common"

export interface PaymentReminderProps extends BaseEmailProps {
  serviceName: string
  invoiceRef: string
  /** Invoice total including VAT, in integer cents. */
  amountCents: number
  /** Day the card will be charged. */
  chargeDate: DateInput
  /** Card brand as the processor reports it, for example "Visa". */
  cardBrand?: string
  /** Last four digits of the card on file. */
  cardLast4?: string
  /** Invoice page in the customer area, where it can also be paid now. */
  invoiceUrl: string
  /** Page to change the card on file. */
  updateCardUrl: string
}

export function subject(props: PaymentReminderProps): string {
  return `Recordatorio: renovación de ${props.serviceName} el ${formatDate(props.chargeDate)}`
}

function cardLabel(props: PaymentReminderProps): string | undefined {
  return props.cardLast4 ? `${props.cardBrand ?? "Tarjeta"} ····${props.cardLast4}` : undefined
}

export function PaymentReminderEmail(props: PaymentReminderProps) {
  const { serviceName, invoiceRef, amountCents, chargeDate, invoiceUrl, updateCardUrl } = props
  const amount = formatMoney(amountCents)
  const date = formatDate(chargeDate)
  const card = cardLabel(props)
  return (
    <EmailLayout
      preview={`El ${date} cobraremos ${amount} por la renovación de ${serviceName}`}
      customerAreaUrl={props.customerAreaUrl}
    >
      <Heading>Recordatorio de pago</Heading>
      <Paragraph>{greeting(props.name)}</Paragraph>
      <Paragraph>
        Dentro de tres días renovamos {serviceName}. Cobraremos el importe de forma automática
        {card ? " con la tarjeta que tienes guardada" : ""}.
      </Paragraph>
      <DataTable
        rows={[
          { label: "Servicio", value: serviceName },
          { label: "Factura", value: invoiceRef, mono: true },
          { label: "Importe", value: amount },
          { label: "Fecha de cargo", value: date },
          card ? { label: "Tarjeta", value: card, mono: true } : null,
        ]}
      />
      <Paragraph>
        Si la tarjeta ha caducado o prefieres usar otra, cámbiala antes del {date} para que la
        renovación no se interrumpa.
      </Paragraph>
      <Button href={updateCardUrl}>Revisar la tarjeta</Button>
      <UrlFallback href={updateCardUrl} />
      <Muted>
        También puedes pagar ya la factura desde el área de cliente: {invoiceUrl}
      </Muted>
    </EmailLayout>
  )
}

export function text(props: PaymentReminderProps): string {
  const { serviceName, invoiceRef, amountCents, chargeDate, invoiceUrl, updateCardUrl } = props
  const date = formatDate(chargeDate)
  const card = cardLabel(props)
  return plainText([
    greeting(props.name),
    "",
    `Dentro de tres días renovamos ${serviceName}. Cobraremos el importe de forma automática${
      card ? " con la tarjeta que tienes guardada" : ""
    }.`,
    "",
    ...plainRows([
      ["Servicio", serviceName],
      ["Factura", invoiceRef],
      ["Importe", formatMoney(amountCents)],
      ["Fecha de cargo", date],
      ["Tarjeta", card],
    ]),
    "",
    `Si la tarjeta ha caducado o prefieres usar otra, cámbiala antes del ${date} para que la renovación no se interrumpa.`,
    "",
    `Revisar la tarjeta: ${updateCardUrl}`,
    `Pagar ya la factura: ${invoiceUrl}`,
  ])
}
