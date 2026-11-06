import { FilterBar, FilterDate, FilterText } from "@/components/admin/filters"
import {
  AdminHeader,
  LoadFailure,
  Maybe,
  Mono,
  TableEmpty,
  TableWrap,
  Td,
  Th,
  Timestamp,
} from "@/components/admin/ui"
import { ButtonLink, StatusBadge } from "@/components/app/ui"
import { auditFilterFrom, hasAnyFilter, one, type RawSearchParams } from "@/server/admin/filters"
import { auditScreen, requireAdminPage } from "@/server/admin/queries"

const FILTER_KEYS = ["entidad", "id", "actor", "desde", "hasta"] as const

export default async function AdminAuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  await requireAdminPage()
  const params = await searchParams
  const screen = await auditScreen(auditFilterFrom(params, new Date()))

  const exportQuery = new URLSearchParams()
  for (const key of FILTER_KEYS) {
    const value = one(params, key)
    if (value) exportQuery.set(key, value)
  }
  const exportHref = `/admin/auditoria/export${exportQuery.size > 0 ? `?${exportQuery.toString()}` : ""}`

  return (
    <>
      <AdminHeader
        title="Auditoría"
        hint="Cada escritura con efecto deja una fila. Nunca se borra ninguna."
        actions={
          <ButtonLink href={exportHref} variant="secondary">
            Exportar CSV
          </ButtonLink>
        }
      />

      <FilterBar action="/admin/auditoria" reset={hasAnyFilter(params, FILTER_KEYS)}>
        <FilterText name="entidad" label="Entidad" value={one(params, "entidad")} placeholder="order, service, plan…" />
        <FilterText name="id" label="Id de entidad" value={one(params, "id")} />
        <FilterText name="actor" label="Id del actor" value={one(params, "actor")} />
        <FilterDate name="desde" label="Desde" value={one(params, "desde")} />
        <FilterDate name="hasta" label="Hasta" value={one(params, "hasta")} />
      </FilterBar>

      {!screen.ok ? (
        <LoadFailure message={screen.message} detail={screen.detail} />
      ) : (
        <>
          <p className="mb-3 text-xs text-text-muted">
            {screen.data.length} entradas · límite de 200 en pantalla, 1000 en la exportación
          </p>
          <TableWrap>
            <thead>
              <tr>
                <Th>Fecha</Th>
                <Th>Actor</Th>
                <Th>Entidad</Th>
                <Th>Acción</Th>
                <Th>Cambios</Th>
                <Th>IP</Th>
                <Th>Correlación</Th>
              </tr>
            </thead>
            <tbody>
              {screen.data.length === 0 ? (
                <TableEmpty colSpan={7}>Ninguna entrada coincide con el filtro.</TableEmpty>
              ) : null}
              {screen.data.map((row) => (
                <tr key={row.id}>
                  <Td><Timestamp value={row.createdAt} /></Td>
                  <Td>
                    <StatusBadge tone={row.actorType === "admin" ? "warn" : "neutral"}>{row.actorType}</StatusBadge>
                    <p><Mono className="text-text-muted"><Maybe value={row.actorId} /></Mono></p>
                  </Td>
                  <Td>
                    <Mono>{row.entity}</Mono>
                    <p><Mono className="text-text-muted"><Maybe value={row.entityId} /></Mono></p>
                  </Td>
                  <Td mono>{row.action}</Td>
                  <Td>
                    {row.diff ? (
                      <pre className="max-w-md overflow-x-auto font-mono text-xs whitespace-pre-wrap">
                        {JSON.stringify(row.diff, null, 1)}
                      </pre>
                    ) : (
                      <Maybe value={null} />
                    )}
                  </Td>
                  <Td mono><Maybe value={row.ip} /></Td>
                  <Td mono><Maybe value={row.correlationId} /></Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </>
      )}
    </>
  )
}
