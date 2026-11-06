"use client"

/**
 * The four plan cards plus the monthly/annual switch. Client side only because the
 * switch is state: every price on the page comes from the server-built view model.
 */
import { useState } from "react"
import Link from "next/link"
import { TERM_PARAMS, formatCents, type SellablePlan, type Term } from "@ola/core"
import { cn } from "@/lib/utils"
import { TermToggle } from "./TermToggle"

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-bg-dark/10 py-2 last:border-b-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.06em] text-text-muted">{label}</dt>
      <dd className="font-mono text-[13px]">{value}</dd>
    </div>
  )
}

function Check() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="mt-[3px] h-3.5 w-3.5 shrink-0 text-accent-ink">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 8.5l3.2 3.2L13 5"
      />
    </svg>
  )
}

export function PlanCards({ plans }: { plans: readonly SellablePlan[] }) {
  const [term, setTerm] = useState<Term>("P1M")
  const bestSaving = Math.max(0, ...plans.map((plan) => plan.savingPercent))

  return (
    <div>
      <div className="mb-8 flex flex-col items-center gap-3">
        <TermToggle term={term} onChange={setTerm} savingPercent={bestSaving} />
        <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-text-muted">
          Precios sin IVA
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => {
          const price = plan.price[term]
          const featured = plan.slug === "l"
          return (
            <article
              key={plan.slug}
              className={cn(
                "flex flex-col rounded-[18px] border bg-surface-light p-6",
                featured ? "border-bg-dark" : "border-bg-dark/12",
              )}
            >
              <header className="mb-5 flex items-start justify-between gap-3">
                <h3 className="text-[22px] font-normal tracking-[-0.02em]">{plan.name}</h3>
                {featured ? (
                  <span className="rounded-full bg-primary px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-bg-dark">
                    El más vendido
                  </span>
                ) : null}
              </header>

              <div className="mb-5">
                <p className="flex items-baseline gap-1.5">
                  <span className="text-[34px] font-light tracking-[-0.03em]">
                    {formatCents(price.monthly)}
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-text-muted">
                    / mes
                  </span>
                </p>
                <p className="mt-1 text-[12.5px] text-text-muted">
                  {term === "P12M"
                    ? `${formatCents(price.cycle)} al año, sin IVA · ahorras ${formatCents(plan.savingPerYear)}`
                    : "Sin IVA, sin compromiso de permanencia"}
                </p>
              </div>

              <dl className="mb-5">
                <SpecRow label="vCores" value={`${plan.specs.vcores}`} />
                <SpecRow label="RAM" value={`${plan.specs.ramGb} GB`} />
                <SpecRow label="NVMe" value={`${plan.specs.nvmeGb} GB`} />
                <SpecRow
                  label="Red"
                  value={
                    plan.specs.bandwidthMbps >= 1000
                      ? `${plan.specs.bandwidthMbps / 1000} Gbit/s`
                      : `${plan.specs.bandwidthMbps} Mbit/s`
                  }
                />
              </dl>

              <ul className="mb-6 flex flex-col gap-2 text-[13px] leading-snug">
                {plan.included.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <Check />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={`/vps/configurar?plan=${plan.slug}&term=${TERM_PARAMS[term]}`}
                className={cn(
                  "mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-lg font-mono text-[11px] uppercase tracking-[0.06em] transition-colors",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink",
                  featured
                    ? "bg-bg-dark text-text-dark hover:bg-surface-dark"
                    : "border border-bg-dark/20 text-text-base hover:bg-surface-beige",
                )}
              >
                Configurar
                <span aria-hidden>→</span>
              </Link>
            </article>
          )
        })}
      </div>
    </div>
  )
}
