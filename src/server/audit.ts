import "server-only"
import { auditLog, db } from "@ola/db"

export type ActorType = "user" | "admin" | "system" | "webhook"

export interface AuditEntry {
  actorId?: string | null
  actorType?: ActorType
  entity: string
  entityId?: string | null
  action: string
  diff?: Record<string, unknown>
  ip?: string | null
  userAgent?: string | null
  correlationId?: string | null
}

/**
 * Append-only record of every action with an effect.
 *
 * Auditing must never break the operation it is recording: a failure here is logged and
 * swallowed, because losing an audit row is bad but failing a paid order is worse.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await db()
      .insert(auditLog)
      .values({
        actorId: entry.actorId ?? null,
        actorType: entry.actorType ?? "system",
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        action: entry.action,
        diff: entry.diff ?? null,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
        correlationId: entry.correlationId ?? null,
      })
  } catch (error) {
    console.error("[audit] failed to write entry", {
      entity: entry.entity,
      action: entry.action,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/** Shallow diff of the fields that changed, for the audit row. */
export function diffOf<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {}
  for (const [key, value] of Object.entries(after)) {
    if (before[key] !== value) diff[key] = { from: before[key], to: value }
  }
  return diff
}
