import "server-only"
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes, randomInt } from "node:crypto"
import { and, desc, eq } from "drizzle-orm"
import { actions, db } from "@ola/db"
import { env } from "@/lib/env"
import { logger } from "@/lib/logger"

/**
 * One-time reveal of the root password of a freshly installed server.
 *
 * Decision (documented here because the schema has no column for it): the password is
 * stored ENCRYPTED AT REST in the `actions` table, as a row of type `root_password` whose
 * `payload` holds `{ iv, tag, ciphertext }`, plus a write-once `shownAt` marker in
 * `result`. Why `actions` and not a new column:
 *  - `packages/db/src/schema.ts` is owned by another module and a migration is not this
 *    layer's to write;
 *  - `actions` is already the per-service operation log, is never deleted, and its
 *    `payload`/`result` columns are jsonb.
 *
 * Properties:
 *  - AES-256-GCM, key derived from `AUTH_SECRET` with HKDF and a fixed info label, so the
 *    ciphertext is useless without the application secret;
 *  - write-once: a second store for the same service is refused, never overwritten;
 *  - read-once: `revealRootPasswordOnce` returns the plaintext only while `result.shownAt`
 *    is null, and sets it in the same call. After that the UI can only say "ya mostrada".
 *  - OVH's own password email is never forwarded: the rebuild runs with
 *    `doNotSendPassword: true` (see `src/inngest/jobs/provision.ts`).
 */

const ACTION_TYPE = "root_password"
const KEY_INFO = "ola-vps/root-password/v1"
const PASSWORD_ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#%*+-="
const PASSWORD_LENGTH = 24

interface EncryptedPayload {
  iv: string
  tag: string
  ciphertext: string
}

function encryptionKey(): Buffer {
  const secret = env().AUTH_SECRET
  return Buffer.from(hkdfSync("sha256", Buffer.from(secret, "utf8"), Buffer.alloc(0), KEY_INFO, 32))
}

/** 24 characters out of an unambiguous alphabet: no O/0, no l/1. */
export function generateRootPassword(): string {
  let password = ""
  for (let index = 0; index < PASSWORD_LENGTH; index += 1) {
    password += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)]
  }
  return password
}

export function encryptSecret(plaintext: string): EncryptedPayload {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  return {
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  }
}

export function decryptSecret(payload: EncryptedPayload): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(payload.iv, "base64"),
  )
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"))
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ])
  return plaintext.toString("utf8")
}

function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.iv === "string" &&
    typeof candidate.tag === "string" &&
    typeof candidate.ciphertext === "string"
  )
}

async function findRow(serviceId: string) {
  const rows = await db()
    .select()
    .from(actions)
    .where(and(eq(actions.serviceId, serviceId), eq(actions.type, ACTION_TYPE)))
    .orderBy(desc(actions.createdAt))
    .limit(1)
  return rows[0] ?? null
}

/**
 * Stores the password for a service exactly once. Called BEFORE the rebuild that applies
 * it, so a crash can never leave a server whose password nobody knows.
 */
export async function storeRootPasswordOnce(serviceId: string, password: string): Promise<void> {
  const existing = await findRow(serviceId)
  if (existing) {
    logger.warn({ serviceId }, "root password already stored; refusing to overwrite")
    return
  }
  await db()
    .insert(actions)
    .values({
      serviceId,
      type: ACTION_TYPE,
      status: "done",
      payload: { ...encryptSecret(password) },
      result: { shownAt: null },
      finishedAt: new Date(),
    })
}

export type RootPasswordReveal =
  | { state: "available"; password: string }
  | { state: "already_shown" }
  | { state: "none" }

/**
 * Returns the password once and burns the right to see it again. Intended for the
 * customer area; the plaintext is never logged.
 */
export async function revealRootPasswordOnce(serviceId: string): Promise<RootPasswordReveal> {
  const row = await findRow(serviceId)
  if (!row) return { state: "none" }

  const shownAt = (row.result as Record<string, unknown> | null)?.shownAt
  if (typeof shownAt === "string" && shownAt !== "") return { state: "already_shown" }
  if (!isEncryptedPayload(row.payload)) return { state: "none" }

  const password = decryptSecret(row.payload)
  await db()
    .update(actions)
    .set({ result: { shownAt: new Date().toISOString() } })
    .where(eq(actions.id, row.id))
  return { state: "available", password }
}
