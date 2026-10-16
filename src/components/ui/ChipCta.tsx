"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

// ─── 1. Interfaces ──────────────────────────────────────────────────────────
export interface ChipCtaProps {
  href: string
  children: React.ReactNode
  className?: string
}

// ─── 2. Styles (design tokens only) ─────────────────────────────────────────
// Mismas proporciones que el botón del footer ("Contacta con un experto"),
// escaladas a 40px de alto para caber en la cápsula del menú (52px):
//  - chip = 32px (inset-y-1 sobre 40px), ancla derecha a 4px del borde
//  - al hover el chip crece hacia la izquierda hasta cubrir toda la cápsula
const CHIP_REST = "left-[calc(100%-36px)]"
const EASE = "ease-out"

// ─── 3/4. Component + render ────────────────────────────────────────────────
/**
 * CTA "chip expansible": cápsula oscura con borde y un chip claro con flecha a
 * la derecha. Hover/foco: el chip se expande a todo el botón y el texto pasa a
 * oscuro (420ms, solo `left` + `color`).
 * Rendimiento: transición CSS pura, sin JS ni lecturas de layout.
 * A11y: el chip es decorativo (aria-hidden); :focus-visible dispara el mismo
 * efecto que el hover.
 */
export function ChipCta({ href, children, className }: ChipCtaProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex items-center h-10 pl-5 pr-1 rounded-lg overflow-clip",
        "bg-bg-dark border border-white/10 focus-visible:outline-none",
        className
      )}
    >
      {/* Chip claro: en reposo es el cuadrado de la flecha; en hover llena el botón */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-1 right-1 rounded-md bg-bg-light transition-[left] duration-[420ms]",
          CHIP_REST,
          "group-hover:left-1 group-focus-visible:left-1",
          EASE
        )}
      />
      <span
        className={cn(
          "label-mono relative mr-6 whitespace-nowrap text-bg-light transition-colors duration-300",
          "group-hover:text-bg-dark group-focus-visible:text-bg-dark"
        )}
      >
        {children}
      </span>
      <span aria-hidden className="relative w-8 h-8 flex items-center justify-center text-bg-dark">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      </span>
    </Link>
  )
}

/*
 * ─── 5. Memoria ─────────────────────────────────────────────────────────────
 * Por qué: el usuario pidió para "Habla con nosotros" la animación del botón
 * del footer. Se extrae a un componente para no duplicar el markup.
 * Edge cases:
 *  - La flecha va en un contenedor de 32px que coincide con el chip en reposo
 *    (left = 100% - 36px, right = 4px → 32px de ancho); si cambias uno, cambia
 *    el otro o la flecha se desalinea.
 *  - El texto lleva z-order por `relative` para quedar sobre el chip expandido.
 *  - Sin `group-focus-visible` el teclado no vería el efecto: se añade explícito.
 *  - En reposo la flecha es oscura sobre chip claro; durante la expansión el
 *    chip pasa por debajo de la flecha, que sigue contrastando (oscura sobre claro).
 */
