"use client"

/**
 * The configurator: five steps on one page, one sticky summary.
 *
 * Three rules shape it:
 *  - the price always comes from the server (`quoteAction`), debounced, with the last good
 *    quote left on screen while a new one is calculated;
 *  - the configuration lives in the URL, so a reload or a shared link restores it;
 *  - the client only ever handles public slugs, never an OVH code.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import {
  TERM_PARAMS,
  encodeConfig,
  formatCents,
  resolveConfig,
  type PublicConfig,
  type PublicQuote,
  type RawParams,
  type SellablePlan,
  type Term,
} from "@ola/core"
import { quoteAction } from "@/app/vps/configurar/actions"
import { AddonList } from "./AddonList"
import { ChoiceRadio, StepHeading } from "./Choice"
import { DatacenterPicker } from "./DatacenterPicker"
import { OsPicker } from "./OsPicker"
import { SummaryPanel } from "./SummaryPanel"
import { TermToggle } from "./TermToggle"

const DEBOUNCE_MS = 250

function toRaw(config: PublicConfig): RawParams {
  return {
    plan: config.plan,
    dc: config.dc,
    os: config.os,
    term: TERM_PARAMS[config.term],
    addons: config.addons.join(","),
  }
}

export function Configurator({
  plans,
  initialConfig,
  initialQuote,
}: {
  plans: readonly SellablePlan[]
  initialConfig: PublicConfig
  initialQuote: PublicQuote
}) {
  const [config, setConfig] = useState<PublicConfig>(initialConfig)
  const [quote, setQuote] = useState<PublicQuote>(initialQuote)
  const [error, setError] = useState<string | null>(null)
  /** Query string the quote on screen belongs to, so nothing is ever priced twice. */
  const [quotedSearch, setQuotedSearch] = useState(() => encodeConfig(initialConfig))
  const latest = useRef(0)

  const plan = plans.find((candidate) => candidate.slug === config.plan) ?? plans[0]
  const search = encodeConfig(config)
  /** Derived, not stored: the summary is stale exactly while these two differ. */
  const pending = search !== quotedSearch

  const patch = useCallback(
    (changes: RawParams) => {
      setConfig((previous) => resolveConfig(plans, { ...toRaw(previous), ...changes }))
    },
    [plans],
  )

  useEffect(() => {
    // The URL is the shareable state. Shallow update: no server round trip for a repaint.
    window.history.replaceState(null, "", `?${search}`)
    if (search === quotedSearch) return

    const id = latest.current + 1
    latest.current = id
    const timer = window.setTimeout(() => {
      void quoteAction(search).then((result) => {
        if (latest.current !== id) return
        // This configuration is now settled, whether it priced or not.
        setQuotedSearch(search)
        if (!result.ok) {
          setError(result.message)
          return
        }
        setQuote(result.quote)
        setError(null)
        // The server may have dropped something we still had selected: follow it.
        const canonical = encodeConfig(result.config)
        if (canonical !== search) setConfig(result.config)
      })
    }, DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [search, quotedSearch])

  if (!plan) return null

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12">
      <div className="flex flex-col gap-10">
        <StepHeading index="01 · Plan" title="Elige la potencia">
          <div role="radiogroup" aria-label="Plan" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {plans.map((candidate) => (
              <ChoiceRadio
                key={candidate.slug}
                name="plan"
                value={candidate.slug}
                checked={candidate.slug === config.plan}
                onSelect={(value) => patch({ plan: value })}
                caption={`${formatCents(candidate.price[config.term].monthly)} / mes`}
                title={candidate.name}
                note={`${candidate.specs.vcores} vCores · ${candidate.specs.ramGb} GB RAM · ${candidate.specs.nvmeGb} GB NVMe`}
              />
            ))}
          </div>
        </StepHeading>

        <StepHeading
          index="02 · Centro de datos"
          title="Dónde quieres el servidor"
          hint="Los datos se quedan en el centro que elijas"
        >
          <DatacenterPicker
            datacenters={plan.datacenters}
            value={config.dc}
            onChange={(value) => patch({ dc: value })}
          />
        </StepHeading>

        <StepHeading
          index="03 · Sistema operativo"
          title="Qué imagen instalamos"
          hint="Se instala limpia al crear el servidor"
        >
          <OsPicker
            groups={plan.osGroups}
            value={config.os}
            onChange={(value) => patch({ os: value })}
          />
        </StepHeading>

        <StepHeading index="04 · Opciones" title="Backup, discos y panel">
          <AddonList
            groups={plan.addons}
            selected={config.addons}
            term={config.term}
            onChange={(slugs) => patch({ addons: slugs.join(",") })}
          />
        </StepHeading>

        <StepHeading
          index="05 · Término"
          title="Cómo quieres pagarlo"
          hint="El plan anual se factura de una vez y sale más barato por mes"
        >
          <TermToggle
            term={config.term}
            onChange={(term: Term) => patch({ term: TERM_PARAMS[term] })}
            savingPercent={plan.savingPercent}
          />
          <p className="mt-4 text-[13px] text-text-muted">
            Mensual: {formatCents(plan.price.P1M.monthly)} al mes · Anual:{" "}
            {formatCents(plan.price.P12M.monthly)} al mes, {formatCents(plan.price.P12M.cycle)} por
            doce meses. Precios del plan sin opciones y sin IVA.
          </p>
        </StepHeading>
      </div>

      {/*
        Checkout lives at /app/servers/new and is owned by the checkout agent. The whole
        configuration travels in the query string (plan, dc, os, term, addons), so that
        page can restore it with `resolveConfig` exactly as this one does. When the route
        exists as a POST handler this link becomes a form with the same fields.
      */}
      <SummaryPanel
        quote={quote}
        pending={pending}
        error={error}
        continueHref={`/app/servers/new?${search}`}
      />
    </div>
  )
}
