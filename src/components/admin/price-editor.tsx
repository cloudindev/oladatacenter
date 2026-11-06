"use client"

import * as React from "react"
import { useActionState } from "react"
import { formatCents, marginOf, priceFromCost, type Cents } from "@ola/core"
import { Button, Input, Notice } from "@/components/app/ui"
import { cn } from "@/lib/utils"
import type { AdminActionResult } from "@/server/admin/results"

/**
 * Inline editor for one plan or addon row.
 *
 * The preview is computed in the browser with the very same `priceFromCost` / `marginOf`
 * the server will use, so what the operator sees before saving is what gets written. The
 * margin shown is the one over the TRUE cost (plan + mandatory options); the bare-cost
 * figure is printed beside it, labelled, so nobody mistakes the two.
 */

type Action = (
  previous: AdminActionResult | null,
  form: FormData,
) => Promise<AdminActionResult>

export interface TermCosts {
  /** Bare plan or addon cost per month. */
  bareCost: Cents
  /** Cost and PVP of the mandatory options that ride along. Zero for an addon. */
  mandatoryCost: Cents
  mandatoryPrice: Cents
  /** Manual PVP currently stored, or `null` when the margin rule is in force. */
  manualPrice: Cents | null
}

/** `"7,99"` from 799, which is what the input shows. */
function centsToField(value: Cents | null): string {
  if (value === null) return ""
  const sign = value < 0 ? "-" : ""
  const absolute = Math.abs(value)
  return `${sign}${Math.trunc(absolute / 100)},${String(absolute % 100).padStart(2, "0")}`
}

const AMOUNT = /^-?\d{1,9}(?:[.,]\d{1,2})?$/

/** The browser-side twin of `euroToCents` in `src/server/admin/input.ts`. */
function fieldToCents(raw: string): Cents | null {
  const value = raw.trim().replace(/\s|€/g, "")
  if (value === "" || !AMOUNT.test(value)) return null
  const negative = value.startsWith("-")
  const [whole, fraction = ""] = value.replace("-", "").split(/[.,]/)
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"))
  return negative ? -cents : cents
}

function fieldToRatio(raw: string): number | null {
  const value = raw.trim().replace(/\s|%/g, "")
  if (value === "" || !AMOUNT.test(value) || value.startsWith("-")) return null
  const [whole, fraction = ""] = value.split(/[.,]/)
  return (Number(whole) * 100 + Number(fraction.padEnd(2, "0"))) / 10_000
}

function formatRatio(ratio: number | null): string {
  if (ratio === null) return "—"
  return `${new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(ratio * 100)} %`
}

interface Preview {
  rulePrice: Cents
  linePrice: Cents
  source: "manual" | "rule"
  totalPrice: Cents
  trueCost: Cents
  trueMargin: number | null
  bareMargin: number | null
  belowFloor: boolean
}

function preview(costs: TermCosts, margin: number, manual: Cents | null, floor: number): Preview {
  const rulePrice = priceFromCost(costs.bareCost, margin)
  const linePrice = manual ?? rulePrice
  const trueCost = costs.bareCost + costs.mandatoryCost
  const trueMargin = marginOf(trueCost, linePrice)
  return {
    rulePrice,
    linePrice,
    source: manual === null ? "rule" : "manual",
    totalPrice: linePrice + costs.mandatoryPrice,
    trueCost,
    trueMargin,
    bareMargin: marginOf(costs.bareCost, linePrice),
    belowFloor: trueMargin !== null && trueMargin < floor,
  }
}

