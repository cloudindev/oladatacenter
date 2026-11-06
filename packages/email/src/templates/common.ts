/** Props and copy shared by every template. */

export interface BaseEmailProps {
  /** First name when we have it. The greeting degrades to "Hola," when we do not. */
  name?: string
  /** Footer link target. Injected by the caller; this package reads no environment. */
  customerAreaUrl?: string
}

/** "Hola Luis," / "Hola," */
export function greeting(name?: string): string {
  const trimmed = name?.trim()
  return trimmed ? `Hola ${trimmed},` : "Hola,"
}
