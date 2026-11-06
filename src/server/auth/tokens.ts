import "server-only"
import { and, desc, eq, isNull } from "drizzle-orm"
import { db, verificationTokens } from "@ola/db"
import { randomDigits, randomToken, safeEqual, sha256 } from "@/lib/crypto"

/**
 * Single-use tokens for email verification, password reset, phone OTP and TOTP
 * recovery codes.
 *
 * Only the sha256 of a token is ever stored. The plaintext is returned once, to be put
 * in an email or an SMS, and cannot be recovered afterwards. Consuming a token stamps
 * `consumedAt`, and every other live token of the same purpose for that user is
 * consumed at the same time so an old link cannot be replayed.
 */

export const TOKEN_PURPOSES = {
  emailVerify: "email_verify",
  passwordReset: "password_reset",
  phoneOtp: "phone_otp",
  totpRecovery: "totp_recovery",
} as const

export type TokenPurpose = (typeof TOKEN_PURPOSES)[keyof typeof TOKEN_PURPOSES]

export const EMAIL_VERIFY_TTL_MINUTES = 24 * 60
export const PASSWORD_RESET_TTL_MINUTES = 60
export const OTP_TTL_MINUTES = 10
export const OTP_LENGTH = 6
export const OTP_MAX_ATTEMPTS = 5
/** Recovery codes do not expire; the column is NOT NULL, so they are stamped far out. */
const NO_EXPIRY_YEARS = 50

function minutesFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000)
}

/** Invalidates every live token of one purpose for one user. */
export async function invalidateTokens(userId: string, purpose: TokenPurpose): Promise<void> {
  await db()
    .update(verificationTokens)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(verificationTokens.userId, userId),
        eq(verificationTokens.purpose, purpose),
        isNull(verificationTokens.consumedAt),
      ),
    )
}

/**
 * Issues a long random token for a link. The plaintext is returned once; the row keeps
 * only its hash. Any previous live token of the same purpose is invalidated.
 */
export async function issueLinkToken(input: {
  userId: string
  purpose: Extract<TokenPurpose, "email_verify" | "password_reset">
  ttlMinutes?: number
}): Promise<string> {
  const ttl =
    input.ttlMinutes ??
    (input.purpose === TOKEN_PURPOSES.emailVerify
      ? EMAIL_VERIFY_TTL_MINUTES
      : PASSWORD_RESET_TTL_MINUTES)

  await invalidateTokens(input.userId, input.purpose)
  const token = randomToken()
  await db().insert(verificationTokens).values({
    userId: input.userId,
    purpose: input.purpose,
    tokenHash: sha256(token),
    expiresAt: minutesFromNow(ttl),
  })
  return token
}

export type ConsumeResult =
  | { ok: true; userId: string; target: string | null }
  | { ok: false; reason: "not_found" | "expired" | "already_used" }

/**
 * Consumes a link token. Looks the row up by hash, so the plaintext never has to be
 * compared against anything stored.
 */
export async function consumeLinkToken(input: {
  token: string
  purpose: Extract<TokenPurpose, "email_verify" | "password_reset">
}): Promise<ConsumeResult> {
  const rows = await db()
    .select({
      id: verificationTokens.id,
      userId: verificationTokens.userId,
      target: verificationTokens.target,
      expiresAt: verificationTokens.expiresAt,
      consumedAt: verificationTokens.consumedAt,
    })
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.tokenHash, sha256(input.token)),
        eq(verificationTokens.purpose, input.purpose),
      ),
    )
    .limit(1)

  const row = rows[0]
  if (!row || !row.userId) return { ok: false, reason: "not_found" }
  if (row.consumedAt) return { ok: false, reason: "already_used" }
  if (row.expiresAt.getTime() <= Date.now()) return { ok: false, reason: "expired" }

  await db()
    .update(verificationTokens)
    .set({ consumedAt: new Date() })
    .where(eq(verificationTokens.id, row.id))

  return { ok: true, userId: row.userId, target: row.target }
}

/**
 * Issues a 6-digit phone OTP valid for 10 minutes. The code is returned once so the
 * SMS adapter can send it. Any live OTP for that user is invalidated first, so only
 * the newest code works.
 */
export async function issueOtp(input: {
  userId: string
  target: string
}): Promise<{ code: string; expiresAt: Date }> {
  await invalidateTokens(input.userId, TOKEN_PURPOSES.phoneOtp)
  const code = randomDigits(OTP_LENGTH)
  const expiresAt = minutesFromNow(OTP_TTL_MINUTES)
  await db().insert(verificationTokens).values({
    userId: input.userId,
    purpose: TOKEN_PURPOSES.phoneOtp,
    tokenHash: sha256(code),
    target: input.target,
    expiresAt,
  })
  return { code, expiresAt }
}

