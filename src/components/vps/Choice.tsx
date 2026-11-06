"use client"

/**
 * The two primitives every picker in the configurator is built from.
 *
 * They are native radios and checkboxes with a visually hidden input, so arrow-key
 * navigation, focus order and screen-reader semantics come for free. Only the painted
 * surface is ours.
 */
import * as React from "react"
import { cn } from "@/lib/utils"

const SURFACE = cn(
  "flex h-full flex-col gap-1 rounded-[14px] border border-bg-dark/12 bg-surface-light p-4",
  "transition-colors hover:border-bg-dark/35",
  "peer-checked:border-primary-hover peer-checked:bg-primary peer-checked:text-bg-dark",
  "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
  "peer-focus-visible:outline-accent-ink",
  "peer-disabled:cursor-not-allowed peer-disabled:border-dashed peer-disabled:opacity-50",
  "peer-disabled:hover:border-bg-dark/12",
)

export interface ChoiceProps {
  name: string
  value: string
  checked: boolean
  onSelect: (value: string) => void
  disabled?: boolean
  /** Main line, e.g. "Gravelines, Francia". */
  title: string
  /** Mono caption above the title, e.g. "FRANCIA" or "+ 1,01 € / MES". */
  caption?: string
  /** Small sentence under the title. */
  note?: string
  className?: string
}

export function ChoiceRadio({
  name,
  value,
  checked,
  onSelect,
  disabled = false,
  title,
  caption,
  note,
  className,
}: ChoiceProps) {
  return (
    <label className={cn("relative block", disabled ? "cursor-not-allowed" : "cursor-pointer", className)}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onSelect(value)}
        className="peer sr-only"
      />
      <span className={SURFACE}>
        {caption ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.06em] opacity-60">
            {caption}
          </span>
        ) : null}
        <span className="text-[15px] leading-snug">{title}</span>
        {note ? <span className="text-[12.5px] leading-snug opacity-65">{note}</span> : null}
      </span>
    </label>
  )
}

export function ChoiceCheckbox({
  name,
  value,
  checked,
  onSelect,
  disabled = false,
  title,
  caption,
  note,
  className,
}: ChoiceProps) {
  return (
    <label className={cn("relative block", disabled ? "cursor-not-allowed" : "cursor-pointer", className)}>
      <input
        type="checkbox"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onSelect(value)}
        className="peer sr-only"
      />
      <span className={SURFACE}>
        {caption ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.06em] opacity-60">
            {caption}
          </span>
        ) : null}
        <span className="text-[15px] leading-snug">{title}</span>
        {note ? <span className="text-[12.5px] leading-snug opacity-65">{note}</span> : null}
      </span>
    </label>
  )
}

/** Mono uppercase step heading: "02 · Centro de datos". */
export function StepHeading({
  index,
  title,
  hint,
  children,
}: {
  index: string
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="border-t border-bg-dark/12 pt-8">
      <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-accent-ink">
          {index}
        </span>
        <h2 className="text-[21px] font-normal tracking-[-0.02em]">{title}</h2>
        {hint ? <p className="text-[13px] text-text-muted">{hint}</p> : null}
      </div>
      {children}
    </section>
  )
}
