import "server-only"
import { unstable_rethrow } from "next/navigation"
import { DomainError, customerMessageFor } from "@ola/core"
import { requireUser, type SessionContext } from "@/server/auth/session"
import { logger } from "@/lib/logger"

/**
 * The signed-in customer, in a form the pages can render even when nothing works.
 *
 * `requireUser()` redirects when there is no session, which is the behaviour we want and
 * is why its `redirect` is rethrown untouched. What is caught is everything else: if the
 * database is unreachable the panel says so instead of showing a stack trace.
 */
export type CustomerContext =
  | { ok: true; session: SessionContext; customerId: string; email: string }
  | { ok: false; message: string }

export async function customerContext(): Promise<CustomerContext> {
  try {
    const session = await requireUser()
    if (!session.customer) {
      throw new DomainError("not_verified")
    }
    return {
      ok: true,
      session,
      customerId: session.customer.id,
      email: session.user.email,
    }
  } catch (error) {
    unstable_rethrow(error)
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "could not resolve the customer context",
    )
    return { ok: false, message: customerMessageFor(error) }
  }
}
