/**
 * Presentation helpers: they turn a `ParsedCatalog` (OVH vocabulary, costs included)
 * into the customer-facing view model the public pages render.
 *
 * Pure by contract: no io, no `process.env`, no dates of its own. Pricing is NEVER
 * computed here — every figure comes out of `buildQuote`.
 *
 * Two hard rules drive the design:
 *  1. An OVH plan code, an OVH plan name or our cost must never reach the browser.
 *     Everything the client sees is addressed by a stable public slug instead.
 *  2. Prices are net of VAT; the payment step adds it.
 */
import type { Cents } from "../money"
import {
  buildQuote,
  type PricingOverrides,
  type Quote,
  type QuoteRequest,
} from "../pricing/quote"
import {
  MANDATORY_FAMILIES,
  MVP_PLAN_CODES,
  PLAN_BRANDING,
  SELLABLE_DATACENTERS,
  TERMS,
  TERM_MONTHS,
  type AddonCost,
  type AddonFamily,
  type DatacenterRegion,
  type ParsedCatalog,
  type PlanCost,
  type Term,
} from "./types"

export class PresentationError extends Error {}

// ─── Spanish labels ──────────────────────────────────────────────────────────

/** Order the configurator shows the families in. `os`/`storage` are infrastructure. */
export const ADDON_FAMILY_ORDER: readonly AddonFamily[] = [
  "automatedBackup",
  "snapshot",
  "additionalDisk",
  "plesk",
  "os",
  "storage",
]

export const ADDON_FAMILY_LABELS: Readonly<Record<AddonFamily, string>> = {
  automatedBackup: "Backup automático",
  snapshot: "Snapshot",
  additionalDisk: "Disco adicional",
  plesk: "Panel Plesk",
  os: "Sistema operativo",
  storage: "Almacenamiento",
}

export const ADDON_FAMILY_HINTS: Readonly<Record<AddonFamily, string>> = {
  automatedBackup: "Copia diaria gestionada por nosotros, con restauración desde el panel",
  snapshot: "Una imagen manual del disco que puedes restaurar cuando quieras",
  additionalDisk: "Volumen extra que se monta aparte del disco del sistema",
  plesk: "Panel de control web con licencia incluida en la cuota",
  os: "Imagen que se instala al crear el servidor",
  storage: "Disco del sistema, NVMe local",
}

/** What every plan includes, whatever the configuration. Shown on the card and the summary. */
export const INCLUDED_FEATURES: readonly string[] = [
  "Backup automático de 1 día",
  "Dirección IPv4 y bloque IPv6",
  "Protección anti-DDoS siempre activa",
  "Panel de gestión y consola KVM",
]

export const TERM_LABELS: Readonly<Record<Term, string>> = {
  P1M: "Mensual",
  P12M: "Anual",
}

/** Value of the `term` query parameter. Human readable so a shared link reads well. */
export const TERM_PARAMS: Readonly<Record<Term, string>> = {
  P1M: "mensual",
  P12M: "anual",
}

// ─── slugs ───────────────────────────────────────────────────────────────────

/** Lowercase, accent-free, hyphenated. Stable: it is part of the shareable URL. */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function planCodeForSlug(slug: string): string | null {
  const entry = Object.entries(PLAN_BRANDING).find(([, branding]) => branding.slug === slug)
  return entry ? entry[0] : null
}

export function planSlugForCode(planCode: string): string | null {
  return PLAN_BRANDING[planCode]?.slug ?? null
}

const DISK_SIZE_LABELS: Readonly<Record<string, string>> = {
  "50g": "50 GB",
  "100g": "100 GB",
  "200g": "200 GB",
  "500g": "500 GB",
  "1000g": "1 TB",
  "5000g": "5 TB",
  "10000g": "10 TB",
}

const DISK_SIZE_SLUGS: Readonly<Record<string, string>> = {
  "50g": "disco-50gb",
  "100g": "disco-100gb",
  "200g": "disco-200gb",
  "500g": "disco-500gb",
  "1000g": "disco-1tb",
  "5000g": "disco-5tb",
  "10000g": "disco-10tb",
}

const PLESK_SLUGS: Readonly<Record<string, string>> = {
  webadmin: "plesk-web-admin",
  webpro: "plesk-web-pro",
  webhost: "plesk-web-host",
}

