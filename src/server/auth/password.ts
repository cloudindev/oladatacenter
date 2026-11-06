import "server-only"
import { type Algorithm, hash, verify } from "@node-rs/argon2"
import { DomainError } from "@ola/core"
import {
  firstPasswordIssueMessage,
  passwordStrength,
  type PasswordVerdict,
} from "@ola/core/identity/index"

/**
 * Password hashing with argon2id.
 *
 * The parameters follow the OWASP 2024 recommendation for argon2id (19 MiB, 2 passes,
 * 1 lane). They are embedded in the PHC string, so raising them later keeps old hashes
 * verifiable; `needsRehash` says when to upgrade one on a successful login.
 */
const ARGON2_OPTIONS = {
  // `Algorithm.Argon2id`. The enum is an ambient const enum, which `isolatedModules`
  // forbids reading at runtime, so the value is written out and typed instead.
  algorithm: 2 as Algorithm,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const

export class WeakPasswordError extends DomainError {
  readonly reason: string

  constructor(reason: string) {
    super("conflict", { detail: `weak password: ${reason}` })
    this.name = "WeakPasswordError"
    this.reason = reason
  }

  /** Shown verbatim in the form, in Spanish. */
  override get customerMessage(): string {
    return this.reason
  }
}

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTIONS)
}

/**
 * Verifies a password against a stored hash. A malformed or missing hash is a failed
 * attempt, never an exception: accounts created through a social provider have none.
 */
export async function verifyPassword(
  storedHash: string | null,
  plain: string,
): Promise<boolean> {
  if (!storedHash) return false
  try {
    return await verify(storedHash, plain, ARGON2_OPTIONS)
  } catch {
    return false
  }
}

/** True when the hash was produced with weaker parameters than the current ones. */
export function needsRehash(storedHash: string): boolean {
  const memory = /\bm=(\d+)/.exec(storedHash)?.[1]
  const time = /\bt=(\d+)/.exec(storedHash)?.[1]
  if (!storedHash.startsWith("$argon2id$")) return true
  if (!memory || !time) return true
  return (
    Number.parseInt(memory, 10) < ARGON2_OPTIONS.memoryCost ||
    Number.parseInt(time, 10) < ARGON2_OPTIONS.timeCost
  )
}

/** Grades a password without throwing. Used for the live meter. */
export function gradePassword(plain: string, email?: string): PasswordVerdict {
  return passwordStrength(plain, email)
}

/**
 * Throws `WeakPasswordError` with a Spanish message when the password is not strong
 * enough. Every write path calls this; the client-side meter is only a courtesy.
 */
export function assertStrongPassword(plain: string, email?: string): void {
  const issue = firstPasswordIssueMessage(plain, email)
  if (issue) throw new WeakPasswordError(issue)
}
