import pino from "pino"

/**
 * Structured logging. Every external call and every job step logs with a correlationId
 * so one order can be followed end to end across Stripe, WHMCS and OVH.
 *
 * Secrets never reach a log line: the redaction list below is the safety net, but the
 * first rule is simply not to pass them in.
 */
const REDACTED = [
  "password",
  "passwordHash",
  "token",
  "tokenHash",
  "secret",
  "apiKey",
  "applicationSecret",
  "consumerKey",
  "identifier",
  "authorization",
  "cookie",
  "*.password",
  "*.secret",
  "*.token",
  "headers.authorization",
  "headers.cookie",
]

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
  redact: { paths: REDACTED, censor: "[redacted]" },
  base: { service: "ola-vps" },
})

export type Logger = typeof logger

/** A child logger bound to one unit of work. */
export function withCorrelation(correlationId: string, extra: Record<string, unknown> = {}): Logger {
  return logger.child({ correlationId, ...extra })
}

/** Time an external call and log the outcome without leaking its payload. */
export async function timed<T>(
  log: Logger,
  event: string,
  fields: Record<string, unknown>,
  run: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now()
  try {
    const result = await run()
    log.info({ ...fields, event, durationMs: Date.now() - startedAt, ok: true })
    return result
  } catch (error) {
    log.error({
      ...fields,
      event,
      durationMs: Date.now() - startedAt,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}
