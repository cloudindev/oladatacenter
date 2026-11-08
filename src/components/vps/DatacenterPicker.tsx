"use client"

/**
 * Datacenter step. Every location is shown with its country's flag, in Europe or
 * elsewhere, so the customer always sees where we are; only the ones where OVH has stock
 * for this plan right now can be chosen. The label is the city and the country, never an
 * OVH code.
 */
import type { PublicDatacenter } from "@ola/core"
import { ChoiceRadio } from "./Choice"
import { CountryFlag } from "./CountryFlag"

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
  const europeHasStock = available.some((dc) => dc.region === "europe")

  return (
    <div className="flex flex-col gap-4">
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
            checked={dc.available && value === dc.slug}
            onSelect={onChange}
            disabled={!dc.available}
            caption={
              <>
                <CountryFlag code={dc.countryCode} />
                {dc.region === "europe" ? `Europa · ${dc.country}` : dc.country}
              </>
            }
            title={dc.city}
            note={
              !dc.available
                ? "Sin stock ahora"
                : dc.region === "europe"
                  ? "Disponible ahora"
                  : "Disponible ahora · fuera de la Unión Europea"
            }
            className={dc.available ? undefined : "opacity-80"}
          />
        ))}
      </div>

      {available.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-bg-dark/20 px-4 py-5 text-[14px] text-text-muted">
          Ahora mismo no queda stock de este plan en ninguno de nuestros centros de datos. Elige
          otro plan o vuelve a intentarlo en unas horas: la disponibilidad se repone a menudo.
        </p>
      ) : europeHasStock ? null : (
        <p className="rounded-[14px] border border-dashed border-bg-dark/20 px-4 py-5 text-[14px] text-text-muted">
          Ahora mismo no queda stock de este plan en Europa. Puedes elegir uno de los centros
          disponibles, otro plan o volver a intentarlo en unas horas.
        </p>
      )}
    </div>
  )
}
