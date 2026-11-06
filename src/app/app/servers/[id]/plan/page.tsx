import { notFound } from "next/navigation"
import { formatCents, prorateAddon, TERM_MONTHS } from "@ola/core"
import { DataRow, Notice, Panel, SectionTitle } from "@/components/app/ui"
import { AutoRenewToggle } from "@/components/servers/AutoRenewToggle"
import { StatusGateNotice } from "@/components/servers/StatusGateNotice"
import { UpgradeOptions } from "@/components/servers/UpgradeOptions"
import { formatDate, specsLine, TERM_LABEL } from "@/components/servers/labels"
import { load } from "@/server/services/load"
import { actionGate, serviceForPage } from "@/server/services/page-data"
import { fetchAvailableUpgradePlanCodes, fetchRenewal } from "@/server/services/provider"
import {
  listContractableAddons,
  listPlansAbove,
  listServiceAddons,
} from "@/server/services/repository"

/**
 * Plan, add-ons and renewal.
 *
 * Upgrades are the intersection of what the provider will actually let this machine grow
 * into and what we sell. The match is made on the provider's plan code server-side; what
 * reaches the browser is our plan name and our price.
 */
export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const page = await serviceForPage(id)
  if (page.state === "missing") notFound()
  if (page.state === "unavailable") return null

  const { service } = page
  const can = actionGate(service)

  const [upgradeCodes, candidates, renewal, currentAddons, contractable] = await Promise.all([
    load("fetchAvailableUpgrades", () =>
      fetchAvailableUpgradePlanCodes(service.ovhServiceName),
    ),
    load("listPlansAbove", () => listPlansAbove(service.monthlyPrice)),
    load("fetchRenewal", () => fetchRenewal(service.ovhServiceName)),
    load("listServiceAddons", () => listServiceAddons(service.id)),
    load("listContractableAddons", () =>
      listContractableAddons(service.ovhPlanCode, service.id),
    ),
  ])

  const upgradeOptions =
    upgradeCodes.ok && candidates.ok
      ? candidates.data
          .filter((candidate) => upgradeCodes.data.includes(candidate.ovhPlanCode))
          .map((candidate) => ({
            planId: candidate.id,
            planName: candidate.name,
            specs: candidate.specs,
            monthlyPrice: candidate.monthlyPrice,
          }))
      : []

  const cycleEnd = service.nextDueAt
  const cycleStart = cycleEnd ? startOfCycle(cycleEnd, TERM_MONTHS[service.term]) : null

  return (
    <div className="space-y-8">
      <StatusGateNotice status={service.status} />

      <Panel>
        <SectionTitle>Plan actual</SectionTitle>
        <dl>
          <DataRow label="Plan">{service.planName}</DataRow>
          <DataRow label="Recursos">{specsLine(service.specs)}</DataRow>
          <DataRow label="Red">{service.specs.bandwidthMbps} Mbps</DataRow>
          <DataRow label="Compromiso">{TERM_LABEL[service.term] ?? service.term}</DataRow>
          <DataRow label="Precio">{formatCents(service.monthlyPrice)} al mes</DataRow>
          <DataRow label="Próxima renovación">{formatDate(service.nextDueAt)}</DataRow>
        </dl>
      </Panel>

      <Panel>
        <SectionTitle>Ampliar el servidor</SectionTitle>
        <p className="mb-6 text-sm text-text-muted leading-relaxed max-w-2xl">
          Al ampliar pagas solo la diferencia de lo que queda del periodo en curso. El
          cambio se aplica sobre la misma máquina, con la misma IP y los mismos datos:
          solo se reinicia una vez.
        </p>

        {!upgradeCodes.ok ? (
          <Notice tone="warn" title="No hemos podido consultar las ampliaciones">
            {upgradeCodes.message}
          </Notice>
        ) : !candidates.ok ? (
          <Notice tone="warn" title="No hemos podido consultar las ampliaciones">
            {candidates.message}
          </Notice>
        ) : (
          <UpgradeOptions
            serviceId={service.id}
            options={upgradeOptions}
            allowed={can("upgrade")}
          />
        )}

        <div className="mt-6">
          <Notice tone="neutral" title="No se puede reducir el plan">
            Un servidor se puede hacer más grande pero no más pequeño: el proveedor no
            admite la operación inversa. Si necesitas bajar, se crea un servidor nuevo del
            tamaño que quieras y se migran los datos. Te ayudamos con ello.
          </Notice>
        </div>
      </Panel>

      <Panel>
        <SectionTitle>Servicios contratados</SectionTitle>
        {!currentAddons.ok ? (
          <Notice tone="warn">{currentAddons.message}</Notice>
        ) : currentAddons.data.filter((addon) => addon.status !== "removed").length === 0 ? (
          <p className="text-sm text-text-muted">
            Este servidor no tiene servicios adicionales contratados.
          </p>
        ) : (
          <dl>
            {currentAddons.data
              .filter((addon) => addon.status !== "removed")
              .map((addon) => (
                <DataRow key={addon.id} label={addon.name}>
                  {addon.monthlyPrice > 0
                    ? `${formatCents(addon.monthlyPrice)} al mes`
                    : "Incluido"}
                  {addon.status === "pending" ? " · activándose" : ""}
                </DataRow>
              ))}
          </dl>
        )}
      </Panel>

      <Panel>
        <SectionTitle>Añadir servicios</SectionTitle>
        {!contractable.ok ? (
          <Notice tone="warn">{contractable.message}</Notice>
        ) : contractable.data.length === 0 ? (
          <p className="text-sm text-text-muted">
            No hay servicios adicionales disponibles para este plan.
          </p>
        ) : (
          <>
            <p className="mb-5 text-sm text-text-muted leading-relaxed max-w-2xl">
              Se cobran prorrateados hasta la próxima renovación y después van en la cuota
              mensual.
            </p>
            <dl>
              {contractable.data.map((addon) => {
                const now = new Date()
                const prorated =
                  cycleStart && cycleEnd
                    ? prorateAddon(addon.monthlyPrice, cycleStart, cycleEnd, now)
                    : null
                return (
                  <DataRow key={addon.id} label={addon.name}>
                    {formatCents(addon.monthlyPrice)} al mes
                    {prorated ? ` · ${formatCents(prorated.amountDue)} ahora` : ""}
                  </DataRow>
                )
              })}
            </dl>
            {/* TODO(integration): contracting an add-on creates an order, which belongs to
                the checkout flow. Until that lands the panel quotes it and support closes it. */}
            <p className="mt-5 text-sm text-text-muted">
              Para contratar cualquiera de ellos escríbenos y lo activamos en el momento.
            </p>
          </>
        )}
      </Panel>

      <Panel>
        <SectionTitle>Renovación</SectionTitle>
        {!renewal.ok ? (
          <div className="mb-5">
            <Notice tone="warn">
              {renewal.message} Mostramos el estado que tenemos guardado.
            </Notice>
          </div>
        ) : (
          <dl className="mb-6">
            <DataRow label="Vence el">{formatDate(renewal.data.expiresAt)}</DataRow>
            <DataRow label="En el proveedor">
              {renewal.data.automatic ? "Renovación automática" : "Sin renovación automática"}
            </DataRow>
          </dl>
        )}

        <AutoRenewToggle
          serviceId={service.id}
          serverName={service.name}
          autoRenew={service.autoRenew}
          nextDueAt={service.nextDueAt}
          disabled={service.status === "terminating" || service.status === "terminated"}
        />
      </Panel>
    </div>
  )
}

/** Start of the period already paid, derived from the renewal date and the term. */
function startOfCycle(cycleEnd: Date, months: number): Date {
  const start = new Date(cycleEnd)
  start.setMonth(start.getMonth() - months)
  return start
}
