/**
 * What every admin Server Action returns.
 *
 * `detail` carries the raw provider or database error. The admin panel is the one place
 * in the product where that is allowed and wanted: an operator debugging a stuck order
 * needs OVH's own words, not a reassuring sentence.
 */
export type AdminActionResult =
  | { ok: true; message: string; detail?: string }
  | { ok: false; message: string; detail?: string }

export function ok(message: string, detail?: string): AdminActionResult {
  return detail === undefined ? { ok: true, message } : { ok: true, message, detail }
}

export function fail(message: string, detail?: string): AdminActionResult {
  return detail === undefined ? { ok: false, message } : { ok: false, message, detail }
}

/** The idle state a `useActionState` form starts in. */
export const IDLE: AdminActionResult | null = null
