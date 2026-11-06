"use client"

import { formatImageId, groupImages } from "./labels"
import { cn } from "@/lib/utils"

/**
 * The images this server can be reinstalled with, exactly as the provider lists them.
 *
 * `GET /vps/{serviceName}/images/available` returns identifiers and no display names,
 * so the identifier is tidied up for reading and the real value is what gets sent.
 * They are grouped by family to make a list of twenty-odd options navigable.
 */
export function ImagePicker({
  images,
  currentImage,
  value,
  onChange,
}: {
  images: readonly string[]
  currentImage: string | null
  value: string
  onChange: (imageId: string) => void
}) {
  const groups = groupImages(images)

  return (
    <fieldset>
      <legend className="label-mono text-text-muted mb-3">Sistema que se va a instalar</legend>
      <div className="space-y-5">
        {groups.map((group) => (
          <div key={group.family}>
            <p className="label-mono text-text-base mb-2">{group.family}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {group.images.map((imageId) => {
                const selected = value === imageId
                return (
                  <label
                    key={imageId}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors",
                      "focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent-ink",
                      selected
                        ? "border-accent-ink bg-surface-beige"
                        : "border-border-base hover:bg-surface-beige/60",
                    )}
                  >
                    <input
                      type="radio"
                      name="image"
                      value={imageId}
                      checked={selected}
                      onChange={() => onChange(imageId)}
                      className="mt-1 accent-[var(--ag-sys-color-accent-ink)]"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm text-text-base break-words">
                        {formatImageId(imageId)}
                      </span>
                      {currentImage && currentImage === imageId ? (
                        <span className="label-mono text-text-muted">instalado ahora</span>
                      ) : null}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </fieldset>
  )
}
