import { inngest } from "../client"
import { jobDeps } from "../deps"

/**
 * `ola/alert.raise` lets any module (a server action, a webhook, another job) ask for an
 * admin alert without waiting for the email and the Slack post.
 */
export const alertRaise = inngest.createFunction(
  { id: "alert-raise", name: "Avisar al equipo", retries: 2 },
  { event: "ola/alert.raise" },
  async ({ event }) => {
    const deps = jobDeps()
    await deps.alerts.raise({
      severity: event.data.severity,
      title: event.data.title,
      entity: event.data.entity,
      entityId: event.data.entityId ?? null,
      detail: event.data.detail,
      correlationId: event.data.correlationId ?? null,
    })
    return { raised: true }
  },
)
