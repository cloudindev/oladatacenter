/** Provisioning is late. Informational: the customer has nothing to do. */
import * as React from "react"

import { Button, DataTable, EmailLayout, Heading, Muted, Paragraph, UrlFallback } from "../layout"
import { type DateInput, formatDateTime, formatMinutes, plainRows, plainText } from "../format"
import { type BaseEmailProps, greeting } from "./common"

export interface OrderDelayedProps extends BaseEmailProps {
  orderRef: string
  planName?: string
  /** Minutes already elapsed since payment. */
  elapsedMinutes?: number
  /** Our current estimate for delivery. */
  estimatedBy?: DateInput
  /** Order detail page, where the real provisioning state is visible. */
  orderUrl: string
}

export const subject: (props: OrderDelayedProps) => string = () =>
  "Tu servidor está tardando más de lo previsto"

export function OrderDelayedEmail(props: OrderDelayedProps) {
  const { orderRef, planName, elapsedMinutes, estimatedBy, orderUrl, customerAreaUrl } = props
  return (
    <EmailLayout
      preview="La creación de tu servidor se está retrasando, seguimos en ello"
      customerAreaUrl={customerAreaUrl}
    >
      <Heading>Estamos tardando más de lo previsto</Heading>
      <Paragraph>{greeting(props.name)}</Paragraph>
      <Paragraph>
        La creación de tu servidor se está retrasando. Lo tenemos localizado y seguimos en ello,
        no hace falta que hagas nada ni que repitas el pedido.
      </Paragraph>
      <DataTable
        rows={[
          { label: "Pedido", value: orderRef, mono: true },
          planName ? { label: "Plan", value: planName } : null,
          elapsedMinutes !== undefined
            ? { label: "Tiempo transcurrido", value: formatMinutes(elapsedMinutes) }
            : null,
          estimatedBy ? { label: "Estimación", value: formatDateTime(estimatedBy) } : null,
        ]}
      />
      <Paragraph>
        El pago sigue siendo válido y el servidor se entregará en cuanto el proveedor libere la
        máquina. Te avisaremos con los datos de acceso en cuanto esté operativo. Si no pudiéramos
        completarlo, te devolveremos el importe íntegro.
      </Paragraph>
      <Button href={orderUrl}>Ver el estado</Button>
      <UrlFallback href={orderUrl} />
      <Muted>En el área de cliente puedes ver el estado real del aprovisionamiento paso a paso.</Muted>
    </EmailLayout>
  )
}

export function text(props: OrderDelayedProps): string {
  const { orderRef, planName, elapsedMinutes, estimatedBy, orderUrl } = props
  return plainText([
    greeting(props.name),
    "",
    "La creación de tu servidor se está retrasando. Lo tenemos localizado y seguimos en ello, no hace falta que hagas nada ni que repitas el pedido.",
    "",
    ...plainRows([
      ["Pedido", orderRef],
      ["Plan", planName],
      ["Tiempo transcurrido", elapsedMinutes !== undefined ? formatMinutes(elapsedMinutes) : undefined],
      ["Estimación", estimatedBy ? formatDateTime(estimatedBy) : undefined],
    ]),
    "",
    "El pago sigue siendo válido y el servidor se entregará en cuanto el proveedor libere la máquina. Te avisaremos con los datos de acceso en cuanto esté operativo. Si no pudiéramos completarlo, te devolveremos el importe íntegro.",
    "",
    `Ver el estado: ${orderUrl}`,
  ])
}
