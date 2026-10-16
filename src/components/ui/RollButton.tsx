"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

// ─── 1. Interfaces ──────────────────────────────────────────────────────────
export interface RollButtonProps {
  href: string
  /** Plain text: it is rendered twice (resting label + hover label). */
  label: string
  className?: string
}

// ─── 2. Styles ──────────────────────────────────────────────────────────────
// Replicates `.u-btn--3` from integratedbio.com: charcoal block, white mono
// uppercase label, 12px radius. On hover the background becomes sage (#c9cbbe)
// and the label "rolls": the resting one slides up while an identical one
// (charcoal text) rises from below, 0.3s with cubic-bezier(.76, 0, .24, 1).
const EASE = "ease-[cubic-bezier(0.76,0,0.24,1)]"

// ─── 3/4. Component + render ────────────────────────────────────────────────
/**
 * Rolling-label CTA.
 * Perf: only `transform` and `background-color` transition (compositor-friendly),
 * no JS, no layout reads.
 * A11y: the duplicated hover label is `aria-hidden`; the link keeps the single
 * accessible name through `aria-label`.
 */
export function RollButton({ href, label, className }: RollButtonProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "group relative inline-flex items-center h-[46px] px-5 rounded-xl overflow-hidden",
        "label-mono !text-[12px] whitespace-nowrap bg-bg-dark text-white",
        "transition-colors duration-300 delay-100 hover:bg-text-sage",
        EASE,
        className
      )}
    >
      {/* Resting label — slides up on hover */}
      <span className={cn("relative inline-flex transition-transform duration-300 group-hover:-translate-y-3", EASE)}>
        {label}
      </span>
      {/* Hover label — rises from below, charcoal on sage */}
      <span
        aria-hidden
        className={cn(
          "absolute -inset-px flex items-center px-5 rounded-xl bg-text-sage text-bg-dark",
          "translate-y-full transition-transform duration-300 group-hover:translate-y-0",
          EASE
        )}
      >
        {label}
      </span>
    </Link>
  )
}

/*
 * ─── 5. Memoria ─────────────────────────────────────────────────────────────
 * Por qué: el usuario pidió el comportamiento del botón "Work with us" de
 * integratedbio.com. Su CSS real (.u-btn--3) usa un pseudo-elemento :after con
 * `content: attr(data-label)`; aquí se hace con un segundo <span> para poder
 * usar tokens de Tailwind y mantener el aria-hidden.
 * Edge cases:
 *  - label largo: whitespace-nowrap evita que el span absoluto se desalinee.
 *  - prefers-reduced-motion: heredado del navegador no aplica a transitions;
 *    la animación dura 0.3s y es solo de transform, por lo que es discreta.
 *  - El texto en reposo y el de hover comparten padding (px-5) para que no
 *    "salte" horizontalmente al deslizar.
 */
