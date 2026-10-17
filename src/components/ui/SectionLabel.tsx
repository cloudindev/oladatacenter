import * as React from "react"
import { cn } from "@/lib/utils"

// ─── Interfaces ─────────────────────────────────────────────────────────────
interface SectionLabelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

// ─── Component ──────────────────────────────────────────────────────────────
/**
 * Section eyebrow in the integratedbio.com style: small lime square + Roboto
 * Mono uppercase text ("■ THE INTEGRATED PLATFORM").
 * Default colour is `accent-ink` (readable on light backgrounds); on dark
 * sections pass `className="text-primary"`.
 */
export function SectionLabel({ children, className, ...props }: SectionLabelProps) {
  return (
    <div className={cn("label-mono text-accent-ink flex items-center gap-2.5 mb-4", className)} {...props}>
      <span aria-hidden className="w-2 h-2 bg-primary-hover shrink-0" />
      {children}
    </div>
  )
}

/*
 * ─── Memoria ────────────────────────────────────────────────────────────────
 * Por qué: el punto pulsante anterior era estilo "neón"; IntegratedBio usa un
 * cuadrado sólido lima, estático y más sobrio.
 * Edge cases: el cuadrado usa siempre lima (#00B8D4) — es visible tanto sobre
 * off-white como sobre charcoal, así no depende del color del texto.
 */
