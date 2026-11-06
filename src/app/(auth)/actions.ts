"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { customers, db, users } from "@ola/db"
import { recordAudit } from "@/server/audit"
import {
  absoluteUrl,
  baseEmailProps,
  sendPasswordResetEmail,
  sendTemplateEmail,
} from "@/server/auth/mailer"
import {
  assertStrongPassword,
  hashPassword,
  needsRehash,
  verifyPassword,
  WeakPasswordError,
} from "@/server/auth/password"
import {
  enforceRateLimit,
  RateLimitedError,
  resetRateLimit,
} from "@/server/auth/rate-limit"
import {
  clearPendingMfa,
  createSession,
  currentSession,
  destroyAllSessions,
  destroySession,
  ensureDeviceCookie,
  markSessionMfaVerified,
  readPendingMfa,
  requestMeta,
  SESSION_COOKIE,
  setPendingMfa,
} from "@/server/auth/session"
import {
  consumeLinkToken,
  issueLinkToken,
  TOKEN_PURPOSES,
} from "@/server/auth/tokens"
import { verifySecondFactor } from "@/server/auth/totp"

/**
 * Server Actions for the `(auth)` route group.
 *
 * Shape of every action: validate, rate limit, do the one write it owns, audit, then
 * redirect with an opaque result code. They return `never` because the redirect throws,
 * which keeps the forms plain Server Components with no client state.
 *
 * Two things are deliberate and must stay:
 *  - the login form answers `credenciales` whether the address or the password was
 *    wrong, and takes the same work either way, so it cannot be used to enumerate
 *    accounts;
 *  - `/recuperar` always answers "we sent you an email", for the same reason.
 */

const emailSchema = z.string().trim().toLowerCase().email().max(320)

/** Only in-app paths are accepted as a post-login destination. */
function safeNext(raw: FormDataEntryValue | null): string {
  const value = typeof raw === "string" ? raw : ""
  if (!value.startsWith("/") || value.startsWith("//")) return "/app"
  return value
}

function field(form: FormData, name: string): string {
  const value = form.get(name)
  return typeof value === "string" ? value.trim() : ""
}

function rateKey(meta: { ip: string | null }, identifier: string): string {
  return `${meta.ip ?? "sin-ip"}:${identifier}`
}

// ─── registration ────────────────────────────────────────────────────────────
export async function registerAction(form: FormData): Promise<never> {
  const meta = await requestMeta()
  const emailResult = emailSchema.safeParse(form.get("email"))
  const password = typeof form.get("password") === "string" ? String(form.get("password")) : ""
  const repeat = typeof form.get("password2") === "string" ? String(form.get("password2")) : ""
  const name = field(form, "nombre")
  const accepted = form.get("condiciones") !== null

  if (!emailResult.success) redirect("/registro?error=correo_invalido")
  if (!accepted) redirect("/registro?error=campos")
  if (password !== repeat) redirect("/registro?error=contrasenas_distintas")

  const email = emailResult.data

  try {
    enforceRateLimit("register", rateKey(meta, email))
    assertStrongPassword(password, email)
  } catch (error) {
    if (error instanceof RateLimitedError) redirect("/registro?error=limite")
    if (error instanceof WeakPasswordError) redirect("/registro?error=contrasena_debil")
    throw error
  }

  const existing = await db()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)
  if (existing.length > 0) redirect("/registro?error=correo_en_uso")

  const passwordHash = await hashPassword(password)
  const inserted = await db()
    .insert(users)
    .values({ email, passwordHash, role: "customer" })
    .returning({ id: users.id })
  const userId = inserted[0]?.id
  if (!userId) redirect("/registro?error=interno")

  // The customer row is created empty: the onboarding wizard fills it in.
  const customerRows = await db()
    .insert(customers)
    .values({ userId, kind: "company", legalName: name || null, status: "unverified" })
    .returning({ id: customers.id })
  const customerId = customerRows[0]?.id ?? null

  await recordAudit({
    actorId: userId,
    actorType: "user",
    entity: "user",
    entityId: userId,
    action: "user_registered",
    diff: { email },
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  const token = await issueLinkToken({ userId, purpose: TOKEN_PURPOSES.emailVerify })
  await sendTemplateEmail(
    email,
    "welcome-verify",
    {
      ...baseEmailProps(name),
      verifyUrl: absoluteUrl(`/verificar-email?token=${encodeURIComponent(token)}`),
    },
    { customerId },
  )

  await createSession(userId, meta)
  redirect("/verificar-email?ok=registro")
}

// ─── login ───────────────────────────────────────────────────────────────────
export async function loginAction(form: FormData): Promise<never> {
  const meta = await requestMeta()
  const next = safeNext(form.get("next"))
  const emailResult = emailSchema.safeParse(form.get("email"))
  const password = typeof form.get("password") === "string" ? String(form.get("password")) : ""

  // An invalid address gets the same answer as a wrong password.
  if (!emailResult.success || password.length === 0) redirect("/login?error=credenciales")
  const email = emailResult.data

  try {
    enforceRateLimit("login", rateKey(meta, email))
  } catch (error) {
    if (error instanceof RateLimitedError) redirect("/login?error=limite")
    throw error
  }

  const rows = await db()
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      totpSecret: users.totpSecret,
      totpEnabledAt: users.totpEnabledAt,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)
  const user = rows[0]

  const ok = await verifyPassword(user?.passwordHash ?? null, password)
  if (!user || !ok) {
    await recordAudit({
      actorId: user?.id ?? null,
      actorType: "user",
      entity: "user",
      entityId: user?.id ?? null,
      action: "login_failed",
      diff: { email },
      ip: meta.ip,
      userAgent: meta.userAgent,
    })
    redirect("/login?error=credenciales")
  }

  resetRateLimit("login", rateKey(meta, email))

  if (user.passwordHash && needsRehash(user.passwordHash)) {
    await db()
      .update(users)
      .set({ passwordHash: await hashPassword(password) })
      .where(eq(users.id, user.id))
  }

  // Second factor: no session exists until the code is right.
  if (user.totpEnabledAt && user.totpSecret) {
    await setPendingMfa(user.id, next)
    redirect("/login?paso=2fa")
  }

  return finishLogin(user.id, meta, next, { mfaVerified: false })
}

