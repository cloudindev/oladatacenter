import "server-only"
import { unstable_rethrow } from "next/navigation"
import { customerMessageFor, isDomainError } from "@ola/core"
import { logger } from "@/lib/logger"

/**
 * Every read the customer area performs can fail for reasons outside our control:
 * the database may be unreachable, the OVH credentials may not be configured, the
 * provider may be down. A panel that throws in that case shows the customer a blank
 * error page, so instead every read returns this and the page renders a notice.
 */
export type Loaded<T> = { ok: true; data: T } | { ok: false; message: string }

export function loaded<T>(data: T): Loaded<T> {
  return { ok: true, data }
}

/**
 * Runs a read and converts any failure into a Spanish message.
 *
 * `unstable_rethrow` is called first so Next.js internals (`redirect`, `notFound`)
 * keep working: they are implemented by throwing.
 */
export async function load<T>(label: string, read: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await read() }
  } catch (error) {
    unstable_rethrow(error)
    logger.error(
      {
        label,
        code: isDomainError(error) ? error.code : undefined,
        error: error instanceof Error ? error.message : String(error),
      },
      "customer area read failed",
    )
    return { ok: false, message: customerMessageFor(error) }
  }
}

/** Same as `load`, but a failure yields a fallback instead of a message. */
export async function loadOr<T>(label: string, fallback: T, read: () => Promise<T>): Promise<T> {
  const result = await load(label, read)
  return result.ok ? result.data : fallback
}
