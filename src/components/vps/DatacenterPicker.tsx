"use client"

/** Datacenter step. The label is always the city and the country, never an OVH code. */
import type { PublicDatacenter } from "@ola/core"
import { ChoiceRadio } from "./Choice"

export function DatacenterPicker({
  datacenters,
  value,
  onChange,
}: {
  datacenters: readonly PublicDatacenter[]
  value: string
  onChange: (slug: string) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Centro de datos"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      {datacenters.map((dc) => (
        <ChoiceRadio
          key={dc.slug}
          name="dc"
          value={dc.slug}
          checked={value === dc.slug}
          onSelect={onChange}
          caption={dc.country}
          title={dc.city}
          note="Tus datos no salen de este centro"
        />
      ))}
    </div>
  )
}
