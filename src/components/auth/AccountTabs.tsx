"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

/**
 * Section nav for the account area. A Client Component only because the active tab
 * depends on the current path.
 */

const TABS = [
  { href: "/app/account", label: "Perfil" },
  { href: "/app/account/seguridad", label: "Seguridad" },
  { href: "/app/account/claves-ssh", label: "Claves SSH" },
  { href: "/app/account/cerrar-cuenta", label: "Cerrar cuenta" },
] as const

export function AccountTabs() {
  const pathname = usePathname()
  return (
    <nav aria-label="Secciones de la cuenta" className="border-b border-border-base mb-8">
      <ul className="flex flex-wrap gap-x-6 gap-y-2 -mb-px">
        {TABS.map((tab) => {
          const active = pathname === tab.href
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "label-mono inline-block py-3 border-b-2 transition-colors",
                  active
                    ? "border-text-base text-text-base"
                    : "border-transparent text-text-muted hover:text-text-base",
                )}
              >
                {tab.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
