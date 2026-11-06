"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

/**
 * Tabs of one server. Each tab is its own route segment, so this is navigation, not a
 * widget: links with `aria-current`, horizontally scrollable at 360 px.
 */

const TABS: readonly { segment: string; label: string }[] = [
  { segment: "", label: "Resumen" },
  { segment: "consola", label: "Consola" },
  { segment: "reinstalar", label: "Reinstalar" },
  { segment: "rescate", label: "Rescate" },
  { segment: "snapshots", label: "Snapshots" },
  { segment: "backups", label: "Backups" },
  { segment: "red", label: "Red" },
  { segment: "plan", label: "Plan" },
  { segment: "actividad", label: "Actividad" },
]

export function TabBar({ serviceId }: { serviceId: string }) {
  const pathname = usePathname()
  const base = `/app/servers/${serviceId}`

  return (
    <nav aria-label="Secciones del servidor" className="border-b border-border-base">
      <ul className="flex gap-1 overflow-x-auto -mb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((tab) => {
          const href = tab.segment ? `${base}/${tab.segment}` : base
          const active = tab.segment
            ? pathname === href || pathname.startsWith(`${href}/`)
            : pathname === base
          return (
            <li key={tab.segment || "resumen"} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "label-mono inline-flex items-center h-11 px-3 border-b-2 transition-colors",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink",
                  active
                    ? "border-accent-ink text-text-base"
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
