"use client"

/**
 * IntegratedPlatformSection — Réplica 1:1 de `.c-hgroup` + `.c-usp-cards` de integratedbio.com
 *
 * Estructura y animaciones extraídas directamente de:
 *  - `text-reveal.BAzZnHIM.js`: cada palabra del titular se envuelve en `.text-reveal-word`
 *    con un `.text-reveal-overlay` (`background-color: currentColor; transform-origin: bottom; scaleY(1)`).
 *    Al entrar al viewport (`top 80%`), las cortinas hacen `scaleY: 1 → 0` en `0.8s` con curva
 *    `expo.out` (`cubic-bezier(0.16, 1, 0.3, 1)`) y `stagger: 0.1s` por palabra.
 *  - `blocks.lZcM2_hG.js` (`inview`): los elementos `.inview-element` (pastilla lateral, párrafo y CTA)
 *    entran con `opacity: 0 → 1, translateY(20px → 0)` en `0.8s` con curva `power2.out` y `stagger: 0.05s`.
 *  - `usp-cards.js`: las 3 tarjetas inferiores se revelan de izquierda a derecha con
 *    `clip-path: polygon(0 0, 0% 0, 0% 100%, 0% 100%) → polygon(0 0, 100% 0, 100% 100%, 0% 100%)`
 *    (`1s`, `expo.out`, `stagger: 0.15s`), y tras `0.6s` de delay entran sus elementos internos
 *    (`card_index`, `card_icon`, `card_heading`, `card_text`) con `0.6s`, `power2.out` y `stagger: 0.2s`.
 */

import React, { useEffect, useRef, useState } from "react"
import { useLanguage } from "@/context/LanguageContext"
import { ArrowCta } from "@/components/ui/ArrowCta"
import { cn } from "@/lib/utils"

// ─── 1. Interfaces ──────────────────────────────────────────────────────────
interface WordDef {
  text: string
  muted?: boolean
}

interface UspCardDef {
  index: string
  bgClass: string
  textClass: string
  headingEn: string
  headingEs: string
  bodyEn: string
  bodyEs: string
  icon: React.ReactNode
}

// ─── 2. Constants & SVG Icons ───────────────────────────────────────────────
const CARDS: UspCardDef[] = [
  {
    index: "01.",
    bgClass: "bg-primary",
    textClass: "text-bg-dark",
    headingEn: "Green Edge Colocation",
    headingEs: "Colocation Edge Verde",
    bodyEn:
      "Tier-grade facilities powered by 100% renewable energy with ultra-low latency across Europe.",
    bodyEs:
      "Instalaciones de alta disponibilidad con energía 100% renovable y latencia ultrabaja.",
    icon: (
      <svg viewBox="0 0 114 114" fill="none" className="w-[68px] h-[68px] lg:w-[114px] lg:h-[114px]">
        {Array.from({ length: 24 }).map((_, i) => {
          const angle = (i * 15 * Math.PI) / 180
          const x1 = 57 + Math.cos(angle) * 16
          const y1 = 57 + Math.sin(angle) * 16
          const x2 = 57 + Math.cos(angle) * 52
          const y2 = 57 + Math.sin(angle) * 52
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="currentColor"
              strokeWidth="1.2"
            />
          )
        })}
      </svg>
    ),
  },
  {
    index: "02.",
    bgClass: "bg-bg-dark",
    textClass: "text-text-dark",
    headingEn: "Cloud & Bare Metal",
    headingEs: "Cloud y Bare Metal",
    bodyEn:
      "Dedicated single-tenant hardware and virtualized cloud nodes deployed in minutes with full data residency.",
    bodyEs:
      "Servidores dedicados y nodos cloud desplegados en minutos con total soberanía de tus datos.",
    icon: (
      <svg viewBox="0 0 114 114" fill="none" className="w-[68px] h-[68px] lg:w-[114px] lg:h-[114px]">
        {[48, 39, 30, 21, 12].map((r, i) => (
          <polygon
            key={i}
            points={[0, 1, 2, 3, 4, 5]
              .map((k) => {
                const a = ((k * 60 - 90) * Math.PI) / 180
                return `${57 + Math.cos(a) * r},${57 + Math.sin(a) * r}`
              })
              .join(" ")}
            stroke="currentColor"
            strokeWidth="1.2"
          />
        ))}
      </svg>
    ),
  },
  {
    index: "03.",
    bgClass: "bg-surface-beige",
    textClass: "text-bg-dark",
    headingEn: "High-Density AI Clusters",
    headingEs: "Clústeres de IA de Alta Densidad",
    bodyEn:
      "Next-generation GPU infrastructure and liquid-ready racks engineered to train and serve AI models at scale.",
    bodyEs:
      "Infraestructura GPU de nueva generación diseñada para entrenar y desplegar modelos de IA a escala.",
    icon: (
      <svg viewBox="0 0 114 114" fill="none" className="w-[68px] h-[68px] lg:w-[114px] lg:h-[114px]">
        {[0, 1, 2].map((layer) => {
          const offset = (layer - 1) * 14
          const r = 34
          const pts = [0, 1, 2, 3, 4, 5].map((k) => {
            const a = ((k * 60 - 90) * Math.PI) / 180
            return [57 + Math.cos(a) * r, 57 + offset + Math.sin(a) * (r * 0.55)] as const
          })
          return (
            <g key={layer}>
              <polygon
                points={pts.map(([x, y]) => `${x},${y}`).join(" ")}
                stroke="currentColor"
                strokeWidth="1.15"
              />
              {pts.map(([x, y], idx) => (
                <line
                  key={idx}
                  x1={57}
                  y1={57 + offset}
                  x2={x}
                  y2={y}
                  stroke="currentColor"
                  strokeWidth="0.9"
                  opacity="0.65"
                />
              ))}
            </g>
          )
        })}
      </svg>
    ),
  },
]