const PLESK_LABELS: Readonly<Record<string, string>> = {
  "plesk-web-admin": "Plesk Web Admin",
  "plesk-web-pro": "Plesk Web Pro",
  "plesk-web-host": "Plesk Web Host",
}

/**
 * Public slug of one catalog option. Returns `null` for anything we do not sell,
 * which is also the safety net: an option we cannot name is never published.
 */
export function addonSlug(addon: AddonCost): string | null {
  const code = addon.planCode

  const backup = /^option-auto-backup-\d+-(\d+)-model\d+$/.exec(code)
  if (backup) return `backup-${backup[1]}d`

  if (/^option-snapshot-/.test(code)) return "snapshot"

  const disk = /^option-additional-disk-\d+-(\d+g)$/.exec(code)
  if (disk) return DISK_SIZE_SLUGS[disk[1]] ?? null

  const plesk = /^option-plesk-(web[a-z]+)$/.exec(code)
  if (plesk) return PLESK_SLUGS[plesk[1]] ?? null

  if (code === "option-linux") return "linux"
  if (/^option-windows-/.test(code)) return "windows"
  if (/^option-storage-local-/.test(code)) return "nvme-local"
  if (/^option-storage-remote-/.test(code)) return "disco-remoto"

  return null
}

export function addonLabel(slug: string): string {
  const backup = /^backup-(\d+)d$/.exec(slug)
  if (backup) {
    const days = Number(backup[1])
    return `Backup automático de ${days} ${days === 1 ? "día" : "días"}`
  }
  if (slug === "snapshot") return "Snapshot bajo demanda"
  const disk = Object.entries(DISK_SIZE_SLUGS).find(([, value]) => value === slug)
  if (disk) return `Disco adicional de ${DISK_SIZE_LABELS[disk[0]]}`
  if (PLESK_LABELS[slug]) return PLESK_LABELS[slug]
  if (slug === "linux") return "Linux"
  if (slug === "windows") return "Windows Server"
  if (slug === "nvme-local") return "Disco NVMe local"
  if (slug === "disco-remoto") return "Disco remoto"
  return slug
}

// ─── datacenters ─────────────────────────────────────────────────────────────

export interface PublicDatacenter {
  /** Query-string value. Never an OVH code. */
  slug: string
  city: string
  country: string
  /** "Gravelines, Francia" — the only thing a customer ever reads. */
  label: string
  /** `europe` keeps the data in the EU/EEA or the UK; `world` does not. */
  region: DatacenterRegion
  /**
   * OVH has stock here for this plan right now. `true` until live stock is applied with
   * `applyDatacenterStock`, and kept `true` when the stock source cannot be reached.
   */
  available: boolean
}

const DATACENTER_BY_SLUG = new Map(
  SELLABLE_DATACENTERS.map((dc) => [slugify(dc.city), dc.code as string]),
)

export function datacenterSlug(code: string): string | null {
  const dc = SELLABLE_DATACENTERS.find((candidate) => candidate.code === code)
  return dc ? slugify(dc.city) : null
}

export function datacenterCodeForSlug(slug: string): string | null {
  return DATACENTER_BY_SLUG.get(slug) ?? null
}

export function datacenterLabel(code: string): string | null {
  const dc = SELLABLE_DATACENTERS.find((candidate) => candidate.code === code)
  return dc ? `${dc.city}, ${dc.country}` : null
}

/** Sellable datacenters a given plan actually offers, in commercial order. */
export function datacentersFor(plan: PlanCost): readonly PublicDatacenter[] {
  return SELLABLE_DATACENTERS.filter((dc) => plan.datacenters.includes(dc.code)).map((dc) => ({
    slug: slugify(dc.city),
    city: dc.city,
    country: dc.country,
    label: `${dc.city}, ${dc.country}`,
    region: dc.region,
    available: true,
  }))
}

/**
 * Marks each datacenter of a plan as in or out of stock, from the OVH codes that have
 * Linux stock. `null` means the stock could not be read: everything stays available, so
 * an OVH hiccup never empties the shop; the order path re-checks before buying.
 */
export function applyDatacenterStock(
  plan: SellablePlan,
  inStockCodes: ReadonlySet<string> | null,
): SellablePlan {
  if (inStockCodes === null) return plan
  const datacenters = plan.datacenters.map((dc) => {
    const code = DATACENTER_BY_SLUG.get(dc.slug)
    return { ...dc, available: code !== undefined && inStockCodes.has(code) }
  })
  return { ...plan, datacenters, available: datacenters.some((dc) => dc.available) }
}

