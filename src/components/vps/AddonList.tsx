"use client"

/**
 * Options step. One block per addon family, and every OVH family is exclusive: a family
 * with several options renders as a radio group, a single optional one as a checkbox.
 *
 * `os` and `storage` are not shown: the image is the previous step and the system disk is
 * part of the plan. cPanel is out of scope and never reaches the view model.
 */
import { formatCents, type AddonGroup, type Term } from "@ola/core"
import { ChoiceCheckbox, ChoiceRadio } from "./Choice"

const VISIBLE_FAMILIES: readonly string[] = [
  "automatedBackup",
  "snapshot",
  "additionalDisk",
  "plesk",
]

const NONE = "ninguno"

/**
 * What the option adds to the price already shown. For a mandatory family the cheapest
 * option is inside the plan price, so the upgrade is quoted as the difference.
 */
function priceCaption(cents: number, baseline: number, included: boolean): string {
  if (included) return "Incluido"
  return `+ ${formatCents(Math.max(0, cents - baseline))} / mes`
}

export function AddonList({
  groups,
  selected,
  term,
  onChange,
}: {
  groups: readonly AddonGroup[]
  selected: readonly string[]
  term: Term
  /** The next selection for the whole configurator: one addon per family at most. */
  onChange: (slugs: string[]) => void
}) {
  const visible = groups.filter((group) => VISIBLE_FAMILIES.includes(group.family))

  function replaceInFamily(group: AddonGroup, slug: string | null): void {
    const familySlugs = new Set(group.options.map((option) => option.slug))
    const kept = selected.filter((candidate) => !familySlugs.has(candidate))
    onChange(slug === null ? kept : [...kept, slug])
  }

  return (
    <div className="flex flex-col gap-8">
      {visible.map((group) => {
        const options = group.options.filter((option) => !option.disabled)
        if (options.length === 0) return null
        const chosen = options.find((option) => selected.includes(option.slug))
        const isCheckbox = options.length === 1 && !group.mandatory
        const baseline = options.find((option) => option.included)?.monthlyPrice[term] ?? 0

        return (
          <fieldset key={group.family}>
            <legend className="mb-1 text-[16px]">{group.label}</legend>
            <p className="mb-3 text-[13px] text-text-muted">{group.hint}</p>

            {isCheckbox ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {options.map((option) => (
                  <ChoiceCheckbox
                    key={option.slug}
                    name={`addon-${group.family}`}
                    value={option.slug}
                    checked={selected.includes(option.slug)}
                    onSelect={() =>
                      replaceInFamily(group, selected.includes(option.slug) ? null : option.slug)
                    }
                    caption={priceCaption(option.monthlyPrice[term], baseline, option.included)}
                    title={option.label}
                  />
                ))}
              </div>
            ) : (
              <div
                role="radiogroup"
                aria-label={group.label}
                className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
              >
                {group.mandatory ? null : (
                  <ChoiceRadio
                    name={`addon-${group.family}`}
                    value={NONE}
                    checked={chosen === undefined}
                    onSelect={() => replaceInFamily(group, null)}
                    caption="Sin coste"
                    title="No lo necesito"
                  />
                )}
                {options.map((option) => (
                  <ChoiceRadio
                    key={option.slug}
                    name={`addon-${group.family}`}
                    value={option.slug}
                    checked={
                      option.included ? chosen === undefined : selected.includes(option.slug)
                    }
                    onSelect={() => replaceInFamily(group, option.included ? null : option.slug)}
                    caption={priceCaption(option.monthlyPrice[term], baseline, option.included)}
                    title={option.label}
                  />
                ))}
              </div>
            )}
          </fieldset>
        )
      })}
    </div>
  )
}
