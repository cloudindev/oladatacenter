/** Account verified: confirms the welcome credit, its amount, its expiry and its scope. */
import * as React from "react"

import { Button, DataTable, EmailLayout, Heading, Muted, Paragraph, UrlFallback } from "../layout"
import { CUSTOMER_AREA_URL } from "../theme"
import { type DateInput, formatDate, formatMoney, plainRows, plainText } from "../format"
import { type BaseEmailProps, greeting } from "./common"

export interface AccountVerifiedProps extends BaseEmailProps {
  /** Welcome credit granted, in integer cents. */
  creditCents: number
  /** Day the unused credit disappears. */
  creditExpiresAt: DateInput
  /** Where to start a configuration. */
  shopUrl?: string
}

export const subject: (props: AccountVerifiedProps) => string = () =>
  "Cuenta verificada y crédito de bienvenida disponible"

export function AccountVerifiedEmail(props: AccountVerifiedProps) {
  const { creditCents, creditExpiresAt, customerAreaUrl, shopUrl = "https://oladc.com/vps" } = props
  const amount = formatMoney(creditCents)
  const expiry = formatDate(creditExpiresAt)
  return (
    <EmailLayout
      preview={`Tu cuenta está verificada y tienes ${amount} de crédito hasta el ${expiry}`}
      customerAreaUrl={customerAreaUrl}
    >
      <Heading>Cuenta verificada</Heading>
      <Paragraph>{greeting(props.name)}</Paragraph>
      <Paragraph>
        Tu cuenta ya está verificada y hemos añadido un crédito de bienvenida de {amount} a tu
        saldo.
      </Paragraph>
      <DataTable
        rows={[
          { label: "Crédito", value: amount },
          { label: "Caduca el", value: expiry },
        ]}
      />
      <Paragraph>
        El crédito se aplica de forma automática a tu primera factura de un VPS y cubre tanto el
        plan como las opciones contratadas. No es canjeable por dinero, no se puede transferir y
        la parte que no uses antes del {expiry} se pierde.
      </Paragraph>
      <Button href={shopUrl}>Configurar un servidor</Button>
      <UrlFallback href={shopUrl} />
      <Muted>
        Puedes consultar tu saldo en cualquier momento en el área de cliente, en la sección de
        facturación.
      </Muted>
    </EmailLayout>
  )
}

export function text(props: AccountVerifiedProps): string {
  const { creditCents, creditExpiresAt, shopUrl = "https://oladc.com/vps" } = props
  const amount = formatMoney(creditCents)
  const expiry = formatDate(creditExpiresAt)
  return plainText([
    greeting(props.name),
    "",
    `Tu cuenta ya está verificada y hemos añadido un crédito de bienvenida de ${amount} a tu saldo.`,
    "",
    ...plainRows([
      ["Crédito", amount],
      ["Caduca el", expiry],
    ]),
    "",
    `El crédito se aplica de forma automática a tu primera factura de un VPS y cubre tanto el plan como las opciones contratadas. No es canjeable por dinero, no se puede transferir y la parte que no uses antes del ${expiry} se pierde.`,
    "",
    `Configurar un servidor: ${shopUrl}`,
    `Consultar tu saldo: ${CUSTOMER_AREA_URL}/billing`,
  ])
}
