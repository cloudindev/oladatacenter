/**
 * Money is always integer cents of EUR. Never floats, never strings.
 */
export type Cents = number

export class MoneyError extends Error {}

export function cents(value: number): Cents {
  if (!Number.isFinite(value)) throw new MoneyError(`not a finite amount: ${value}`)
  if (!Number.isInteger(value)) throw new MoneyError(`amount must be integer cents: ${value}`)
  return value
}

/**
 * OVH catalog prices are integers in units of 1e-8 EUR.
 * Verified 2026-11-05: vps-2027-model1 monthly = 449_000_000 -> 4.49 EUR -> 449 cents.
 */
export function catalogPriceToCents(catalogPrice: number): Cents {
  if (!Number.isFinite(catalogPrice)) {
    throw new MoneyError(`not a finite catalog price: ${catalogPrice}`)
  }
  return Math.round(catalogPrice / 1e6)
}

export function eurosToCents(euros: number): Cents {
  return Math.round(euros * 100)
}

export function centsToEuros(value: Cents): number {
  return value / 100
}

/** "12,99 €" — Spanish formatting, which is what the whole UI shows. */
export function formatCents(value: Cents, opts: { withSymbol?: boolean } = {}): string {
  const { withSymbol = true } = opts
  const formatted = new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    // Spanish CLDR data skips the separator below 10 000 ("2561,71"); RAE style and
    // invoices write "2.561,71".
    useGrouping: "always",
  }).format(centsToEuros(value))
  return withSymbol ? `${formatted} €` : formatted
}

export function sumCents(values: readonly Cents[]): Cents {
  return values.reduce<Cents>((total, value) => total + value, 0)
}

/** Multiply cents by a ratio and round half-up, staying in integer cents. */
export function multiplyCents(value: Cents, factor: number): Cents {
  if (!Number.isFinite(factor)) throw new MoneyError(`not a finite factor: ${factor}`)
  return Math.round(value * factor)
}