// ─── 3. Component Logic ─────────────────────────────────────────────────────
export function IntegratedPlatformSection() {
  const { lang, t } = useLanguage()
  const hgroupRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const cardsRef = useRef<HTMLDivElement>(null)

  const [hgroupInView, setHgroupInView] = useState(false)
  const [headingRevealed, setHeadingRevealed] = useState(false)
  const [cardsRevealed, setCardsRevealed] = useState(false)

  const words: WordDef[] =
    lang === "es"
      ? [
          { text: "La" },
          { text: "soberanía" },
          { text: "y" },
          { text: "seguridad" },
          { text: "de" },
          { text: "tus" },
          { text: "datos" },
          { text: "en" },
          { text: "una" },
          { text: "infraestructura" },
          { text: "de" },
          { text: "centro" },
          { text: "de" },
          { text: "datos" },
          { text: "privada" },
          { text: "que", muted: true },
          { text: "satisface", muted: true },
          { text: "sus", muted: true },
          { text: "necesidades", muted: true },
          { text: "locales.", muted: true },
        ]
      : [
          { text: "Data" },
          { text: "sovereignty" },
          { text: "and" },
          { text: "security" },
          { text: "in" },
          { text: "a" },
          { text: "private" },
          { text: "datacenter" },
          { text: "infrastructure" },
          { text: "that", muted: true },
          { text: "meets", muted: true },
          { text: "your", muted: true },
          { text: "local", muted: true },
          { text: "needs.", muted: true },
        ]

  /**
   * Dispara las animaciones exactamente como ScrollTrigger (`start: "top 80%", once: true`):
   * rootMargin "0px 0px -20% 0px" activa cuando el top del elemento cruza el 80% de la ventana.
   */
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduced) {
      setHgroupInView(true)
      setHeadingRevealed(true)
      setCardsRevealed(true)
      return
    }

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          if (entry.target === hgroupRef.current) {
            setHgroupInView(true)
          } else if (entry.target === headingRef.current) {
            setHeadingRevealed(true)
          } else if (entry.target === cardsRef.current) {
            setCardsRevealed(true)
          }
          obs.unobserve(entry.target)
        })
      },
      { threshold: 0, rootMargin: "0px 0px -20% 0px" }
    )

    if (hgroupRef.current) obs.observe(hgroupRef.current)
    if (headingRef.current) obs.observe(headingRef.current)
    if (cardsRef.current) obs.observe(cardsRef.current)

    return () => obs.disconnect()
  }, [])

  // ─── 4. Render ────────────────────────────────────────────────────────────
  return (
    <section className="bg-bg-light text-text-base overflow-hidden">
      {/* Parte 1: c-hgroup (2 columnas 1fr / 2fr con corchetes superiores y text-reveal por palabra) */}
      <div
        ref={hgroupRef}
        className="max-w-[1600px] mx-auto px-6 md:px-[44px] pt-[clamp(60px,calc(25px+8.33vw),160px)] pb-[clamp(60px,calc(33.75px+6.25vw),135px)] grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-y-11 lg:gap-x-10 items-start"
      >
        {/* Columna izquierda: pastilla `.u-ts--1` con corchete superior */}
        <aside className="relative w-full pt-12 before:content-[''] before:absolute before:top-0 before:left-0 before:w-full before:h-3 before:rounded-t-[8px] before:border-t before:border-l before:border-r before:border-bg-dark/10">
          <div
            className={cn(
              "inline-flex items-center bg-surface-light text-text-base rounded-[8px] py-2 pl-2 pr-3 font-mono uppercase text-[12px] leading-none tracking-[0.02em] shadow-[0_1px_2px_rgba(10,15,28,0.04)]",
              "transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)]",
              hgroupInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
            )}
          >
            <span aria-hidden className="w-2.5 h-2.5 bg-primary-hover mr-3 shrink-0" />
            {t("THE INTEGRATED PLATFORM", "LA PLATAFORMA INTEGRADA")}
          </div>
        </aside>

        {/* Columna derecha: titular con cortina por palabra + párrafo + CTA */}
        <div className="relative w-full lg:pt-12 flex flex-col items-start gap-y-[clamp(20px,calc(20px+0.04*(100vw-440px)),60px)] lg:before:content-[''] lg:before:absolute lg:before:top-0 lg:before:left-0 lg:before:w-full lg:before:h-3 lg:before:rounded-t-[8px] lg:before:border-t lg:before:border-l lg:before:border-r lg:before:border-bg-dark/10">
          <h2
            ref={headingRef}
            className="text-[clamp(1.75rem,calc(1.625rem+0.05*(100vw-27.5rem)),4.75rem)] font-normal tracking-[-0.02em] leading-[1.1] text-balance"
          >
            {words.map((w, idx) => (
              <React.Fragment key={idx}>
                <span
                  className={cn(
                    "relative inline-block overflow-hidden align-bottom",
                    w.muted ? "text-[#c9cbbe]" : "text-text-base"
                  )}
                  style={{ clipPath: "inset(-0.1em)" }}
                >
                  {w.text}
                  {/* Cortina `.text-reveal-overlay` idéntica a integratedbio.com */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-[0.12em] bottom-[-0.12em] bg-current origin-bottom transition-transform duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
                    style={{
                      transform: headingRevealed ? "scaleY(0)" : "scaleY(1)",
                      transitionDelay: `${idx * 95}ms`,
                    }}
                  />
                </span>{" "}
              </React.Fragment>
            ))}
          </h2>

          <p
            className={cn(
              "text-[clamp(1rem,calc(1rem+0.003*(100vw-27.5rem)),1.1875rem)] text-text-base/80 tracking-[-0.02em] leading-[1.35] max-w-[790px]",
              "transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)] delay-[150ms]",
              hgroupInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
            )}
          >
            {t(
              "Data center that satisfies your local needs, with renewable energy, ultra-low-latency fiber connectivity, and high-density GPU clusters that transform your company's compute and storage. Our data center includes redundancy mechanisms, high availability, and the maximum reliability of infrastructure and services.",
              "Centro de datos que satisface sus necesidades locales, con energía renovable, conectividad de fibra de ultrabaja latencia y clústeres GPU de alta densidad que transforman el cómputo y almacenamiento de tu empresa. Nuestro centro de datos incluye mecanismos de redundancia, alta disponibilidad y la máxima fiabilidad de infraestructuras y servicios."
            )}
          </p>

          <div
            className={cn(
              "transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)] delay-[240ms]",
              hgroupInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
            )}
          >
            <ArrowCta href="/company/about">
              {t("DISCOVER OUR COMPANY", "DESCUBRE NUESTRA EMPRESA")}
            </ArrowCta>
          </div>
        </div>
      </div>

      {/* Parte 2: c-usp-cards (3 tarjetas a sangre con wipe clip-path horizontal y entrada escalonada) */}
      <div ref={cardsRef} className="w-full grid grid-cols-1 lg:grid-cols-3">
        {CARDS.map((card, cardIdx) => {
          const cardDelayMs = cardIdx * 150
          const contentBaseMs = 600 + cardIdx * 150
          return (
            <div
              key={card.index}
              className={cn(
                "relative flex flex-col justify-between min-h-[280px] lg:min-h-[420px] p-6 lg:p-10 overflow-hidden",
                "transition-[clip-path] duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
                card.bgClass,
                card.textClass
              )}
              style={{
                clipPath: cardsRevealed
                  ? "polygon(0 0, 100% 0, 100% 100%, 0% 100%)"
                  : "polygon(0 0, 0% 0, 0% 100%, 0% 100%)",
                transitionDelay: `${cardDelayMs}ms`,
              }}
            >
              {/* Índice en esquina superior derecha (`01.`, `02.`, `03.`) */}
              <div
                className={cn(
                  "absolute top-6 right-6 lg:top-10 lg:right-10 font-mono text-[13px] tracking-[-0.02em] leading-none uppercase",
                  "transition-all duration-[600ms] ease-[cubic-bezier(0.25,1,0.5,1)]",
                  cardsRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
                )}
                style={{ transitionDelay: `${contentBaseMs}ms` }}
              >
                {card.index}
              </div>

              {/* Icono geométrico vectorial */}
              <div
                className={cn(
                  "flex items-start justify-start",
                  "transition-all duration-[600ms] ease-[cubic-bezier(0.25,1,0.5,1)]",
                  cardsRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
                )}
                style={{ transitionDelay: `${contentBaseMs + 160}ms` }}
              >
                {card.icon}
              </div>

              {/* Título y descripción */}
              <div className="flex flex-col gap-4 mt-10">
                <h3
                  className={cn(
                    "text-[clamp(1.625rem,calc(1.625rem+0.002*(100vw-27.5rem)),1.75rem)] font-normal tracking-[-0.02em] leading-[1.1]",
                    "transition-all duration-[600ms] ease-[cubic-bezier(0.25,1,0.5,1)]",
                    cardsRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
                  )}
                  style={{ transitionDelay: `${contentBaseMs + 320}ms` }}
                >
                  {t(card.headingEn, card.headingEs)}
                </h3>
                <p
                  className={cn(
                    "text-[clamp(1rem,calc(1rem+0.003*(100vw-27.5rem)),1.1875rem)] tracking-[-0.02em] leading-[1.3] opacity-75",
                    "transition-all duration-[600ms] ease-[cubic-bezier(0.25,1,0.5,1)]",
                    cardsRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
                  )}
                  style={{ transitionDelay: `${contentBaseMs + 480}ms` }}
                >
                  {t(card.bodyEn, card.bodyEs)}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/*
 * ─── 5. Memoria ─────────────────────────────────────────────────────────────
 * Por qué: el usuario pidió replicar después del hero la sección de integratedbio.com
 * (su primera captura) junto con su animación de entrada por scroll exacta.
 * Se inspeccionó `text-reveal.BAzZnHIM.js`, `hgroup.css`, `usp-cards.css` y `usp-cards.js`
 * de integratedbio.com y se replicó sin depender de GSAP SplitText de pago:
 *  - Cada palabra lleva una cortina `bg-current` con `transform-origin: bottom` que pasa
 *    de `scaleY(1)` a `scaleY(0)` con `cubic-bezier(0.16,1,0.3,1)` (`expo.out`) y stagger.
 *  - Los bloques secundarios suben `20px` con `opacity: 0 → 1`.
 *  - Las 3 tarjetas hacen el barrido `clip-path` horizontal de izquierda a derecha.
 * Edge cases:
 *  - `prefers-reduced-motion: reduce`: muestra todos los textos y tarjetas directamente
 *    sin cortinas ni desplazamientos.
 *  - Cambio de idioma EN/ES: las palabras se recalculan limpiamente manteniendo el estado
 *    ya revelado si la sección ya entró en pantalla.
 */
