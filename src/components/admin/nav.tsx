"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export interface AdminNavItem {
  href: string
  label: string
}

export const ADMIN_NAV: readonly AdminNavItem[] = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/planes", label: "Planes" },
  { href: "/admin/catalogo", label: "Catálogo" },
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/servicios", label: "Servicios" },
  { href: "/admin/clientes", label: "Clientes" },
  { href: "/admin/pagos", label: "Pagos" },
  { href: "/admin/flags", label: "Flags" },
  { href: "/admin/auditoria", label: "Auditoría" },
]

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin"
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AdminNav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Secciones del panel interno" className="overflow-x-auto">
      <ul className="flex items-center gap-1">
        {ADMIN_NAV.map((item) => {
          const active = isActive(pathname, item.href)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "label-mono inline-flex h-9 items-center rounded-md px-3 whitespace-nowrap transition-colors",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                  active
                    ? "bg-primary text-bg-dark"
                    : "text-text-sage hover:bg-surface-dark hover:text-text-dark",
                )}
              >
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
