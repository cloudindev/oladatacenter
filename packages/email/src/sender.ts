/**
 * Sending port plus two adapters. This package reads no environment variable: the API key,
 * the `from` address and the reply-to are injected by `src/server/providers.ts`.
 */
import type { Resend } from "resend"

import { type EmailMessage, type RenderedEmail, renderMessage } from "./render"

/** A message with its recipient resolved. */
export type OutboundEmail = EmailMessage & { to: string }

export interface SendResult {
  id: string
}

export interface EmailSender {
  send(message: OutboundEmail): Promise<SendResult>
}

export class EmailSendError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message)
    this.name = "EmailSendError"
  }
}

// ─── Resend adapter ──────────────────────────────────────────────────────────

/**
 * The slice of the Resend SDK this adapter uses. A real `Resend` instance satisfies it;
 * declaring it structurally keeps the adapter testable without a network stub.
 */
export interface ResendLike {
  emails: {
    send(payload: {
      from: string
      to: string | string[]
      subject: string
      html: string
      text: string
      replyTo?: string | string[]
      headers?: Record<string, string>
    }): Promise<{
      data: { id: string } | null
      error: { name: string; message: string } | null
    }>
  }
}

/** Resend error names that map to a 5xx and are therefore worth one retry. */
const RETRYABLE_ERRORS: ReadonlySet<string> = new Set([
  "application_error",
  "internal_server_error",
])

export interface ResendSenderOptions {
  /** Verified sender, for example "OLA <no-reply@oladc.com>". */
  from: string
  replyTo?: string | string[]
  /** Milliseconds to wait before the single retry. Zero in tests. */
  retryDelayMs?: number
  /** Injected for tests; defaults to a real timer. */
  sleep?: (ms: number) => Promise<void>
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

export class ResendSender implements EmailSender {
  private readonly client: ResendLike
  private readonly from: string
  private readonly replyTo?: string | string[]
  private readonly retryDelayMs: number
  private readonly sleep: (ms: number) => Promise<void>

  constructor(client: ResendLike, options: ResendSenderOptions) {
    this.client = client
    this.from = options.from
    this.replyTo = options.replyTo
    this.retryDelayMs = options.retryDelayMs ?? 500
    this.sleep = options.sleep ?? defaultSleep
  }

  async send(message: OutboundEmail): Promise<SendResult> {
    const rendered = await renderMessage(message)
    const first = await this.attempt(message.to, rendered)
    if (first.ok) return { id: first.id }
    if (!first.retryable) throw new EmailSendError(first.reason)

    if (this.retryDelayMs > 0) await this.sleep(this.retryDelayMs)
    const second = await this.attempt(message.to, rendered)
    if (second.ok) return { id: second.id }
    throw new EmailSendError(`${second.reason} (tras un reintento)`)
  }

  private async attempt(
    to: string,
    rendered: RenderedEmail,
  ): Promise<{ ok: true; id: string } | { ok: false; retryable: boolean; reason: string }> {
    try {
      const response = await this.client.emails.send({
        from: this.from,
        to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        ...(this.replyTo === undefined ? {} : { replyTo: this.replyTo }),
      })
      if (response.error !== null) {
        return {
          ok: false,
          retryable: RETRYABLE_ERRORS.has(response.error.name),
          reason: `resend rejected the message: ${response.error.name} ${response.error.message}`,
        }
      }
      if (response.data === null) {
        return { ok: false, retryable: true, reason: "resend returned no id" }
      }
      return { ok: true, id: response.data.id }
    } catch (error) {
      // A transport failure (DNS, socket, 5xx surfaced as a throw) is worth one retry.
      return {
        ok: false,
        retryable: true,
        reason: `resend request failed: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }
}

/** Convenience factory that pins the real SDK type at the construction site. */
export function resendSender(client: Resend, options: ResendSenderOptions): ResendSender {
  return new ResendSender(client, options)
}

// ─── Mock adapter ────────────────────────────────────────────────────────────

export interface SentEmail {
  to: string
  template: EmailMessage["template"]
  subject: string
  html: string
  text: string
  sentAt: Date
  id: string
}

/**
 * Records everything instead of sending it. Used by the test suite and by local dev when
 * `USE_MOCK_PROVIDERS=true`.
 */
export class MockEmailSender implements EmailSender {
  readonly sent: SentEmail[] = []
  private counter = 0

  async send(message: OutboundEmail): Promise<SendResult> {
    const rendered = await renderMessage(message)
    this.counter += 1
    const id = `mock-${String(this.counter).padStart(4, "0")}`
    this.sent.push({
      to: message.to,
      template: message.template,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      sentAt: new Date(),
      id,
    })
    return { id }
  }

  reset(): void {
    this.sent.length = 0
    this.counter = 0
  }

  /** Last message sent, or undefined when nothing was sent. */
  last(): SentEmail | undefined {
    return this.sent.at(-1)
  }

  /** Every message sent for one template. */
  byTemplate(template: EmailMessage["template"]): SentEmail[] {
    return this.sent.filter((entry) => entry.template === template)
  }
}
