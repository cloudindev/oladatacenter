"use client"

import { EmptyState, StatusBadge } from "@/components/app/ui"
import { deleteFirewallRule } from "@/server/services/actions"
import { ActionButton } from "./ActionButton"
import type { FirewallRuleView } from "./types"

/**
 * Rules already on the firewall, in the order OVH evaluates them.
 *
 * The provider lists positions and then each rule separately; a rule whose detail could
 * not be read is still listed by its position rather than hidden or invented.
 */
export function FirewallRules({
  serviceId,
  ip,
  sequences,
  rules,
  allowed,
}: {
  serviceId: string
  ip: string
  sequences: readonly number[]
  rules: readonly FirewallRuleView[]
  allowed: boolean
}) {
  if (sequences.length === 0) {
    return (
      <EmptyState>
        No hay reglas de firewall en esta IP. Sin reglas, el firewall de red de OVH no
        filtra nada y el tráfico llega al servidor.
      </EmptyState>
    )
  }

  const bySequence = new Map(rules.map((rule) => [rule.sequence, rule]))

  return (
    <ul className="divide-y divide-border-base">
      {[...sequences].sort((a, b) => a - b).map((sequence) => {
        const rule = bySequence.get(sequence)
        return (
          <li key={sequence} className="flex flex-wrap items-center gap-3 py-3">
            <span className="label-mono text-text-muted w-16 shrink-0">pos {sequence}</span>
            <span className="min-w-0 flex-1 text-sm text-text-base">
              {rule ? (
                <>
                  {rule.action === "permit" ? "Permite" : "Bloquea"} {rule.protocol.toUpperCase()}
                  {rule.destinationPort ? ` al puerto ${rule.destinationPort}` : ""} desde{" "}
                  {rule.source || "cualquier origen"}
                </>
              ) : (
                <span className="text-text-muted">
                  No hemos podido leer el detalle de esta regla
                </span>
              )}
            </span>
            {rule ? <StatusBadge tone={rule.state === "ok" ? "ok" : "busy"}>{rule.state === "ok" ? "Activa" : "Aplicándose"}</StatusBadge> : null}
            <ActionButton
              serviceId={serviceId}
              label="Eliminar"
              variant="ghost"
              disabled={!allowed}
              run={() => deleteFirewallRule({ serviceId, ip, sequence })}
              confirm={{
                title: `Eliminar la regla ${sequence}`,
                consequence: (
                  <>
                    El tráfico que esta regla filtraba dejará de filtrarse. Si era la
                    regla que bloqueaba accesos no deseados, quedarán permitidos.
                  </>
                ),
                confirmLabel: "Eliminar la regla",
                danger: true,
              }}
            />
          </li>
        )
      })}
    </ul>
  )
}
