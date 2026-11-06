import Link from "next/link"
import { SERVICE_STATUSES, datacenterLabel, formatCents } from "@ola/core"
import { FilterBar, FilterSelect, FilterText } from "@/components/admin/filters"
import {
  AdminHeader,
  DunningBadge,
  LoadFailure,
  Maybe,
  Mono,
  ServiceStatus,
  TableEmpty,
  TableWrap,
  Td,
  Th,
  Timestamp,
} from "@/components/admin/ui"
import { SERVICE_STATUS_UI } from "@/components/app/ui"
import { hasAnyFilter, one, serviceFilterFrom, type RawSearchParams } from "@/server/admin/filters"
import { requireAdminPage, servicesScreen } from "@/server/admin/queries"

export default async function AdminServiciosPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  await requireAdminPage()
  const params = await searchParams
  const screen = await servicesScreen(serviceFilterFrom(params))

  if (!screen.ok) {
    return (
      <>
        <AdminHeader title="Servicios" />
        <LoadFailure message={screen.message} detail={screen.detail} />
      </>
    )
  }

  const { rows, datacenters, plans } = screen.data

  return (
    <>
      <AdminHeader
        title="Servicios"
        hint="Incluye el nombre de servicio en OVH y la fase de cobro de cada servidor."
      />

      <FilterBar action="/admin/servicios" reset={hasAnyFilter(params, ["estado", "dc", "plan", "q"])}>
        <FilterSelect
          name="estado"
          label="Estado"
          value={one(params, "estado")}
          options={[
            { value: "", label: "Todos" },
            ...SERVICE_STATUSES.map((status) => ({
              value: status,
              label: SERVICE_STATUS_UI[status]?.label ?? status,
            })),
          ]}
        />
        <FilterSelect
          name="dc"
          label="Datacenter"
          value={one(params, "dc")}
          options={[
            { value: "", label: "Todos" },
            ...datacenters.map((code) => ({
              value: code,
              label: `${code} · ${datacenterLabel(code) ?? "fuera de venta"}`,
            })),
          ]}
        />
        <FilterSelect
          name="plan"
          label="Plan"
          value={one(params, "plan")}
          options={[
            { value: "", label: "Todos" },
            ...plans.map((plan) => ({ value: plan.id, label: plan.name })),
          ]}
        />
        <FilterText
          name="q"
          label="Buscar"
          value={one(params, "q")}
          placeholder="correo, IP, vps…ovh.net"
        />
      </FilterBar>

      <p className="mb-3 text-xs text-text-muted">{rows.length} servicios · límite de 100</p>

      <TableWrap>
        <thead>
          <tr>
            <Th>Servicio</Th>
            <Th>Cliente</Th>
            <Th>Plan</Th>
            <Th>DC</Th>
            <Th>IPv4</Th>
            <Th align="center">Estado</Th>
            <Th align="center">Cobro</Th>
            <Th align="right">Cuota</Th>
            <Th>Renueva</Th>
            <Th>Sincronizado</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <TableEmpty colSpan={10}>Ningún servicio coincide con el filtro.</TableEmpty>
          ) : null}
          {rows.map((row) => (
            <tr key={row.id}>
              <Td>
                <Link
                  href={`/admin/servicios/${row.id}`}
                  className="text-accent-ink underline decoration-dotted underline-offset-4"
                >
                  {row.displayName ?? row.id}
                </Link>
                <p>
                  <Mono className="text-text-muted">{row.ovhServiceName ?? "sin nombre OVH"}</Mono>
                </p>
              </Td>
              <Td>
                <Link href={`/admin/clientes/${row.customerId}`} className="hover:underline">
                  {row.customerEmail}
                </Link>
              </Td>
              <Td>
                {row.planName}
                <p>
                  <Mono className="text-text-muted">{row.ovhPlanCode}</Mono>
                </p>
              </Td>
              <Td mono>{row.datacenter}</Td>
              <Td mono>
                <Maybe value={row.ipv4} />
              </Td>
              <Td align="center">
                <ServiceStatus status={row.status} />
              </Td>
              <Td align="center">
                <DunningBadge stage={row.dunningStage} />
              </Td>
              <Td align="right" mono>
                {formatCents(row.monthlyPrice)}
              </Td>
              <Td>
                <Timestamp value={row.nextDueAt} time={false} />
              </Td>
              <Td>
                <Timestamp value={row.lastSyncedAt} />
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  )
}
