"use client"

/**
 * Operating system step, grouped by distribution family as the catalog publishes them.
 * Windows is listed so nobody has to ask, but it is out of scope for now and disabled.
 */
import type { OsGroup } from "@ola/core"
import { ChoiceRadio } from "./Choice"

export function OsPicker({
  groups,
  value,
  onChange,
}: {
  groups: readonly OsGroup[]
  value: string
  onChange: (slug: string) => void
}) {
  return (
    <div role="radiogroup" aria-label="Sistema operativo" className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.family}>
          <h3 className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.06em] text-text-muted">
            {group.label}
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.options.map((option) => (
              <ChoiceRadio
                key={option.slug}
                name="os"
                value={option.slug}
                checked={value === option.slug}
                onSelect={onChange}
                disabled={option.disabled}
                title={option.name}
                {...(option.note ? { note: option.note } : {})}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
