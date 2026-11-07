import "server-only"
import { inArray } from "drizzle-orm"
import { cookies } from "next/headers"
import { db, sessions } from "@ola/db"
import { sha256 } from "@/lib/crypto"
import {
  decodePendingOrder,
  encodePendingOrder,
  PENDING_ORDER_COOKIE,
  PENDING_ORDER_MAX_AGE_SECONDS,
} from "@/lib/pending-order"

const SESSION_COOKIE = "ola_session"

/** The user each session hash belongs to, for the hashes that exist. */
async function usersOfSessions(hashes: readonly string[]): Promise<Map<string, string>> {
  if (hashes.length === 0) return new Map()
  const rows = await db()
    .select({ token: sessions.token, userId: sessions.userId })
    .from(sessions)
    .where(inArray(sessions.token, [...hashes]))
  return new Map(rows.map((row) => [row.token, row.userId]))
}

/**
 * The order URL this person configured and did not buy, if any.
 *
 * Shown only to its owner: the session that configured it, the same user in a later
 * session, or anyone when it was configured without a session (they are the one who
 * just signed in on this browser). Another account on the same browser never sees it.
 */
export async function pendingOrderHref(): Promise<string | null> {
  const cookieStore = await cookies()
  const pending = decodePendingOrder(cookieStore.get(PENDING_ORDER_COOKIE)?.value)
  if (!pending) return null
  if (pending.owner === null) return pending.href

  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null
  const current = sha256(token)
  if (pending.owner === current) return pending.href

  const owners = await usersOfSessions([pending.owner, current])
  const ownerUser = owners.get(pending.owner)
  return ownerUser !== undefined && ownerUser === owners.get(current) ? pending.href : null
}

/**
 * Called right after sign-in, with the new session's hash. A pending order configured
 * without a session, or by this same user before, is moved to the new session; one that
 * belongs to somebody else is left untouched, and stays hidden from this account.
 */
export async function adoptPendingOrder(userId: string, newSessionHash: string): Promise<void> {
  const cookieStore = await cookies()
  const pending = decodePendingOrder(cookieStore.get(PENDING_ORDER_COOKIE)?.value)
  if (!pending) {
    if (cookieStore.get(PENDING_ORDER_COOKIE)) cookieStore.delete(PENDING_ORDER_COOKIE)
    return
  }
  const sameUser =
    pending.owner === null || (await usersOfSessions([pending.owner])).get(pending.owner) === userId
  // Somebody else's: leave it alone. It stays hidden from this account (the owner check
  // in pendingOrderHref) and its owner still finds it when they sign in again.
  if (!sameUser) return
  cookieStore.set(PENDING_ORDER_COOKIE, encodePendingOrder(pending.href, newSessionHash), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PENDING_ORDER_MAX_AGE_SECONDS,
  })
}

/** Forgets the pending order: the customer discarded it, or an order was created. */
export async function clearPendingOrder(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(PENDING_ORDER_COOKIE)
}
