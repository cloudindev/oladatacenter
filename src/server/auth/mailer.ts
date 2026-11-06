import "server-only"
import { eq } from "drizzle-orm"
import {
  CUSTOMER_AREA_URL,
  type EmailPropsMap,
  type EmailSender,
  type EmailTemplateName,
  emailSubject,
  MockEmailSender,
  type OutboundEmail,
} from "@ola/email"
import { db, outboundEmails } from "@ola/db"
import { clientEnv, env } from "@/lib/env"
import { emailSender } from "@/server/providers"
// `tokens.ts` owns the reset lifetime; the email must quote the same number.
import { PASSWORD_RESET_TTL_MINUTES } from "./tokens"

/**
 * Transactional email for the auth flows.
 *
 * The adapter is NOT built here: `emailSender()` in `src/server/providers.ts` is the one
 * place adapters are constructed, and it already falls back to `MockEmailSender` when the
 * providers are mocked or no Resend key is set. This module only renders the right
 * template, records one `outbound_emails` row per attempt — so a missing email can be
 * traced without the provider dashboard — and never throws at the caller.
 */

/** Local-dev and test seam: the recorded messages, when the mock is the active sender. */
export function sentEmails(): MockEmailSender | null {
  const sender: EmailSender = emailSender()
  return sender instanceof MockEmailSender ? sender : null
}

/** Absolute URL for a link that must survive landing in an inbox. */
export function absoluteUrl(path: string): string {
  const base = env().AUTH_URL ?? clientEnv.NEXT_PUBLIC_SITE_URL
  return new URL(path, base).toString()
}

/**
 * Renders and sends one template, and records the attempt. Never throws: a provider
 * outage must not roll back the sign-up that triggered it, and the row plus the log
 * line are enough to resend by hand.
 */
export async function sendTemplateEmail<K extends EmailTemplateName>(
  to: string,
  template: K,
  props: EmailPropsMap[K],
  options: { customerId?: string | null } = {},
): Promise<{ sent: boolean }> {
  const subject = emailSubject(template, props)
  const inserted = await db()
    .insert(outboundEmails)
    .values({ to, template, subject, customerId: options.customerId ?? null })
    .returning({ id: outboundEmails.id })
  const rowId = inserted[0]?.id

  try {
    // `OutboundEmail` is a union keyed by template name; the generic pair has to be
    // reassembled into one member of it, which only an assertion can express.
    const message = { to, template, props } as unknown as OutboundEmail
    const result = await emailSender().send(message)
    if (rowId) {
      await db()
        .update(outboundEmails)
        .set({ sentAt: new Date(), providerId: result.id })
        .where(eqOutboundEmail(rowId))
    }
    if (sentEmails()) {
      // Local testing needs the verification and reset links, which otherwise only exist
      // inside an email nobody receives. Only `*Url` props are printed: never the whole
      // props object, which for some templates carries a one-time root password.
      const links = Object.fromEntries(
        Object.entries(props as object).filter(
          ([key, value]) => key.endsWith("Url") && typeof value === "string",
        ),
      )
      console.info("[mailer] mock email", { to, template, subject, ...links })
    }
    return { sent: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[mailer] send failed", { to, template, error: message })
    if (rowId) {
      await db()
        .update(outboundEmails)
        .set({ error: message })
        .where(eqOutboundEmail(rowId))
        .catch(() => undefined)
    }
    return { sent: false }
  }
}

/** Props every template shares, filled from the environment. */
export function baseEmailProps(name?: string | null): {
  name?: string
  customerAreaUrl: string
} {
  const trimmed = name?.trim()
  return {
    ...(trimmed ? { name: trimmed } : {}),
    customerAreaUrl: absoluteUrl("/app") || CUSTOMER_AREA_URL,
  }
}

/**
 * Password reset mail.
 *
 * Goes through the typed registry like every other template; the 60-minute expiry is
 * the one `tokens.ts` issues. `requestedFromIp` is passed when the request carried one:
 * the template only prints that line when it is present, and it is what lets someone
 * recognise a reset attempt that was not theirs.
 */
export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
  options: { customerId?: string | null; requestedFromIp?: string | null } = {},
): Promise<{ sent: boolean }> {
  const { customerId = null, requestedFromIp = null } = options
  return sendTemplateEmail(
    to,
    "password-reset",
    {
      ...baseEmailProps(null),
      resetUrl,
      expiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
      ...(requestedFromIp ? { requestedFromIp } : {}),
    },
    { customerId },
  )
}

function eqOutboundEmail(id: string) {
  return eq(outboundEmails.id, id)
}
