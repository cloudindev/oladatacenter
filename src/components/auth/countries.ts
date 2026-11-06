/**
 * Countries we invoice. ISO 3166-1 alpha-2 plus the Spanish name, EU members flagged
 * because that is what decides reverse charge.
 *
 * Spain first, then the rest of the EU, then the non-EU countries we actually sell to.
 * `vatTreatment` in `@ola/core` is the only place that interprets the flag.
 */

export interface Country {
  code: string
  name: string
  eu: boolean
}

export const COUNTRIES: readonly Country[] = [
  { code: "ES", name: "España", eu: true },
  { code: "AT", name: "Austria", eu: true },
  { code: "BE", name: "Bélgica", eu: true },
  { code: "BG", name: "Bulgaria", eu: true },
  { code: "CY", name: "Chipre", eu: true },
  { code: "CZ", name: "República Checa", eu: true },
  { code: "DE", name: "Alemania", eu: true },
  { code: "DK", name: "Dinamarca", eu: true },
  { code: "EE", name: "Estonia", eu: true },
  { code: "FI", name: "Finlandia", eu: true },
  { code: "FR", name: "Francia", eu: true },
  { code: "GR", name: "Grecia", eu: true },
  { code: "HR", name: "Croacia", eu: true },
  { code: "HU", name: "Hungría", eu: true },
  { code: "IE", name: "Irlanda", eu: true },
  { code: "IT", name: "Italia", eu: true },
  { code: "LT", name: "Lituania", eu: true },
  { code: "LU", name: "Luxemburgo", eu: true },
  { code: "LV", name: "Letonia", eu: true },
  { code: "MT", name: "Malta", eu: true },
  { code: "NL", name: "Países Bajos", eu: true },
  { code: "PL", name: "Polonia", eu: true },
  { code: "PT", name: "Portugal", eu: true },
  { code: "RO", name: "Rumanía", eu: true },
  { code: "SE", name: "Suecia", eu: true },
  { code: "SI", name: "Eslovenia", eu: true },
  { code: "SK", name: "Eslovaquia", eu: true },
  { code: "AD", name: "Andorra", eu: false },
  { code: "AR", name: "Argentina", eu: false },
  { code: "BR", name: "Brasil", eu: false },
  { code: "CA", name: "Canadá", eu: false },
  { code: "CH", name: "Suiza", eu: false },
  { code: "CL", name: "Chile", eu: false },
  { code: "CO", name: "Colombia", eu: false },
  { code: "GB", name: "Reino Unido", eu: false },
  { code: "MA", name: "Marruecos", eu: false },
  { code: "MX", name: "México", eu: false },
  { code: "NO", name: "Noruega", eu: false },
  { code: "US", name: "Estados Unidos", eu: false },
  { code: "UY", name: "Uruguay", eu: false },
]

const BY_CODE = new Map(COUNTRIES.map((country) => [country.code, country]))

export function countryName(code: string | null): string {
  if (!code) return "—"
  return BY_CODE.get(code)?.name ?? code
}

export function isKnownCountry(code: string): boolean {
  return BY_CODE.has(code)
}

export function isEuCountry(code: string | null): boolean {
  if (!code) return false
  return BY_CODE.get(code)?.eu ?? false
}
