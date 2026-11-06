import "server-only"

/**
 * FormData readers shared by the auth, onboarding and account actions.
 *
 * `FormData.get` returns `string | File | null`, so every field has to be narrowed
 * before it is used. Keeping that in one place means no action forgets to trim.
 */

/** Trimmed text field, or an empty string when absent or a file. */
export function fieldText(form: FormData, name: string): string {
  const value = form.get(name)
  return typeof value === "string" ? value.trim() : ""
}

/** Untrimmed field. Passwords are never trimmed: spaces are part of the secret. */
export function fieldRaw(form: FormData, name: string): string {
  const value = form.get(name)
  return typeof value === "string" ? value : ""
}

/**
 * Reads a one-time code from either shape `OtpInput` submits: the joined hidden field,
 * or the six per-digit fields that arrive when JavaScript has not loaded.
 */
export function joinCode(form: FormData, name = "codigo", length = 6): string {
  const joined = fieldText(form, name).replace(/\s/g, "")
  if (joined.length > 0) return joined
  let digits = ""
  for (let index = 0; index < length; index += 1) {
    digits += fieldText(form, `${name}_${index}`)
  }
  return digits.replace(/\s/g, "")
}
