/**
 * The margin view the pricing screen is built on.
 *
 * ONE rule drives this whole file, from `docs/decisions.md` (2026-11-05):
 *
 *   `automatedBackup` is mandatory and priced. A VPS can never be sold at its bare plan
 *   cost, so the margin an operator is shown must be computed over the TRUE cost — the
 *   plan plus every mandatory addon. On VPS-1 that is 7,99 € over 4,84 € = 65 %, not the
 *   78 % that 7,99 € over the bare 4,49 € suggests.
 *
 * Three margins come out of this, and which is which matters:
 *
 *   `trueMargin`  PVP over the TRUE cost. 65 % — the figure `decisions.md` names, the
 *                 conservative one, and the only one the screen calls "the margin".
 *   `totalMargin` the same, once the mandatory options are also billed on top
 *                 (`buildQuote` charges the 1-day backup at 0,99 €, so the baseline cart
 *                 is 8,98 € and this comes out at 85 %). Higher, so it is shown beside
 *                 the margin and never in place of it.
 *   `bareMargin`  PVP over the bare plan cost. 78 % — the overstated figure, returned
 *                 only so the screen can show how far off it is. Never the margin.
 *
 * Pure by contract: no io, no `process.env`, no dates. Every price comes out of
 * `priceFromCost` / `resolvePrice` in `@ola/core`; nothing is computed by hand here.
 */
import {
  marginOf,
  priceFromCost,
  resolvePrice,
  type Cents,
  type Term,
} from "@ola/core"

/** Margin floor below which a price change is flagged, in basis points. */
export const DEFAULT_MARGIN_FLOOR_BP = 3000

/** `featureFlags` key the floor is stored under. See `settings.ts` for the encoding. */
export const MARGIN_FLOOR_FLAG = "margin_floor"

export function basisPointsToRatio(basisPoints: number): number {
  return basisPoints / 10_000
}

export function ratioToBasisPoints(ratio: number): number {
  return Math.round(ratio * 10_000)
}

/** Percentage as the UI prints it: 0.6508 -> "65,1 %". */
export function formatMargin(ratio: number | null): string {
  if (ratio === null) return "—"
  return `${new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(ratio * 100)} %`
}

/**
 * The cost and price of the mandatory options OVH forces onto every cart, summed.
 *
 * `buildQuote` resolves these automatically, so the caller gets them by subtracting the
 * plan line from the baseline quote instead of guessing.
 */
export interface MandatoryTotals {
  cost: Cents
  price: Cents
}

export interface MarginInput {
  /** Bare plan (or addon) cost per month, as published by OVH. */
  bareCost: Cents
  /** Cost and PVP of the mandatory options. Zero for an addon row. */
  mandatory: MandatoryTotals
  /** Margin currently stored on the row, as a ratio. */
  margin: number
  /** Manual PVP of this line, or `null`/`undefined` to use the margin rule. */
  manualPrice: Cents | null | undefined
  /** Floor below which the resulting margin is flagged, as a ratio. */
  floor: number
}

export interface MarginView {
  /** What OVH charges us for the plan alone. */
  bareCost: Cents
  /** Plan plus every mandatory addon: the real floor cost. */
  trueCost: Cents
  /** PVP of this line, manual or from the rule. The advertised price. */
  linePrice: Cents
  /** What the baseline cart charges: this line plus the mandatory options on top. */
  totalPrice: Cents
  /** What `priceFromCost` would produce for this line right now. */
  rulePrice: Cents
  source: "manual" | "rule"
  /** THE margin: the advertised PVP over the true cost. The figure to act on. */
  trueMargin: number | null
  /** The margin once the mandatory options are billed on top. Never shown alone. */
  totalMargin: number | null
  /**
   * The figure a bare-cost calculation suggests. Higher than `trueMargin` whenever a
   * mandatory addon is priced. Shown as a caveat, never as the margin.
   */
  bareMargin: number | null
  /** True when `trueMargin` is below the configured floor. */
  belowFloor: boolean
  floor: number
}

/**
 * The margin view of one line.
 *
 * `trueMargin` deliberately divides by `trueCost`, never by `bareCost`. Changing that
 * divisor is what re-introduces the overstated margin, and `belowFloor` is derived from
 * it so the warning fires on the conservative number.
 */
export function marginView(input: MarginInput): MarginView {
  const trueCost = input.bareCost + input.mandatory.cost
  const resolution = resolvePrice(input.bareCost, input.margin, input.manualPrice)
  const totalPrice = resolution.price + input.mandatory.price
  const trueMargin = marginOf(trueCost, resolution.price)

  return {
    bareCost: input.bareCost,
    trueCost,
    linePrice: resolution.price,
    totalPrice,
    rulePrice: priceFromCost(input.bareCost, input.margin),
    source: resolution.source,
    trueMargin,
    totalMargin: marginOf(trueCost, totalPrice),
    bareMargin: marginOf(input.bareCost, resolution.price),
    belowFloor: trueMargin !== null && trueMargin < input.floor,
    floor: input.floor,
  }
}

/** The margin view of one row for both terms. */
export type MarginByTerm = Record<Term, MarginView>

export interface TermMarginInput {
  bareCost: Record<Term, Cents>
  mandatory: Record<Term, MandatoryTotals>
  margin: number
  manualPrice: Partial<Record<Term, Cents>>
  floor: number
}

export function marginViewByTerm(input: TermMarginInput): MarginByTerm {
  const build = (term: Term): MarginView =>
    marginView({
      bareCost: input.bareCost[term],
      mandatory: input.mandatory[term],
      margin: input.margin,
      manualPrice: input.manualPrice[term] ?? null,
      floor: input.floor,
    })
  return { P1M: build("P1M"), P12M: build("P12M") }
}

// ─── the confirmation a price change has to show ─────────────────────────────

export interface PriceChangeTerm {
  term: Term
  before: MarginView
  after: MarginView
}

export interface PriceChangePreview {
  terms: readonly PriceChangeTerm[]
  /** True when any term ends up below the floor. The confirmation must say so. */
  warnsBelowFloor: boolean
  /** Terms that would drop below the floor, for the warning text. */
  belowFloorTerms: readonly Term[]
}

/**
 * What a price or margin change would do, per term, before and after.
 *
 * The admin UI never writes a price without showing this: old -> new and the margin
 * effect, with a loud warning when the floor is breached.
 */
export function previewPriceChange(
  current: TermMarginInput,
  next: { margin?: number; manualPrice?: Partial<Record<Term, Cents | null>> },
): PriceChangePreview {
  const manualPrice: Partial<Record<Term, Cents>> = { ...current.manualPrice }
  for (const [term, value] of Object.entries(next.manualPrice ?? {})) {
    if (value === null || value === undefined) delete manualPrice[term as Term]
    else manualPrice[term as Term] = value
  }

  const before = marginViewByTerm(current)
  const after = marginViewByTerm({
    ...current,
    margin: next.margin ?? current.margin,
    manualPrice,
  })

  const terms: PriceChangeTerm[] = (["P1M", "P12M"] as const).map((term) => ({
    term,
    before: before[term],
    after: after[term],
  }))
  const belowFloorTerms = terms.filter((row) => row.after.belowFloor).map((row) => row.term)

  return {
    terms,
    warnsBelowFloor: belowFloorTerms.length > 0,
    belowFloorTerms,
  }
}
