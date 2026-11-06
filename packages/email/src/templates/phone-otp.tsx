/**
 * One-time code for phone verification.
 *
 * The code is the whole point of the message, so it is in the body — but never in the
 * subject, which is visible in lock-screen notifications.
 */
import * as React from "react"

import { Callout, CodeValue, EmailLayout, Eyebrow, Heading, Muted, Paragraph } from "../layout"
import { formatMinutes, plainText, spaceCode } from "../format"
import { type BaseEmailProps, greeting } from "./common"

export interface PhoneOtpProps extends BaseEmailProps {
  /** Six digits. */
  code: string
  /** Minutes of validity. Ten by default, matching the server. */
  expiresInMinutes?: number
  /** Last digits of the phone being verified, for context. */
  phoneLast4?: string
}

const DEFAULT_MINUTES = 10

/** The code never goes in the subject: it is visible in lock-screen notifications. */
export const subject: (props: PhoneOtpProps) => string = () =>
  "Código para verificar tu teléfono"

export function PhoneOtpEmail(props: PhoneOtpProps) {
  const { code, expiresInMinutes = DEFAULT_MINUTES, phoneLast4, customerAreaUrl } = props
  return (
    <EmailLayout
      preview="Tu código de verificación de teléfono, válido durante unos minutos"
      customerAreaUrl={customerAreaUrl}
    >
      <Heading>Código de verificación</Heading>
      <Paragraph>{greeting(props.name)}</Paragraph>
      <Paragraph>
        Introduce este código para confirmar tu teléfono
        {phoneLast4 ? ` terminado en ${phoneLast4}` : ""}.
      </Paragraph>
      <Callout>
        <Eyebrow>Código</Eyebrow>
        <CodeValue>{code}</CodeValue>
      </Callout>
      <Muted>
        Caduca en {formatMinutes(expiresInMinutes)} y solo sirve una vez. No lo compartas con
        nadie: nunca te lo pediremos por teléfono ni por correo. Si no has solicitado la
        verificación, ignora este mensaje y revisa tu contraseña.
      </Muted>
    </EmailLayout>
  )
}

export function text(props: PhoneOtpProps): string {
  const { code, expiresInMinutes = DEFAULT_MINUTES, phoneLast4 } = props
  return plainText([
    greeting(props.name),
    "",
    `Introduce este código para confirmar tu teléfono${phoneLast4 ? ` terminado en ${phoneLast4}` : ""}.`,
    "",
    `Código: ${code}  (${spaceCode(code)})`,
    "",
    `Caduca en ${formatMinutes(expiresInMinutes)} y solo sirve una vez. No lo compartas con nadie: nunca te lo pediremos por teléfono ni por correo.`,
    "Si no has solicitado la verificación, ignora este mensaje y revisa tu contraseña.",
  ])
}
