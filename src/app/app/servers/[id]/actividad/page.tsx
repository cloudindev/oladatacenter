import { notFound } from "next/navigation"
import { EmptyState, Notice, Panel, SectionTitle, StatusBadge } from "@/components/app/ui"
import {
  ACTION_STATUS_UI,
  ACTOR_LABELS,
  actionLabel,
  formatDateTime,
} from "@/components/servers/labels"
import { load } from "@/server/services/load"
import { serviceForPage } from "@/server/services/page-data"
import { listAuditForService, listRecentActions } from "@/server/services/repository"

/**
 * Activity: what happened, who did it, when, and how it ended.
 *
 * Two sources with different jobs. `actions` holds the operations we sent to the
 * provider and their real outcome; `audit_log` holds every change with an effect,
 * including the ones made by the dunning jobs or by our own support team. Nothing is
 * ever deleted from either, so this is the full record.
 */
export default async function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const page = await serviceForPage(id)
  if (page.state === "missing") notFound()
  if (page.state === "unavailable") return null

  const { service } = page
  const [actions, audit] = await Promise.all([
    load("listRecentActions", () => listRecentActions(service.id, 30)),
    load("listAuditForService", () => listAuditForService(service.id, 40)),
  ])

  return (
    <div className="space-y-8">
      <Panel>
        <SectionTitle>Operaciones</SectionTitle>
        {!actions.ok ? (
          <Notice tone="warn">{actions.message}</Notice>
        ) : actions.data.length === 0 ? (
          <EmptyState>Todavía no se ha hecho ninguna operación sobre este servidor.</EmptyState>
        ) : (
          <ul className="divide-y divide-border-base">
            {actions.data.map((action) => {
              const ui = ACTION_STATUS_UI[action.status]
              return (
                <li key={action.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-text-base">
                      {actionLabel(action.type)}
                    </span>
                    <span className="block text-xs text-text-muted">
                      {formatDateTime(action.createdAt)}
                      {action.finishedAt
                        ? ` · terminó ${formatDateTime(action.finishedAt)}`
                        : ""}
                    </span>
                  </span>
                  <StatusBadge tone={ui.tone} pulse={action.status === "running"}>
                    {ui.label}
                  </StatusBadge>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      <Panel>
        <SectionTitle>Registro de cambios</SectionTitle>
        {!audit.ok ? (
          <Notice tone="warn">{audit.message}</Notice>
        ) : audit.data.length === 0 ? (
          <EmptyState>No hay cambios registrados sobre este servidor.</EmptyState>
        ) : (
          <ul className="divide-y divide-border-base">
            {audit.data.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-baseline gap-3 py-3">
                <span className="min-w-0 flex-1 text-sm text-text-base">
                  {actionLabel(entry.action)}
                </span>
                <span className="label-mono text-text-muted">
                  {ACTOR_LABELS[entry.actorType] ?? entry.actorType}
                </span>
                <span className="text-xs text-text-muted">{formatDateTime(entry.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
