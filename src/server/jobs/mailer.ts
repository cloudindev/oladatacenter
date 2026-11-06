import "server-only"
import { emailSubject, type OutboundEmail } from "@ola/email"
import { db, outboundEmails } from "@ola/db"
import { logger } from "@/lib/logger"
import { emailSender as sender } from "@/server/providers"

/**
 * The one place the jobs layer sends email.
 *
 * `@ola/email` renders, `providers.emailSender()` picks the transport; this adapter writes
 * the `outbound_emails` row and makes sure a failed email can never fail the operation that
 * triggered it — losing a notification is bad, failing a paid order is worse.
 */

export interface SendEmailInput {
  message: Omit<OutboundEmail, "to">
  to: string
  customerId?: string | null
  correlationId?: string | null
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const log = logger.child({
    correlationId: input.correlationId ?? null,
    template: input.message.template,
  })
  const outbound = { ...input.message, to: input.to } as OutboundEmail
  const subject = emailSubject(input.message.template, input.message.props)

  try {
    const result = await sender().send(outbound)
    log.info({ to: input.to }, "email sent")
    await recordOutbound(input, subject, result.id, null)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    log.error({ to: input.to, error: detail }, "email failed")
    await recordOutbound(input, subject, null, detail)
  }
}

/** The outbox row is best-effort too: it never breaks the caller. */
async function recordOutbound(
  input: SendEmailInput,
  subject: string,
  providerId: string | null,
  error: string | null,
): Promise<void> {
  try {
    await db()
      .insert(outboundEmails)
      .values({
        customerId: input.customerId ?? null,
        to: input.to,
        template: input.message.template,
        subject,
        providerId,
        sentAt: error === null ? new Date() : null,
        error,
      })
  } catch (dbError) {
    logger.warn(
      { error: dbError instanceof Error ? dbError.message : String(dbError) },
      "could not write the outbound_emails row",
    )
  }
}
