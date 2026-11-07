/**
 * The customer area's navigation, OVH style: a few top-level universes, each with its
 * own side menu. Pure data plus the rule that maps a path to its universe, so the header
 * and the side menu can never disagree about where the customer is.
 */

export type UniverseKey = "home" | "bare-metal" | "web-cloud"

export interface NavItem {
  href: string
  label: string
  /** Name of the lucide icon rendered next to the label. */
  icon:
    | "home"
    | "receipt"
    | "cart"
    | "wallet"
    | "card"
    | "user"
    | "lifebuoy"
    | "server"
    | "key"
    | "globe"
    | "mail"
    | "hard-drive"
  /** Other path prefixes that also mark this item as current. */
  alsoActiveOn?: readonly string[]
  /** Shown but not clickable yet. */
  soon?: boolean
}

export interface Universe {
  key: UniverseKey
  label: string
  href: string
  items: readonly NavItem[]
}

export const UNIVERSES: readonly Universe[] = [
  {
    key: "home",
    label: "Inicio",
    href: "/app",
    items: [
      { href: "/app", label: "Inicio", icon: "home" },
      { href: "/app/billing", label: "Mis facturas", icon: "receipt" },
      { href: "/app/pedidos", label: "Mis pedidos", icon: "cart", alsoActiveOn: ["/app/servers/new"] },
      { href: "/app/billing/saldo", label: "Mi saldo", icon: "wallet" },
      { href: "/app/billing/metodos-de-pago", label: "Mis formas de pago", icon: "card" },
      { href: "/app/account", label: "Mi cuenta", icon: "user" },
      { href: "/contact", label: "Soporte", icon: "lifebuoy" },
    ],
  },
  {
    key: "bare-metal",
    label: "Bare Metal Cloud",
    href: "/app/bare-metal/vps",
    items: [
      { href: "/app/bare-metal/vps", label: "VPS", icon: "server", alsoActiveOn: ["/app/servers/"] },
      { href: "/app/bare-metal/licencias", label: "Licencias", icon: "key" },
    ],
  },
  {
    key: "web-cloud",
    label: "Web Cloud",
    href: "/app/web-cloud",
    items: [
      { href: "/app/web-cloud", label: "Alojamiento web", icon: "hard-drive", soon: true },
      { href: "/app/web-cloud", label: "Dominios", icon: "globe", soon: true },
      { href: "/app/web-cloud", label: "Correo", icon: "mail", soon: true },
    ],
  },
]

/** Which universe a path belongs to. Anything unknown under /app is "home". */
export function universeOf(pathname: string): UniverseKey {
  if (pathname.startsWith("/app/bare-metal") || /^\/app\/servers\/(?!new)/.test(pathname)) {
    return "bare-metal"
  }
  if (pathname.startsWith("/app/web-cloud")) return "web-cloud"
  return "home"
}

/** Exact match for the root of a universe, prefix match (on a segment) for the rest. */
export function isItemActive(item: NavItem, pathname: string): boolean {
  if (item.soon) return false
  const matches = (href: string) =>
    href === "/app" || href === "/app/billing"
      ? pathname === href
      : pathname === href || pathname.startsWith(href.endsWith("/") ? href : `${href}/`)
  return matches(item.href) || (item.alsoActiveOn ?? []).some((prefix) => pathname.startsWith(prefix))
}
