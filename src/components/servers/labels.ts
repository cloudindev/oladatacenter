import type { StatusTone } from "@/components/app/ui"
import type { ActionStatusName } from "./types"

/**
 * Spanish copy for everything the server area renders, in one place so the server
 * pages and the client components cannot drift apart.
 *
 * Dates are always formatted in `Europe/Madrid` and `es-ES`, which keeps the server
 * render and the client render identical and avoids a hydration mismatch.
 */

const DATE_ZONE = "Europe/Madrid"

export function formatDate(date: Date | null): string {
  if (!date) return "—"
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: DATE_ZONE,
  }).format(date)
}

export function formatDateTime(date: Date | null): string {
  if (!date) return "—"
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: DATE_ZONE,
  }).format(date)
}

// ─── operations ──────────────────────────────────────────────────────────────

const ACTION_LABELS: Readonly<Record<string, string>> = {
  start: "Encender",
  stop: "Apagar",
  reboot: "Reiniciar",
  reinstall: "Reinstalar",
  rescue_on: "Activar modo rescate",
  rescue_off: "Desactivar modo rescate",
  console: "Abrir consola",
  snapshot_create: "Crear snapshot",
  snapshot_revert: "Revertir snapshot",
  snapshot_delete: "Eliminar snapshot",
  backup_restore: "Restaurar backup",
  rdns_set: "Cambiar rDNS",
  firewall_rule_add: "Añadir regla de firewall",
  firewall_rule_delete: "Eliminar regla de firewall",
  upgrade: "Cambiar de plan",
  addon_add: "Añadir servicio",
  rename: "Cambiar el nombre",
  auto_renew: "Cambiar la renovación",
}

/** Accepts both `actions.type` and the `service.<action>` form used in the audit log. */
export function actionLabel(type: string): string {
  const key = type.startsWith("service.") ? type.slice("service.".length) : type
  return ACTION_LABELS[key] ?? key
}

export const ACTION_STATUS_UI: Readonly<
  Record<ActionStatusName, { label: string; tone: StatusTone }>
> = {
  queued: { label: "En cola", tone: "busy" },
  running: { label: "En curso", tone: "busy" },
  done: { label: "Completada", tone: "ok" },
  error: { label: "Con error", tone: "danger" },
}

export const ACTOR_LABELS: Readonly<Record<string, string>> = {
  user: "Tú",
  admin: "Soporte de OLA",
  system: "Automático",
  webhook: "Automático",
}

// ─── provider power state ────────────────────────────────────────────────────

/** `vps.VpsStateEnum`, as the customer reads it. */
export const VPS_STATE_UI: Readonly<Record<string, { label: string; tone: StatusTone }>> = {
  running: { label: "En marcha", tone: "ok" },
  stopped: { label: "Apagado", tone: "neutral" },
  stopping: { label: "Apagándose", tone: "busy" },
  rebooting: { label: "Reiniciándose", tone: "busy" },
  installing: { label: "Instalando", tone: "busy" },
  rescued: { label: "En modo rescate", tone: "warn" },
  backuping: { label: "Copiando datos", tone: "busy" },
  maintenance: { label: "En mantenimiento", tone: "warn" },
  upgrading: { label: "Ampliando", tone: "busy" },
}

export function vpsStateUi(state: string): { label: string; tone: StatusTone } {
  return VPS_STATE_UI[state] ?? { label: "Estado desconocido", tone: "neutral" }
}

// ─── images ──────────────────────────────────────────────────────────────────

const IMAGE_FAMILIES: readonly { match: RegExp; label: string }[] = [
  { match: /debian/i, label: "Debian" },
  { match: /ubuntu/i, label: "Ubuntu" },
  { match: /alma/i, label: "AlmaLinux" },
  { match: /rocky/i, label: "Rocky Linux" },
  { match: /centos/i, label: "CentOS" },
  { match: /fedora/i, label: "Fedora" },
  { match: /arch/i, label: "Arch Linux" },
  { match: /alpine/i, label: "Alpine" },
  { match: /windows|win-?(server|20)/i, label: "Windows Server" },
  { match: /plesk/i, label: "Con Plesk" },
  { match: /cpanel/i, label: "Con cPanel" },
  { match: /docker|cloud-?init|kubernetes/i, label: "Preparadas para contenedores" },
]

