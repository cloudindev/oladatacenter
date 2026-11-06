/**
 * Password reset. The link is the only secret in the body: the token itself is single use,
 * is stored as a hash and expires, so nothing else — no password, no code — appears here.
 */
import * as React from "react"

import { Button, EmailLayout, Heading, Muted, Paragraph, UrlFallback } from "../layout"
import { formatMinutes, plainText } from "../format"
import { type BaseEmailProps, greeting } from "./common"

export interface PasswordResetProps extends BaseEmailProps {
  /** Signed reset link. Single use. */
  resetUrl: string
  /** Minutes of validity, as the auth module issued it. */
  expiresInMinutes: number
  /** Where the request came from, so a stranger's attempt is recognisable. */
  requestedFromIp?: string
}

export const subject: (props: PasswordResetProps) => string = () => "Restablece tu contraseña"

export function PasswordResetEmail(props: PasswordResetProps) {
  const { resetUrl, expiresInMinutes, requestedFromIp, customerAreaUrl } = props
  return (
    <EmailLayout
      preview="Enlace para restablecer la contraseña de tu cuenta de OLA VPS Cloud"
      customerAreaUrl={customerAreaUrl}
    >
      <Heading>Restablece tu contraseña</Heading>
      <Paragraph>{greeting(props.name)}</Paragraph>
      <Paragraph>
        Alguien ha solicitado restablecer la contraseña de esta cuenta. Si has sido tú, elige una
        contraseña nueva desde el enlace siguiente.
      </Paragraph>
      <Button href={resetUrl}>Elegir contraseña nueva</Button>
      <UrlFallback href={resetUrl} />
      <Muted>
        El enlace caduca en {formatMinutes(expiresInMinutes)} y solo se puede usar una vez. Si
        caduca, pide otro desde la pantalla de acceso.
      </Muted>
      <Paragraph>
        Si no has pedido este cambio, puedes ignorar el mensaje: tu contraseña seguirá siendo la
        misma y nadie podrá cambiarla sin este enlace.
        {requestedFromIp ? ` La solicitud se hizo desde la dirección IP ${requestedFromIp}.` : ""}
      </Paragraph>
    </EmailLayout>
  )
}

export function text(props: PasswordResetProps): string {
  const { resetUrl, expiresInMinutes, requestedFromIp } = props
  return plainText([
    greeting(props.name),
    "",
    "Alguien ha solicitado restablecer la contraseña de esta cuenta. Si has sido tú, elige una contraseña nueva desde este enlace:",
    resetUrl,
    "",
    `El enlace caduca en ${formatMinutes(expiresInMinutes)} y solo se puede usar una vez. Si caduca, pide otro desde la pantalla de acceso.`,
    "",
    "Si no has pedido este cambio, puedes ignorar el mensaje: tu contraseña seguirá siendo la misma y nadie podrá cambiarla sin este enlace.",
    requestedFromIp ? `La solicitud se hizo desde la dirección IP ${requestedFromIp}.` : null,
  ])
}
