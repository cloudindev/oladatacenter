import "server-only"
import { unstable_rethrow } from "next/navigation"
import { logger } from "@/lib/logger"

/**
 * There is no database configured in this environment, and there may not be one in
 * production the day Supabase has an incident. Every admin read goes through this so the page
 * renders a notice instead of a stack trace.
 *
 * Unlike the customer-area equivalent, this keeps the RAW message: the admin panel exists
 * to show the operator what actually broke.
 */
export type Loaded<T> = { ok: true; data: T } | { ok: false; message: string; detail: string }

const log = logger.child({ module: "admin" })

export async function load<T>(label: string, read: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await read() }
  } catch (error) {
    // `redirect()` and `notFound()` are implemented by throwing: let them through first,
    // otherwise `requireAdmin()` would be swallowed into a notice and the page would render.
    unstable_rethrow(error)
    const detail = error instanceof Error ? error.message : String(error)
    log.error({ label, error: detail }, "admin read failed")
    return {
      ok: false,
      message: "No se han podido leer los datos. Revisa la conexión con la base de datos.",
      detail,
    }
  }
}