function TermPreview({ label, value }: { label: string; value: Preview }) {
  return (
    <div className="rounded-lg border border-border-base bg-bg-light p-3">
      <p className="label-mono mb-2 text-text-muted">{label}</p>
      <dl className="space-y-1 text-xs">
        <div className="flex justify-between gap-3">
          <dt className="text-text-muted">Coste real</dt>
          <dd className="font-mono tabular-nums">{formatCents(value.trueCost)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-text-muted">
            PVP {value.source === "manual" ? "(manual)" : "(regla)"}
          </dt>
          <dd className="font-mono tabular-nums">{formatCents(value.linePrice)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-text-muted">La regla daría</dt>
          <dd className="font-mono tabular-nums">{formatCents(value.rulePrice)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-text-muted">Carrito con obligatorias</dt>
          <dd className="font-mono tabular-nums">{formatCents(value.totalPrice)}</dd>
        </div>
        <div
          className={cn(
            "flex justify-between gap-3 border-t border-border-base pt-1",
            value.belowFloor && "text-[#8a2d26]",
          )}
        >
          <dt className="font-medium">Margen sobre coste real</dt>
          <dd className="font-mono font-medium tabular-nums">{formatRatio(value.trueMargin)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-text-muted">Sobre coste pelado (no usar)</dt>
          <dd className="font-mono tabular-nums text-text-muted line-through">
            {formatRatio(value.bareMargin)}
          </dd>
        </div>
      </dl>
    </div>
  )
}

export function PriceEditor({
  action,
  idField,
  id,
  name,
  monthly,
  annual,
  marginBasisPoints,
  floor,
  mandatoryNote,
}: {
  action: Action
  /** `"planId"` or `"addonId"`. */
  idField: "planId" | "addonId"
  id: string
  name: string
  monthly: TermCosts
  annual: TermCosts
  marginBasisPoints: number
  /** Floor as a ratio, from `featureFlags`. */
  floor: number
  /** Shown when the row is a mandatory option: the change moves every plan's price. */
  mandatoryNote?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [confirming, setConfirming] = React.useState(false)
  const [priceMonth, setPriceMonth] = React.useState(centsToField(monthly.manualPrice))
  const [price12m, setPrice12m] = React.useState(centsToField(annual.manualPrice))
  const [marginPercent, setMarginPercent] = React.useState(
    formatRatio(marginBasisPoints / 10_000).replace(" %", ""),
  )
  const [result, submit, pending] = useActionState(action, null)

  const margin = fieldToRatio(marginPercent) ?? marginBasisPoints / 10_000
  const nextMonthly = preview(monthly, margin, fieldToCents(priceMonth), floor)
  const nextAnnual = preview(annual, margin, fieldToCents(price12m), floor)
  const currentMonthly = preview(monthly, marginBasisPoints / 10_000, monthly.manualPrice, floor)
  const currentAnnual = preview(annual, marginBasisPoints / 10_000, annual.manualPrice, floor)
  const breaches = nextMonthly.belowFloor || nextAnnual.belowFloor
  const changed =
    nextMonthly.linePrice !== currentMonthly.linePrice ||
    nextAnnual.linePrice !== currentAnnual.linePrice ||
    margin !== marginBasisPoints / 10_000

  if (!open) {
    return (
      <div>
        <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
          Editar
        </Button>
        {result ? (
          <div className="mt-2">
            <Notice tone={result.ok ? (result.message.includes("por debajo") ? "warn" : "ok") : "danger"}>
              {result.message}
            </Notice>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <form action={submit} className="rounded-xl border border-border-base bg-surface-light p-4">
      <input type="hidden" name={idField} value={id} />
      <input type="hidden" name="expectedMarginBasisPoints" value={marginBasisPoints} />

      <p className="mb-3 text-sm font-medium text-text-base">{name}</p>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="label-mono mb-1.5 block text-text-muted">PVP mensual (€)</span>
          <Input
            name="priceMonth"
            value={priceMonth}
            onChange={(event) => setPriceMonth(event.target.value)}
            placeholder={centsToField(nextMonthly.rulePrice)}
            inputMode="decimal"
            autoComplete="off"
          />
        </label>
        <label className="block">
          <span className="label-mono mb-1.5 block text-text-muted">PVP anual (€/mes)</span>
          <Input
            name="price12m"
            value={price12m}
            onChange={(event) => setPrice12m(event.target.value)}
            placeholder={centsToField(nextAnnual.rulePrice)}
            inputMode="decimal"
            autoComplete="off"
          />
        </label>
        <label className="block">
          <span className="label-mono mb-1.5 block text-text-muted">Margen (%)</span>
          <Input
            name="marginPercent"
            value={marginPercent}
            onChange={(event) => setMarginPercent(event.target.value)}
            inputMode="decimal"
            autoComplete="off"
          />
        </label>
      </div>
      <p className="mt-2 text-xs text-text-muted">
        Deja un PVP en blanco para volver a la regla del margen.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <TermPreview label="Mensual" value={nextMonthly} />
        <TermPreview label="Anual" value={nextAnnual} />
      </div>

      {breaches ? (
        <div className="mt-3">
          <Notice tone="warn" title="Margen por debajo del mínimo">
            El margen sobre el coste real queda por debajo de {formatRatio(floor)}. El coste real
            incluye el backup automático, que OVH cobra de forma obligatoria.
          </Notice>
        </div>
      ) : null}

      {mandatoryNote ? (
        <div className="mt-3">
          <Notice tone="warn">{mandatoryNote}</Notice>
        </div>
      ) : null}

      {confirming ? (
        <div className="mt-4 rounded-lg border border-[#f0dcae] bg-[#fdf4e3] p-3">
          <p className="text-sm font-medium text-text-base">Confirma el cambio de precio</p>
          <ul className="mt-2 space-y-1 text-sm text-text-base">
            <li>
              Mensual: {formatCents(currentMonthly.linePrice)} → {formatCents(nextMonthly.linePrice)},
              margen real {formatRatio(currentMonthly.trueMargin)} →{" "}
              {formatRatio(nextMonthly.trueMargin)}
            </li>
            <li>
              Anual: {formatCents(currentAnnual.linePrice)} → {formatCents(nextAnnual.linePrice)},
              margen real {formatRatio(currentAnnual.trueMargin)} →{" "}
              {formatRatio(nextAnnual.trueMargin)}
            </li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="submit" variant="primary" loading={pending}>
              Guardar precio
            </Button>
            <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
              Volver a editar
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="primary"
            disabled={!changed}
            onClick={() => setConfirming(true)}
          >
            Revisar cambio
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cerrar
          </Button>
        </div>
      )}

      {result ? (
        <div className="mt-3">
          <Notice tone={result.ok ? (result.message.includes("por debajo") ? "warn" : "ok") : "danger"}>
            <p>{result.message}</p>
            {result.detail ? <p className="mt-1 font-mono text-xs">{result.detail}</p> : null}
          </Notice>
        </div>
      ) : null}
    </form>
  )
}
