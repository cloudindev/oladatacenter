/** Sent right after sign-up: one action, verify the address. */
import * as React from "react"

import { Button, EmailLayout, Heading, Muted, Paragraph, UrlFallback } from "../layout"
import { plainText } from "../format"
import { type BaseEmailProps, greeting } from "./common"

export interface WelcomeVerifyProps extends BaseEmailProps {
  /** Signed verification link. Single use, 24 h. */
  verifyUrl: string
}

/** Takes props for a uniform template contract, even though this subject is constant. */
export const subject: (props: WelcomeVerifyProps) => string = () =>
  "Verifica tu correo para activar tu cuenta"

export function WelcomeVerifyEmail(props: WelcomeVerifyProps) {
  const { verifyUrl, customerAreaUrl } = props
  return (
    <EmailLayout
      preview="Confirma tu dirección de correo para activar tu cuenta de OLA VPS Cloud"
      customerAreaUrl={customerAreaUrl}
    >
      <Heading>Verifica tu correo</Heading>
      <Paragraph>{greeting(props.name)}</Paragraph>
      <Paragraph>
        Hemos creado tu cuenta de OLA VPS Cloud. Para activarla y poder contratar servidores,
        confirma que esta dirección es tuya.
      </Paragraph>
      <Button href={verifyUrl}>Verificar correo</Button>
      <UrlFallback href={verifyUrl} />
      <Muted>
        El enlace caduca en 24 horas y solo se puede usar una vez. Si caduca, pide uno nuevo
        desde la pantalla de acceso. Si no has creado ninguna cuenta, ignora este mensaje.
      </Muted>
    </EmailLayout>
  )
}

export function text(props: WelcomeVerifyProps): string {
  return plainText([
    greeting(props.name),
    "",
    "Hemos creado tu cuenta de OLA VPS Cloud. Para activarla y poder contratar servidores, confirma que esta dirección es tuya.",
    "",
    "Verifica tu correo abriendo este enlace:",
    props.verifyUrl,
    "",
    "El enlace caduca en 24 horas y solo se puede usar una vez. Si caduca, pide uno nuevo desde la pantalla de acceso.",
    "Si no has creado ninguna cuenta, ignora este mensaje.",
  ])
}
