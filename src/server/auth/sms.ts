import "server-only"
import { maskPhone } from "@ola/core/identity/index"
// Aliased on import: the project's eslint reads a call named use* as a React hook.
import { env, mocksEnabled } from "@/lib/env"

/**
 * SMS port plus the only adapter that exists today.
 *
 * TODO(provider): no SMS provider has been chosen yet. When one is (Twilio, MessageBird
 * or Esendex are the candidates on the table), add an adapter class next to
 * `ConsoleSmsSender`, construct it in `smsSender()` behind `SMS_PROVIDER_KEY` and leave
 * the port untouched — nothing else in the codebase talks to the provider. The adapter
 * must: use a registered alphanumeric sender id for Spain, never log the message body,
 * and treat a 4xx as permanent and a 5xx as retryable.
 */

export interface SmsMessage {
  /** E.164, as produced by `parsePhone`. */
  to: string
  body: string
}

export interface SmsSendResult {
  id: string
}

export interface SmsSender {
  send(message: SmsMessage): Promise<SmsSendResult>
}

export class SmsSendError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SmsSendError"
  }
}

/**
 * Logs the message instead of sending it, so the onboarding wizard can be walked end to
 * end locally. The phone number is masked; the code is printed on purpose, because in
 * development the console is the only inbox there is.
 */
export class ConsoleSmsSender implements SmsSender {
  readonly sent: SmsMessage[] = []
  private counter = 0

  async send(message: SmsMessage): Promise<SmsSendResult> {
    this.counter += 1
    this.sent.push(message)
    console.info("[sms] console adapter", {
      to: maskPhone(message.to),
      body: message.body,
    })
    return { id: `console-${String(this.counter).padStart(4, "0")}` }
  }

  reset(): void {
    this.sent.length = 0
    this.counter = 0
  }

  last(): SmsMessage | undefined {
    return this.sent.at(-1)
  }
}

let sender: SmsSender | null = null

/**
 * The SMS adapter. Until a provider is picked this is always `ConsoleSmsSender`; with
 * `SMS_PROVIDER_KEY` set and mocks off it throws, so a half-configured production
 * deployment fails loudly instead of silently dropping verification codes.
 */
export function smsSender(): SmsSender {
  if (sender) return sender

  if (mocksEnabled() || !env().SMS_PROVIDER_KEY) {
    sender = new ConsoleSmsSender()
    return sender
  }

  throw new SmsSendError(
    "SMS_PROVIDER_KEY is set but no SMS adapter exists yet; implement one in src/server/auth/sms.ts",
  )
}

export function resetSmsSender(): void {
  sender = null
}

/** The only SMS the product sends today. */
export function otpSmsBody(code: string, minutes: number): string {
  return `OLA VPS Cloud: tu código de verificación es ${code}. Caduca en ${minutes} minutos.`
}