/**
 * `GET /vps/{serviceName}/images/available` returns ids only — the provider gives no
 * display name and the per-image route is not available (docs/ovh-api-verified.md).
 * So the id is tidied up when it looks like a slug, and shown verbatim otherwise.
 */
export function formatImageId(imageId: string): string {
  const cleaned = imageId.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim()
  if (!cleaned) return imageId
  if (/[a-z]/.test(cleaned) && cleaned === cleaned.toLowerCase()) {
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
  }
  return cleaned
}

export function imageFamily(imageId: string): string {
  return IMAGE_FAMILIES.find((family) => family.match.test(imageId))?.label ?? "Otras"
}

/** Images grouped by family, families in a stable order, ids sorted inside each. */
export function groupImages(
  imageIds: readonly string[],
): readonly { family: string; images: readonly string[] }[] {
  const groups = new Map<string, string[]>()
  for (const imageId of imageIds) {
    const family = imageFamily(imageId)
    const bucket = groups.get(family)
    if (bucket) bucket.push(imageId)
    else groups.set(family, [imageId])
  }
  const order = [...IMAGE_FAMILIES.map((family) => family.label), "Otras"]
  return [...groups.entries()]
    .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([family, images]) => ({
      family,
      images: [...images].sort((a, b) => a.localeCompare(b, "es")),
    }))
}

// ─── firewall ────────────────────────────────────────────────────────────────

export const FIREWALL_PROTOCOL_OPTIONS = [
  { value: "tcp", label: "TCP" },
  { value: "udp", label: "UDP" },
  { value: "icmp", label: "ICMP (ping)" },
  { value: "gre", label: "GRE" },
  { value: "esp", label: "ESP" },
  { value: "ah", label: "AH" },
  { value: "ipv4", label: "IPv4" },
] as const

export type FirewallProtocolValue = (typeof FIREWALL_PROTOCOL_OPTIONS)[number]["value"]

export const FIREWALL_ACTION_OPTIONS = [
  { value: "permit", label: "Permitir" },
  { value: "deny", label: "Bloquear" },
] as const

export type FirewallActionValue = (typeof FIREWALL_ACTION_OPTIONS)[number]["value"]

// ─── misc ────────────────────────────────────────────────────────────────────

export const TERM_LABEL: Readonly<Record<string, string>> = {
  P1M: "Mensual",
  P12M: "Anual",
}

/**
 * The payment warning for one server, from its dunning stage. `null` when there is
 * nothing to warn about. Billing itself is owned by another module: this only reads the
 * state the dunning job writes.
 */
export function dunningWarning(
  dunningStage: string,
  status: string,
): { tone: "warn" | "danger"; title: string; body: string } | null {
  if (status === "suspended") {
    return {
      tone: "danger",
      title: "Servidor suspendido por impago",
      body: "En cuanto se cobre la factura pendiente lo volvemos a encender. Tus datos siguen ahí.",
    }
  }
  switch (dunningStage) {
    case "invoiced":
    case "charging":
      return {
        tone: "warn",
        title: "Hay una factura pendiente",
        body: "Estamos intentando cobrarla con tu método de pago habitual.",
      }
    case "retry_1":
    case "retry_2":
      return {
        tone: "warn",
        title: "No hemos podido cobrar la renovación",
        body: "Revisa tu método de pago para que el servidor no se suspenda.",
      }
    case "terminating":
      return {
        tone: "danger",
        title: "El servidor está a punto de darse de baja",
        body: "Paga la factura pendiente hoy para conservarlo.",
      }
    default:
      return null
  }
}

export function specsLine(specs: {
  vcores: number
  ramGb: number
  nvmeGb: number
}): string {
  return `${specs.vcores} vCore · ${specs.ramGb} GB RAM · ${specs.nvmeGb} GB NVMe`
}
