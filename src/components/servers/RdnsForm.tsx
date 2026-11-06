"use client"

import * as React from "react"
import { Button, Field, Input, Notice } from "@/components/app/ui"
import { setRdns } from "@/server/services/actions"
import type { ActionResult } from "./types"
import { useRunner } from "./useRunner"

/**
 * Reverse DNS of one IP. The field starts on whatever the provider has configured.
 */
export function RdnsForm({
  serviceId,
  ip,
  currentHostname,
  allowed,
}: {
  serviceId: string
  ip: string
  currentHostname: string | null
  allowed: boolean
}) {
  const runner = useRunner<ActionResult>({ refreshOnSuccess: true })
  const [hostname, setHostname] = React.useState(currentHostname ?? "")
  const inputId = `rdns-${ip.replace(/[^a-z0-9]/gi, "-")}`

  return (
    <form
      className="border-b border-border-base py-5 last:border-b-0"
      onSubmit={(event) => {
        event.preventDefault()
        void runner.run(() => setRdns({ serviceId, ip, hostname }))
      }}
    >
      <p className="label-mono text-text-muted mb-2">{ip}</p>
      <Field
        label="Nombre de host"
        htmlFor={inputId}
        hint={
          currentHostname
            ? "Cambia el nombre y guarda para actualizarlo."
            : "El rDNS es lo que responde esta IP cuando alguien pregunta a quién pertenece. Muchos servidores de correo lo exigen."
        }
      >
        <Input
          id={inputId}
          value={hostname}
          inputMode="url"
          autoComplete="off"
          placeholder="servidor.midominio.com"
          onChange={(event) => setHostname(event.target.value)}
        />
      </Field>

      {runner.error ? (
        <div className="mb-4">
          <Notice tone="danger">{runner.error}</Notice>
        </div>
      ) : null}

      {runner.result ? (
        <div className="mb-4">
          <Notice tone="ok">
            Hemos pedido el cambio. El rDNS puede tardar unos minutos en propagarse.
          </Notice>
        </div>
      ) : null}

      <Button
        type="submit"
        variant="secondary"
        loading={runner.busy}
        disabled={
          !allowed ||
          hostname.trim().length < 4 ||
          hostname.trim() === (currentHostname ?? "").trim()
        }
      >
        Guardar el rDNS
      </Button>
      {!allowed ? (
        <p className="mt-2 text-xs text-text-muted">
          Disponible cuando el servidor está activo.
        </p>
      ) : null}
    </form>
  )
}
