import "server-only"
import { recordAudit } from "@/server/audit"
import { clientEnv, env } from "@/lib/env"
import { logger } from "@/lib/logger"
import { sendEmail } from "./mailer"

/**
 * Admin alerting: one audit row, one email to `ALERTS_EMAIL`, one Slack post when
 * `ALERTS_SLACK_WEBHOOK` is configured.
 *
 * Rules:
 *  - an alert never throws. Losing an alert is bad; failing the paid operation that raised
 *    it is worse.
 *  - nothing that looks like a credential leaves this function: `redactDetail` strips long
 *    opaque tokens before the text reaches an inbox or Slack.
 */

export type AlertSeverity = "info" | "warning" | "critical"

export interface RaiseAlertInput {
  severity: AlertSeverity
  title: string
  /** `order`, `service`, `catalog`, `invoice`, `webhook`, … */
  entity: string
  entityId?: string | null
  /** Technical context for the admin. Never a secret. */
  detail?: string
  correlationId?: string | null
}

/** Opaque strings of 24+ characters are assumed to be keys and never forwarded. */
const SECRET_LIKE = /\b[A-Za-z0-9+/=_-]{24,}\b/g

export function redactDetail(detail: string | undefined): string | undefined {
  if (!detail) return detail
  return detail.replace(SECRET_LIKE, "[redacted]")
}

const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  info: "INFO",
  warning: "AVISO",
  critical: "CRÍTICO",
}

/** Deep link into /admin for the entity the alert is about. */
export function adminBaseUrl(): string {
  return `${clientEnv.NEXT_PUBLIC_SITE_URL}/admin`
}

function adminUrl(input: RaiseAlertInput): string {
  const base = adminBaseUrl()
  if (!input.entityId) return base
  // Must match the route segments under src/app/admin. Invoices and payments have no
  // detail view of their own, so those alerts land on the payments list.
  switch (input.entity) {
    case "order":
      return `${base}/pedidos/${input.entityId}`
    case "service":
      return `${base}/servicios/${input.entityId}`
    case "customer":
      return `${base}/clientes/${input.entityId}`
    case "invoice":
    case "payment":
      return `${base}/pagos`
    default:
      return base
  }
}

export async function raiseAlert(input: RaiseAlertInput): Promise<void> {
  const detail = redactDetail(input.detail)
  const log = logger.child({ correlationId: input.correlationId ?? null, alert: input.title })

  const fields = {
    severity: input.severity,
    entity: input.entity,
    entityId: input.entityId ?? null,
    detail,
  }
  if (input.severity === "critical") log.error(fields, "alert raised")
  else if (input.severity === "warning") log.warn(fields, "alert raised")
  else log.info(fields, "alert raised")

  await recordAudit({
    actorType: "system",
    entity: input.entity,
    entityId: input.entityId ?? null,
    action: `alert.${input.severity}`,
    diff: { title: input.title, detail: detail ?? null },
    correlationId: input.correlationId ?? null,
  })

  const config = readAlertConfig()

  if (config.email) {
    await sendEmail({
      to: config.email,
      correlationId: input.correlationId ?? null,
      message: {
        template: "admin-alert",
        props: {
          severity: input.severity,
          entity: input.entity,
          entityId: input.entityId ?? undefined,
          summary: input.title,
          detail,
          occurredAt: new Date(),
          correlationId: input.correlationId ?? undefined,
          adminUrl: adminUrl(input),
        },
      },
    })
  }

  if (config.slackWebhook) {
    await postToSlack(config.slackWebhook, input, detail)
  }
}

function readAlertConfig(): { email: string | null; slackWebhook: string | null } {
  try {
    const config = env()
    return {
      email: config.ALERTS_EMAIL ?? null,
      slackWebhook: config.ALERTS_SLACK_WEBHOOK ?? null,
    }
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "alert config unavailable",
    )
    return { email: null, slackWebhook: null }
  }
}

async function postToSlack(
  webhookUrl: string,
  input: RaiseAlertInput,
  detail: string | undefined,
): Promise<void> {
  const lines = [
    `*[${SEVERITY_LABEL[input.severity]}] ${input.title}*`,
    `${input.entity}${input.entityId ? ` \`${input.entityId}\`` : ""}`,
  ]
  if (detail) lines.push(detail)

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: lines.join("\n") }),
    })
    if (!response.ok) {
      logger.warn({ status: response.status }, "slack alert rejected")
    }
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      "slack alert failed",
    )
  }
}
