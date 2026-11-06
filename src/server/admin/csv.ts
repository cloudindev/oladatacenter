/**
 * RFC 4180 CSV, written by hand because the audit export has to be exactly right.
 *
 * A field is quoted when it contains a quote, a comma, a semicolon, a CR or an LF, and an
 * embedded quote is doubled. Rows end with CRLF, which is what the RFC says and what
 * Excel expects. A field starting with `=`, `+`, `-` or `@` is prefixed with a single
 * quote so a spreadsheet does not evaluate it as a formula: audit diffs contain
 * attacker-influenced text and this export is opened in Excel.
 */

const NEEDS_QUOTING = /["\n\r,;]/
const FORMULA_START = /^[=+\-@\t\r]/

export function escapeCsvField(value: unknown): string {
  const raw = stringify(value)
  const guarded = FORMULA_START.test(raw) ? `'${raw}` : raw
  if (!NEEDS_QUOTING.test(guarded)) return guarded
  return `"${guarded.replace(/"/g, '""')}"`
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return JSON.stringify(value)
}

export function csvRow(fields: readonly unknown[]): string {
  return `${fields.map(escapeCsvField).join(",")}\r\n`
}

/** The whole document, header first. Used by the tests; the route streams row by row. */
export function csvDocument(
  header: readonly string[],
  rows: readonly (readonly unknown[])[],
): string {
  return csvRow(header) + rows.map(csvRow).join("")
}

/**
 * A `ReadableStream` of the document, so an export of 100 000 audit rows never sits in
 * memory. The header goes out first, then one chunk per row.
 */
export function csvStream(
  header: readonly string[],
  rows: Iterable<readonly unknown[]>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const iterator = rows[Symbol.iterator]()
  let headerSent = false

  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (!headerSent) {
        headerSent = true
        // UTF-8 BOM: without it Excel on Windows mangles the accented Spanish labels.
        controller.enqueue(encoder.encode(`﻿${csvRow(header)}`))
        return
      }
      const next = iterator.next()
      if (next.done) {
        controller.close()
        return
      }
      controller.enqueue(encoder.encode(csvRow(next.value)))
    },
  })
}
