/**
 * Formatting helpers shared by the React templates and their plain-text twins.
 *
 * Every amount goes through `formatCents` from `@ola/core` so an email can never disagree
 * with the invoice. Dates are rendered in Spanish; an invalid date throws instead of
 * leaking "Invalid Date" into a customer's inbox.
 */
import { formatCents } from "@ola/core"

import { COMPANY_CITY, COMPANY_NAME, CUSTOMER_AREA_URL, SIGNATURE } from "./theme"

/** Callers hold dates as `Date` in memory and as ISO strings when they come from the DB. */
export type DateInput = Date | string

export class EmailFormatError extends Error {}

export function toDate(value: DateInput): Date {
  const date = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(date.getTime())) {
    throw new EmailFormatError(`not a valid date: ${String(value)}`)
  }
  return date
}

/** "14 de marzo de 2026" */
export function formatDate(value: DateInput): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Madrid",
  }).format(toDate(value))
}

/** "14 de marzo de 2026, 09:30" */
export function formatDateTime(value: DateInput): string {
  const date = toDate(value)
  const time = new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  }).format(date)
  return `${formatDate(date)}, ${time}`
}

/** "12,99 €" — always via `@ola/core`, never hand-rolled. */
export function formatMoney(cents: number): string {
  return formatCents(cents)
}

/** "1 día" / "7 días" */
export function formatDays(days: number): string {
  return days === 1 ? "1 día" : `${days} días`
}

/** "1 minuto" / "15 minutos" */
export function formatMinutes(minutes: number): string {
  return minutes === 1 ? "1 minuto" : `${minutes} minutos`
}

/** Groups a 6-digit code as "123 456" for the plain-text version only. */
export function spaceCode(code: string): string {
  return code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code
}

type Line = string | null | undefined | false

/**
 * Assembles a plain-text body: drops empty lines, trims trailing whitespace and appends the
 * same signature and legal footer the HTML card shows.
 */
export function plainText(lines: readonly Line[], opts: { footer?: boolean } = {}): string {
  const { footer = true } = opts
  const body = lines.filter((line): line is string => typeof line === "string").join("\n")
  if (!footer) return `${body.trimEnd()}\n`
  return [
    body.trimEnd(),
    "",
    "--",
    SIGNATURE,
    `${COMPANY_NAME} · ${COMPANY_CITY}`,
    `Área de cliente: ${CUSTOMER_AREA_URL}`,
    "Mensaje transaccional sobre tu cuenta y tus servicios, no es publicidad.",
    "",
  ].join("\n")
}

/** "Etiqueta: valor" rows for the plain-text version of a `DataTable`. */
export function plainRows(rows: readonly (readonly [string, string | null | undefined])[]): string[] {
  return rows
    .filter((row): row is readonly [string, string] => typeof row[1] === "string" && row[1] !== "")
    .map(([label, value]) => `${label}: ${value}`)
}
