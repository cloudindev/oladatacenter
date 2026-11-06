/**
 * OpenSSH public key *shape* validation. Pure: it checks the three-part layout and
 * that the body is base64 whose decoded header repeats the declared algorithm.
 * The SHA-256 fingerprint needs a hash and therefore lives in the app layer.
 */

export const SSH_KEY_TYPES: readonly string[] = [
  "ssh-ed25519",
  "ssh-rsa",
  "ecdsa-sha2-nistp256",
  "ecdsa-sha2-nistp384",
  "ecdsa-sha2-nistp521",
  "sk-ssh-ed25519@openssh.com",
  "sk-ecdsa-sha2-nistp256@openssh.com",
]

export interface ParsedSshKey {
  type: string
  /** Base64 body, exactly as it must be stored. */
  body: string
  comment: string | null
}

const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/

/**
 * Splits `type base64 comment`. Returns `null` when the key cannot be an OpenSSH
 * public key: wrong number of fields, unknown type, non-base64 body, or a body whose
 * embedded algorithm name does not match the declared type.
 */
export function parseSshPublicKey(raw: string): ParsedSshKey | null {
  const value = raw.replace(/\s+/g, " ").trim()
  if (value.length === 0 || value.length > 16_384) return null
  if (value.startsWith("-----BEGIN")) return null

  const parts = value.split(" ")
  if (parts.length < 2) return null

  const type = parts[0] as string
  const body = parts[1] as string
  const comment = parts.length > 2 ? parts.slice(2).join(" ") : null

  if (!SSH_KEY_TYPES.includes(type)) return null
  if (body.length < 40 || body.length % 4 !== 0 || !BASE64_RE.test(body)) return null
  if (!bodyDeclaresType(body, type)) return null

  return { type, body, comment }
}

/**
 * The SSH wire format starts with a 4-byte big-endian length followed by the
 * algorithm name, so the decoded body must begin with the declared type. Decoding
 * only the first bytes is enough and keeps this helper free of Buffer.
 */
function bodyDeclaresType(body: string, type: string): boolean {
  const prefixLength = Math.ceil(((4 + type.length) * 4) / 3)
  const decoded = decodeBase64Prefix(body.slice(0, prefixLength + 4))
  if (decoded === null || decoded.length < 4 + type.length) return false
  const declaredLength =
    (decoded[0] as number) * 2 ** 24 +
    (decoded[1] as number) * 2 ** 16 +
    (decoded[2] as number) * 2 ** 8 +
    (decoded[3] as number)
  if (declaredLength !== type.length) return false
  const name = decoded
    .slice(4, 4 + type.length)
    .map((byte) => String.fromCharCode(byte))
    .join("")
  return name === type
}

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

/** Decodes as many whole 4-character groups as possible. No padding handling needed. */
function decodeBase64Prefix(chunk: string): number[] | null {
  const groups = Math.floor(chunk.length / 4)
  const bytes: number[] = []
  for (let group = 0; group < groups; group += 1) {
    let accumulator = 0
    for (let offset = 0; offset < 4; offset += 1) {
      const character = chunk[group * 4 + offset] as string
      const index = BASE64_ALPHABET.indexOf(character)
      if (index < 0) return character === "=" ? bytes : null
      accumulator = accumulator * 64 + index
    }
    bytes.push((accumulator >> 16) & 0xff, (accumulator >> 8) & 0xff, accumulator & 0xff)
  }
  return bytes
}

export function isSshPublicKey(raw: string): boolean {
  return parseSshPublicKey(raw) !== null
}