// ─── operating systems ───────────────────────────────────────────────────────

export interface OsOption {
  slug: string
  /** Distribution name as the installer reports it — not an OVH plan code. */
  name: string
  family: string
  disabled: boolean
  note?: string
}

export interface OsGroup {
  family: string
  label: string
  options: readonly OsOption[]
}

interface OsFamilyRule {
  family: string
  label: string
  test: RegExp
}

const OS_FAMILY_RULES: readonly OsFamilyRule[] = [
  { family: "ubuntu", label: "Ubuntu", test: /^Ubuntu/i },
  { family: "debian", label: "Debian", test: /^Debian/i },
  { family: "almalinux", label: "AlmaLinux", test: /^AlmaLinux/i },
  { family: "rocky", label: "Rocky Linux", test: /^Rocky/i },
  { family: "fedora", label: "Fedora", test: /^Fedora/i },
  { family: "freebsd", label: "FreeBSD", test: /^FreeBSD/i },
  { family: "windows", label: "Windows Server", test: /^Windows/i },
  // Images with an application preinstalled ("Debian 12 - Docker"), shown last and kept
  // apart from the plain versions of their base distribution, as OVH does.
  { family: "apps", label: "Con aplicación", test: / - (docker|n8n)\b/i },
]

/** Images that carry a third-party licence we do not resell yet. */
const LICENSED_IMAGE = /cpanel|plesk|cloudlinux/i

/** Windows is out of MVP scope: listed so nobody asks, never selectable. */
const WINDOWS_NOTE = "disponible próximamente"

export function osSlug(name: string): string {
  return slugify(name)
}

export function groupOperatingSystems(plan: PlanCost): readonly OsGroup[] {
  const groups = new Map<string, OsOption[]>()

  for (const name of plan.operatingSystems) {
    if (LICENSED_IMAGE.test(name)) continue
    // An app image matches its base distribution too: the app rule wins.
    const rule =
      OS_FAMILY_RULES.find((candidate) => candidate.family === "apps" && candidate.test.test(name)) ??
      OS_FAMILY_RULES.find((candidate) => candidate.test.test(name))
    if (!rule) continue
    const isWindows = rule.family === "windows"
    const option: OsOption = {
      slug: osSlug(name),
      name,
      family: rule.family,
      disabled: isWindows,
      ...(isWindows ? { note: WINDOWS_NOTE } : {}),
    }
    const bucket = groups.get(rule.family)
    if (bucket) bucket.push(option)
    else groups.set(rule.family, [option])
  }

  return OS_FAMILY_RULES.filter((rule) => groups.has(rule.family)).map((rule) => ({
    family: rule.family,
    label: rule.label,
    options: (groups.get(rule.family) ?? []).sort((a, b) =>
      b.name.localeCompare(a.name, "es", { numeric: true }),
    ),
  }))
}

/** Newest image of the first preferred family available, so the default is a safe one. */
const OS_PREFERENCE: readonly string[] = ["ubuntu", "debian", "almalinux", "rocky"]

export function defaultOsFor(plan: PlanCost): OsOption | null {
  const groups = groupOperatingSystems(plan)
  for (const family of OS_PREFERENCE) {
    const group = groups.find((candidate) => candidate.family === family)
    const option = group?.options.find((candidate) => !candidate.disabled)
    if (option) return option
  }
  for (const group of groups) {
    const option = group.options.find((candidate) => !candidate.disabled)
    if (option) return option
  }
  return null
}

// ─── addons ──────────────────────────────────────────────────────────────────

export interface AddonOption {
  slug: string
  family: AddonFamily
  label: string
  /** Net price the customer pays per month, for each term. */
  monthlyPrice: Readonly<Record<Term, Cents>>
  /** True for the cheapest option of a mandatory family: it is already in the plan price. */
  included: boolean
  /** Exclusive families render as a single choice. Every OVH family is exclusive. */
  mandatoryFamily: boolean
  disabled: boolean
  note?: string
}

export interface AddonGroup {
  family: AddonFamily
  label: string
  hint: string
  mandatory: boolean
  options: readonly AddonOption[]
}

