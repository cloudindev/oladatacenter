/**
 * The margin floor, and the five feature flags the panel owns.
 *
 * `featureFlags` has no value column (key / enabled / description), and `packages/db` is
 * owned by another module, so the floor is stored as the decimal basis-point figure in
 * the `description` of the `margin_floor` row — `"3000"` means 30 %. `enabled` says
 * whether the check is on at all. The encoding is strict on read: anything that is not
 * one to five digits falls back to the default rather than silently accepting a floor of
 * zero, which would switch the warning off without anyone noticing.
 */
import { DEFAULT_MARGIN_FLOOR_BP, MARGIN_FLOOR_FLAG, basisPointsToRatio } from "./pricing"
import type { AdminStore, FlagRow } from "./store"

const BASIS_POINTS = /^\d{1,5}$/

export interface MarginFloor {
  basisPoints: number
  ratio: number
  /** False when the row is missing or disabled: the default is in force. */
  configured: boolean
  enforced: boolean
}

export function parseMarginFloor(description: string | null): number | null {
  const trimmed = description?.trim() ?? ""
  if (!BASIS_POINTS.test(trimmed)) return null
  const value = Number(trimmed)
  return value <= 10_000 ? value : null
}

/**
 * `fallbackBasisPoints` is `CATALOG_MARGIN_FLOOR` from the environment, so an operator who
 * has never touched the flag sees the same threshold the catalog sync job alerts on.
 */
export function marginFloorFrom(
  row: FlagRow | null,
  fallbackBasisPoints = DEFAULT_MARGIN_FLOOR_BP,
): MarginFloor {
  const parsed = row ? parseMarginFloor(row.description) : null
  const basisPoints = parsed ?? fallbackBasisPoints
  return {
    basisPoints,
    ratio: basisPointsToRatio(basisPoints),
    configured: parsed !== null,
    enforced: row?.enabled ?? true,
  }
}

export async function readMarginFloor(
  store: AdminStore,
  fallbackBasisPoints = DEFAULT_MARGIN_FLOOR_BP,
): Promise<MarginFloor> {
  return marginFloorFrom(await store.getFlag(MARGIN_FLOOR_FLAG), fallbackBasisPoints)
}

export async function writeMarginFloor(
  store: AdminStore,
  basisPoints: number,
  enforced: boolean,
): Promise<void> {
  await store.setFlag(MARGIN_FLOOR_FLAG, enforced, String(Math.round(basisPoints)))
}

// ─── the operational flags ───────────────────────────────────────────────────

export const ADMIN_FLAG_KEYS = [
  "welcome_credit",
  "new_signups",
  "ovh_orders",
  "windows",
  "local_zone",
] as const
export type AdminFlagKey = (typeof ADMIN_FLAG_KEYS)[number]

export function isAdminFlagKey(value: string): value is AdminFlagKey {
  return (ADMIN_FLAG_KEYS as readonly string[]).includes(value)
}

export interface FlagDefinition {
  key: AdminFlagKey
  label: string
  /** What flipping it off actually stops. The confirmation repeats this sentence. */
  consequence: string
  /** True when an environment variable, not this row, has the last word. */
  envBacked: boolean
}

export const FLAG_DEFINITIONS: readonly FlagDefinition[] = [
  {
    key: "welcome_credit",
    label: "Crédito de bienvenida",
    consequence: "deja de concederse crédito a las cuentas nuevas verificadas",
    envBacked: false,
  },
  {
    key: "new_signups",
    label: "Registro de clientes",
    consequence: "nadie puede crear una cuenta nueva",
    envBacked: false,
  },
  {
    key: "ovh_orders",
    label: "Pedidos reales a OVH",
    consequence: "ningún pedido llega a OVH y el aprovisionamiento se detiene",
    envBacked: true,
  },
  {
    key: "windows",
    label: "Imágenes de Windows",
    consequence: "Windows deja de poder seleccionarse en el configurador",
    envBacked: false,
  },
  {
    key: "local_zone",
    label: "Local Zone",
    consequence: "los datacenters de Local Zone dejan de ofrecerse",
    envBacked: false,
  },
]

export interface FlagView extends FlagDefinition {
  /** The stored row, or `null` when the flag has never been written. */
  row: FlagRow | null
  /** The value of the row, defaulting to off when there is no row. */
  storedEnabled: boolean
  /** The environment kill switch, for `ovh_orders` only. */
  envEnabled: boolean | null
  /** What is actually in force right now. */
  effective: boolean
  /** Which switch is holding the brake. `"ninguno"` means the feature is live. */
  blockedBy: "entorno" | "base de datos" | "ambos" | "ninguno"
}

/**
 * `ovh_orders` mirrors `OVH_ORDERS_ENABLED`, and the environment is the authority:
 * `assertOvhOrdersEnabled()` in `src/server/providers.ts` reads the variable and nothing
 * else, so flipping the row on cannot enable real orders. The view says so explicitly
 * instead of leaving the operator to guess.
 */
export function flagViews(
  rows: readonly FlagRow[],
  ovhOrdersEnabledInEnv: boolean,
): readonly FlagView[] {
  const byKey = new Map(rows.map((row) => [row.key, row]))

  return FLAG_DEFINITIONS.map((definition) => {
    const row = byKey.get(definition.key) ?? null
    const storedEnabled = row?.enabled ?? false
    const envEnabled = definition.envBacked ? ovhOrdersEnabledInEnv : null

    const effective = envEnabled === null ? storedEnabled : envEnabled && storedEnabled

    let blockedBy: FlagView["blockedBy"]
    if (envEnabled === null) blockedBy = storedEnabled ? "ninguno" : "base de datos"
    else if (!envEnabled && !storedEnabled) blockedBy = "ambos"
    else if (!envEnabled) blockedBy = "entorno"
    else if (!storedEnabled) blockedBy = "base de datos"
    else blockedBy = "ninguno"

    return { ...definition, row, storedEnabled, envEnabled, effective, blockedBy }
  })
}
