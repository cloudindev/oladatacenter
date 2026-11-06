/**
 * Dunning step one: the charge was declined. States the full calendar up front — retry,
 * suspension at T+3 and deletion at T+10 — so nothing later comes as a surprise.
 */
import * as React from "react"

import { Button, DataTable, EmailLayout, Heading, Muted, Paragraph, UrlFallback } from "../layout"
import { type DateInput, formatDate, formatMoney, plainRows, plainText } from "../format"
import { type BaseEmailProps, greeting } from "./common"

export interface PaymentFailedProps extends BaseEmailProps {
  serviceName: string
  invoiceRef: string
  /** Amount we tried to charge, in integer cents. */
  amountCents: number
  /** Next automatic attempt. */
  retryDate: DateInput
  /** T+3: the server is stopped. */
  suspendDate: DateInput
  /** T+10: the server and its data are deleted. */
  deletionDate: DateInput
  /** Payment methods page in the customer area. */
  updateCardUrl: string
  /** Card brand, if we know it. */
  cardBrand?: string
  cardLast4?: string
}

export const subject: (props: PaymentFailedProps) => string = () =>
  "No hemos podido cobrar tu renovación"

export function PaymentFailedEmail(props: PaymentFailedProps) {
  const {
    serviceName,
    invoiceRef,
    amountCents,
    retryDate,
    suspendDate,
    deletionDate,
    updateCardUrl,
    cardBrand,
    cardLast4,
    customerAreaUrl,
  } = props
  const amount = formatMoney(amountCents)
  const retry = formatDate(retryDate)
  const suspend = formatDate(suspendDate)
  const deletion = formatDate(deletionDate)
  const card = cardLast4 ? `${cardBrand ?? "Tarjeta"} ····${cardLast4}` : undefined
  return (
    <EmailLayout
      preview={`El cargo de ${amount} ha sido rechazado, lo reintentaremos el ${retry}`}
      customerAreaUrl={customerAreaUrl}
    >
      <Heading>El cobro ha sido rechazado</Heading>
      <Paragraph>{greeting(props.name)}</Paragraph>
      <Paragraph>
        No hemos podido cobrar la renovación de {serviceName}. El servidor sigue funcionando con
        normalidad por ahora.
      </Paragraph>
      <DataTable
        rows={[
          { label: "Servicio", value: serviceName },
          { label: "Factura", value: invoiceRef, mono: true },
          { label: "Importe", value: amount },
          card ? { label: "Tarjeta", value: card, mono: true } : null,
          { label: "Siguiente intento", value: retry },
        ]}
      />
      <Heading level={2}>Si el cobro sigue fallando</Heading>
      <Paragraph>
        El {suspend} apagaremos el servidor y dejará de estar accesible, aunque conservaremos
        todos tus datos. El {deletion}, si la factura continúa sin pagar, eliminaremos el
        servidor y sus copias de seguridad de forma definitiva. Puedes evitarlo en cualquier
        momento actualizando la tarjeta o pagando la factura a mano.
      </Paragraph>
      <Button href={updateCardUrl}>Actualizar la tarjeta</Button>
      <UrlFallback href={updateCardUrl} />
      <Muted>
        Los rechazos más habituales son por tarjeta caducada, límite alcanzado o una verificación
        del banco sin confirmar.
      </Muted>
    </EmailLayout>
  )
}

export function text(props: PaymentFailedProps): string {
  const {
    serviceName,
    invoiceRef,
    amountCents,
    retryDate,
    suspendDate,
    deletionDate,
    updateCardUrl,
    cardBrand,
    cardLast4,
  } = props
  return plainText([
    greeting(props.name),
    "",
    `No hemos podido cobrar la renovación de ${serviceName}. El servidor sigue funcionando con normalidad por ahora.`,
    "",
    ...plainRows([
      ["Servicio", serviceName],
      ["Factura", invoiceRef],
      ["Importe", formatMoney(amountCents)],
      ["Tarjeta", cardLast4 ? `${cardBrand ?? "Tarjeta"} ····${cardLast4}` : undefined],
      ["Siguiente intento", formatDate(retryDate)],
    ]),
    "",
    "Si el cobro sigue fallando",
    `El ${formatDate(suspendDate)} apagaremos el servidor y dejará de estar accesible, aunque conservaremos todos tus datos.`,
    `El ${formatDate(deletionDate)}, si la factura continúa sin pagar, eliminaremos el servidor y sus copias de seguridad de forma definitiva.`,
    "Puedes evitarlo en cualquier momento actualizando la tarjeta o pagando la factura a mano.",
    "",
    `Actualizar la tarjeta: ${updateCardUrl}`,
  ])
}
