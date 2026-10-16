"use client"

import * as React from "react"
import Link from "next/link"

// ─── 1. Interfaces ──────────────────────────────────────────────────────────
export interface ArrowCtaProps {
  href: string
  children: React.ReactNode
  /** dark: bloque oscuro + chip menta (por defecto). light: bloque blanco + chip oscuro. */
  variant?: "dark" | "light"
  className?: string
}

// ─── 2. Styles ──────────────────────────────────────────────────────────────
// Todo el estilo y la animación viven en globals.css (`.ola-btn*`), porque
// dependen de pseudo-elementos (::before con la flecha) y de `fill` de SVG,
// que no se pueden expresar bien con utilidades de Tailwind.

// ─── 3/4. Component + render ────────────────────────────────────────────────
/**
 * CTA con flecha: réplica de `.u-btn--1` de integratedbio.com.
 * Rendimiento: solo se animan transform, background-position, fill y color
 * (sin layout thrash); no hay JS por frame.
 * A11y: los SVG son decorativos (aria-hidden) y el foco por teclado dispara
 * la misma animación que el hover (:focus-visible).
 */
export function ArrowCta({ href, children, variant = "dark", className }: ArrowCtaProps) {
  return (
    <Link href={href} data-variant={variant} className={["ola-btn", className].filter(Boolean).join(" ")}>
      <span className="ola-btn__label">
        {children}
        {/* Esquina curva que "cose" el bloque con el chip */}
        <span className="ola-btn__corner" aria-hidden>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="48" fill="none" viewBox="0 0 18 48" preserveAspectRatio="none">
            <path d="M0 0h5.63c7.808 0 13.536 7.337 11.642 14.91l-6.09 24.359A11.527 11.527 0 0 1 0 48V0Z" />
          </svg>
        </span>
      </span>
      {/* Chip trapecio; la flecha se pinta con ::before */}
      <i className="ola-btn__icon" aria-hidden>
        <svg xmlns="http://www.w3.org/2000/svg" width="51" height="48" fill="none" viewBox="0 0 51 48" preserveAspectRatio="none">
          <path d="M6.728 9.09A12 12 0 0 1 18.369 0H39c6.627 0 12 5.373 12 12v24c0 6.627-5.373 12-12 12H12.37C4.561 48-1.167 40.663.727 33.09l6-24Z" />
        </svg>
      </i>
    </Link>
  )
}

/*
 * ─── 5. Memoria ─────────────────────────────────────────────────────────────
 * Por qué: la primera versión era una aproximación (chip desplazándose con
 * `ease`). La real usa formas SVG, una curva cubic-bezier(.25,1,.5,1) de 0.6s
 * y un intercambio de flechas por background-position; aquí se replica 1:1 a
 * partir del CSS publicado en integratedbio.com.
 * Edge cases:
 *  - El label usa margin-right 16px (12px en hover) para dejar sitio a la
 *    esquina absoluta (right:-16px); no quitar o se solapa con el chip.
 *  - preserveAspectRatio="none" evita que el SVG se centre si cambia la altura.
 *  - Lección aprendida: copiar el CSS real del sitio de referencia en lugar de
 *    aproximar el efecto "a ojo".
 */
