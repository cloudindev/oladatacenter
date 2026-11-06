import "server-only"
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { and, desc, eq, gt, isNull } from "drizzle-orm"
import { customers, db, sessions, users } from "@ola/db"
import { env } from "@/lib/env"
import { randomToken, readSignedCookieValue, sha256, signCookieValue } from "@/lib/crypto"

/**
 * Sessions are rows in `sessions`, not JWTs, so a session can be revoked the moment
 * a password changes or the customer closes the account. The cookie carries an opaque
 * random token; only its sha256 is stored.
 */

export const SESSION_COOKIE = "ola_session"
/** Per-browser marker used as a welcome-credit fraud signal. Not an identity. */
export const DEVICE_COOKIE = "ola_device"
/** Signed marker for a password-verified login that still owes its TOTP code. */
export const PENDING_MFA_COOKIE = "ola_pending_mfa"
const PENDING_MFA_TTL_MS = 10 * 60 * 1000

export const SESSION_TTL_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

export interface SessionContext {
  user: { id: string; email: string; role: "customer" | "admin" }
  customer: {
    id: string
    status: string
    whmcsClientId: number | null
    stripeCustomerId: string | null
    country: string | null
    kind: "company" | "individual"
    taxIdValidated: boolean
  } | null
}

/** `SessionContext` plus the session row id, which the UI never needs. */
export interface SessionDetails {
  context: SessionContext
  sessionId: string
  /** True when this session row carries a TOTP challenge it passed. */
  mfaVerified: boolean
  /** When the second factor was passed, for the audit trail. */
  totpVerifiedAt: Date | null
}

export interface RequestMeta {
  ip: string | null
  userAgent: string | null
}

function isProduction(): boolean {
  return env().NODE_ENV === "production"
}

function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax" as const,
    path: "/",
  }
}

/** Client address and user agent, for audit rows and session bookkeeping. */
export async function requestMeta(): Promise<RequestMeta> {
  const headerList = await headers()
  const forwarded = headerList.get("x-forwarded-for")
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    headerList.get("x-real-ip")?.trim() ||
    null
  return { ip: ip && ip.length <= 45 ? ip : null, userAgent: headerList.get("user-agent") }
}

// ─── reading ─────────────────────────────────────────────────────────────────
/** Everything about the current session, or `null` when there is none. */
export async function currentSessionDetails(): Promise<SessionDetails | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  const rows = await db()
    .select({
      sessionId: sessions.id,
      totpVerifiedAt: sessions.totpVerifiedAt,
      userId: users.id,
      email: users.email,
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.token, sha256(token)),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1)

  const row = rows[0]
  if (!row) return null

  const customerRows = await db()
    .select({
      id: customers.id,
      status: customers.status,
      whmcsClientId: customers.whmcsClientId,
      stripeCustomerId: customers.stripeCustomerId,
      country: customers.country,
      kind: customers.kind,
      taxIdValidated: customers.taxIdValidated,
    })
    .from(customers)
    .where(eq(customers.userId, row.userId))
    .limit(1)

  // The second factor lives on the session row: revoking the row revokes the factor.
  return {
    sessionId: row.sessionId,
    totpVerifiedAt: row.totpVerifiedAt,
    mfaVerified: row.totpVerifiedAt !== null,
    context: {
      user: { id: row.userId, email: row.email, role: row.role },
      customer: customerRows[0] ?? null,
    },
  }
}

/** FIXED contract: the current session, or `null`. Never throws. */
export async function currentSession(): Promise<SessionContext | null> {
  const details = await currentSessionDetails()
  return details?.context ?? null
}

/** FIXED contract: the current session, redirecting to /login when absent. */
export async function requireUser(): Promise<SessionContext> {
  const session = await currentSession()
  if (!session) redirect("/login")
  return session
}

/**
 * FIXED contract: an admin whose session passed the second factor.
 *
 * A customer account is sent to its own area; an admin without a TOTP-verified
 * session is sent to the login page to complete the challenge.
 */
export async function requireAdmin(): Promise<SessionContext> {
  const details = await currentSessionDetails()
  if (!details) redirect("/login")
  if (details.context.user.role !== "admin") redirect("/app")
  if (!details.mfaVerified) redirect("/login?error=2fa_requerido")
  return details.context
}

/** The signed-in user, or `null`, without touching the customer row. */
export async function currentUserId(): Promise<string | null> {
  const details = await currentSessionDetails()
  return details?.context.user.id ?? null
}

// ─── writing ─────────────────────────────────────────────────────────────────
/**
 * Creates a session row and sets the cookie. Returns the session id so the caller
 * can audit it. Must be called from a Server Action or a Route Handler: cookies
 * cannot be set while rendering.
 */
