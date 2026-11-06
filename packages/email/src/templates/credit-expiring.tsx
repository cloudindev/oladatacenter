/** Reminder that unused credit is about to expire. */
import * as React from "react"

import { Button, DataTable, EmailLayout, Heading, Muted, Paragraph, UrlFallback } from "../layout"
import { type DateInput, formatDate, formatDays, formatMoney, plainRows, plainText } from "../format"
import { type BaseEmailProps, greeting } from "./common"

export interface CreditExpiringProps extends BaseEmailProps {
  /** Credit still available, in integer cents. */
  amountCents: number
  /** Whole days left until it expires. */
  days: number
  /** Expiry day. */
  expiresAt: DateInput
  /** Where to spend it. */
  shopUrl?: string
}

export function subject(props: CreditExpiringProps): string {
  return `Tu crédito caduca en ${formatDays(props.days)}`
}

export function CreditExpiringEmail(props: CreditExpiringProps) {
  const {
    amountCents,
    days,
    expiresAt,
    shopUrl = "https://oladc.com/vps",
    customerAreaUrl,
  } = props
  const amount = formatMoney(amountCents)
  const expiry = formatDate(expiresAt)
  return (
    <EmailLayout
      preview={`Te quedan ${amount} de crédito hasta el ${expiry}`}
      customerAreaUrl={customerAreaUrl}
    >
      <Heading>Tu crédito está a punto de caducar</Heading>
      <Paragraph>{greeting(props.name)}</Paragraph>
      <Paragraph>
        Todavía tienes {amount} de crédito sin usar. Caduca en {formatDays(days)}, el {expiry}.
      </Paragraph>
      <DataTable
        rows={[
          { label: "Crédito disponible", value: amount },
          { label: "Caduca el", value: expiry },
          { label: "Tiempo restante", value: formatDays(days) },
        ]}
      />
      <Paragraph>
        Se aplica de forma automática a la siguiente factura de un VPS, tanto si contratas un
        servidor nuevo como si amplías uno que ya tienes. La parte que no uses antes de esa fecha
        se pierde y no es canjeable por dinero.
      </Paragraph>
      <Button href={shopUrl}>Usar el crédito</Button>
      <UrlFallback href={shopUrl} />
      <Muted>Puedes ver el detalle de tu saldo en el área de cliente, en facturación.</Muted>
    </EmailLayout>
  )
}

export function text(props: CreditExpiringProps): string {
  const { amountCents, days, expiresAt, shopUrl = "https://oladc.com/vps" } = props
  const amount = formatMoney(amountCents)
  const expiry = formatDate(expiresAt)
  return plainText([
    greeting(props.name),
    "",
    `Todavía tienes ${amount} de crédito sin usar. Caduca en ${formatDays(days)}, el ${expiry}.`,
    "",
    ...plainRows([
      ["Crédito disponible", amount],
      ["Caduca el", expiry],
      ["Tiempo restante", formatDays(days)],
    ]),
    "",
    "Se aplica de forma automática a la siguiente factura de un VPS, tanto si contratas un servidor nuevo como si amplías uno que ya tienes. La parte que no uses antes de esa fecha se pierde y no es canjeable por dinero.",
    "",
    `Usar el crédito: ${shopUrl}`,
  ])
}
