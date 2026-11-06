import { cn } from "@/lib/utils"

/**
 * Class strings for the bare editorial form style used across the `(auth)` screens:
 * no cards, no shadows, fields that are only a bottom rule, monospace uppercase
 * labels. Kept in a plain module so Server and Client Components share one source.
 *
 * The customer area (`/app`, `/onboarding`) keeps the boxed kit in
 * `src/components/app/ui.tsx`; these two styles are deliberate, not a drift.
 */

/** Field that is just a bottom rule. `rounded-none` is for iOS Safari. */
export const bareInputClass = cn(
  "w-full bg-transparent border-0 border-b border-bg-dark/25 rounded-none",
  "pb-3 pt-1 text-[19px] text-text-base placeholder:text-text-base/25",
  "focus:outline-none focus:border-bg-dark transition-colors",
  "disabled:opacity-50",
)

/** Same rule, for a multi-line field. */
export const bareTextareaClass = cn(bareInputClass, "text-base leading-relaxed resize-y")

/** Monospace uppercase field label. */
export const bareLabelClass =
  "block font-mono text-[11px] uppercase tracking-[0.06em] text-text-base/55"

/** Small monospace label used for eyebrows and status lines. */
export const monoLineClass =
  "inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.06em]"

/** Two-digit step number for a field label: `01 / CORREO ELECTRÓNICO`. */
export function fieldNumber(index: number): string {
  return String(index).padStart(2, "0")
}
