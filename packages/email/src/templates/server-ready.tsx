/**
 * Delivery email: the only template in this package that may carry a credential, and only
 * when the provider generated an initial root password that the customer has no other way
 * to obtain. It is flagged as shown once and the panel link is offered as the alternative.
 */
import * as React from "react"

import {
  Button,
  Callout,
  CodeValue,
  DataTable,
  EmailLayout,
  Eyebrow,
  Heading,
  Muted,
  Paragraph,
  UrlFallback,
} from "../layout"
import { plainRows, plainText } from "../format"
import { type BaseEmailProps, greeting } from "./common"

export interface ServerReadyProps extends BaseEmailProps {
  /** Name the customer gave the server. */
  serverName: string
  /** Commercial plan name. */
  planName: string
  ipv4: string
  ipv6?: string
  /** Human datacenter label, for example "Gravelines, Francia". */
  datacenter: string
  /** Installed image, for example "Debian 12". */
  os: string
  /** Login user for SSH. */
  sshUser?: string
  /** Server page in the customer area. */
  panelUrl: string
  /**
   * Initial root password, when the image was delivered with one. Shown once and never
   * stored in a readable form, so it does not appear in any other email.
   */
  rootPassword?: string
}

export function subject(props: ServerReadyProps): string {
  return `Tu servidor ${props.serverName} ya está listo`
}

export function ServerReadyEmail(props: ServerReadyProps) {
  const {
    serverName,
    planName,
    ipv4,
    ipv6,
    datacenter,
    os,
    sshUser = "root",
    panelUrl,
    rootPassword,
    customerAreaUrl,
  } = props
  return (
    <EmailLayout
      preview={`${serverName} está operativo en ${ipv4}`}
      customerAreaUrl={customerAreaUrl}
    >
      <Heading>Tu servidor está listo</Heading>
      <Paragraph>{greeting(props.name)}</Paragraph>
      <Paragraph>
        {serverName} ya está operativo. Estos son sus datos.
      </Paragraph>
      <DataTable
        rows={[
          { label: "Servidor", value: serverName },
          { label: "Plan", value: planName },
          { label: "IPv4", value: ipv4, mono: true },
          ipv6 ? { label: "IPv6", value: ipv6, mono: true } : null,
          { label: "Centro de datos", value: datacenter },
          { label: "Sistema", value: os },
        ]}
      />

      <Heading level={2}>Cómo conectarte</Heading>
      <Paragraph>
        Abre un terminal y usa SSH con el usuario {sshUser}:
      </Paragraph>
      <Callout>
        <CodeValue>
          ssh {sshUser}@{ipv4}
        </CodeValue>
      </Callout>
      {rootPassword ? (
        <>
          <Callout tone="accent">
            <Eyebrow>Contraseña inicial de root</Eyebrow>
            <CodeValue>{rootPassword}</CodeValue>
          </Callout>
          <Paragraph>
            Esta contraseña se muestra una sola vez: no la guardamos y no podremos volver a
            enviarla. Cámbiala en tu primera conexión y, mejor aún, añade tu clave SSH desde el
            área de cliente y desactiva el acceso por contraseña.
          </Paragraph>
        </>
      ) : (
        <Paragraph>
          El servidor se ha entregado con tu clave SSH, así que no hay contraseña inicial. Puedes
          gestionar tus claves desde el área de cliente.
        </Paragraph>
      )}
      <Button href={panelUrl}>Abrir el servidor</Button>
      <UrlFallback href={panelUrl} />
      <Muted>
        Desde el área de cliente puedes reiniciar, apagar, reinstalar, ver las copias de
        seguridad y abrir la consola. Si algo no responde, escríbenos desde la misma pantalla.
      </Muted>
    </EmailLayout>
  )
}

export function text(props: ServerReadyProps): string {
  const {
    serverName,
    planName,
    ipv4,
    ipv6,
    datacenter,
    os,
    sshUser = "root",
    panelUrl,
    rootPassword,
  } = props
  return plainText([
    greeting(props.name),
    "",
    `${serverName} ya está operativo. Estos son sus datos.`,
    "",
    ...plainRows([
      ["Servidor", serverName],
      ["Plan", planName],
      ["IPv4", ipv4],
      ["IPv6", ipv6],
      ["Centro de datos", datacenter],
      ["Sistema", os],
    ]),
    "",
    "Cómo conectarte",
    `ssh ${sshUser}@${ipv4}`,
    "",
    rootPassword ? `Contraseña inicial de root: ${rootPassword}` : null,
    rootPassword
      ? "Esta contraseña se muestra una sola vez: no la guardamos y no podremos volver a enviarla. Cámbiala en tu primera conexión y añade tu clave SSH desde el área de cliente."
      : "El servidor se ha entregado con tu clave SSH, así que no hay contraseña inicial.",
    "",
    `Abrir el servidor: ${panelUrl}`,
  ])
}
