"use client"

import * as React from "react"
import Link from "next/link"

// ─── 1. Interfaces ──────────────────────────────────────────────────────────
export interface ArrowCtaProps {
  href?: string
  type?: "button" | "submit"
  onClick?: React.MouseEventHandler<HTMLAnchorElement | HTMLButtonElement>
  children: React.ReactNode
  /** dark: bloque oscuro + chip menta (por defecto). light: bloque blanco + chip oscuro. */
  variant?: "dark" | "light"
  className?: string
}

type Pt = readonly [number, number]

// ─── 2. Shapes & morph engine ───────────────────────────────────────────────
/**
 * Formas exactas extraídas de app.js de integratedbio.com. Ellos las deforman
 * con GSAP MorphSVG (0.3s, power2.out): al hacer hover la inclinación oblicua
 * del bloque y del chip se INVIERTE ("/" → "\").
 */
const SHAPES = {
  text: {
    rest: "M0 0h5.63c7.808 0 13.536 7.337 11.642 14.91l-6.09 24.359A11.527 11.527 0 0 1 0 48V0Z",
    hover: "M0 0c5.29 0 9.9 3.6 11.183 8.731l6.09 24.359C19.165 40.663 13.437 48 5.63 48H0V0Z",
  },
  blob: {
    rest: "M6.728 9.09A12 12 0 0 1 18.369 0H39c6.627 0 12 5.373 12 12v24c0 6.627-5.373 12-12 12H12.37C4.561 48-1.167 40.663.727 33.09l6-24Z",
    hover: "M.728 14.91C-1.166 7.338 4.562 0 12.369 0H39c6.628 0 12 5.373 12 12v24c0 6.627-5.372 12-12 12H18.37a12 12 0 0 1-11.641-9.09l-6-24Z",
  },
} as const

const DURATION_MS = 300
const SAMPLES = 160 // puntos por contorno: suficiente para curvas suaves a 48px de alto
const SVG_NS = "http://www.w3.org/2000/svg"

/** power2.out de GSAP: 1 - (1 - t)^3 */
const easeOut = (t: number): number => 1 - Math.pow(1 - t, 3)

const sampleCache = new Map<string, Pt[]>()

/**
 * Muestrea un path SVG a puntos equiespaciados en longitud de arco.
 * Rendimiento: se calcula una sola vez por forma y se cachea a nivel de módulo
 * (los 4 paths se comparten entre todas las instancias del botón).
 */
function samplePath(d: string): Pt[] {
  const cached = sampleCache.get(d)
  if (cached) return cached
  const path = document.createElementNS(SVG_NS, "path")
  path.setAttribute("d", d)
  const length = path.getTotalLength()
  const pts: Pt[] = []
  for (let i = 0; i < SAMPLES; i++) {
    const p = path.getPointAtLength((length * i) / SAMPLES)
    pts.push([p.x, p.y])
  }
  sampleCache.set(d, pts)
  return pts
}

/** Interpola dos contornos muestreados y devuelve el atributo `d` resultante. */
function morphD(from: Pt[], to: Pt[], t: number): string {
  let d = ""
  for (let i = 0; i < from.length; i++) {
    const x = from[i][0] + (to[i][0] - from[i][0]) * t
    const y = from[i][1] + (to[i][1] - from[i][1]) * t
    d += `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`
  }
  return `${d}Z`
}

// ─── 3. Component logic ─────────────────────────────────────────────────────
/**
 * CTA con flecha: réplica de `.u-btn--1` de integratedbio.com.
 * CSS (globals.css `.ola-btn*`): colores, escala del chip, hueco y flechas.
 * JS (aquí): morph de la forma del bloque y del chip (inclinación invertida).
 *
 * Rendimiento: el morph solo corre 300ms por hover, mueve ~320 puntos por
 * frame y solo toca el atributo `d` de 2 paths; sin GSAP (~70KB menos).
 * A11y: SVG decorativos (aria-hidden); foco por teclado = mismo efecto que hover.
 */
