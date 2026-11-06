/**
 * Side-by-side comparison for wide screens. A Server Component: it has no state, both
 * terms are shown at once so nothing needs to switch.
 */
import Link from "next/link"
import {
  formatCents,
  type AddonFamily,
  type SellablePlan,
} from "@ola/core"

function cheapestOf(plan: SellablePlan, family: AddonFamily): string {
  const group = plan.addons.find((candidate) => candidate.family === family)
  const options = group?.options.filter((option) => !option.disabled && !option.included) ?? []
  if (options.length === 0) return "No disponible"
  const cheapest = options.reduce((best, option) =>
    option.monthlyPrice.P1M < best.monthlyPrice.P1M ? option : best,
  )
  return `Desde ${formatCents(cheapest.monthlyPrice.P1M)} / mes`
}

function bandwidth(plan: SellablePlan): string {
  const { bandwidthMbps } = plan.specs
  return bandwidthMbps >= 1000 ? `${bandwidthMbps / 1000} Gbit/s` : `${bandwidthMbps} Mbit/s`
}

export function PlanComparison({ plans }: { plans: readonly SellablePlan[] }) {
  const rows: { label: string; value: (plan: SellablePlan) => string }[] = [
    { label: "vCores", value: (plan) => `${plan.specs.vcores}` },
    { label: "Memoria RAM", value: (plan) => `${plan.specs.ramGb} GB` },
    { label: "Disco NVMe", value: (plan) => `${plan.specs.nvmeGb} GB` },
    { label: "Ancho de banda", value: bandwidth },
    { label: "Centros de datos", value: (plan) => `${plan.datacenters.length} en Europa` },
    { label: "Backup automático", value: () => "1 día, incluido" },
    { label: "Snapshot", value: (plan) => cheapestOf(plan, "snapshot") },
    { label: "Disco adicional", value: (plan) => cheapestOf(plan, "additionalDisk") },
    { label: "Panel Plesk", value: (plan) => cheapestOf(plan, "plesk") },
    { label: "Anti-DDoS", value: () => "Incluido" },
    {
      label: "Precio mensual",
      value: (plan) => `${formatCents(plan.price.P1M.monthly)} / mes`,
    },
    {
      label: "Precio anual",
      value: (plan) => `${formatCents(plan.price.P12M.monthly)} / mes`,
    },
  ]

  return (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">
        Comparación de los planes OLA VPS Cloud. Todos los precios son sin IVA.
      </caption>
      <thead>
        <tr>
          <th scope="col" className="w-[22%] border-b border-bg-dark/12 py-4 pr-4 align-bottom">
            <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-text-muted">
              Características
            </span>
          </th>
          {plans.map((plan) => (
            <th
              key={plan.slug}
              scope="col"
              className="border-b border-bg-dark/12 py-4 pr-4 align-bottom"
            >
              <span className="block text-[19px] font-normal tracking-[-0.02em]">{plan.name}</span>
              <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-text-muted">
                Desde {formatCents(plan.price.P12M.monthly)} / mes
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="align-baseline">
            <th
              scope="row"
              className="border-b border-bg-dark/10 py-3 pr-4 font-mono text-[11px] font-normal uppercase tracking-[0.06em] text-text-muted"
            >
              {row.label}
            </th>
            {plans.map((plan) => (
              <td key={plan.slug} className="border-b border-bg-dark/10 py-3 pr-4 text-[14px]">
                {row.value(plan)}
              </td>
            ))}
          </tr>
        ))}
        <tr>
          <td />
          {plans.map((plan) => (
            <td key={plan.slug} className="py-5 pr-4">
              <Link
                href={`/vps/configurar?plan=${plan.slug}`}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-bg-dark/20 px-4 font-mono text-[11px] uppercase tracking-[0.06em] transition-colors hover:bg-surface-beige focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink"
              >
                Configurar
                <span aria-hidden>→</span>
              </Link>
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  )
}
