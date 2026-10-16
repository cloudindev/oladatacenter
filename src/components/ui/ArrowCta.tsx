"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

// ─── 1. Interfaces ──────────────────────────────────────────────────────────
export interface ArrowCtaProps {
  href: string
  children: React.ReactNode
  /** dark: charcoal slab + mint chip (default). light: white slab + charcoal chip. */
  variant?: "dark" | "light"
  size?: "md" | "lg"
  className?: string
}

// ─── 2. Styles (design tokens only) ─────────────────────────────────────────
const SLAB = {
  dark: "bg-bg-dark text-text-dark",
  light: "bg-surface-light text-text-base",
} as const

const CHIP = {
  dark: "bg-primary text-bg-dark",
  light: "bg-bg-dark text-primary",
} as const

const HEIGHT = { md: "h-10", lg: "h-12" } as const
const CHIP_SIZE = { md: "w-10", lg: "w-12" } as const

// Slanted right edge on the slab, like integratedbio.com's "DISCOVER OUR COMPANY".
const SLANT: React.CSSProperties = {
  clipPath: "polygon(0 0, 100% 0, calc(100% - 8px) 100%, 0 100%)",
}

// ─── 3/4. Component + render ────────────────────────────────────────────────
/**
 * IntegratedBio-style call to action: a mono-uppercase slab with a slanted
 * edge followed by a detached square arrow chip. On hover the chip slides
 * right and the arrow nudges. Pure CSS transitions — no JS cost per frame.
 */
export function ArrowCta({ href, children, variant = "dark", size = "md", className }: ArrowCtaProps) {
  return (
    <Link href={href} className={cn("group inline-flex items-stretch gap-1", HEIGHT[size], className)}>
      <span
        style={SLANT}
        className={cn(
          "label-mono flex items-center pl-5 pr-7 rounded-l-md transition-colors duration-300",
          SLAB[variant]
        )}
      >
        {children}
      </span>
      <span
        aria-hidden
        className={cn(
          "flex items-center justify-center rounded-md -ml-2 transition-transform duration-300 ease-out group-hover:translate-x-1",
          CHIP[variant],
          CHIP_SIZE[size]
        )}
      >
        <svg className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      </span>
    </Link>
  )
}

/*
 * ─── 5. Memoria ─────────────────────────────────────────────────────────────
 * Por qué: el CTA de integratedbio.com (bloque oscuro con borde inclinado +
 * chip menta separado) se repite en hero, header y secciones; centralizarlo
 * evita divergencias visuales.
 * Edge cases:
 *  - El clip-path recorta 8px del borde derecho, por eso pr-7 > pl-5 para que
 *    el texto quede ópticamente centrado.
 *  - El chip usa -ml-2 para encajar en el hueco del corte inclinado.
 *  - Contraste: menta #cef79e sobre charcoal #222f30 ≈ 11:1 (AAA).
 */