export function groupAddonsByFamily(options: readonly AddonOption[]): readonly AddonGroup[] {
  const groups = new Map<AddonFamily, AddonOption[]>()
  for (const option of options) {
    const bucket = groups.get(option.family)
    if (bucket) bucket.push(option)
    else groups.set(option.family, [option])
  }
  return ADDON_FAMILY_ORDER.filter((family) => groups.has(family)).map((family) => {
    const items = groups.get(family) ?? []
    return {
      family,
      label: ADDON_FAMILY_LABELS[family],
      hint: ADDON_FAMILY_HINTS[family],
      mandatory: items.some((option) => option.mandatoryFamily),
      options: items,
    }
  })
}

// ─── plan view model ─────────────────────────────────────────────────────────

export interface PlanSpecs {
  vcores: number
  ramGb: number
  nvmeGb: number
  bandwidthMbps: number
}

export interface TermPrice {
  /** Net price per month. */
  monthly: Cents
  /** Net price of one full billing cycle (1 or 12 months). */
  cycle: Cents
  months: number
}

export interface SellablePlan {
  /** "s" | "m" | "l" | "xl" — the only plan identifier the browser ever sees. */
  slug: string
  name: string
  specs: PlanSpecs
  price: Readonly<Record<Term, TermPrice>>
  /** Percent saved per month by paying for 12 months. */
  savingPercent: number
  /** Cents saved over a year by paying for 12 months. */
  savingPerYear: Cents
  datacenters: readonly PublicDatacenter[]
  osGroups: readonly OsGroup[]
  addons: readonly AddonGroup[]
  included: readonly string[]
  sort: number
  /** At least one sellable datacenter has stock for this plan. */
  available: boolean
}

/** Percent of the monthly price saved by committing to 12 months. 0 when there is none. */
export function annualSavingPercent(monthly: Cents, annualMonthly: Cents): number {
  if (monthly <= 0 || annualMonthly >= monthly) return 0
  return Math.round(((monthly - annualMonthly) / monthly) * 100)
}

function defaultDatacenterCode(plan: PlanCost): string {
  const sellable = SELLABLE_DATACENTERS.find((dc) => plan.datacenters.includes(dc.code))
  const code = sellable?.code ?? plan.datacenters[0]
  if (!code) throw new PresentationError(`plan ${plan.planCode} has no datacenter`)
  return code
}

/**
 * Baseline configuration a plan is advertised with: cheapest mandatory options only,
 * which is exactly what `buildQuote` resolves when no addon is requested.
 */
export function baselineRequest(plan: PlanCost, term: Term): QuoteRequest {
  const os = defaultOsFor(plan)
  if (!os) throw new PresentationError(`plan ${plan.planCode} has no sellable operating system`)
  return {
    planCode: plan.planCode,
    term,
    datacenter: defaultDatacenterCode(plan),
    operatingSystem: os.name,
  }
}

function addonOptionsFor(
  plan: PlanCost,
  catalog: ParsedCatalog,
  overrides: PricingOverrides,
  baseline: Readonly<Record<Term, Quote>>,
): readonly AddonOption[] {
  const includedCodes = new Set(
    TERMS.flatMap((term) => baseline[term].lines.map((line) => line.code)),
  )
  const byCode = new Map(catalog.addons.map((addon) => [addon.planCode, addon]))
  const options: AddonOption[] = []

  for (const codes of Object.values(plan.addonCodesByFamily)) {
    for (const code of codes ?? []) {
      const addon = byCode.get(code)
      if (!addon) continue
      const slug = addonSlug(addon)
      if (slug === null) continue

      // Price every option through the engine, in the configuration that selects it.
      const monthlyPrice = {} as Record<Term, Cents>
      let priced = true
      for (const term of TERMS) {
        const quote = quoteWithAddon(catalog, plan, term, code, overrides)
        const line = quote?.lines.find((candidate) => candidate.code === code)
        if (!line) {
          priced = false
          break
        }
        monthlyPrice[term] = line.monthlyPrice
      }
      if (!priced) continue

      const isWindows = slug === "windows"
      options.push({
        slug,
        family: addon.family,
        label: addonLabel(slug),
        monthlyPrice,
        included: includedCodes.has(code),
        mandatoryFamily: MANDATORY_FAMILIES.includes(addon.family),
        disabled: isWindows,
        ...(isWindows ? { note: WINDOWS_NOTE } : {}),
      })
    }
  }

  return options
}

function quoteWithAddon(
  catalog: ParsedCatalog,
  plan: PlanCost,
  term: Term,
  addonCode: string,
  overrides: PricingOverrides,
): Quote | null {
  try {
    return buildQuote(catalog, { ...baselineRequest(plan, term), addonCodes: [addonCode] }, overrides)
  } catch {
    // An option the engine refuses (unknown, or exclusive with a mandatory family) is not sold.
    return null
  }
}

