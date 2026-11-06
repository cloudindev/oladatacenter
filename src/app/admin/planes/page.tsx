import { formatCents } from "@ola/core"
import { ActionForm } from "@/components/admin/action-form"
import { PriceEditor, type TermCosts } from "@/components/admin/price-editor"
import {
  AdminHeader,
  AdminSection,
  LoadFailure,
  MarginCell,
  Mono,
  Muted,
  TableEmpty,
  TableWrap,
  Td,
  Th,
} from "@/components/admin/ui"
import { Input, Notice, StatusBadge } from "@/components/app/ui"
import {
  setAddonActive,
  setPlanActive,
  setPlanSort,
  updateAddonPricing,
  updateMarginFloor,
  updatePlanPricing,
} from "@/server/admin/actions"
import { formatMargin } from "@/server/admin/pricing"
import { pricingScreen, requireAdminPage } from "@/server/admin/queries"
import type { MarginView } from "@/server/admin/pricing"

/**
 * Pricing control.
 *
 * The column that matters is "margen real": the PVP over the plan cost PLUS the mandatory
 * addons OVH forces onto every cart. The bare-cost figure is shown beside it, struck
 * through and labelled, because it is the number that overstates the margin — 78 % on
 * VPS-1 where the real one is 65 % (docs/decisions.md, 2026-11-05).
 */

function TermCell({ view }: { view: MarginView }) {
  return (
    <div className="space-y-0.5">
      <p className="font-mono text-xs tabular-nums">{formatCents(view.linePrice)}</p>
      <p className="label-mono text-text-muted">
        {view.source === "manual" ? "manual" : "regla"}
      </p>
    </div>
  )
}

function costsFor(view: MarginView): TermCosts {
  return {
    bareCost: view.bareCost,
    mandatoryCost: view.trueCost - view.bareCost,
    mandatoryPrice: view.totalPrice - view.linePrice,
    manualPrice: view.source === "manual" ? view.linePrice : null,
  }
}

