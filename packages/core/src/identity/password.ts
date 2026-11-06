/**
 * Password strength. Pure and deterministic so the same verdict can be shown while
 * typing in the browser and enforced again on the server.
 */

export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 200

export type PasswordIssue =
  | "too_short"
  | "too_long"
  | "too_few_classes"
  | "contains_email"
  | "repeated_characters"
  | "sequential_characters"
  | "common_password"

/** Spanish messages, shown verbatim in the UI. */
export const PASSWORD_ISSUE_MESSAGES: Record<PasswordIssue, string> = {
  too_short: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  too_long: `La contraseña no puede superar ${PASSWORD_MAX_LENGTH} caracteres.`,
  too_few_classes:
    "Combina al menos tres de estos grupos: minúsculas, mayúsculas, números y símbolos.",
  contains_email: "La contraseña no puede contener tu correo.",
  repeated_characters: "Evita repetir el mismo carácter tres o más veces seguidas.",
  sequential_characters: "Evita secuencias como abcd o 1234.",
  common_password: "Esta contraseña es demasiado común.",
}

/** Short deny list of passwords seen constantly in credential stuffing. */
const COMMON_PASSWORDS: readonly string[] = [
  "123456789012",
  "contrasena123",
  "contraseña123",
  "administrador",
  "qwertyuiop12",
  "password1234",
  "passw0rd1234",
  "iloveyou1234",
  "bienvenido12",
  "oladc1234567",
  "cloud1234567",
  "letmein12345",
]

export interface PasswordVerdict {
  /** True when the password may be used. */
  ok: boolean
  /** 0 (unusable) to 4 (strong). Only a hint for the UI meter. */
  score: 0 | 1 | 2 | 3 | 4
  issues: readonly PasswordIssue[]
}

function characterClasses(password: string): number {
  let classes = 0
  if (/[a-záéíóúüñ]/.test(password)) classes += 1
  if (/[A-ZÁÉÍÓÚÜÑ]/.test(password)) classes += 1
  if (/[0-9]/.test(password)) classes += 1
  if (/[^A-Za-z0-9áéíóúüñÁÉÍÓÚÜÑ]/.test(password)) classes += 1
  return classes
}

function hasSequence(password: string, length = 4): boolean {
  const lower = password.toLowerCase()
  for (let index = 0; index + length <= lower.length; index += 1) {
    let ascending = true
    let descending = true
    for (let step = 1; step < length; step += 1) {
      const previous = lower.charCodeAt(index + step - 1)
      const current = lower.charCodeAt(index + step)
      if (current - previous !== 1) ascending = false
      if (current - previous !== -1) descending = false
    }
    if (ascending || descending) return true
  }
  return false
}

function emailFragments(email: string): readonly string[] {
  const local = email.split("@")[0] ?? ""
  const domain = (email.split("@")[1] ?? "").split(".")[0] ?? ""
  return [local, domain].filter((fragment) => fragment.length >= 4)
}

/**
 * Grades a password. `email` is optional and only used to reject passwords built
 * from the address itself.
 */
export function passwordStrength(password: string, email?: string): PasswordVerdict {
  const issues: PasswordIssue[] = []

  if (password.length < PASSWORD_MIN_LENGTH) issues.push("too_short")
  if (password.length > PASSWORD_MAX_LENGTH) issues.push("too_long")

  const classes = characterClasses(password)
  if (classes < 3) issues.push("too_few_classes")

  if (/(.)\1\1/.test(password)) issues.push("repeated_characters")
  if (hasSequence(password)) issues.push("sequential_characters")

  const lower = password.toLowerCase()
  if (COMMON_PASSWORDS.includes(lower)) issues.push("common_password")

  if (email) {
    const normalizedEmail = email.trim().toLowerCase()
    const hit = emailFragments(normalizedEmail).some((fragment) => lower.includes(fragment))
    if (hit || lower.includes(normalizedEmail)) issues.push("contains_email")
  }

  return { ok: issues.length === 0, score: scoreOf(password, classes, issues), issues }
}

function scoreOf(
  password: string,
  classes: number,
  issues: readonly PasswordIssue[],
): 0 | 1 | 2 | 3 | 4 {
  if (password.length === 0) return 0
  if (issues.length > 0) return password.length >= PASSWORD_MIN_LENGTH ? 1 : 0
  if (password.length >= 20 && classes === 4) return 4
  if (password.length >= 16 && classes >= 3) return 3
  return 2
}

/** The first problem to show, or `null` when the password is acceptable. */
export function firstPasswordIssueMessage(
  password: string,
  email?: string,
): string | null {
  const verdict = passwordStrength(password, email)
  if (verdict.ok) return null
  const first = verdict.issues[0] as PasswordIssue
  return PASSWORD_ISSUE_MESSAGES[first]
}