/**
 * Everything the public pages need about one plan, priced by `buildQuote` for both terms.
 * `overrides` are the admin's margins and manual PVPs, straight from the database.
 */
export function toPlanViewModel(
  plan: PlanCost,
  catalog: ParsedCatalog,
  overrides: PricingOverrides = {},
): SellablePlan {
  const branding = PLAN_BRANDING[plan.planCode]
  if (!branding) throw new PresentationError(`plan ${plan.planCode} has no branding`)

  const baseline = {} as Record<Term, Quote>
  const price = {} as Record<Term, TermPrice>
  for (const term of TERMS) {
    const quote = buildQuote(catalog, baselineRequest(plan, term), overrides)
    baseline[term] = quote
    price[term] = {
      monthly: quote.monthlyPrice,
      cycle: quote.cycleNet,
      months: TERM_MONTHS[term],
    }
  }

  const sort = MVP_PLAN_CODES.indexOf(plan.planCode)

  return {
    slug: branding.slug,
    name: branding.name,
    specs: {
      vcores: branding.vcores,
      ramGb: branding.ramGb,
      nvmeGb: branding.nvmeGb,
      bandwidthMbps: branding.bandwidthMbps,
    },
    price,
    savingPercent: annualSavingPercent(price.P1M.monthly, price.P12M.monthly),
    savingPerYear: price.P1M.monthly * TERM_MONTHS.P12M - price.P12M.cycle,
    datacenters: datacentersFor(plan),
    osGroups: groupOperatingSystems(plan),
    addons: groupAddonsByFamily(addonOptionsFor(plan, catalog, overrides, baseline)),
    included: INCLUDED_FEATURES,
    sort: sort < 0 ? MVP_PLAN_CODES.length : sort,
    available: true,
  }
}

// ─── the shareable configuration ─────────────────────────────────────────────

/** The configuration as it travels in the URL and to the server action. Slugs only. */
export interface PublicConfig {
  plan: string
  dc: string
  os: string
  term: Term
  addons: readonly string[]
}

export type RawParams = Readonly<Record<string, string | readonly string[] | undefined>>

function firstValue(value: string | readonly string[] | undefined): string | undefined {
  if (value === undefined) return undefined
  return typeof value === "string" ? value : value[0]
}

export function parseTermParam(value: string | undefined): Term | null {
  if (!value) return null
  const normalised = value.trim().toLowerCase()
  if (normalised === TERM_PARAMS.P1M || normalised === "p1m") return "P1M"
  if (normalised === TERM_PARAMS.P12M || normalised === "p12m") return "P12M"
  return null
}

/**
 * Validate a raw query string against the published plans and fill every gap with a
 * default, so a hand-edited or stale link still renders a sellable configuration.
 */
