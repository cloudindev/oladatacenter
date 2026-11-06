import Link from "next/link"
import { FilterBar, FilterSelect, FilterText } from "@/components/admin/filters"
import {
  AdminHeader,
  CUSTOMER_STATUS_UI,
  CustomerStatus,
  LoadFailure,
  Maybe,
  Mono,
  TableEmpty,
  TableWrap,
  Td,
  Th,
  Timestamp,
} from "@/components/admin/ui"
import { StatusBadge } from "@/components/app/ui"
import {
  CUSTOMER_STATUSES,
  customerFilterFrom,
  hasAnyFilter,
  one,
  type RawSearchParams,
} from "@/server/admin/filters"
import { customersScreen, requireAdminPage } from "@/server/admin/queries"

export default async function AdminClientesPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  await requireAdminPage()
  const params = await searchParams
  const screen = await customersScreen(customerFilterFrom(params))

  if (!screen.ok) {
    return (
      <>
        <AdminHeader title="Clientes" />
        <LoadFailure message={screen.message} detail={screen.detail} />
      </>
    )
  }

  const rows = screen.data

  return (
    <>
      <AdminHeader title="Clientes" hint="Estado de verificación, primer pago e identificadores externos." />

      <FilterBar action="/admin/clientes" reset={hasAnyFilter(params, ["estado", "q"])}>
        <FilterSelect
          name="estado"
          label="Estado"
          value={one(params, "estado")}
          options={[
            { value: "", label: "Todos" },
            ...CUSTOMER_STATUSES.map((status) => ({
              value: status,
              label: CUSTOMER_STATUS_UI[status]?.label ?? status,
            })),
          ]}
        />
        <FilterText name="q" label="Buscar" value={one(params, "q")} placeholder="correo, razón social, NIF" />
      </FilterBar>

      <p className="mb-3 text-xs text-text-muted">{rows.length} clientes · límite de 100</p>

      <TableWrap>
        <thead>
          <tr>
            <Th>Cliente</Th>
            <Th>Razón social</Th>
            <Th>País</Th>
            <Th align="center">Estado</Th>
            <Th align="center">Verificación</Th>
            <Th>Primer pago</Th>
            <Th>WHMCS</Th>
            <Th>Stripe</Th>
            <Th>Alta</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? <TableEmpty colSpan={9}>Ningún cliente coincide con el filtro.</TableEmpty> : null}
          {rows.map((row) => {
            const checks = [row.emailVerifiedAt, row.phoneVerifiedAt].filter((value) => value !== null).length
            return (
              <tr key={row.id}>
                <Td>
                  <Link
                    href={`/admin/clientes/${row.id}`}
                    className="text-accent-ink underline decoration-dotted underline-offset-4"
                  >
                    {row.email}
                  </Link>
                  <p><Mono className="text-text-muted">{row.id}</Mono></p>
                </Td>
                <Td><Maybe value={row.legalName} /></Td>
                <Td mono><Maybe value={row.country} /></Td>
                <Td align="center"><CustomerStatus status={row.status} /></Td>
                <Td align="center">
                  <StatusBadge tone={checks === 2 ? "ok" : "warn"}>{checks}/2</StatusBadge>
                </Td>
                <Td><Timestamp value={row.firstPaidAt} time={false} /></Td>
                <Td mono><Maybe value={row.whmcsClientId} /></Td>
                <Td mono><Maybe value={row.stripeCustomerId} /></Td>
                <Td><Timestamp value={row.createdAt} time={false} /></Td>
              </tr>
            )
          })}
        </tbody>
      </TableWrap>
    </>
  )
}
