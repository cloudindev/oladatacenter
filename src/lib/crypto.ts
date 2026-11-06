import "server-only"
import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto"
import { parseSshPublicKey } from "@ola/core/identity/index"

/**
 * Primitives for opaque tokens, hashes and signatures.
 *
 * Rules this file exists to enforce:
 *  - a token is random, never derived from user data;
 *  - only its sha256 is ever stored;
 *  - comparisons are constant-time.
 */

/** URL-safe random token. 32 bytes = 256 bits of entropy. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url")
}

/** Lower-case hex sha256. The only form we persist for tokens. */
export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

/** Constant-time comparison of two hex digests of the same length. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"))
}

/** Numeric code with no modulo bias. Used for phone OTPs. */
export function randomDigits(length: number): string {
  let code = ""
  for (let index = 0; index < length; index += 1) code += String(randomInt(0, 10))
  return code
}

/** Base32 (RFC 4648, no padding) secret for TOTP enrolment. */
export function randomBase32(bytes = 20): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
  const source = randomBytes(bytes)
  let bits = 0
  let accumulator = 0
  let output = ""
  for (const byte of source) {
    accumulator = (accumulator << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += alphabet[(accumulator >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) output += alphabet[(accumulator << (5 - bits)) & 31]
  return output
}

/**
 * HMAC-SHA256 signature in base64url, keyed with `AUTH_SECRET`.
 * Used for the second-factor marker cookie, which must be unforgeable but carries
 * no secret of its own.
 */
export function signValue(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value, "utf8").digest("base64url")
}

/** `value.signature`, the shape of every signed cookie we set. */
export function signCookieValue(value: string, secret: string): string {
  return `${value}.${signValue(value, secret)}`
}

/** Returns the payload of a signed cookie, or `null` when the signature fails. */
export function readSignedCookieValue(raw: string, secret: string): string | null {
  const separator = raw.lastIndexOf(".")
  if (separator <= 0) return null
  const value = raw.slice(0, separator)
  const signature = raw.slice(separator + 1)
  const expected = signValue(value, secret)
  if (signature.length !== expected.length) return null
  return safeEqual(signature, expected) ? value : null
}

/**
 * OpenSSH fingerprint: `SHA256:` plus the unpadded base64 sha256 of the key blob,
 * the exact string `ssh-keygen -lf` prints. Returns `null` when the key is not a
 * well-formed public key.
 */
export function sshKeyFingerprint(publicKey: string): string | null {
  const parsed = parseSshPublicKey(publicKey)
  if (!parsed) return null
  const digest = createHash("sha256").update(Buffer.from(parsed.body, "base64")).digest("base64")
  return `SHA256:${digest.replace(/=+$/, "")}`
}

/** Normalised `type base64` form, without the comment, for storage and comparison. */
export function normalizeSshKey(publicKey: string): string | null {
  const parsed = parseSshPublicKey(publicKey)
  return parsed ? `${parsed.type} ${parsed.body}` : null
}
