"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

/** The three sections of the customer area. */
const SECTIONS: readonly { href: string; label: string }[] = [
  { href: "/app", label: "Servidores" },
  { href: "/app/billing", label: "Facturación" },
  { href: "/app/account", label: "Cuenta" },
]

export function AppNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Secciones del panel">
      <ul className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SECTIONS.map((section) => {
          const active =
            section.href === "/app"
              ? pathname === "/app" || pathname.startsWith("/app/servers")
              : pathname === section.href || pathname.startsWith(`${section.href}/`)
          return (
            <li key={section.href} className="shrink-0">
              <Link
                href={section.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "label-mono inline-flex items-center h-10 px-3 rounded-t-lg border-b-2 transition-colors",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink",
                  active
                    ? "border-accent-ink text-text-base"
                    : "border-transparent text-text-muted hover:text-text-base",
                )}
              >
                {section.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
