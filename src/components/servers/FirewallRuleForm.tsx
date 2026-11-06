"use client"

import * as React from "react"
import { Button, Field, Input, Notice, Select } from "@/components/app/ui"
import { addFirewallRule } from "@/server/services/actions"
import {
  FIREWALL_ACTION_OPTIONS,
  FIREWALL_PROTOCOL_OPTIONS,
  type FirewallActionValue,
  type FirewallProtocolValue,
} from "./labels"
import type { ActionResult } from "./types"
import { useRunner } from "./useRunner"

/**
 * A new rule on the OVH network firewall.
 *
 * The sequence number is the rule's position: OVH evaluates 0 first and stops at the
 * first match, which is why the field is explicit instead of hidden. Ports only apply
 * to TCP and UDP, so they are disabled for everything else.
 */
export function FirewallRuleForm({
  serviceId,
  ip,
  usedSequences,
  allowed,
}: {
  serviceId: string
  ip: string
  usedSequences: readonly number[]
  allowed: boolean
}) {
  const runner = useRunner<ActionResult>({ refreshOnSuccess: true })
  const free = Array.from({ length: 20 }, (_, index) => index).filter(
    (sequence) => !usedSequences.includes(sequence),
  )

  const [sequence, setSequence] = React.useState(String(free[0] ?? 0))
  const [action, setAction] = React.useState<FirewallActionValue>("permit")
  const [protocol, setProtocol] = React.useState<FirewallProtocolValue>("tcp")
  const [source, setSource] = React.useState("")
  const [port, setPort] = React.useState("")

  const supportsPorts = protocol === "tcp" || protocol === "udp"

  if (free.length === 0) {
    return (
      <Notice tone="warn" title="No quedan posiciones libres">
        El firewall de OVH admite veinte reglas por IP y ya están todas ocupadas. Elimina
        una antes de añadir otra.
      </Notice>
    )
  }

  return (
    <form
      className="space-y-1"
      onSubmit={(event) => {
        event.preventDefault()
        void runner.run(async () => {
          const result = await addFirewallRule({
            serviceId,
            ip,
            sequence: Number(sequence),
            action,
            protocol,
            source: source.trim(),
            destinationPort: supportsPorts && port ? Number(port) : 0,
          })
          if (result.ok) {
            setSource("")
            setPort("")
          }
          return result
        })
      }}
    >
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Posición" htmlFor="fw-sequence" hint="Se evalúan de menor a mayor.">
          <Select
            id="fw-sequence"
            value={sequence}
            onChange={(event) => setSequence(event.target.value)}
          >
            {free.map((value) => (
              <option key={value} value={String(value)}>
                {value}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Qué hace" htmlFor="fw-action">
          <Select
            id="fw-action"
            value={action}
            onChange={(event) => setAction(event.target.value as FirewallActionValue)}
          >
            {FIREWALL_ACTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Protocolo" htmlFor="fw-protocol">
          <Select
            id="fw-protocol"
            value={protocol}
            onChange={(event) => setProtocol(event.target.value as FirewallProtocolValue)}
          >
            {FIREWALL_PROTOCOL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Puerto de destino"
          htmlFor="fw-port"
          hint={supportsPorts ? "Déjalo vacío para cualquier puerto." : "Solo para TCP y UDP."}
        >
          <Input
            id="fw-port"
            value={port}
            inputMode="numeric"
            placeholder="22"
            disabled={!supportsPorts}
            onChange={(event) => setPort(event.target.value.replace(/[^0-9]/g, "").slice(0, 5))}
          />
        </Field>
      </div>

      <Field
        label="Origen"
        htmlFor="fw-source"
        hint="Una IP o un rango en formato CIDR. Vacío significa cualquier origen."
      >
        <Input
          id="fw-source"
          value={source}
          autoComplete="off"
          placeholder="203.0.113.0/24"
          onChange={(event) => setSource(event.target.value)}
        />
      </Field>

      {runner.error ? <Notice tone="danger">{runner.error}</Notice> : null}
      {runner.result ? (
        <Notice tone="ok">
          Regla enviada. El firewall de OVH tarda unos segundos en aplicarla.
        </Notice>
      ) : null}

      <div className="pt-3">
        <Button type="submit" variant="secondary" loading={runner.busy} disabled={!allowed}>
          Añadir la regla
        </Button>
        {!allowed ? (
          <p className="mt-2 text-xs text-text-muted">
            Disponible cuando el servidor está activo.
          </p>
        ) : null}
      </div>
    </form>
  )
}
