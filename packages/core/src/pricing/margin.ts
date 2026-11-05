import { multiplyCents, type Cents } from "../money"

export const DEFAULT_PLAN_MARGIN = 0.75
export const DEFAULT_ADDON_MARGIN = 0.5

/**
 * Round UP to the next price ending in ,99.
 * 785 -> 799 · 799 -> 799 · 800 -> 899 · 0 -> 0
 */
export function ceilTo99(value: Cents): Cents {
  if (value <= 0) return 0
  const remainder = ((value - 99) % 100 + 100) % 100
  return remainder === 0 ? value : value + (100 - remainder)
}

/**
 * Sale price from cost: cost * (1 + margin), rounded up to ,99.
 *
 * Verified against the brief's suggested PVP table: with margin 0.75 this reproduces
 * all eight published prices exactly (7,99 / 14,99 / 21,99 / 41,99 monthly and
 * 6,99 / 12,99 / 18,99 / 34,99 for the 12-month term).
 */
export function priceFromCost(cost: Cents, margin: number): Cents {
  if (!Number.isFinite(margin) || margin < 0) {
    throw new RangeError(`margin must be a non-negative number, got ${margin}`)
  }
  return ceilTo99(multiplyCents(cost, 1 + margin))
}

/** Effective margin of a price over a cost, as a ratio. `null` when cost is 0. */
export function marginOf(cost: Cents, price: Cents): number | null {
  if (cost <= 0) return null
  return (price - cost) / cost
}

export interface PriceResolution {
  /** Final sale price in cents. */
  price: Cents
  /** Where it came from, for the admin UI. */
  source: "manual" | "rule"
  /** Margin actually achieved over the cost passed in. */
  effectiveMargin: number | null
}

/** A manual PVP always wins over the margin rule; that is the documented admin override. */
export function resolvePrice(
  cost: Cents,
  margin: number,
  manualPrice: Cents | null | undefined,
): PriceResolution {
  const price = manualPrice != null ? manualPrice : priceFromCost(cost, margin)
  return {
    price,
    source: manualPrice != null ? "manual" : "rule",
    effectiveMargin: marginOf(cost, price),
  }
}