export type OtpResult =
  | { ok: true; target: string | null }
  | {
      ok: false
      reason: "not_found" | "expired" | "already_used" | "too_many_attempts" | "mismatch"
      attemptsLeft?: number
    }

/**
 * Verifies a phone OTP. Wrong codes count: after `OTP_MAX_ATTEMPTS` the code is burned
 * and a new one must be requested. A correct code is consumed immediately.
 */
export async function verifyOtp(input: {
  userId: string
  code: string
}): Promise<OtpResult> {
  const rows = await db()
    .select({
      id: verificationTokens.id,
      tokenHash: verificationTokens.tokenHash,
      target: verificationTokens.target,
      attempts: verificationTokens.attempts,
      expiresAt: verificationTokens.expiresAt,
      consumedAt: verificationTokens.consumedAt,
    })
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.userId, input.userId),
        eq(verificationTokens.purpose, TOKEN_PURPOSES.phoneOtp),
        isNull(verificationTokens.consumedAt),
      ),
    )
    .orderBy(desc(verificationTokens.createdAt))
    .limit(1)

  const row = rows[0]
  if (!row) return { ok: false, reason: "not_found" }
  if (row.expiresAt.getTime() <= Date.now()) return { ok: false, reason: "expired" }
  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    await db()
      .update(verificationTokens)
      .set({ consumedAt: new Date() })
      .where(eq(verificationTokens.id, row.id))
    return { ok: false, reason: "too_many_attempts" }
  }

  const submitted = input.code.replace(/\s/g, "")
  if (!safeEqual(sha256(submitted), row.tokenHash)) {
    const attempts = row.attempts + 1
    await db()
      .update(verificationTokens)
      .set({
        attempts,
        ...(attempts >= OTP_MAX_ATTEMPTS ? { consumedAt: new Date() } : {}),
      })
      .where(eq(verificationTokens.id, row.id))
    return {
      ok: false,
      reason: attempts >= OTP_MAX_ATTEMPTS ? "too_many_attempts" : "mismatch",
      attemptsLeft: Math.max(0, OTP_MAX_ATTEMPTS - attempts),
    }
  }

  await db()
    .update(verificationTokens)
    .set({ consumedAt: new Date() })
    .where(eq(verificationTokens.id, row.id))
  return { ok: true, target: row.target }
}

/** True when a live OTP exists, so the UI can show the code step instead of the form. */
export async function pendingOtpTarget(userId: string): Promise<string | null> {
  const rows = await db()
    .select({ target: verificationTokens.target, expiresAt: verificationTokens.expiresAt })
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.userId, userId),
        eq(verificationTokens.purpose, TOKEN_PURPOSES.phoneOtp),
        isNull(verificationTokens.consumedAt),
      ),
    )
    .orderBy(desc(verificationTokens.createdAt))
    .limit(1)
  const row = rows[0]
  if (!row || row.expiresAt.getTime() <= Date.now()) return null
  return row.target
}

// ─── TOTP recovery codes ─────────────────────────────────────────────────────
/** Stores the hashes of a fresh set of recovery codes, replacing any previous set. */
export async function storeRecoveryCodes(userId: string, codes: readonly string[]): Promise<void> {
  await invalidateTokens(userId, TOKEN_PURPOSES.totpRecovery)
  const expiresAt = new Date(Date.now() + NO_EXPIRY_YEARS * 365 * 24 * 60 * 60 * 1000)
  await db()
    .insert(verificationTokens)
    .values(
      codes.map((code) => ({
        userId,
        purpose: TOKEN_PURPOSES.totpRecovery,
        tokenHash: sha256(code),
        expiresAt,
      })),
    )
}

/** Consumes one recovery code. Each code works once. */
export async function consumeRecoveryCode(userId: string, code: string): Promise<boolean> {
  // Codes are shown as `abcde-fghij`; the separator and any spacing are ignored.
  const normalized = code.trim().toLowerCase().replace(/[\s-]/g, "")
  const rows = await db()
    .select({ id: verificationTokens.id })
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.userId, userId),
        eq(verificationTokens.purpose, TOKEN_PURPOSES.totpRecovery),
        eq(verificationTokens.tokenHash, sha256(normalized)),
        isNull(verificationTokens.consumedAt),
      ),
    )
    .limit(1)

  const row = rows[0]
  if (!row) return false
  await db()
    .update(verificationTokens)
    .set({ consumedAt: new Date() })
    .where(eq(verificationTokens.id, row.id))
  return true
}

/** How many recovery codes are still unused, for the security screen. */
export async function countRecoveryCodes(userId: string): Promise<number> {
  const rows = await db()
    .select({ id: verificationTokens.id })
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.userId, userId),
        eq(verificationTokens.purpose, TOKEN_PURPOSES.totpRecovery),
        isNull(verificationTokens.consumedAt),
      ),
    )
  return rows.length
}
