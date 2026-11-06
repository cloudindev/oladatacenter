"use client"

/**
 * Datacenter step. Only datacenters where OVH has stock for this plan right now are
 * offered; the label is always the city and the country, never an OVH code.
 */
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
  const available = datacenters.filter((dc) => dc.available)

  if (available.length === 0) {
    return (
      <p className="rounded-[14px] border border-dashed border-bg-dark/20 px-4 py-5 text-[14px] text-text-muted">
        Ahora mismo no queda stock de este plan en ninguno de nuestros centros de datos en Europa.
        Elige otro plan o vuelve a intentarlo en unas horas: la disponibilidad se repone a
        menudo.
      </p>
    )
  }

  return (
    <div
      role="radiogroup"
      aria-label="Centro de datos"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      {available.map((dc) => (
        <ChoiceRadio
          key={dc.slug}
          name="dc"
          value={dc.slug}
          checked={value === dc.slug}
          onSelect={onChange}
          caption={dc.country}
          title={dc.city}
          note="Disponible ahora"
        />
      ))}
    </div>
  )
}
