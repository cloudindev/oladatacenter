/**
 * Internal alert. Goes to the team mailbox, never to a customer, which is why it is the one
 * template allowed to carry a raw payload — a stack trace, a provider response, an id.
 * Callers must still keep secrets out of `detail`.
 */
import * as React from "react"

import { Button, Callout, DataTable, EmailLayout, Eyebrow, Heading, Muted, Paragraph, UrlFallback } from "../layout"
import { colors, MONO_STACK } from "../theme"
import { type DateInput, formatDateTime, plainRows, plainText } from "../format"

export type AlertSeverity = "info" | "warning" | "critical"

export interface AdminAlertProps {
  severity: AlertSeverity
  /** Domain entity the alert is about: "order", "service", "invoice", "webhook"… */
  entity: string
  entityId?: string
  /** One line, in Spanish, that a human can act on. */
  summary: string
  /** Raw technical detail. Internal only. */
  detail?: string
  /** When it happened. */
  occurredAt?: DateInput
  /** Correlation id so the alert can be matched with the logs. */
  correlationId?: string
  /** Deep link into /admin. */
  adminUrl: string
}

const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  info: "Info",
  warning: "Atención",
  critical: "Crítico",
}

export function subject(props: AdminAlertProps): string {
  const parts = [props.entity, props.entityId, props.summary].filter(
    (part): part is string => typeof part === "string" && part.length > 0,
  )
  return `[OLA] ${SEVERITY_LABEL[props.severity]} · ${parts.join(" · ")}`
}

export function AdminAlertEmail(props: AdminAlertProps) {
  const { severity, entity, entityId, summary, detail, occurredAt, correlationId, adminUrl } = props
  return (
    <EmailLayout preview={`${SEVERITY_LABEL[severity]} · ${entity} · ${summary}`} internal>
      <Eyebrow>Aviso interno · {SEVERITY_LABEL[severity]}</Eyebrow>
      <Heading>{summary}</Heading>
      <DataTable
        rows={[
          { label: "Severidad", value: SEVERITY_LABEL[severity] },
          { label: "Entidad", value: entity, mono: true },
          entityId ? { label: "Id", value: entityId, mono: true } : null,
          occurredAt ? { label: "Momento", value: formatDateTime(occurredAt) } : null,
          correlationId ? { label: "Correlación", value: correlationId, mono: true } : null,
        ]}
      />
      {detail ? (
        <Callout>
          <Eyebrow>Detalle</Eyebrow>
          <pre
            style={{
              fontFamily: MONO_STACK,
              fontSize: "12px",
              lineHeight: "18px",
              color: colors.ink,
              margin: 0,
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {detail}
          </pre>
        </Callout>
      ) : null}
      <Paragraph>Revisa el caso en el panel de administración.</Paragraph>
      <Button href={adminUrl}>Abrir en admin</Button>
      <UrlFallback href={adminUrl} label="Enlace directo" />
      <Muted>Mensaje generado por la plataforma. No contiene datos de pago completos.</Muted>
    </EmailLayout>
  )
}

export function text(props: AdminAlertProps): string {
  const { severity, entity, entityId, summary, detail, occurredAt, correlationId, adminUrl } = props
  return plainText(
    [
      `${SEVERITY_LABEL[severity]} · ${summary}`,
      "",
      ...plainRows([
        ["Severidad", SEVERITY_LABEL[severity]],
        ["Entidad", entity],
        ["Id", entityId],
        ["Momento", occurredAt ? formatDateTime(occurredAt) : undefined],
        ["Correlación", correlationId],
      ]),
      "",
      detail ? "Detalle:" : null,
      detail,
      detail ? "" : null,
      `Abrir en admin: ${adminUrl}`,
      "",
      "Aviso interno generado por la plataforma. No reenviar fuera del equipo.",
    ],
    { footer: false },
  )
}
