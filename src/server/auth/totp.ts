import "server-only"
import { cookies } from "next/headers"
import { authenticator } from "otplib"
import { toString } from "qrcode"
import { env } from "@/lib/env"
import { randomBase32, readSignedCookieValue, signCookieValue } from "@/lib/crypto"
import { consumeRecoveryCode, countRecoveryCodes, storeRecoveryCodes } from "./tokens"

/**
 * Time-based second factor.
 *
 * The secret is generated here, shown once during enrolment and then kept in
 * `users.totp_secret`. It is never sent to a Client Component after enrolment: the
 * security screen only ever learns whether 2FA is on.
 */

export const TOTP_ISSUER = "OLA VPS Cloud"
export const RECOVERY_CODE_COUNT = 8
const RECOVERY_CODE_LENGTH = 10

/** One step of tolerance either way, for clocks that drift. */
authenticator.options = { window: 1 }

export interface TotpEnrolment {
  /** Base32 secret, to be kept server-side until the first code is confirmed. */
  secret: string
  /** `otpauth://` URI for the QR code. Contains the secret: server-side only. */
  otpauthUrl: string
  /** The secret in groups of four, for manual entry. */
  formattedSecret: string
}

/** Starts enrolment. Nothing is written until a code is confirmed. */
export function beginTotpEnrolment(email: string): TotpEnrolment {
  const secret = randomBase32(20)
  return {
    secret,
    otpauthUrl: authenticator.keyuri(email, TOTP_ISSUER, secret),
    formattedSecret: formatSecret(secret),
  }
}

/** `otpauth://` URI for one secret. Contains the secret: never put it in a URL bar. */
export function otpauthUrlFor(email: string, secret: string): string {
  return authenticator.keyuri(email, TOTP_ISSUER, secret)
}

/**
 * Inline SVG QR for an enrolment URL, rendered here on the server.
 *
 * The URL carries the shared secret, so it is never handed to a third-party QR
 * service and never reaches the client as anything but the finished image. Error
 * correction level M: still scannable if the screen is dirty or the photo is poor.
 */
export async function qrSvgFor(otpauthUrl: string): Promise<string> {
  return toString(otpauthUrl, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 220,
    color: { dark: "#222f30", light: "#ffffff" },
  })
}

/** Base32 in groups of four: easier to type into an authenticator by hand. */
export function formatSecret(secret: string): string {
  return (secret.match(/.{1,4}/g) ?? [secret]).join(" ")
}

/** Verifies a 6-digit code against a secret. Never throws on malformed input. */
export function verifyTotp(secret: string, code: string): boolean {
  const token = code.replace(/\s/g, "")
  if (!/^[0-9]{6}$/.test(token)) return false
  try {
    return authenticator.check(token, secret)
  } catch {
    return false
  }
}

/**
 * Fresh recovery codes. Returned in plaintext exactly once, stored hashed. Format
 * `abcde-fghij`, lower-case base32 so there is no 0/O or 1/l ambiguity.
 */
export async function generateRecoveryCodes(userId: string): Promise<string[]> {
  const codes: string[] = []
  while (codes.length < RECOVERY_CODE_COUNT) {
    const raw = randomBase32(10).toLowerCase().replace(/[^a-z2-7]/g, "")
    if (raw.length < RECOVERY_CODE_LENGTH) continue
    const code = raw.slice(0, RECOVERY_CODE_LENGTH)
    const display = `${code.slice(0, 5)}-${code.slice(5)}`
    if (!codes.includes(display)) codes.push(display)
  }
  await storeRecoveryCodes(userId, codes)
  return codes
}

/** Accepts a TOTP code or a recovery code. Recovery codes are single use. */
export async function verifySecondFactor(input: {
  userId: string
  secret: string
  code: string
}): Promise<{ ok: boolean; usedRecoveryCode: boolean }> {
  if (verifyTotp(input.secret, input.code)) return { ok: true, usedRecoveryCode: false }
  const recovered = await consumeRecoveryCode(input.userId, input.code)
  return { ok: recovered, usedRecoveryCode: recovered }
}

/** Recovery codes still unused, for the security screen. */
export async function remainingRecoveryCodes(userId: string): Promise<number> {
  return countRecoveryCodes(userId)
}

// ─── enrolment handover ──────────────────────────────────────────────────────
/**
 * Enrolment spans two requests: one generates the secret and shows it, the next
 * confirms a code. The secret cannot go in the URL or in a hidden form field, and there
 * is no column to park it in before it is confirmed, so it travels in a signed,
 * httpOnly, 10-minute cookie bound to the user id.
 *
 * The same mechanism hands the fresh recovery codes to the page that shows them once.
 * Both cookies are short-lived and unreadable by page scripts; the codes are stored
 * hashed, so the cookie copy is the only plaintext and it expires on its own.
 */
const SETUP_COOKIE = "ola_totp_setup"
const CODES_COOKIE = "ola_totp_codes"
const SETUP_TTL_MS = 10 * 60 * 1000

function cookieOptions() {
  return {
    httpOnly: true,
    secure: env().NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: new Date(Date.now() + SETUP_TTL_MS),
  }
}

export async function storeEnrolmentSecret(userId: string, secret: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(
    SETUP_COOKIE,
    signCookieValue(`${userId}|${secret}`, env().AUTH_SECRET),
    cookieOptions(),
  )
}

export async function readEnrolmentSecret(userId: string): Promise<string | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(SETUP_COOKIE)?.value
  if (!raw) return null
  const payload = readSignedCookieValue(raw, env().AUTH_SECRET)
  if (!payload) return null
  const [owner, secret] = payload.split("|")
  return owner === userId && secret ? secret : null
}

export async function clearEnrolmentSecret(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SETUP_COOKIE)
}

export async function storeFreshRecoveryCodes(
  userId: string,
  codes: readonly string[],
): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(
    CODES_COOKIE,
    signCookieValue(`${userId}|${codes.join(",")}`, env().AUTH_SECRET),
    cookieOptions(),
  )
}

/** The codes to show once, or `null`. They disappear when the cookie expires. */
export async function readFreshRecoveryCodes(userId: string): Promise<string[] | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(CODES_COOKIE)?.value
  if (!raw) return null
  const payload = readSignedCookieValue(raw, env().AUTH_SECRET)
  if (!payload) return null
  const [owner, joined] = payload.split("|")
  if (owner !== userId || !joined) return null
  return joined.split(",").filter((code) => code.length > 0)
}

export async function clearFreshRecoveryCodes(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(CODES_COOKIE)
}
