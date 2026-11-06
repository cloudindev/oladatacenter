"use client"

/**
 * Operating system step: one card per distribution, with the version chosen in a select
 * inside the card — the way OVH's own funnel presents it. Picking a card selects the
 * version last shown in its select (the newest by default).
 *
 * Windows is listed so nobody has to ask, but it is out of scope for now and disabled.
 */
import { useState } from "react"
import type { OsGroup, OsOption } from "@ola/core"
import { cn } from "@/lib/utils"
import { OS_LOGOS } from "./os-logos"

/** Small brand mark for a distribution; a neutral server glyph when there is none. */
function OsLogo({ family }: { family: string }) {
  const logo = OS_LOGOS[family]
  if (!logo) {
    return (
      <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="3" y="4" width="18" height="12" rx="1.5" />
        <path d="M8 20h8M12 16v4" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden fill={logo.hex}>
      <path d={logo.path} />
    </svg>
  )
}

/** "Ubuntu 26.04" → "26.04"; falls back to the full name when there is no prefix. */
function versionLabel(option: OsOption, group: OsGroup): string {
  const prefix = new RegExp(`^${group.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "i")
  const stripped = option.name.replace(prefix, "").replace(/^[-_\s]+/, "").trim()
  return stripped.length > 0 ? stripped : option.name
}

export function OsPicker({
  groups,
  value,
  onChange,
}: {
  groups: readonly OsGroup[]
  value: string
  onChange: (slug: string) => void
}) {
  // The version each card shows when it is not the selected one.
  const [shown, setShown] = useState<Record<string, string>>({})

  return (
    <div
      role="radiogroup"
      aria-label="Sistema operativo"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      {groups.map((group) => {
        const options = group.options.filter((option) => !option.disabled)
        const disabled = options.length === 0
        const selectedHere = options.find((option) => option.slug === value)
        const current =
          selectedHere ??
          options.find((option) => option.slug === shown[group.family]) ??
          options[0] ??
          group.options[0]
        if (!current) return null
        const checked = selectedHere !== undefined

        return (
          <div
            key={group.family}
            className={cn(
              "flex flex-col gap-3 rounded-[14px] border p-4 transition-colors",
              checked
                ? "border-primary-hover bg-primary text-bg-dark"
                : "border-bg-dark/12 bg-surface-light hover:border-bg-dark/35",
              disabled && "cursor-not-allowed border-dashed opacity-50 hover:border-bg-dark/12",
            )}
          >
            <label
              className={cn(
                "flex items-center gap-3",
                disabled ? "cursor-not-allowed" : "cursor-pointer",
              )}
            >
              <input
                type="radio"
                name="os-family"
                value={group.family}
                checked={checked}
                disabled={disabled}
                onChange={() => onChange(current.slug)}
                className="size-4 accent-bg-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink"
              />
              <OsLogo family={group.family} />
              <span className="text-[15px] leading-snug">{group.label}</span>
            </label>

            <select
              aria-label={`Versión de ${group.label}`}
              value={current.slug}
              disabled={disabled}
              onChange={(event) => {
                const slug = event.target.value
                setShown((previous) => ({ ...previous, [group.family]: slug }))
                onChange(slug)
              }}
              className="h-10 w-full rounded-lg border border-bg-dark/15 bg-surface-light px-3 text-[14px] text-text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink disabled:cursor-not-allowed"
            >
              {(disabled ? group.options : options).map((option) => (
                <option key={option.slug} value={option.slug}>
                  Versión {versionLabel(option, group)}
                </option>
              ))}
            </select>

            <span className="font-mono text-[10px] uppercase tracking-[0.06em] opacity-70">
              {disabled ? (group.options[0]?.note ?? "No disponible") : "Incluido"}
            </span>
          </div>
        )
      })}
    </div>
  )
}