/** Second step of a login with 2FA enabled. */
export async function loginTotpAction(form: FormData): Promise<never> {
  const meta = await requestMeta()
  const code = field(form, "codigo")
  const pending = await readPendingMfa()
  if (!pending) redirect("/login?error=sesion_expirada")
  const { userId, next } = pending

  try {
    enforceRateLimit("totpVerify", rateKey(meta, userId))
  } catch (error) {
    if (error instanceof RateLimitedError) redirect("/login?error=limite")
    throw error
  }

  const rows = await db()
    .select({ id: users.id, totpSecret: users.totpSecret })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  const secret = rows[0]?.totpSecret
  if (!secret) redirect("/login?error=sesion_expirada")

  const result = await verifySecondFactor({ userId, secret, code })
  if (!result.ok) {
    await recordAudit({
      actorId: userId,
      actorType: "user",
      entity: "user",
      entityId: userId,
      action: "login_2fa_failed",
      ip: meta.ip,
      userAgent: meta.userAgent,
    })
    redirect("/login?paso=2fa&error=2fa_invalido")
  }

  await clearPendingMfa()
  return finishLogin(userId, meta, next, {
    mfaVerified: true,
    usedRecoveryCode: result.usedRecoveryCode,
  })
}

async function finishLogin(
  userId: string,
  meta: { ip: string | null; userAgent: string | null },
  next: string,
  outcome: { mfaVerified: boolean; usedRecoveryCode?: boolean },
): Promise<never> {
  const { sessionId } = await createSession(userId, meta)
  // Only a session that passed the TOTP challenge may reach /admin.
  if (outcome.mfaVerified) await markSessionMfaVerified(sessionId)
  await db().update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId))
  await recordAudit({
    actorId: userId,
    actorType: "user",
    entity: "session",
    entityId: sessionId,
    action: "login_ok",
    diff: {
      mfa: outcome.mfaVerified,
      ...(outcome.usedRecoveryCode ? { usedRecoveryCode: true } : {}),
    },
    ip: meta.ip,
    userAgent: meta.userAgent,
  })
  redirect(next)
}

/** Abandons a half-finished login, so the form goes back to step one. */
export async function cancelPendingMfaAction(): Promise<never> {
  await clearPendingMfa()
  redirect("/login")
}

export async function logoutAction(): Promise<never> {
  const meta = await requestMeta()
  const cookieStore = await cookies()
  const hadSession = cookieStore.has(SESSION_COOKIE)
  await destroySession()
  if (hadSession) {
    await recordAudit({
      actorType: "user",
      entity: "session",
      action: "logout",
      ip: meta.ip,
      userAgent: meta.userAgent,
    })
  }
  redirect("/login?ok=sesion_cerrada")
}

// ─── email verification ──────────────────────────────────────────────────────
/**
 * Confirms an address. Submitted from a button rather than consumed on page load, so a
 * link preview or a corporate mail scanner cannot burn the token before the customer
 * clicks it.
 */
