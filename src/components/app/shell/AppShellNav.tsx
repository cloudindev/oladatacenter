"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CreditCard,
  Globe,
  HardDrive,
  House,
  KeyRound,
  LifeBuoy,
  Mail,
  Receipt,
  Server,
  ShoppingCart,
  User,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { UNIVERSES, isItemActive, universeOf, type NavItem } from "./nav-model"

const ICONS: Record<NavItem["icon"], LucideIcon> = {
  home: House,
  receipt: Receipt,
  cart: ShoppingCart,
  wallet: Wallet,
  card: CreditCard,
  user: User,
  lifebuoy: LifeBuoy,
  server: Server,
  key: KeyRound,
  globe: Globe,
  mail: Mail,
  "hard-drive": HardDrive,
}

const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink"

/** Top-level universes: Inicio, Bare Metal Cloud, Web Cloud. */
export function UniverseTabs() {
  const pathname = usePathname()
  const current = universeOf(pathname)
  return (
    <nav aria-label="Secciones del panel">
      <ul className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {UNIVERSES.map((universe) => {
          const active = universe.key === current
          return (
            <li key={universe.key} className="shrink-0">
              <Link
                href={universe.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center h-9 px-3.5 rounded-lg text-sm transition-colors",
                  FOCUS,
                  active
                    ? "bg-surface-beige text-text-base font-medium"
                    : "text-text-muted hover:text-text-base hover:bg-surface-beige/60",
                )}
              >
                {universe.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/**
 * The side menu of the current universe. On small screens it becomes a horizontal strip
 * above the content.
 */
export function SideMenu() {
  const pathname = usePathname()
  const universe = UNIVERSES.find((candidate) => candidate.key === universeOf(pathname))
  if (!universe) return null

  return (
    <nav aria-label={`Menú de ${universe.label}`}>
      <p className="label-mono text-text-muted mb-3 hidden lg:block">{universe.label}</p>
      <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {universe.items.map((item) => {
          const Icon = ICONS[item.icon]
          const active = isItemActive(item, pathname)
          const body = (
            <>
              <Icon aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.7} />
              <span className="whitespace-nowrap">{item.label}</span>
              {item.soon ? (
                <span className="label-mono ml-auto rounded bg-surface-beige px-1.5 py-0.5 text-[10px] text-text-muted">
                  Pronto
                </span>
              ) : null}
            </>
          )
          const classes = cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
            item.soon
              ? "text-text-muted/70 cursor-default"
              : active
                ? "bg-surface-beige text-text-base font-medium"
                : "text-text-muted hover:text-text-base hover:bg-surface-beige/60",
          )
          return (
            <li key={`${item.label}-${item.href}`} className="shrink-0">
              {item.soon ? (
                <span className={classes} aria-disabled="true">
                  {body}
                </span>
              ) : (
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(classes, FOCUS)}
                >
                  {body}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