export default async function AdminPlanesPage() {
  await requireAdminPage()
  const screen = await pricingScreen()

  if (!screen.ok) {
    return (
      <>
        <AdminHeader title="Planes y precios" />
        <LoadFailure message={screen.message} detail={screen.detail} />
      </>
    )
  }

  const { plans, addons, floor, catalogError } = screen.data

  return (
    <>
      <AdminHeader
        title="Planes y precios"
        hint={
          <>
            El margen real se calcula sobre el coste con las opciones obligatorias incluidas
            (plan + backup automático). El margen sobre el coste pelado aparece tachado porque
            exagera el margen y no debe usarse para decidir un precio.
          </>
        }
      />

      {catalogError ? (
        <div className="mb-6">
          <Notice tone="warn" title="Catálogo de OVH no disponible">
            Los costes reales vienen de la columna <Mono>true_cost</Mono> de la base de datos en
            vez del catálogo. Detalle: {catalogError}
          </Notice>
        </div>
      ) : null}

      <AdminSection
        title="Margen mínimo"
        hint="Por debajo de este margen real, cualquier cambio de precio avisa. Se guarda en featureFlags."
      >
        <div className="rounded-xl border border-border-base bg-surface-light p-4">
          <p className="mb-3 text-sm text-text-base">
            Actualmente{" "}
            <strong className="font-medium">{formatMargin(floor.ratio)}</strong>
            {floor.configured ? "" : " (valor por defecto, nunca se ha guardado)"}
            {floor.enforced ? "" : " · aviso desactivado"}
          </p>
          <ActionForm action={updateMarginFloor} submitLabel="Guardar mínimo">
            <label className="block">
              <span className="label-mono mb-1.5 block text-text-muted">Margen mínimo (%)</span>
              <Input
                name="floorPercent"
                defaultValue={(floor.basisPoints / 100).toString()}
                inputMode="decimal"
                className="max-w-[8rem]"
              />
            </label>
            <label className="label-mono mb-3 flex items-center gap-2 text-text-muted">
              <input
                type="checkbox"
                name="enforced"
                defaultChecked={floor.enforced}
                className="h-4 w-4 accent-[#445e5f]"
              />
              Avisar al bajar del mínimo
            </label>
          </ActionForm>
        </div>
      </AdminSection>

      <AdminSection title="Planes" hint={`${plans.length} planes en la base de datos`}>
        <TableWrap>
          <thead>
            <tr>
              <Th>Plan</Th>
              <Th align="right">Coste OVH mes</Th>
              <Th align="right">Coste OVH 12m</Th>
              <Th align="right">Coste real mes</Th>
              <Th align="right">PVP mes</Th>
              <Th align="right">PVP 12m</Th>
              <Th align="right">Margen real mes</Th>
              <Th align="right">Sobre coste pelado</Th>
              <Th align="center">Activo</Th>
              <Th align="center">Orden</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {plans.length === 0 ? (
              <TableEmpty colSpan={11}>
                No hay planes en la base de datos. Ejecuta la sincronización del catálogo.
              </TableEmpty>
            ) : null}
            {plans.map(({ row, margin, baseline }) => (
              <tr key={row.id}>
                <Td>
                  <p className="font-medium">{row.name}</p>
                  <Mono className="text-text-muted">{row.ovhPlanCode}</Mono>
                  {baseline.error ? (
                    <p className="label-mono mt-1 text-[#8a2d26]">{baseline.error}</p>
                  ) : null}
                </Td>
                <Td align="right" mono>
                  {formatCents(margin.P1M.bareCost)}
                </Td>
                <Td align="right" mono>
                  {formatCents(margin.P12M.bareCost)}
                </Td>
                <Td align="right" mono className="font-medium">
                  {formatCents(margin.P1M.trueCost)}
                  <p className="label-mono text-text-muted">
                    +{formatCents(margin.P1M.trueCost - margin.P1M.bareCost)} obligatorias
                  </p>
                </Td>
                <Td align="right">
                  <TermCell view={margin.P1M} />
                </Td>
                <Td align="right">
                  <TermCell view={margin.P12M} />
                </Td>
                <Td align="right">
                  <MarginCell
                    margin={margin.P1M.trueMargin}
                    belowFloor={floor.enforced && margin.P1M.belowFloor}
                    format={formatMargin}
                  />
                  <p className="label-mono text-text-muted">
                    carrito {formatMargin(margin.P1M.totalMargin)}
                  </p>
                </Td>
                <Td align="right">
                  <span className="font-mono text-xs tabular-nums text-text-muted line-through">
                    {formatMargin(margin.P1M.bareMargin)}
                  </span>
                </Td>
                <Td align="center">
                  <ActionForm
                    action={setPlanActive}
                    fields={{ planId: row.id, active: row.active ? "" : "on" }}
                    submitLabel={row.active ? "Desactivar" : "Activar"}
                    variant="ghost"
                  >
                    <StatusBadge tone={row.active ? "ok" : "neutral"}>
                      {row.active ? "Sí" : "No"}
                    </StatusBadge>
                  </ActionForm>
                </Td>
                <Td align="center">
                  <ActionForm action={setPlanSort} fields={{ planId: row.id }} submitLabel="Guardar" variant="ghost">
                    <Input
                      name="sort"
                      type="number"
                      min={0}
                      max={999}
                      defaultValue={row.sort}
                      className="w-20"
                      aria-label={`Orden de ${row.name}`}
                    />
                  </ActionForm>
                </Td>
                <Td>
                  <PriceEditor
                    action={updatePlanPricing}
                    idField="planId"
                    id={row.id}
                    name={row.name}
                    monthly={costsFor(margin.P1M)}
                    annual={costsFor(margin.P12M)}
                    marginBasisPoints={row.marginBasisPoints}
                    floor={floor.ratio}
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </AdminSection>

      <AdminSection
        title="Opciones"
        hint="Las obligatorias no se pueden desactivar: OVH las exige en todos los carritos."
      >
        <TableWrap>
          <thead>
            <tr>
              <Th>Opción</Th>
              <Th>Familia</Th>
              <Th align="right">Coste mes</Th>
              <Th align="right">PVP mes</Th>
              <Th align="right">PVP 12m</Th>
              <Th align="right">Margen mes</Th>
              <Th align="center">Obligatoria</Th>
              <Th align="center">Activa</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {addons.length === 0 ? (
              <TableEmpty colSpan={9}>
                No hay opciones en la base de datos. Ejecuta la sincronización del catálogo.
              </TableEmpty>
            ) : null}
            {addons.map(({ row, margin }) => (
              <tr key={row.id}>
                <Td>
                  <p className="font-medium">{row.name}</p>
                  <Mono className="text-text-muted">{row.ovhPlanCode}</Mono>
                </Td>
                <Td>
                  <Mono>{row.family}</Mono>
                </Td>
                <Td align="right" mono>
                  {formatCents(margin.P1M.bareCost)}
                </Td>
                <Td align="right">
                  <TermCell view={margin.P1M} />
                </Td>
                <Td align="right">
                  <TermCell view={margin.P12M} />
                </Td>
                <Td align="right">
                  <MarginCell
                    margin={margin.P1M.trueMargin}
                    belowFloor={floor.enforced && margin.P1M.belowFloor}
                    format={formatMargin}
                  />
                </Td>
                <Td align="center">
                  {row.mandatory ? (
                    <StatusBadge tone="warn">Sí</StatusBadge>
                  ) : (
                    <Muted>No</Muted>
                  )}
                </Td>
                <Td align="center">
                  {row.mandatory ? (
                    <StatusBadge tone="ok">Siempre</StatusBadge>
                  ) : (
                    <ActionForm
                      action={setAddonActive}
                      fields={{ addonId: row.id, active: row.active ? "" : "on" }}
                      submitLabel={row.active ? "Desactivar" : "Activar"}
                      variant="ghost"
                    >
                      <StatusBadge tone={row.active ? "ok" : "neutral"}>
                        {row.active ? "Sí" : "No"}
                      </StatusBadge>
                    </ActionForm>
                  )}
                </Td>
                <Td>
                  <PriceEditor
                    action={updateAddonPricing}
                    idField="addonId"
                    id={row.id}
                    name={row.name}
                    monthly={costsFor(margin.P1M)}
                    annual={costsFor(margin.P12M)}
                    marginBasisPoints={row.marginBasisPoints}
                    floor={floor.ratio}
                    mandatoryNote={
                      row.mandatory
                        ? "Es una opción obligatoria: cambiar su precio mueve el precio final de todos los planes."
                        : undefined
                    }
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </AdminSection>
    </>
  )
}
