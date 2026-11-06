/** Payment captured, provisioning started. Sets the expectation for the next email. */
import * as React from "react"

import { Button, DataTable, EmailLayout, Heading, Muted, Paragraph, UrlFallback } from "../layout"
import { formatMinutes, formatMoney, plainRows, plainText } from "../format"
import { type BaseEmailProps, greeting } from "./common"

export interface OrderReceivedProps extends BaseEmailProps {
  /** Customer-facing order reference. */
  orderRef: string
  /** Commercial plan name, never the provider's internal name. */
  planName: string
  /** Total charged, in integer cents. */
  amountCents: number
  /** Billing term as shown on the invoice. */
  termLabel?: string
  /** Typical delivery time, in minutes. */
  expectedMinutes?: number
  /** Order detail page in the customer area. */
  orderUrl: string
}

const DEFAULT_MINUTES = 15

export const subject: (props: OrderReceivedProps) => string = () =>
  "Pago recibido, estamos creando tu servidor"

export function OrderReceivedEmail(props: OrderReceivedProps) {
  const {
    orderRef,
    planName,
    amountCents,
    termLabel,
    expectedMinutes = DEFAULT_MINUTES,
    orderUrl,
    customerAreaUrl,
  } = props
  const amount = formatMoney(amountCents)
  return (
    <EmailLayout
      preview={`Hemos cobrado ${amount} y tu servidor se está creando`}
      customerAreaUrl={customerAreaUrl}
    >
      <Heading>Pago recibido</Heading>
      <Paragraph>{greeting(props.name)}</Paragraph>
      <Paragraph>
        Hemos cobrado tu pedido y ya estamos creando el servidor. No tienes que hacer nada más.
      </Paragraph>
      <DataTable
        rows={[
          { label: "Pedido", value: orderRef, mono: true },
          { label: "Plan", value: planName },
          termLabel ? { label: "Periodo", value: termLabel } : null,
          { label: "Importe cobrado", value: amount },
        ]}
      />
      <Heading level={2}>Qué pasa ahora</Heading>
      <Paragraph>
        Reservamos la máquina, instalamos el sistema operativo y configuramos la red. El proceso
        suele tardar unos {formatMinutes(expectedMinutes)}. Cuando el servidor esté operativo te
        enviaremos otro correo con la dirección IP y los datos de acceso. Si se retrasa, también
        te avisaremos.
      </Paragraph>
      <Button href={orderUrl}>Ver el pedido</Button>
      <UrlFallback href={orderUrl} />
      <Muted>
        La factura queda disponible en el área de cliente, en la sección de facturación.
      </Muted>
    </EmailLayout>
  )
}

export function text(props: OrderReceivedProps): string {
  const {
    orderRef,
    planName,
    amountCents,
    termLabel,
    expectedMinutes = DEFAULT_MINUTES,
    orderUrl,
  } = props
  return plainText([
    greeting(props.name),
    "",
    "Hemos cobrado tu pedido y ya estamos creando el servidor. No tienes que hacer nada más.",
    "",
    ...plainRows([
      ["Pedido", orderRef],
      ["Plan", planName],
      ["Periodo", termLabel],
      ["Importe cobrado", formatMoney(amountCents)],
    ]),
    "",
    "Qué pasa ahora",
    `Reservamos la máquina, instalamos el sistema operativo y configuramos la red. El proceso suele tardar unos ${formatMinutes(expectedMinutes)}. Cuando el servidor esté operativo te enviaremos otro correo con la dirección IP y los datos de acceso. Si se retrasa, también te avisaremos.`,
    "",
    `Ver el pedido: ${orderUrl}`,
  ])
}