export function ArrowCta({
  href,
  type = "submit",
  onClick,
  children,
  variant = "dark",
  className,
}: ArrowCtaProps) {
  const textPath = React.useRef<SVGPathElement>(null)
  const blobPath = React.useRef<SVGPathElement>(null)
  const progress = React.useRef(0) // 0 = reposo, 1 = hover (lineal; el easing se aplica al pintar)
  const raf = React.useRef(0)

  const paint = React.useCallback((u: number): void => {
    const text = textPath.current
    const blob = blobPath.current
    if (!text || !blob) return
    if (u <= 0) {
      text.setAttribute("d", SHAPES.text.rest)
      blob.setAttribute("d", SHAPES.blob.rest)
    } else if (u >= 1) {
      text.setAttribute("d", SHAPES.text.hover)
      blob.setAttribute("d", SHAPES.blob.hover)
    } else {
      const e = easeOut(u)
      text.setAttribute("d", morphD(samplePath(SHAPES.text.rest), samplePath(SHAPES.text.hover), e))
      blob.setAttribute("d", morphD(samplePath(SHAPES.blob.rest), samplePath(SHAPES.blob.hover), e))
    }
  }, [])

  const animateTo = React.useCallback(
    (target: 0 | 1): void => {
      cancelAnimationFrame(raf.current)
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        progress.current = target
        paint(target)
        return
      }
      const startU = progress.current
      const startT = performance.now()
      const span = Math.abs(target - startU) * DURATION_MS
      if (span === 0) return
      const tick = (now: number): void => {
        const k = Math.min((now - startT) / span, 1)
        const u = startU + (target - startU) * k
        progress.current = u
        paint(u)
        if (k < 1) raf.current = requestAnimationFrame(tick)
      }
      raf.current = requestAnimationFrame(tick)
    },
    [paint]
  )

  React.useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const innerContent = (
    <>
      <span className="ola-btn__label">
        {children}
        {/* Esquina que "cose" el bloque con el chip */}
        <span className="ola-btn__corner" aria-hidden>
          <svg xmlns={SVG_NS} width="18" height="48" fill="none" viewBox="0 0 18 48" preserveAspectRatio="none">
            <path ref={textPath} d={SHAPES.text.rest} />
          </svg>
        </span>
      </span>
      {/* Chip; la flecha se pinta con ::before (ver globals.css) */}
      <i className="ola-btn__icon" aria-hidden>
        <svg xmlns={SVG_NS} width="51" height="48" fill="none" viewBox="0 0 51 48" preserveAspectRatio="none">
          <path ref={blobPath} d={SHAPES.blob.rest} />
        </svg>
      </i>
    </>
  )

  const sharedClassName = ["ola-btn", className].filter(Boolean).join(" ")

  // ─── 4. Render ────────────────────────────────────────────────────────────
  if (!href) {
    return (
      <button
        type={type}
        onClick={onClick}
        data-variant={variant}
        className={sharedClassName}
        onMouseEnter={() => animateTo(1)}
        onMouseLeave={() => animateTo(0)}
        onFocus={() => animateTo(1)}
        onBlur={() => animateTo(0)}
      >
        {innerContent}
      </button>
    )
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      data-variant={variant}
      className={sharedClassName}
      onMouseEnter={() => animateTo(1)}
      onMouseLeave={() => animateTo(0)}
      onFocus={() => animateTo(1)}
      onBlur={() => animateTo(0)}
    >
      {innerContent}
    </Link>
  )
}

/*
 * ─── 5. Memoria ─────────────────────────────────────────────────────────────
 * Por qué: la 1ª versión solo replicaba el CSS; faltaba el morph de forma que
 * su JS aplica con GSAP MorphSVG. Sin GSAP, se muestrean ambos contornos a
 * puntos equiespaciados y se interpolan linealmente con power2.out.
 * Edge cases:
 *  - Ambos contornos se recorren en sentido horario y empiezan en puntos
 *    homólogos, por eso la correspondencia por longitud de arco es estable.
 *  - Interrumpir el hover a mitad: el progreso es continuo (`progress`), así
 *    que revierte desde la forma actual, sin saltos.
 *  - En reposo/final se pinta el `d` exacto original (no el polígono), por lo
 *    que las curvas quedan nítidas en pantallas retina.
 *  - prefers-reduced-motion: cambio instantáneo sin animar.
 *  - SSR: el HTML inicial trae las formas de reposo; el muestreo (usa DOM)
 *    solo ocurre en el primer hover.
 * Lección aprendida: antes de copiar una animación, leer también el JS del
 * sitio de referencia (no solo el CSS): el efecto puede ser de scripting.
 */
