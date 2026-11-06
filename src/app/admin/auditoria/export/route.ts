import type { NextRequest } from "next/server"
import { csvStream } from "@/server/admin/csv"
import { auditFilterFrom, type RawSearchParams } from "@/server/admin/filters"
import { auditRowsForExport, requireAdminPage } from "@/server/admin/queries"

/**
 * CSV export of the audit search, with the same filters as the page.
 *
 * Guarded by `requireAdminPage()` (role admin + TOTP), streamed row by row, every field
 * escaped by `csv.ts` (quotes, commas, semicolons, newlines, spreadsheet formulas).
 */
export const dynamic = "force-dynamic"

const HEADER = [
  "fecha",
  "tipo_actor",
  "actor",
  "entidad",
  "id_entidad",
  "accion",
  "cambios",
  "ip",
  "correlacion",
] as const

export async function GET(request: NextRequest): Promise<Response> {
  await requireAdminPage()

  const params: RawSearchParams = {}
  for (const [key, value] of request.nextUrl.searchParams.entries()) params[key] = value

  let rows
  try {
    rows = await auditRowsForExport(auditFilterFrom(params, new Date()))
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return new Response(`No se ha podido leer la auditoría: ${detail}`, {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    })
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")
  const body = csvStream(
    HEADER,
    rows.map((row) => [
      row.createdAt,
      row.actorType,
      row.actorId,
      row.entity,
      row.entityId,
      row.action,
      row.diff,
      row.ip,
      row.correlationId,
    ]),
  )

  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="auditoria-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  })
}
