/** Provisioning gave up. Money back, one link to support. */
import * as React from "react"

import { Button, DataTable, EmailLayout, Heading, Muted, Paragraph, UrlFallback } from "../layout"
import { formatDays, formatMoney, plainRows, plainText } from "../format"
import { type BaseEmailProps, greeting } from "./common"

export interface OrderFailedProps extends BaseEmailProps {
  orderRef: string
  planName?: string
  /** Amount refunded, in integer cents. */
  refundedCents: number
  /** Working days the bank usually takes. */
  refundDays?: number
  /** Support page or ticket form. */
  supportUrl: string
}

const DEFAULT_REFUND_DAYS = 10

export const subject: (props: OrderFailedProps) => string = () =>
  "No hemos podido completar tu pedido"

export function OrderFailedEmail(props: OrderFailedProps) {
  const {
    orderRef,
    planName,
    refundedCents,
    refundDays = DEFAULT_REFUND_DAYS,
    supportUrl,
    customerAreaUrl,
  } = props
  const amount = formatMoney(refundedCents)
  return (
    <EmailLayout
      preview={`No hemos podido crear tu servidor y te hemos devuelto ${amount}`}
      customerAreaUrl={customerAreaUrl}
    >
      <Heading>No hemos podido completar tu pedido</Heading>
      <Paragraph>{greeting(props.name)}</Paragraph>
      <Paragraph>
        No hemos conseguido crear el servidor que habías pedido, así que hemos cancelado el
        pedido y devuelto el importe completo. Sentimos las molestias.
      </Paragraph>
      <DataTable
        rows={[
          { label: "Pedido", value: orderRef, mono: true },
          planName ? { label: "Plan", value: planName } : null,
          { label: "Importe devuelto", value: amount },
        ]}
      />
      <Paragraph>
        La devolución se ha emitido al mismo método de pago. Según tu banco, puede tardar hasta{" "}
        {formatDays(refundDays)} en aparecer en el extracto. No se ha activado ningún servicio y
        no hay nada pendiente por tu parte.
      </Paragraph>
      <Button href={supportUrl}>Hablar con soporte</Button>
      <UrlFallback href={supportUrl} />
      <Muted>
        Si quieres volver a intentarlo, puedes configurar otro servidor cuando quieras, incluso en
        otro centro de datos.
      </Muted>
    </EmailLayout>
  )
}

export function text(props: OrderFailedProps): string {
  const {
    orderRef,
    planName,
    refundedCents,
    refundDays = DEFAULT_REFUND_DAYS,
    supportUrl,
  } = props
  return plainText([
    greeting(props.name),
    "",
    "No hemos conseguido crear el servidor que habías pedido, así que hemos cancelado el pedido y devuelto el importe completo. Sentimos las molestias.",
    "",
    ...plainRows([
      ["Pedido", orderRef],
      ["Plan", planName],
      ["Importe devuelto", formatMoney(refundedCents)],
    ]),
    "",
    `La devolución se ha emitido al mismo método de pago. Según tu banco, puede tardar hasta ${formatDays(refundDays)} en aparecer en el extracto. No se ha activado ningún servicio y no hay nada pendiente por tu parte.`,
    "",
    `Hablar con soporte: ${supportUrl}`,
  ])
}
