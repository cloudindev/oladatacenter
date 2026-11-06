import { MVP_PLAN_CODES, formatCents } from "@ola/core"
import { ActionForm } from "@/components/admin/action-form"
import {
  AdminHeader,
  AdminSection,
  LoadFailure,
  Mono,
  Muted,
  TableEmpty,
  TableWrap,
  Td,
  Th,
  Timestamp,
} from "@/components/admin/ui"
import { EmptyState, Notice, StatusBadge, type StatusTone } from "@/components/app/ui"
import { syncCatalogNow } from "@/server/admin/actions"
import { catalogScreen, requireAdminPage } from "@/server/admin/queries"
import type { CostChangeKind } from "@/server/admin/catalog-diff"

/**
 * Catalog sync and the diff between the two newest snapshots.
 *
 * A cost rise is the headline: every PVP driven by the margin rule just lost margin, and
 * nobody will notice until someone looks here. An MVP plan code disappearing is worse
 * still — we would be selling something OVH no longer offers — so it gets a banner.
 */

const CHANGE_UI: Record<CostChangeKind, { label: string; tone: StatusTone }> = {
  up: { label: "Sube", tone: "danger" },
  down: { label: "Baja", tone: "ok" },
  added: { label: "Nuevo", tone: "neutral" },
  removed: { label: "Desaparece", tone: "warn" },
}

export default async function AdminCatalogoPage() {
  await requireAdminPage()
  const screen = await catalogScreen()

  if (!screen.ok) {
    return (
      <>
        <AdminHeader title="Catálogo de OVH" />
        <LoadFailure message={screen.message} detail={screen.detail} />
      </>
    )
  }

  const { newest, previous, changes, missingMvpPlans, hasCostRises } = screen.data

  return (
    <>
      <AdminHeader
        title="Catálogo de OVH"
        hint="El catálogo nunca se pide desde una petición: un trabajo escribe un snapshot y todo lo demás lee de ahí."
        actions={
          <ActionForm
            action={syncCatalogNow}
            submitLabel="Sincronizar ahora"
            variant="primary"
          />
        }
      />

      {missingMvpPlans.length > 0 ? (
        <div className="mb-6">
          <Notice tone="danger" title="Un plan del MVP ha desaparecido del catálogo">
            <p>
              Estos códigos ya no vienen en el último snapshot:{" "}
              <Mono>{missingMvpPlans.join(", ")}</Mono>. Cualquier pedido nuevo de esos planes
              fallará en el checkout de OVH. Desactiva el plan en «Planes» antes de que entre un
              pedido.
            </p>
          </Notice>
        </div>
      ) : null}

      {hasCostRises ? (
        <div className="mb-6">
          <Notice tone="warn" title="Hay costes que han subido">
            Los PVP que salen de la regla del margen no se recalculan solos. Revisa «Planes» y
            comprueba que el margen real sigue por encima del mínimo.
          </Notice>
        </div>
      ) : null}

      <AdminSection title="Última sincronización">
        <dl className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border-base bg-surface-light p-4">
            <dt className="label-mono text-text-muted">Snapshot más reciente</dt>
            <dd className="mt-1 text-sm">
              {newest ? <Timestamp value={newest.fetchedAt} /> : <Muted>nunca</Muted>}
            </dd>
          </div>
          <div className="rounded-xl border border-border-base bg-surface-light p-4">
            <dt className="label-mono text-text-muted">Snapshot anterior</dt>
            <dd className="mt-1 text-sm">
              {previous ? <Timestamp value={previous.fetchedAt} /> : <Muted>no hay</Muted>}
            </dd>
          </div>
          <div className="rounded-xl border border-border-base bg-surface-light p-4">
            <dt className="label-mono text-text-muted">Planes del MVP presentes</dt>
            <dd className="mt-1 font-mono text-sm tabular-nums">
              {newest
                ? `${MVP_PLAN_CODES.filter((code) => newest.costs.has(code)).length} / ${MVP_PLAN_CODES.length}`
                : "—"}
            </dd>
          </div>
        </dl>
      </AdminSection>

      <AdminSection
        title="Diferencias con el snapshot anterior"
        hint="Primero las subidas de coste, después las desapariciones."
      >
        {!newest ? (
          <EmptyState>
            Nunca se ha guardado un snapshot del catálogo. Lanza una sincronización.
          </EmptyState>
        ) : !previous ? (
          <EmptyState>
            Sólo hay un snapshot, así que todavía no hay nada con lo que comparar.
          </EmptyState>
        ) : changes.length === 0 ? (
          <EmptyState>Ningún coste ha cambiado entre los dos últimos snapshots.</EmptyState>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Código OVH</Th>
                <Th>Nombre</Th>
                <Th>Tipo</Th>
                <Th align="center">Cambio</Th>
                <Th align="right">Antes mes</Th>
                <Th align="right">Ahora mes</Th>
                <Th align="right">Diferencia</Th>
                <Th align="right">Antes 12m</Th>
                <Th align="right">Ahora 12m</Th>
              </tr>
            </thead>
            <tbody>
              {changes.length === 0 ? <TableEmpty colSpan={9}>Sin cambios.</TableEmpty> : null}
              {changes.map((change) => {
                const ui = CHANGE_UI[change.change]
                return (
                  <tr key={change.code}>
                    <Td mono>{change.code}</Td>
                    <Td>{change.name}</Td>
                    <Td>
                      <Mono>{change.kind === "plan" ? "plan" : "opción"}</Mono>
                    </Td>
                    <Td align="center">
                      <StatusBadge tone={ui.tone}>{ui.label}</StatusBadge>
                    </Td>
                    <Td align="right" mono>
                      {change.before ? formatCents(change.before.P1M) : <Muted>—</Muted>}
                    </Td>
                    <Td align="right" mono>
                      {change.after ? formatCents(change.after.P1M) : <Muted>—</Muted>}
                    </Td>
                    <Td
                      align="right"
                      mono
                      className={change.deltaMonth > 0 ? "font-medium text-[#8a2d26]" : undefined}
                    >
                      {change.deltaMonth > 0 ? "+" : ""}
                      {formatCents(change.deltaMonth)}
                    </Td>
                    <Td align="right" mono>
                      {change.before ? formatCents(change.before.P12M) : <Muted>—</Muted>}
                    </Td>
                    <Td align="right" mono>
                      {change.after ? formatCents(change.after.P12M) : <Muted>—</Muted>}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </TableWrap>
        )}
      </AdminSection>
    </>
  )
}