export async function confirmEmailAction(form: FormData): Promise<never> {
  const meta = await requestMeta()
  const token = field(form, "token")
  if (!token) redirect("/verificar-email?error=enlace_invalido")

  const result = await consumeLinkToken({ token, purpose: TOKEN_PURPOSES.emailVerify })
  if (!result.ok) {
    const code =
      result.reason === "expired"
        ? "enlace_caducado"
        : result.reason === "already_used"
          ? "enlace_usado"
          : "enlace_invalido"
    redirect(`/verificar-email?error=${code}`)
  }

  const rows = await db()
    .select({ emailVerifiedAt: users.emailVerifiedAt })
    .from(users)
    .where(eq(users.id, result.userId))
    .limit(1)

  if (!rows[0]?.emailVerifiedAt) {
    await db()
      .update(users)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(users.id, result.userId))
    await recordAudit({
      actorId: result.userId,
      actorType: "user",
      entity: "user",
      entityId: result.userId,
      action: "email_verified",
      ip: meta.ip,
      userAgent: meta.userAgent,
    })
  }

  await ensureDeviceCookie()
  redirect("/onboarding?ok=correo_verificado")
}

/** Sends a fresh verification link to a signed-in, still-unverified user. */
export async function resendVerificationAction(): Promise<never> {
  const meta = await requestMeta()
  const session = await currentSession()
  if (!session) redirect("/login")

  const rows = await db()
    .select({ id: users.id, email: users.email, emailVerifiedAt: users.emailVerifiedAt })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)
  const user = rows[0]
  if (!user) redirect("/login")
  if (user.emailVerifiedAt) redirect("/onboarding")

  try {
    enforceRateLimit("emailResend", rateKey(meta, user.id))
  } catch (error) {
    if (error instanceof RateLimitedError) redirect("/verificar-email?error=limite")
    throw error
  }

  const token = await issueLinkToken({ userId: user.id, purpose: TOKEN_PURPOSES.emailVerify })
  await sendTemplateEmail(
    user.email,
    "welcome-verify",
    {
      ...baseEmailProps(null),
      verifyUrl: absoluteUrl(`/verificar-email?token=${encodeURIComponent(token)}`),
    },
    { customerId: session.customer?.id ?? null },
  )
  redirect("/verificar-email?ok=enlace_enviado")
}

// ─── password reset ──────────────────────────────────────────────────────────
export async function requestPasswordResetAction(form: FormData): Promise<never> {
  const meta = await requestMeta()
  const emailResult = emailSchema.safeParse(form.get("email"))
  // Same answer for a valid address, an unknown one and a malformed one.
  if (!emailResult.success) redirect("/recuperar?ok=enlace_enviado")
  const email = emailResult.data

  try {
    enforceRateLimit("passwordReset", rateKey(meta, email))
  } catch (error) {
    if (error instanceof RateLimitedError) redirect("/recuperar?error=limite")
    throw error
  }

  const rows = await db()
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)
  const user = rows[0]

  if (user) {
    const token = await issueLinkToken({ userId: user.id, purpose: TOKEN_PURPOSES.passwordReset })
    await sendPasswordResetEmail(
      user.email,
      absoluteUrl(`/restablecer?token=${encodeURIComponent(token)}`),
      { requestedFromIp: meta.ip },
    )
    await recordAudit({
      actorId: user.id,
      actorType: "user",
      entity: "user",
      entityId: user.id,
      action: "password_reset_requested",
      ip: meta.ip,
      userAgent: meta.userAgent,
    })
  }

  redirect("/recuperar?ok=enlace_enviado")
}

export async function resetPasswordAction(form: FormData): Promise<never> {
  const meta = await requestMeta()
  const token = field(form, "token")
  const password = typeof form.get("password") === "string" ? String(form.get("password")) : ""
  const repeat = typeof form.get("password2") === "string" ? String(form.get("password2")) : ""
  const back = `/restablecer?token=${encodeURIComponent(token)}`

  if (!token) redirect("/restablecer?error=enlace_invalido")
  if (password !== repeat) redirect(`${back}&error=contrasenas_distintas`)

  const result = await consumeLinkToken({ token, purpose: TOKEN_PURPOSES.passwordReset })
  if (!result.ok) {
    const code =
      result.reason === "expired"
        ? "enlace_caducado"
        : result.reason === "already_used"
          ? "enlace_usado"
          : "enlace_invalido"
    redirect(`/restablecer?error=${code}`)
  }

  const rows = await db()
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, result.userId))
    .limit(1)

  try {
    assertStrongPassword(password, rows[0]?.email)
  } catch (error) {
    if (error instanceof WeakPasswordError) redirect(`${back}&error=contrasena_debil`)
    throw error
  }

  await db()
    .update(users)
    .set({ passwordHash: await hashPassword(password) })
    .where(eq(users.id, result.userId))

  // A reset is also the recovery path after a compromise: every session goes.
  await destroyAllSessions(result.userId)
  await recordAudit({
    actorId: result.userId,
    actorType: "user",
    entity: "user",
    entityId: result.userId,
    action: "password_changed",
    diff: { via: "reset" },
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  redirect("/login?ok=contrasena_restablecida")
}
