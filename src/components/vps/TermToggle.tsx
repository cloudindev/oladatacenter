"use client"

/**
 * Monthly / annual switch. Controlled: the parent owns the term, because the same value
 * drives the prices, the summary and the shareable URL.
 */
import { TERM_LABELS, TERMS, type Term } from "@ola/core"
import { cn } from "@/lib/utils"

export function TermToggle({
  term,
  onChange,
  savingPercent,
  className,
}: {
  term: Term
  onChange: (term: Term) => void
  /** Shown on the annual option, e.g. 11 for "ahorra 11 %". */
  savingPercent?: number
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label="Periodo de facturación"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-bg-dark/12 bg-surface-light p-1",
        className,
      )}
    >
      {TERMS.map((candidate) => {
        const active = candidate === term
        const showSaving = candidate === "P12M" && savingPercent !== undefined && savingPercent > 0
        return (
          <button
            key={candidate}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(candidate)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-2 font-mono text-[11px] uppercase tracking-[0.06em] transition-colors",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink",
              active
                ? "bg-bg-dark text-text-dark"
                : "text-text-base hover:bg-surface-beige",
            )}
          >
            {TERM_LABELS[candidate]}
            {showSaving ? (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] tracking-[0.04em]",
                  active ? "bg-primary text-bg-dark" : "bg-primary/60 text-bg-dark",
                )}
              >
                −{savingPercent} %
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
