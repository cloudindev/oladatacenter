/**
 * Email design tokens.
 *
 * Mirrors `src/app/globals.css` but as literal hex values: an email client has no CSS
 * variables, no external stylesheet and no web fonts, so everything is inlined here and
 * applied through `style` props. Light background, dark text, hairline borders.
 */

export const colors = {
  /** off-white canvas */
  canvas: "#f7f7f5",
  /** white card surface */
  card: "#ffffff",
  /** dark charcoal — body text and the primary button */
  ink: "#222f30",
  /** muted grey text */
  muted: "#6b7475",
  /** hairline border */
  border: "#e4e3e3",
  /** deep sea green — accent with AA contrast on light */
  accentInk: "#445e5f",
  /** soft mint — accent on dark */
  mint: "#CEF79E",
  /** fresh lime */
  lime: "#a7e26e",
  /** beige surface for inset blocks */
  beige: "#e7e8e1",
  /** text on dark surfaces */
  onInk: "#f7f7f5",
} as const

/** System font stack only: a web font would not load in Outlook and may not load in Gmail. */
export const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"

export const MONO_STACK =
  "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', 'Courier New', monospace"

/** Hard cap for the card. Anything wider breaks the Outlook desktop reading pane. */
export const MAX_WIDTH = 560

/** Public customer area. Not a secret and not read from the environment. */
export const CUSTOMER_AREA_URL = "https://oladc.com/app"

export const COMPANY_NAME = "Cloudin Hosting S.L."
export const COMPANY_CITY = "Oviedo, España"
export const SIGNATURE = "Equipo OLA"
