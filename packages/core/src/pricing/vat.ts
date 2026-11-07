import { multiplyCents, type Cents } from "../money"

export const SPAIN_VAT_RATE = 0.21

/** EU member states, for the reverse-charge decision. */
const EU_COUNTRIES = new Set([
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR", "HU",
  "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK",
])

export function isEuCountry(country: string): boolean {
  return EU_COUNTRIES.has(country.toUpperCase())
}

/**
 * A tax id is mandatory inside the EU (Spanish NIF/CIF/NIE, EU VAT number). Companies
 * elsewhere often have none that matters to us (no VAT is charged outside the EU), so
 * for them it is optional.
 */
export function taxIdRequiredFor(country: string | null | undefined): boolean {
  return country ? isEuCountry(country) : true
}

export type CustomerKind = "company" | "individual"

export interface VatContext {
  /** ISO-3166 alpha-2, uppercase. */
  country: string
  kind: CustomerKind
  /** True only when the VAT number was validated against VIES. */
  hasValidEuVatNumber: boolean
}

export type VatTreatment =
  | { kind: "standard"; rate: number; reason: "domestic" }
  | { kind: "reverse_charge"; rate: 0; reason: "eu_b2b_vies" }
  | { kind: "exempt"; rate: 0; reason: "outside_eu" }
  | { kind: "standard"; rate: number; reason: "eu_b2c" }

/**
 * Spanish seller (Cloudin Hosting S.L.) selling a digital service:
 *  - Spain, any customer            -> 21 %
 *  - EU company with valid VIES VAT -> reverse charge, 0 %
 *  - EU consumer                    -> 21 % (MVP: no OSS per-country rates yet)
 *  - outside the EU                 -> out of scope, 0 %
 */
export function vatTreatment(context: VatContext): VatTreatment {
  const country = context.country.toUpperCase()
  if (country === "ES") return { kind: "standard", rate: SPAIN_VAT_RATE, reason: "domestic" }
  if (!EU_COUNTRIES.has(country)) return { kind: "exempt", rate: 0, reason: "outside_eu" }
  if (context.kind === "company" && context.hasValidEuVatNumber) {
    return { kind: "reverse_charge", rate: 0, reason: "eu_b2b_vies" }
  }
  return { kind: "standard", rate: SPAIN_VAT_RATE, reason: "eu_b2c" }
}

export interface TaxedAmount {
  net: Cents
  tax: Cents
  gross: Cents
  rate: number
  treatment: VatTreatment
}

/** Prices are quoted NET on the site; VAT is added at checkout. */
export function applyVat(net: Cents, context: VatContext): TaxedAmount {
  const treatment = vatTreatment(context)
  const tax = multiplyCents(net, treatment.rate)
  return { net, tax, gross: net + tax, rate: treatment.rate, treatment }
}