export async function createSession(
  userId: string,
  meta: RequestMeta,
): Promise<{ sessionId: string }> {
  const token = randomToken()
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * DAY_MS)

  const inserted = await db()
    .insert(sessions)
    .values({
      userId,
      token: sha256(token),
      expiresAt,
      ip: meta.ip,
      userAgent: meta.userAgent,
    })
    .returning({ id: sessions.id })

  const sessionId = inserted[0]?.id ?? ""
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, { ...baseCookieOptions(), expires: expiresAt })
  await ensureDeviceCookie()
  return { sessionId }
}

/**
 * Stamps the session row as having passed the TOTP challenge.
 *
 * It is a column, not a cookie: `requireAdmin` gates money-moving operations, so
 * revoking the session row has to revoke its second factor at the same instant, and
 * "this session passed 2FA at this time" has to be answerable from the database.
 */
export async function markSessionMfaVerified(sessionId: string): Promise<void> {
  await db()
    .update(sessions)
    .set({ totpVerifiedAt: new Date() })
    .where(eq(sessions.id, sessionId))
}

// ─── pending second factor ───────────────────────────────────────────────────
/**
 * Remembers a login that got the password right but still owes its TOTP code. No
 * session row exists yet, so this signed, short-lived cookie is the whole state.
 */
export async function setPendingMfa(userId: string, next: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(PENDING_MFA_COOKIE, signCookieValue(`${userId}|${next}`, env().AUTH_SECRET), {
    ...baseCookieOptions(),
    expires: new Date(Date.now() + PENDING_MFA_TTL_MS),
  })
}

/** The pending login, or `null` when there is none or the signature does not hold. */
export async function readPendingMfa(): Promise<{ userId: string; next: string } | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(PENDING_MFA_COOKIE)?.value
  if (!raw) return null
  const payload = readSignedCookieValue(raw, env().AUTH_SECRET)
  if (!payload) return null
  const [userId = "", next = "/app"] = payload.split("|")
  return userId ? { userId, next } : null
}

export async function clearPendingMfa(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(PENDING_MFA_COOKIE)
}

/**
 * Revokes the current session and clears its cookie. Revoking the row takes the second
 * factor with it, because `totp_verified_at` lives on that same row.
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (token) {
    await db()
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.token, sha256(token)), isNull(sessions.revokedAt)))
  }
  cookieStore.delete(SESSION_COOKIE)
  cookieStore.delete(PENDING_MFA_COOKIE)
}

/** Revokes every live session of a user. Rows are kept: nothing is ever deleted. */
export async function destroyAllSessions(userId: string): Promise<void> {
  await db()
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)))
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
  cookieStore.delete(PENDING_MFA_COOKIE)
}

export interface ActiveSession {
  id: string
  ip: string | null
  userAgent: string | null
  createdAt: Date
  expiresAt: Date
  /** When this session passed the second factor, or null if it never did. */
  totpVerifiedAt: Date | null
  current: boolean
}

/** Live sessions of a user, newest first, for the security screen. */
export async function listActiveSessions(userId: string): Promise<ActiveSession[]> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const currentHash = token ? sha256(token) : null

  const rows = await db()
    .select({
      id: sessions.id,
      token: sessions.token,
      ip: sessions.ip,
      userAgent: sessions.userAgent,
      createdAt: sessions.createdAt,
      expiresAt: sessions.expiresAt,
      totpVerifiedAt: sessions.totpVerifiedAt,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(sessions.createdAt))

  return rows.map((row) => ({
    id: row.id,
    ip: row.ip,
    userAgent: row.userAgent,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    totpVerifiedAt: row.totpVerifiedAt,
    current: currentHash !== null && row.token === currentHash,
  }))
}

// ─── device fingerprint ──────────────────────────────────────────────────────
/**
 * Sets a long-lived random marker the first time we see a browser. It is one of the
 * four welcome-credit fraud signals; it identifies a browser, never a person, and is
 * httpOnly so page scripts cannot read it.
 */
export async function ensureDeviceCookie(): Promise<string> {
  const cookieStore = await cookies()
  const existing = cookieStore.get(DEVICE_COOKIE)?.value
  if (existing) return existing
  const value = randomToken(16)
  cookieStore.set(DEVICE_COOKIE, value, {
    ...baseCookieOptions(),
    expires: new Date(Date.now() + 365 * DAY_MS),
  })
  return value
}

/** Reads the device marker without creating one (safe while rendering). */
export async function readDeviceFingerprint(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(DEVICE_COOKIE)?.value ?? null
}