export function resolveConfig(plans: readonly SellablePlan[], raw: RawParams): PublicConfig {
  if (plans.length === 0) throw new PresentationError("no sellable plans")
  const requested = firstValue(raw.plan)
  const plan =
    plans.find((candidate) => candidate.slug === requested) ??
    plans.find((candidate) => candidate.available) ??
    plans[0]

  // A datacenter without stock is never kept: fall back to the first one that has it.
  const dcSlug = firstValue(raw.dc)
  const inStock = plan.datacenters.filter((candidate) => candidate.available)
  const dc =
    inStock.find((candidate) => candidate.slug === dcSlug) ?? inStock[0] ?? plan.datacenters[0]

  const osSlugWanted = firstValue(raw.os)
  const osOptions = plan.osGroups.flatMap((group) => group.options).filter((o) => !o.disabled)
  const os = osOptions.find((candidate) => candidate.slug === osSlugWanted) ?? osOptions[0]

  const wanted = new Set(
    (firstValue(raw.addons) ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  )

  // One addon per family, mandatory families excluded unless the customer upgraded them.
  const addons: string[] = []
  for (const group of plan.addons) {
    const picked = group.options.find(
      (option) => wanted.has(option.slug) && !option.disabled && !option.included,
    )
    if (picked) addons.push(picked.slug)
  }

  return {
    plan: plan.slug,
    dc: dc?.slug ?? "",
    os: os?.slug ?? "",
    term: parseTermParam(firstValue(raw.term)) ?? "P1M",
    addons,
  }
}

/** The canonical query string for a configuration: same input, same link. */
export function encodeConfig(config: PublicConfig): string {
  const params = new URLSearchParams()
  params.set("plan", config.plan)
  if (config.dc) params.set("dc", config.dc)
  if (config.os) params.set("os", config.os)
  params.set("term", TERM_PARAMS[config.term])
  if (config.addons.length > 0) params.set("addons", [...config.addons].join(","))
  return params.toString()
}

/** Public slugs → the OVH vocabulary `buildQuote` expects. Server side only. */
export function toQuoteRequest(catalog: ParsedCatalog, config: PublicConfig): QuoteRequest {
  const planCode = planCodeForSlug(config.plan)
  const plan = planCode
    ? catalog.plans.find((candidate) => candidate.planCode === planCode)
    : undefined
  if (!plan) throw new PresentationError(`unknown plan: ${config.plan}`)

  const datacenter = datacenterCodeForSlug(config.dc)
  if (!datacenter || !plan.datacenters.includes(datacenter)) {
    throw new PresentationError(`unknown datacenter: ${config.dc}`)
  }

  const os = groupOperatingSystems(plan)
    .flatMap((group) => group.options)
    .find((option) => option.slug === config.os && !option.disabled)
  if (!os) throw new PresentationError(`unknown operating system: ${config.os}`)

  const byCode = new Map(catalog.addons.map((addon) => [addon.planCode, addon]))
  const available = Object.values(plan.addonCodesByFamily).flatMap((codes) => codes ?? [])
  const addonCodes: string[] = []
  for (const slug of config.addons) {
    const code = available.find((candidate) => {
      const addon = byCode.get(candidate)
      return addon ? addonSlug(addon) === slug : false
    })
    if (!code) throw new PresentationError(`unknown option: ${slug}`)
    addonCodes.push(code)
  }

  return { planCode: plan.planCode, term: config.term, datacenter, operatingSystem: os.name, addonCodes }
}

// ─── the customer-safe quote ─────────────────────────────────────────────────

export interface PublicQuoteLine {
  slug: string
  label: string
  family: AddonFamily | "plan"
  monthlyPrice: Cents
  cyclePrice: Cents
  mandatory: boolean
}

/**
 * A `Quote` carries our cost and OVH's own plan name, so it must never be serialised to
 * the browser. This is what the server action returns instead.
 */
export interface PublicQuote {
  plan: string
  planName: string
  term: Term
  months: number
  datacenter: string
  os: string
  lines: readonly PublicQuoteLine[]
  monthlyPrice: Cents
  cycleNet: Cents
  included: readonly string[]
}

export function toPublicQuote(
  quote: Quote,
  catalog: ParsedCatalog,
  config: PublicConfig,
): PublicQuote {
  const branding = PLAN_BRANDING[quote.planCode]
  if (!branding) throw new PresentationError(`plan ${quote.planCode} has no branding`)
  const byCode = new Map(catalog.addons.map((addon) => [addon.planCode, addon]))

  const lines: PublicQuoteLine[] = []
  for (const line of quote.lines) {
    if (line.kind === "plan") {
      lines.push({
        slug: branding.slug,
        label: branding.name,
        family: "plan",
        monthlyPrice: line.monthlyPrice,
        cyclePrice: line.cyclePrice,
        mandatory: true,
      })
      continue
    }
    const addon = byCode.get(line.code)
    const slug = addon ? addonSlug(addon) : null
    if (!addon || slug === null) continue
    lines.push({
      slug,
      label: addonLabel(slug),
      family: addon.family,
      monthlyPrice: line.monthlyPrice,
      cyclePrice: line.cyclePrice,
      mandatory: line.mandatory,
    })
  }

  const datacenter = datacenterLabel(datacenterCodeForSlug(config.dc) ?? "")
  const plan = catalog.plans.find((candidate) => candidate.planCode === quote.planCode)
  const os = plan
    ? groupOperatingSystems(plan)
        .flatMap((group) => group.options)
        .find((option) => option.slug === config.os)
    : undefined

  return {
    plan: branding.slug,
    planName: branding.name,
    term: quote.term,
    months: quote.months,
    datacenter: datacenter ?? "",
    os: os?.name ?? "",
    lines,
    monthlyPrice: quote.monthlyPrice,
    cycleNet: quote.cycleNet,
    included: INCLUDED_FEATURES,
  }
}
